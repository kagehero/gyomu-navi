import type { QueryRunner } from "typeorm";
import type { BillingRule } from "./business-type-rules";

/**
 * Direct port of Phase1 `frontend/src/lib/reports/auto-billing.ts`.
 * The only signature change: `PoolClient` → `QueryRunner` so it can run
 * inside a TypeORM transaction. `qr.query()` has the same `(sql, params)`
 * shape as `pgClient.query()` so the SQL is unchanged.
 */

export type StaffEntryInput = {
  client_id: string;
  site_id: string;
  business_type_id: string;
  count: number;
  vehicle_id?: string | null;
  line_memo?: Record<string, string> | null;
};

export type ExpandedEntry = StaffEntryInput & {
  auto_generated: boolean;
};

type AutoBillingContext = {
  work_date: string;
  business_line_id: string;
  session_id?: string | null;
};

type BusinessTypeMeta = {
  id: string;
  client_id: string;
  site_id: string | null;
  name: string;
  billing_rule: BillingRule | null;
  billing_trigger_substring: string | null;
};

type VehicleMeta = {
  id: string;
  client_id: string;
  surcharge_label: string | null;
};

async function loadBusinessTypes(
  qr: QueryRunner,
  ids: string[],
): Promise<Map<string, BusinessTypeMeta>> {
  if (ids.length === 0) return new Map();
  const rows: BusinessTypeMeta[] = await qr.query(
    `SELECT id, client_id, site_id, name, billing_rule, billing_trigger_substring
       FROM business_types
      WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function loadAutoBillingTypes(
  qr: QueryRunner,
  clientIds: string[],
): Promise<BusinessTypeMeta[]> {
  if (clientIds.length === 0) return [];
  const rows: BusinessTypeMeta[] = await qr.query(
    `SELECT id, client_id, site_id, name, billing_rule, billing_trigger_substring
       FROM business_types
      WHERE client_id = ANY($1::uuid[])
        AND deleted_at IS NULL
        AND staff_enterable = false
        AND billing_rule IS NOT NULL`,
    [clientIds],
  );
  return rows;
}

async function loadVehicles(
  qr: QueryRunner,
  vehicleIds: string[],
): Promise<Map<string, VehicleMeta>> {
  if (vehicleIds.length === 0) return new Map();
  const rows: VehicleMeta[] = await qr.query(
    `SELECT v.id, vl.client_id, v.surcharge_label
       FROM vehicles v
       JOIN vehicle_lists vl ON vl.id = v.vehicle_list_id
      WHERE v.id = ANY($1::uuid[])`,
    [vehicleIds],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function alreadyBilledToday(
  qr: QueryRunner,
  ctx: AutoBillingContext,
  clientId: string,
  siteId: string,
  businessTypeId: string,
): Promise<boolean> {
  const params: unknown[] = [ctx.work_date, clientId, siteId, businessTypeId];
  let sessionFilter = "";
  if (ctx.session_id) {
    params.push(ctx.session_id);
    sessionFilter = ` AND (r.session_id IS NULL OR r.session_id <> $${params.length})`;
  }
  const rows: Array<{ exists: boolean }> = await qr.query(
    `SELECT EXISTS (
       SELECT 1 FROM business_reports r
       JOIN report_sessions rs ON rs.id = r.session_id
      WHERE rs.work_date = $1::date
        AND r.client_id = $2
        AND r.site_id = $3
        AND r.business_type_id = $4
        AND r.auto_generated = true
        ${sessionFilter}
     ) AS exists`,
    params,
  );
  return rows[0]?.exists ?? false;
}

async function alreadyBilledThisMonth(
  qr: QueryRunner,
  ctx: AutoBillingContext,
  clientId: string,
  siteId: string,
  businessTypeId: string,
): Promise<boolean> {
  const monthStart = ctx.work_date.slice(0, 7) + "-01";
  const params: unknown[] = [monthStart, ctx.work_date, clientId, siteId, businessTypeId];
  let sessionFilter = "";
  if (ctx.session_id) {
    params.push(ctx.session_id);
    sessionFilter = ` AND (r.session_id IS NULL OR r.session_id <> $${params.length})`;
  }
  const rows: Array<{ exists: boolean }> = await qr.query(
    `SELECT EXISTS (
       SELECT 1 FROM business_reports r
       JOIN report_sessions rs ON rs.id = r.session_id
      WHERE rs.work_date >= $1::date
        AND rs.work_date <= $2::date
        AND r.client_id = $3
        AND r.site_id = $4
        AND r.business_type_id = $5
        AND r.auto_generated = true
        ${sessionFilter}
     ) AS exists`,
    params,
  );
  return rows[0]?.exists ?? false;
}

function pushAutoEntry(
  out: ExpandedEntry[],
  seen: Set<string>,
  entry: ExpandedEntry,
): void {
  const key = `${entry.client_id}:${entry.site_id}:${entry.business_type_id}:${entry.vehicle_id ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(entry);
}

/** Append auto-billed lines based on staff entries and Excel billing rules. */
export async function computeAutoBillingEntries(
  qr: QueryRunner,
  staffEntries: StaffEntryInput[],
  ctx: AutoBillingContext,
): Promise<ExpandedEntry[]> {
  if (staffEntries.length === 0) return [];

  const autoEntries: ExpandedEntry[] = [];
  const seen = new Set<string>();

  const staffBtIds = staffEntries.map((e) => e.business_type_id);
  const staffBtMap = await loadBusinessTypes(qr, staffBtIds);

  const clientIds = [...new Set(staffEntries.map((e) => e.client_id))];
  const autoTypes = await loadAutoBillingTypes(qr, clientIds);
  const autoByClient = new Map<string, BusinessTypeMeta[]>();
  for (const bt of autoTypes) {
    const list = autoByClient.get(bt.client_id) ?? [];
    list.push(bt);
    autoByClient.set(bt.client_id, list);
  }

  const vehicleIds = staffEntries.map((e) => e.vehicle_id).filter(Boolean) as string[];
  const vehicleMap = await loadVehicles(qr, vehicleIds);

  // 1) Per-vehicle surcharge + daily-once-per-area: group by surcharge label.
  const surchargeCounts = new Map<string, number>();
  for (const entry of staffEntries) {
    if (!entry.vehicle_id) continue;
    const vehicle = vehicleMap.get(entry.vehicle_id);
    if (!vehicle?.surcharge_label) continue;
    const key = `${entry.client_id}\x1f${entry.site_id}\x1f${vehicle.surcharge_label}`;
    surchargeCounts.set(key, (surchargeCounts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of surchargeCounts) {
    const [clientId, siteId, surchargeName] = key.split("\x1f");
    const clientAuto = autoByClient.get(clientId!) ?? [];
    const bt = clientAuto.find(
      (t) =>
        t.name === surchargeName &&
        (t.billing_rule === "per_vehicle_surcharge" ||
          t.billing_rule === "daily_once_per_area") &&
        (t.site_id === null || t.site_id === siteId),
    );
    if (!bt) continue;

    if (bt.billing_rule === "daily_once_per_area") {
      const billed = await alreadyBilledToday(qr, ctx, clientId!, siteId!, bt.id);
      if (billed) continue;
      pushAutoEntry(autoEntries, seen, {
        client_id: clientId!,
        site_id: siteId!,
        business_type_id: bt.id,
        count: 1,
        auto_generated: true,
      });
      continue;
    }

    pushAutoEntry(autoEntries, seen, {
      client_id: clientId!,
      site_id: siteId!,
      business_type_id: bt.id,
      count,
      auto_generated: true,
    });
  }

  // 2) Daily-once overhead: one row per (client, site).
  const siteKeys = new Set(staffEntries.map((e) => `${e.client_id}:${e.site_id}`));
  for (const siteKey of siteKeys) {
    const [clientId, siteId] = siteKey.split(":");
    const clientAuto = autoByClient.get(clientId!) ?? [];
    const overhead = clientAuto.filter(
      (t) =>
        t.billing_rule === "daily_once_overhead" &&
        (t.site_id === null || t.site_id === siteId),
    );
    for (const bt of overhead) {
      const billed = await alreadyBilledToday(qr, ctx, clientId!, siteId!, bt.id);
      if (billed) continue;
      pushAutoEntry(autoEntries, seen, {
        client_id: clientId!,
        site_id: siteId!,
        business_type_id: bt.id,
        count: 1,
        auto_generated: true,
      });
    }
  }

  // 3) Monthly-once: fire on names containing the trigger substring.
  for (const entry of staffEntries) {
    const bt = staffBtMap.get(entry.business_type_id);
    if (!bt) continue;
    const clientAuto = autoByClient.get(entry.client_id) ?? [];
    for (const autoBt of clientAuto) {
      if (autoBt.billing_rule !== "monthly_once") continue;
      const trigger = autoBt.billing_trigger_substring;
      if (!trigger || !bt.name.includes(trigger)) continue;
      const billed = await alreadyBilledThisMonth(
        qr,
        ctx,
        entry.client_id,
        entry.site_id,
        autoBt.id,
      );
      if (billed) continue;
      pushAutoEntry(autoEntries, seen, {
        client_id: entry.client_id,
        site_id: entry.site_id,
        business_type_id: autoBt.id,
        count: 1,
        auto_generated: true,
      });
    }
  }

  return autoEntries;
}
