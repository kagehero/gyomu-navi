import { describe, expect, it } from "vitest";
import {
  isDittoNote,
  parseAoisanNote,
  validateLineMemoFields,
} from "./business-type-rules";

describe("parseAoisanNote", () => {
  it("parses vehicle selection requirement", () => {
    const rules = parseAoisanNote("各業務選択後に別シートの車種を車両欄から選択必須");
    expect(rules.vehicle_select_mode).toBe("vehicle");
    expect(rules.staff_enterable).toBe(true);
  });

  it("parses auto daily area surcharge", () => {
    const rules = parseAoisanNote(
      "設定エリアごとに1日あたり最大1回加算されるので、スタッフが入力をするのではなく、同日に複数台業務報告があった場合でも自動で1回として加算（同じエリアで同日に複数回入力があっても1回のみ加算）",
    );
    expect(rules.billing_rule).toBe("daily_once_per_area");
    expect(rules.staff_enterable).toBe(false);
  });

  it("parses line memo fields for emergency work", () => {
    const rules = parseAoisanNote(
      "入力があった場合は備考欄を表示し、右記の情報を入力するよう表示→必須記載事項：①ステーション名　②車種　③車番（地域ナンバーから正確に入力）　④対応業務詳細",
    );
    expect(rules.line_memo_fields).toEqual([
      "station_name",
      "vehicle_type",
      "plate_number",
      "work_detail",
    ]);
  });

  it("parses hour input unit", () => {
    const rules = parseAoisanNote("入力単位は時間（例：3時間の場合は3、3時間半の場合は3.5）");
    expect(rules.input_unit).toBe("hour");
  });
});

describe("validateLineMemoFields", () => {
  it("requires configured fields", () => {
    const err = validateLineMemoFields(["plate_number"], {});
    expect(err).toContain("車番");
  });

  it("passes when all fields present", () => {
    const err = validateLineMemoFields(["plate_number"], { plate_number: "品川500あ1234" });
    expect(err).toBeNull();
  });
});

describe("isDittoNote", () => {
  it("detects ditto markers only", () => {
    expect(isDittoNote("〃")).toBe(true);
    expect(isDittoNote("　〃")).toBe(true);
    expect(isDittoNote(null)).toBe(false);
    expect(isDittoNote("")).toBe(false);
    expect(isDittoNote("入力単位はリットル")).toBe(false);
  });
});
