/**
 * Type-only port of Phase1 `business-type-rules.ts`.
 *
 * The runtime parser (`parseAoisanNote`, etc.) lives in the catalog importer
 * (frontend/src/lib/db/import_sales_catalog.ts) and isn't needed at request
 * time — `business_types` rows already carry the parsed columns. We keep
 * just the types + the `validateLineMemoFields` helper so the session
 * validator can call it.
 */

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

export const LINE_MEMO_FIELD_LABELS: Record<LineMemoField, string> = {
  station_name: "ステーション名",
  vehicle_type: "車種",
  plate_number: "車番（地域ナンバー）",
  work_detail: "対応業務詳細",
  shipment: "発送物",
  vehicle_unit_number: "車種+号車",
  person_name: "氏名",
};

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
