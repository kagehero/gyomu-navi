/** Structured entry rules parsed from Excel column「あおいさん宛備考」. */

export type InputUnit = "count" | "liter" | "hour";

export type VehicleSelectMode = "vehicle" | "station" | "plate";

export type LineMemoField =
  | "station_name"
  | "vehicle_type"
  | "plate_number"
  | "work_detail"
  | "shipment"
  | "vehicle_unit_number"
  | "person_name";

export type BillingRule =
  | "daily_once_per_area"
  | "per_vehicle_surcharge"
  | "monthly_once"
  | "daily_once_overhead";

export type BusinessTypeEntryRules = {
  input_unit: InputUnit;
  vehicle_select_mode: VehicleSelectMode | null;
  line_memo_fields: LineMemoField[];
  billing_rule: BillingRule | null;
  billing_trigger_substring: string | null;
  staff_enterable: boolean;
};

export const LINE_MEMO_FIELD_LABELS: Record<LineMemoField, string> = {
  station_name: "ステーション名",
  vehicle_type: "車種",
  plate_number: "車番（地域ナンバー）",
  work_detail: "対応業務詳細",
  shipment: "発送物",
  vehicle_unit_number: "車種+号車",
  person_name: "氏名",
};

export const INPUT_UNIT_LABELS: Record<InputUnit, string> = {
  count: "台数/回数",
  liter: "リットル",
  hour: "時間",
};

const DITTO_MARKERS = new Set(["〃", "　〃"]);

export function isDittoNote(raw: unknown): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  return DITTO_MARKERS.has(s);
}

function parseLineMemoFields(note: string): LineMemoField[] {
  if (!note.includes("必須記載事項")) return [];

  const fields: LineMemoField[] = [];
  if (/ステーション名/.test(note)) fields.push("station_name");
  if (/車種/.test(note) && /号車/.test(note)) {
    fields.push("vehicle_unit_number");
  } else if (/車種/.test(note)) {
    fields.push("vehicle_type");
  }
  if (/車番/.test(note) && !fields.includes("vehicle_unit_number")) {
    fields.push("plate_number");
  }
  if (/対応業務詳細/.test(note)) fields.push("work_detail");
  if (/発送物/.test(note)) fields.push("shipment");
  if (/氏名/.test(note)) fields.push("person_name");

  return fields;
}

function parseVehicleSelectMode(note: string): VehicleSelectMode | null {
  if (/ステーション情報から選択必須/.test(note)) return "station";
  if (/ナンバーを車両欄から選択必須/.test(note)) return "plate";
  if (/車種を車両欄から選択必須/.test(note) || /車両情報から選択必須/.test(note)) {
    return "vehicle";
  }
  return null;
}

function parseInputUnit(note: string): InputUnit {
  if (/入力単位はリットル/.test(note)) return "liter";
  if (/入力単位は時間/.test(note)) return "hour";
  return "count";
}

function parseBillingRule(note: string): {
  billing_rule: BillingRule | null;
  billing_trigger_substring: string | null;
  staff_enterable: boolean;
} {
  if (/1日あたり最大1回加算/.test(note) && /スタッフが入力をするのではなく/.test(note)) {
    return {
      billing_rule: "daily_once_per_area",
      billing_trigger_substring: null,
      staff_enterable: false,
    };
  }
  if (/1台につき自動で1回分加算/.test(note) && /スタッフは選択しない/.test(note)) {
    return {
      billing_rule: "per_vehicle_surcharge",
      billing_trigger_substring: null,
      staff_enterable: false,
    };
  }
  if (/1か月に1回だけ加算/.test(note)) {
    return {
      billing_rule: "monthly_once",
      billing_trigger_substring: "巡回清掃及び点検",
      staff_enterable: false,
    };
  }
  if (/諸経費は1日あたり1回加算/.test(note)) {
    return {
      billing_rule: "daily_once_overhead",
      billing_trigger_substring: null,
      staff_enterable: false,
    };
  }
  return {
    billing_rule: null,
    billing_trigger_substring: null,
    staff_enterable: true,
  };
}

/** Parse a resolved「あおいさん宛備考」string into structured entry rules. */
export function parseAoisanNote(note: string | null | undefined): BusinessTypeEntryRules {
  const text = note?.trim() ?? "";
  if (!text) {
    return {
      input_unit: "count",
      vehicle_select_mode: null,
      line_memo_fields: [],
      billing_rule: null,
      billing_trigger_substring: null,
      staff_enterable: true,
    };
  }

  const billing = parseBillingRule(text);
  return {
    input_unit: parseInputUnit(text),
    vehicle_select_mode: parseVehicleSelectMode(text),
    line_memo_fields: parseLineMemoFields(text),
    billing_rule: billing.billing_rule,
    billing_trigger_substring: billing.billing_trigger_substring,
    staff_enterable: billing.staff_enterable,
  };
}

export function formatLineMemo(memo: Record<string, string>): string {
  return Object.entries(memo)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => {
      const label = LINE_MEMO_FIELD_LABELS[k as LineMemoField] ?? k;
      return `${label}: ${v.trim()}`;
    })
    .join(" / ");
}

export function validateLineMemoFields(
  fields: LineMemoField[],
  memo: Record<string, string> | null | undefined,
): string | null {
  if (fields.length === 0) return null;
  const data = memo ?? {};
  for (const field of fields) {
    if (!data[field]?.trim()) {
      return `${LINE_MEMO_FIELD_LABELS[field]}は必須です`;
    }
  }
  return null;
}
