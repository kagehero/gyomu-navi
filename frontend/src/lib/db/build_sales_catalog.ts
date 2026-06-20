/**
 * Build src/lib/db/sales/catalog.json from public/社内システム売上報告階層.xlsx
 *
 * Uses the SheetJS (xlsx) library so cell text matches what Excel displays
 * (the previous Python XML parser incorrectly concatenated furigana onto names).
 */
import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  isDittoNote,
  parseAoisanNote,
  type BusinessTypeEntryRules,
} from "../reports/business-type-rules";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "sales", "catalog.json");

const EXCEL_CANDIDATES = [
  join(process.cwd(), "public", "社内システム売上報告階層.xlsx"),
  join(process.cwd(), "..", "Desktop", "社内システム売上報告階層.xlsx"),
];

const BL_ALIASES: Record<string, string> = {
  回送カイソウ: "回送",
  スケジュール点検テンケン: "スケジュール点検",
  その他タ: "その他",
  法人リテールホウジン: "法人リテール",
  洗剤販売センザイハンバイ: "洗剤販売",
};

const DEFAULT_BL = "カーシェア";

type CatalogRow = {
  business_line: string;
  client: string;
  branch: string | null;
  task: string;
  unit_price_excl: number | null;
  unit_price_incl: number | null;
  aoisan_note: string | null;
  entry_rules: BusinessTypeEntryRules;
};

type CatalogClient = {
  name: string;
  code: string;
  business_lines: string[];
};

type VehicleEntry = {
  station_name: string | null;
  vehicle_label: string;
  surcharge_label: string | null;
};

type Catalog = {
  business_lines: string[];
  clients: CatalogClient[];
  catalog_rows: CatalogRow[];
  vehicle_lists: {
    sheet_name: string;
    client_hint: string;
    vehicles: VehicleEntry[];
  }[];
};

function normalizeBl(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  return BL_ALIASES[s] ?? s;
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isHeaderRow(row: unknown[]): boolean {
  const first = String(row[0] ?? "");
  return first.includes("選択項目") || first.includes("センタク");
}

function isSkipRow(a: string | null, b: string | null): boolean {
  if (!a) return false;
  return a.startsWith("←") || a.includes("表示されない");
}

function clientHintFromSheet(sheetName: string): string {
  let hint = sheetName.replace(/車両リスト.*$/u, "").trim();
  const paren = hint.match(/^(.+?)（(.+?)）$/u);
  if (paren) {
    hint = paren[1]!;
  }
  return hint.trim();
}

/** Map vehicle-list sheet hints to catalog client names when names differ. */
function resolveClientHint(rawHint: string, clientNames: string[]): string {
  const overrides: Record<string, string> = {
    国際交通: "KOKUSAI GROUP",
  };
  if (overrides[rawHint]) return overrides[rawHint];

  const hint = rawHint.replace(/\s/g, "");
  let best: string | null = null;
  let bestScore = -1;

  for (const name of clientNames) {
    const n = name.replace(/\s/g, "");
    if (n === hint) return name;
    if (n.startsWith(hint) || hint.startsWith(n)) {
      const score = Math.min(n.length, hint.length);
      if (score > bestScore) {
        best = name;
        bestScore = score;
      }
    }
  }

  return best ?? rawHint;
}

function clientCode(name: string, used: Set<string>): string {
  let base = name.replace(/[^a-zA-Z0-9\u3040-\u30ff\u4e00-\u9fff]/gu, "").slice(0, 12);
  if (!base) base = "CLIENT";
  let code = base;
  let suffix = 1;
  while (used.has(code)) {
    code = `${base.slice(0, Math.max(1, 10 - String(suffix).length))}${suffix}`;
    suffix++;
  }
  used.add(code);
  return code;
}

function parseReportSheet(rows: unknown[][]): {
  business_lines: string[];
  clientBlMap: Map<string, Set<string>>;
  catalog_rows: CatalogRow[];
} {
  const blOrder: string[] = [DEFAULT_BL];
  const blSeen = new Set<string>([DEFAULT_BL]);
  const clientBlMap = new Map<string, Set<string>>();
  const catalog_rows: CatalogRow[] = [];

  let currentBl = DEFAULT_BL;
  let currentClient: string | null = null;
  let currentBranch: string | null = null;
  let currentAoisanNote: string | null = null;

  const addClientBl = (client: string, bl: string) => {
    if (!clientBlMap.has(client)) clientBlMap.set(client, new Set());
    clientBlMap.get(client)!.add(bl);
  };

  // Row 0 = note, row 1 = headers, data from index 2 (Excel row 4+)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Columns (0-indexed): A=ログイン, B=日付 (both blank in data rows),
    // C=部門, D=顧客, E=拠点, F=業務, G=税別, H=税込, I=台数, J(idx 9)=備考.
    const blCol = row[2]; // C 部門
    const clientCol = row[3]; // D 顧客
    const branchCol = row[4]; // E 拠点
    const taskCol = row[5]; // F 業務
    const priceExclCol = row[6]; // G 税別
    const priceInclCol = row[7]; // H 税込
    const noteRaw = row[9]; // J あおいさん宛備考

    if (noteRaw != null && String(noteRaw).trim() !== "") {
      if (isDittoNote(noteRaw)) {
        // keep currentAoisanNote
      } else {
        currentAoisanNote = String(noteRaw).trim();
      }
    } else {
      currentAoisanNote = null;
    }

    const nextBl = normalizeBl(blCol);
    if (nextBl) {
      currentBl = nextBl;
      if (!blSeen.has(currentBl)) {
        blSeen.add(currentBl);
        blOrder.push(currentBl);
      }
    }

    // A new client (D) starts a new client block; reset the branch so a stale
    // value from the previous client doesn't leak in.
    if (clientCol != null && String(clientCol).trim() !== "") {
      currentClient = String(clientCol).trim();
      currentBranch = null;
      addClientBl(currentClient, currentBl);
    }

    if (branchCol != null && String(branchCol).trim() !== "") {
      currentBranch = String(branchCol).trim();
    }

    if (currentClient && taskCol != null && String(taskCol).trim() !== "") {
      catalog_rows.push({
        business_line: currentBl,
        client: currentClient,
        branch: currentBranch,
        task: String(taskCol).trim(),
        unit_price_excl: parseNumber(priceExclCol),
        unit_price_incl: parseNumber(priceInclCol),
        aoisan_note: currentAoisanNote,
        entry_rules: parseAoisanNote(currentAoisanNote),
      });
    }
  }

  return { business_lines: blOrder, clientBlMap, catalog_rows };
}

