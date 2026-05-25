-- 011_report_sessions_multi_submit.sql
-- Allow multiple submissions per staff/day/department (each with its own memo).

ALTER TABLE report_sessions
  DROP CONSTRAINT IF EXISTS report_sessions_staff_id_work_date_business_line_id_key;

CREATE INDEX IF NOT EXISTS idx_report_sessions_staff_date_bl
  ON report_sessions(staff_id, work_date DESC, business_line_id);
