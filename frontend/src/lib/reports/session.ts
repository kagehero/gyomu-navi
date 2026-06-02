import type { AuthedUser } from "@/lib/auth/guards";
import { AuthError } from "@/lib/auth/guards";
import type { PoolClient } from "pg";
import {
  employeeHasBusinessLine,
  employeeHasClient,
  visibleSiteIdsForClient,
} from "@/lib/reports/scoping";
import { todayJST } from "@/lib/dates";
import type { InputUnit, LineMemoField } from "@/lib/reports/business-type-rules";
import { validateLineMemoFields } from "@/lib/reports/business-type-rules";
import {
  computeAutoBillingEntries,
  type ExpandedEntry,
  type StaffEntryInput,
} from "@/lib/reports/auto-billing";

export type SessionEntryInput = StaffEntryInput & {
  auto_generated?: boolean;
};

export type CustomerBlockInput = {
  client_id: string;
  site_id?: string | null;
  entries: {
    business_type_id: string;
    count: number;
    vehicle_id?: string | null;
    line_memo?: Record<string, string> | null;
  }[];
};

export type CreateSessionInput = {
  work_date: string;
  business_line_id: string;
  memo?: string | null;
  customer_blocks: CustomerBlockInput[];
  staff_id?: string;
  session_id?: string | null;
};

type BusinessTypeRules = {
  client_id: string;
  site_id: string | null;
  business_line_id: string | null;
  name: string;
  input_unit: InputUnit;
  vehicle_select_mode: string | null;
  line_memo_fields: LineMemoField[];
  staff_enterable: boolean;
};

export function assertWorkDateNotFuture(workDate: string): void {
  if (workDate > todayJST()) {
    throw new AuthError(400, "未来の日付は選択できません");
  }
}

function assertCountForUnit(count: number, unit: InputUnit): void {
  if (count <= 0) {
    throw new AuthError(400, "数量は0より大きく入力してください");
  }
  if (unit === "count" && !Number.isInteger(count)) {
    throw new AuthError(400, "台数/回数は整数で入力してください");
  }
}

/** Resolve staff id for report submission. */
export function resolveSubmitStaffId(user: AuthedUser, staffId?: string): string {
  if (user.role === "admin") {
    if (!staffId) throw new AuthError(400, "staff_id が必要です");
    return staffId;
  }
  if (user.role === "manager") {
    throw new AuthError(403, "マネージャは報告を作成できません");
  }
  if (!user.staffId) {
    throw new AuthError(403, "スタッフプロフィールが連携されていません");
  }
  return user.staffId;
}

