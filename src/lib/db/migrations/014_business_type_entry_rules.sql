-- 014_business_type_entry_rules.sql
-- Entry rules from Excel「あおいさん宛備考」: vehicle pick, line memo, units, auto-billing.

ALTER TABLE business_types
  ADD COLUMN IF NOT EXISTS input_unit VARCHAR(20) NOT NULL DEFAULT 'count',
  ADD COLUMN IF NOT EXISTS vehicle_select_mode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS line_memo_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_rule VARCHAR(40),
  ADD COLUMN IF NOT EXISTS billing_trigger_substring VARCHAR(100),
  ADD COLUMN IF NOT EXISTS staff_enterable BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE business_reports
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_memo JSONB,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE business_reports DROP CONSTRAINT IF EXISTS business_reports_count_check;
ALTER TABLE business_reports
  ALTER COLUMN count TYPE NUMERIC(10, 2) USING count::numeric;
ALTER TABLE business_reports
  ADD CONSTRAINT business_reports_count_check CHECK (count >= 0);

CREATE INDEX IF NOT EXISTS idx_business_reports_vehicle_id
  ON business_reports(vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_types_staff_enterable
  ON business_types(client_id, staff_enterable)
  WHERE deleted_at IS NULL AND staff_enterable = true;
