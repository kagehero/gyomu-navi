-- 006_attendance.sql
-- Attendance log per staff per work_date.

CREATE TABLE IF NOT EXISTS attendance_logs (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID         NOT NULL REFERENCES staffs(id) ON DELETE RESTRICT,
  site_id        UUID         NOT NULL REFERENCES sites(id)  ON DELETE RESTRICT,
  work_date      DATE         NOT NULL,
  punch_in_at    TIMESTAMPTZ  NOT NULL,
  punch_out_at   TIMESTAMPTZ,
  status         VARCHAR(20)  NOT NULL CHECK (status IN ('working', 'done', 'absent')),
  punch_in_lat   NUMERIC(9,6),
  punch_in_lng   NUMERIC(9,6),
  punch_out_lat  NUMERIC(9,6),
  punch_out_lng  NUMERIC(9,6),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendance_staff_date UNIQUE (staff_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_staff_date
  ON attendance_logs(staff_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON attendance_logs(work_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_site_date
  ON attendance_logs(site_id, work_date DESC);

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance_logs;
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