export async function validateAndExpandSession(
  client: PoolClient,
  user: AuthedUser,
  staffId: string,
  input: CreateSessionInput,
): Promise<ExpandedEntry[]> {
  assertWorkDateNotFuture(input.work_date);

  const { rows: blRows } = await client.query<{ id: string }>(
    `SELECT id FROM business_lines WHERE id = $1 AND deleted_at IS NULL`,
    [input.business_line_id],
  );
  if (!blRows[0]) throw new AuthError(400, "部門が見つかりません");

  if (user.role === "employee") {
    const ok = await employeeHasBusinessLine(client, staffId, input.business_line_id);
    if (!ok) throw new AuthError(403, "この部門は担当外です");
  }

  const staffEntries: StaffEntryInput[] = [];

  for (const block of input.customer_blocks) {
    if (block.entries.length === 0) continue;

    if (user.role === "employee") {
      const ok = await employeeHasClient(client, staffId, block.client_id);
      if (!ok) throw new AuthError(403, "この顧客は担当外です");
    }

    const allowedSites = await visibleSiteIdsForClient(client, user, block.client_id);
    const { rows: clientSites } = await client.query<{ id: string }>(
      `SELECT id FROM sites WHERE client_id = $1 AND deleted_at IS NULL ORDER BY name`,
      [block.client_id],
    );

    let siteId = block.site_id ?? null;
    if (clientSites.length === 1) {
      siteId = clientSites[0]!.id;
    } else if (clientSites.length > 1 && !siteId) {
      throw new AuthError(400, "拠点を選択してください");
    } else if (clientSites.length === 0) {
      throw new AuthError(400, "顧客に拠点が登録されていません");
    }

    if (allowedSites !== null && siteId && !allowedSites.includes(siteId)) {
      throw new AuthError(403, "この拠点にはアクセスできません");
    }

    for (const entry of block.entries) {
      if (entry.count <= 0) continue;

      const { rows: btRows } = await client.query<BusinessTypeRules>(
        `SELECT client_id, site_id, business_line_id, name,
                input_unit, vehicle_select_mode, line_memo_fields, staff_enterable
           FROM business_types
          WHERE id = $1 AND deleted_at IS NULL`,
        [entry.business_type_id],
      );
      const bt = btRows[0];
      if (!bt) throw new AuthError(400, "業務内容が見つかりません");
      if (!bt.staff_enterable) {
        throw new AuthError(400, "この業務内容は自動加算のため選択できません");
      }
      if (bt.client_id !== block.client_id) {
        throw new AuthError(400, "業務内容が顧客と一致しません");
      }
      if (bt.business_line_id && bt.business_line_id !== input.business_line_id) {
        throw new AuthError(400, "業務内容が部門と一致しません");
      }
      if (bt.site_id && bt.site_id !== siteId) {
        throw new AuthError(400, "業務内容が選択した拠点と一致しません");
      }
      if (bt.site_id) {
        const { rows: siteOk } = await client.query<{ ok: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM sites
              WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL
           ) AS ok`,
          [bt.site_id, block.client_id],
        );
        if (!siteOk[0]?.ok) {
          throw new AuthError(400, "業務内容が顧客と一致しません");
        }
      }

      assertCountForUnit(entry.count, bt.input_unit);

      if (bt.vehicle_select_mode && !entry.vehicle_id) {
        throw new AuthError(400, `${bt.name}：車両（またはステーション）を選択してください`);
      }

      if (entry.vehicle_id) {
        const { rows: vehicleOk } = await client.query<{ ok: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM vehicles v
             JOIN vehicle_lists vl ON vl.id = v.vehicle_list_id
            WHERE v.id = $1 AND vl.client_id = $2
           ) AS ok`,
          [entry.vehicle_id, block.client_id],
        );
        if (!vehicleOk[0]?.ok) {
          throw new AuthError(400, "選択した車両が顧客と一致しません");
        }
      }

      const memoFields = bt.line_memo_fields ?? [];
      const memoErr = validateLineMemoFields(memoFields, entry.line_memo ?? undefined);
      if (memoErr) {
        throw new AuthError(400, `${bt.name}：${memoErr}`);
      }

      staffEntries.push({
        client_id: block.client_id,
        site_id: siteId!,
        business_type_id: entry.business_type_id,
        count: entry.count,
        vehicle_id: entry.vehicle_id ?? null,
        line_memo: entry.line_memo ?? null,
      });
    }
  }

  if (staffEntries.length === 0) {
    throw new AuthError(400, "1件以上の業務を入力してください");
  }

  const autoEntries = await computeAutoBillingEntries(client, staffEntries, {
    work_date: input.work_date,
    business_line_id: input.business_line_id,
    session_id: input.session_id ?? null,
  });

  return [
    ...staffEntries.map((e) => ({ ...e, auto_generated: false })),
    ...autoEntries,
  ];
}

export async function insertReportSession(
  client: PoolClient,
  staffId: string,
  input: CreateSessionInput,
  entries: ExpandedEntry[],
): Promise<string> {
  const reportedAt = new Date();

  const { rows: sessionRows } = await client.query<{ id: string }>(
    `INSERT INTO report_sessions (staff_id, work_date, business_line_id, memo, submitted_at)
     VALUES ($1, $2::date, $3, $4, now())
     RETURNING id`,
    [staffId, input.work_date, input.business_line_id, input.memo ?? null],
  );
  const sessionId = sessionRows[0]!.id;

  for (const e of entries) {
    if (e.count === 0) continue;
    await client.query(
      `INSERT INTO business_reports
         (staff_id, site_id, client_id, business_type_id, count, reported_at, session_id,
          vehicle_id, line_memo, auto_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        staffId,
        e.site_id,
        e.client_id,
        e.business_type_id,
        e.count,
        reportedAt,
        sessionId,
        e.vehicle_id ?? null,
        e.line_memo ? JSON.stringify(e.line_memo) : null,
        e.auto_generated,
      ],
    );
  }

  return sessionId;
}

export async function replaceReportSession(
  client: PoolClient,
  sessionId: string,
  staffId: string,
  input: CreateSessionInput,
  entries: ExpandedEntry[],
): Promise<void> {
  const reportedAt = new Date();

  await client.query(
    `UPDATE report_sessions
        SET work_date = $2::date,
            business_line_id = $3,
            memo = $4,
            updated_at = now(),
            submitted_at = now()
      WHERE id = $1`,
    [sessionId, input.work_date, input.business_line_id, input.memo ?? null],
  );

  await client.query(`DELETE FROM business_reports WHERE session_id = $1`, [sessionId]);

  for (const e of entries) {
    if (e.count === 0) continue;
    await client.query(
      `INSERT INTO business_reports
         (staff_id, site_id, client_id, business_type_id, count, reported_at, session_id,
          vehicle_id, line_memo, auto_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        staffId,
        e.site_id,
        e.client_id,
        e.business_type_id,
        e.count,
        reportedAt,
        sessionId,
        e.vehicle_id ?? null,
        e.line_memo ? JSON.stringify(e.line_memo) : null,
        e.auto_generated,
      ],
    );
  }
}