function parseVehicleSheet(sheetName: string, rows: unknown[][]): VehicleEntry[] {
  const vehicles: VehicleEntry[] = [];

  for (const row of rows) {
    if (!row || isHeaderRow(row as unknown[])) continue;

    const aRaw = row[0];
    const bRaw = row[1];
    const cRaw = row[2];

    const a = aRaw != null && String(aRaw).trim() !== "" ? String(aRaw).trim() : null;
    const b = bRaw != null && String(bRaw).trim() !== "" ? String(bRaw).trim() : null;
    const c = cRaw != null && String(cRaw).trim() !== "" ? String(cRaw).trim() : null;

    if (isSkipRow(a, b)) continue;
    if (!a && !b) continue;

    if (b && !isSkipRow(b, null)) {
      vehicles.push({
        station_name: a,
        vehicle_label: b,
        surcharge_label: c,
      });
    } else if (a) {
      vehicles.push({
        station_name: null,
        vehicle_label: a,
        surcharge_label: c,
      });
    }
  }

  return vehicles;
}

function buildCatalog(excelPath: string): Catalog {
  const wb = XLSX.readFile(excelPath);
  const reportSheet = wb.Sheets["報告リスト"];
  if (!reportSheet) {
    throw new Error('Sheet "報告リスト" not found in Excel file');
  }

  const reportRows = XLSX.utils.sheet_to_json<unknown[]>(reportSheet, {
    header: 1,
    defval: null,
  });

  const { business_lines, clientBlMap, catalog_rows } = parseReportSheet(reportRows);

  const usedCodes = new Set<string>();
  const clients: CatalogClient[] = [...clientBlMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([name, blSet]) => ({
      name,
      code: clientCode(name, usedCodes),
      business_lines: business_lines.filter((bl) => blSet.has(bl)),
    }));

  const vehicle_lists = wb.SheetNames.filter((n) => n !== "報告リスト").map((sheet_name) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet_name]!, {
      header: 1,
      defval: null,
    });
    const rawHint = clientHintFromSheet(sheet_name);
    const clientNames = clients.map((c) => c.name);
    return {
      sheet_name,
      client_hint: resolveClientHint(rawHint, clientNames),
      vehicles: parseVehicleSheet(sheet_name, rows),
    };
  });

  return { business_lines, clients, catalog_rows, vehicle_lists };
}

function main() {
  const excelPath = EXCEL_CANDIDATES.find((p) => existsSync(p));
  if (!excelPath) {
    console.error("Excel file not found. Expected one of:");
    for (const p of EXCEL_CANDIDATES) console.error(`  ${p}`);
    process.exit(1);
  }

  const catalog = buildCatalog(excelPath);
  writeFileSync(OUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");

  const clientsByBl = new Map<string, number>();
  for (const c of catalog.clients) {
    for (const bl of c.business_lines) {
      clientsByBl.set(bl, (clientsByBl.get(bl) ?? 0) + 1);
    }
  }

  console.log(`Built ${OUT_PATH} from ${excelPath}`);
  console.log(`  business_lines: ${catalog.business_lines.length}`);
  console.log(`  clients:        ${catalog.clients.length}`);
  console.log(`  catalog_rows:   ${catalog.catalog_rows.length}`);
  console.log(`  vehicle_lists:  ${catalog.vehicle_lists.length}`);
  console.log("  clients per business line:");
  for (const bl of catalog.business_lines) {
    console.log(`    ${bl}: ${clientsByBl.get(bl) ?? 0}`);
  }
}

main();
