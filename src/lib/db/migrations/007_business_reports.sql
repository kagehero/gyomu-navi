-- 007_business_reports.sql
-- Daily business reports. client_id is denormalised from site (kept in sync at write time)
-- so dashboard aggregates by client don't need to JOIN sites every time.

CREATE TABLE IF NOT EXISTS business_reports (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID         NOT NULL REFERENCES staffs(id)          ON DELETE RESTRICT,
  site_id          UUID         NOT NULL REFERENCES sites(id)           ON DELETE RESTRICT,
  client_id        UUID         NOT NULL REFERENCES client_companies(id) ON DELETE RESTRICT,
  business_type_id UUID         NOT NULL REFERENCES business_types(id)  ON DELETE RESTRICT,
  count            INTEGER      NOT NULL CHECK (count >= 0),
  image_url        TEXT,
  memo             TEXT,
  reported_at      TIMESTAMPTZ  NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_reported_at
  ON business_reports(reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_staff_reported
  ON business_reports(staff_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_client_reported
  ON business_reports(client_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_site_reported
  ON business_reports(site_id, reported_at DESC);

DROP TRIGGER IF EXISTS trg_reports_updated_at ON business_reports;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON business_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
