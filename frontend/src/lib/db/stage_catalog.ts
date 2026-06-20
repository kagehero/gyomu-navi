/**
 * Stage the client's corrected sales-hierarchy Excel for catalog building.
 *
 * Copies `docs/社内システム売上報告階層 (1).xlsx` (the re-sent file with the
 * C/D-column corrections) to `frontend/public/社内システム売上報告階層.xlsx`,
 * which is where `build_sales_catalog.ts` looks. Kept as a script so the
 * runbook is a single `npm run db:stage-catalog` rather than a manual copy with
 * an easy-to-mistype filename.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(process.cwd(), "..");

// Source candidates in priority order: the re-sent "(1)" file, then any
// already-named drop-in next to it.
const SOURCES = [
  join(repoRoot, "docs", "社内システム売上報告階層 (1).xlsx"),
  join(repoRoot, "docs", "社内システム売上報告階層.xlsx"),
];

const DEST = join(process.cwd(), "public", "社内システム売上報告階層.xlsx");

const source = SOURCES.find((p) => existsSync(p));
if (!source) {
  console.error("Excel が見つかりません。次のいずれかに配置してください:");
  for (const p of SOURCES) console.error(`  ${p}`);
  process.exit(1);
}

copyFileSync(source, DEST);
console.log(`Staged catalog Excel:\n  from ${source}\n  to   ${DEST}`);
console.log("次: npm run db:build-catalog && npm run db:import-sales");
