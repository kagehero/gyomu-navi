import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./pool";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "sales", "catalog.json");

type CatalogRow = {
  business_line: string;
  client: string;
  branch: string | null;
  task: string;
  unit_price_excl: number | null;
  unit_price_incl: number | null;
  aoisan_note?: string | null;
  entry_rules?: {
    input_unit: string;
    vehicle_select_mode: string | null;
    line_memo_fields: string[];
    billing_rule: string | null;
    billing_trigger_substring: string | null;
    staff_enterable: boolean;
  };
};

type Catalog = {
  business_lines: string[];
  clients: { name: string; code: string; business_lines: string[] }[];
  catalog_rows: CatalogRow[];
  vehicle_lists: {
    sheet_name: string;
    client_hint: string;
    vehicles: {
      station_name: string | null;
      vehicle_label: string;
      surcharge_label: string | null;
    }[];
  }[];
};

const DEFAULT_LAT = 35.6812;
const DEFAULT_LNG = 139.7671;

function loadCatalog(): Catalog {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf-8")) as Catalog;
}

/** Match vehicle list client_hint to imported client name. */
function matchClientHint(hint: string, clientNames: string[]): string | null {
  const h = hint.replace(/\s/g, "");
  for (const name of clientNames) {
    const n = name.replace(/\s/g, "");
    if (n.includes(h) || h.includes(n.slice(0, 6))) return name;
  }
  return null;
}

/**
 * Import sales catalog from catalog.json (from Excel via npm run db:build-catalog).
 * Refreshes sales master data (clients, sites, tasks, vehicle lists).
 * Preserves users, staffs, and departments (TRUNCATE CASCADE on those tables would wipe logins).
 */
async function importSalesCatalog() {
  const catalog = loadCatalog();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      TRUNCATE
        vehicle_visits,
        vehicles,
        vehicle_lists,
        business_reports,
        report_sessions,
        staff_client_assigns,
        staff_business_line_assigns,
        client_business_lines,
        staff_site_assigns,
        business_types,
        sites,
        client_companies,
        business_lines
      RESTART IDENTITY CASCADE
    `);

    const blId = new Map<string, string>();
    for (let i = 0; i < catalog.business_lines.length; i++) {
      const name = catalog.business_lines[i]!;
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO business_lines (name, sort_order) VALUES ($1, $2) RETURNING id`,
        [name, i],
      );
      blId.set(name, rows[0]!.id);
    }

    await client.query(
      `INSERT INTO departments (name)
       SELECT '業務部'
        WHERE NOT EXISTS (
          SELECT 1 FROM departments WHERE name = '業務部' AND deleted_at IS NULL
        )`,
    );

    const clientId = new Map<string, string>();
    const clientNameToId = new Map<string, string>();
    for (const c of catalog.clients) {
      const code = c.code;
      let suffix = 0;
      while (true) {
        try {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO client_companies (name, code) VALUES ($1, $2) RETURNING id`,
            [c.name, suffix ? `${code.slice(0, 8)}${suffix}` : code],
          );
          clientId.set(c.name, rows[0]!.id);
          clientNameToId.set(c.name, rows[0]!.id);
          for (const bl of c.business_lines) {
            await client.query(
              `INSERT INTO client_business_lines (client_id, business_line_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [rows[0]!.id, blId.get(bl)],
            );
          }
          break;
        } catch (e: unknown) {
          if (suffix++ > 20) throw e;
        }
      }
    }

    const siteKey = (clientName: string, branch: string | null) =>
      `${clientName}::${branch ?? "__default__"}`;
    const siteId = new Map<string, string>();

    for (const row of catalog.catalog_rows) {
      const cid = clientId.get(row.client);
      if (!cid) continue;
      const branchName = row.branch ?? "共通";
      const key = siteKey(row.client, row.branch);
      if (!siteId.has(key)) {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO sites (client_id, name, latitude, longitude, radius_m, is_billing_branch)
           VALUES ($1, $2, $3, $4, 100, $5) RETURNING id`,
          [cid, branchName, DEFAULT_LAT, DEFAULT_LNG, row.branch !== null],
        );
        siteId.set(key, rows[0]!.id);
      }
    }

    for (const row of catalog.catalog_rows) {
      const cid = clientId.get(row.client);
      const bl = blId.get(row.business_line);
      if (!cid || !bl) continue;
      const key = siteKey(row.client, row.branch);
      const sid = siteId.get(key) ?? null;
      const siteUuid = row.branch ? sid : null;

      await client.query(
        `INSERT INTO business_types
           (client_id, site_id, business_line_id, name, unit_price_excl, unit_price_incl,
            input_unit, vehicle_select_mode, line_memo_fields, billing_rule,
            billing_trigger_substring, staff_enterable)
         SELECT $1::uuid, $2::uuid, $3::uuid, $4::varchar(100), $5::numeric, $6::numeric,
                $7::varchar(20), $8::varchar(20), $9::jsonb, $10::varchar(40),
                $11::varchar(100), $12::boolean
          WHERE NOT EXISTS (
            SELECT 1 FROM business_types bt
             WHERE bt.client_id = $1::uuid
               AND bt.deleted_at IS NULL
               AND bt.name = $4::varchar(100)
               AND COALESCE(bt.site_id, '00000000-0000-0000-0000-000000000000'::uuid)
                 = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
          )`,
        [
          cid,
          siteUuid,
          bl,
          row.task,
          row.unit_price_excl,
          row.unit_price_incl,
          row.entry_rules?.input_unit ?? "count",
          row.entry_rules?.vehicle_select_mode ?? null,
          JSON.stringify(row.entry_rules?.line_memo_fields ?? []),
          row.entry_rules?.billing_rule ?? null,
          row.entry_rules?.billing_trigger_substring ?? null,
          row.entry_rules?.staff_enterable ?? true,
        ],
      );
    }

    const clientNames = [...clientId.keys()];
    for (const vl of catalog.vehicle_lists) {
      const matched = matchClientHint(vl.client_hint, clientNames);
      if (!matched || vl.vehicles.length === 0) continue;
      const cid = clientId.get(matched)!;
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO vehicle_lists (client_id, name, list_type)
         VALUES ($1, $2, 'imported') RETURNING id`,
        [cid, vl.sheet_name],
      );
      const listId = rows[0]!.id;
      for (let i = 0; i < vl.vehicles.length; i++) {
        const v = vl.vehicles[i]!;
        await client.query(
          `INSERT INTO vehicles (vehicle_list_id, station_name, vehicle_label, surcharge_label, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [listId, v.station_name, v.vehicle_label, v.surcharge_label, i],
        );
      }
    }

    await client.query("COMMIT");
    console.log(
      `Import complete: ${catalog.business_lines.length} lines, ${catalog.clients.length} clients, ${catalog.catalog_rows.length} tasks, ${catalog.vehicle_lists.length} vehicle lists`,
    );
    console.log(
      "Note: staff client/department assignments were cleared — re-assign in マスタ管理 → スタッフ if needed.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importSalesCatalog().catch((e) => {
  console.error(e);
  process.exit(1);
});
