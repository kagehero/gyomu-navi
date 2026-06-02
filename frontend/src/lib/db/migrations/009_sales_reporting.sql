-- 009_sales_reporting.sql
-- Client sales-report hierarchy: business lines, unit pricing, report sessions,
-- and staff scoping by business line + customer.

-- ---------- business_lines (カーシェア / レンタカー / …) ----------
CREATE TABLE IF NOT EXISTS business_lines (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_lines_name_live
  ON business_lines(name)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_business_lines_updated_at ON business_lines;
CREATE TRIGGER trg_business_lines_updated_at
  BEFORE UPDATE ON business_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- client ↔ business_line ----------
CREATE TABLE IF NOT EXISTS client_business_lines (
  client_id        UUID NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  business_line_id UUID NOT NULL REFERENCES business_lines(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, business_line_id)
);

CREATE INDEX IF NOT EXISTS idx_client_business_lines_bl
  ON client_business_lines(business_line_id);

-- ---------- staff scoping ----------
CREATE TABLE IF NOT EXISTS staff_business_line_assigns (
  staff_id         UUID NOT NULL REFERENCES staffs(id) ON DELETE CASCADE,
  business_line_id UUID NOT NULL REFERENCES business_lines(id) ON DELETE CASCADE,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, business_line_id)
);

CREATE TABLE IF NOT EXISTS staff_client_assigns (
  staff_id    UUID NOT NULL REFERENCES staffs(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_client_assigns_client
  ON staff_client_assigns(client_id);

-- ---------- sites: billing branch flag ----------
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS is_billing_branch BOOLEAN NOT NULL DEFAULT true;

-- ---------- business_types: branch scope + pricing ----------
ALTER TABLE business_types
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS business_line_id UUID REFERENCES business_lines(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS unit_price_excl NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS unit_price_incl NUMERIC(12, 2);

DROP INDEX IF EXISTS uq_business_types_client_name_live;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_types_client_site_name_live
  ON business_types (
    client_id,
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    name
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_types_site_id
  ON business_types(site_id)
  WHERE site_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_types_business_line_id
  ON business_types(business_line_id)
  WHERE business_line_id IS NOT NULL AND deleted_at IS NULL;

-- ---------- report sessions (daily batch per staff + date + business line) ----------
CREATE TABLE IF NOT EXISTS report_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID        NOT NULL REFERENCES staffs(id) ON DELETE RESTRICT,
  work_date        DATE        NOT NULL,
  business_line_id UUID        NOT NULL REFERENCES business_lines(id) ON DELETE RESTRICT,
  memo             TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, work_date, business_line_id)
);

CREATE INDEX IF NOT EXISTS idx_report_sessions_work_date
  ON report_sessions(work_date DESC);

DROP TRIGGER IF EXISTS trg_report_sessions_updated_at ON report_sessions;
CREATE TRIGGER trg_report_sessions_updated_at
  BEFORE UPDATE ON report_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE business_reports
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES report_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_session_id
  ON business_reports(session_id)
  WHERE session_id IS NOT NULL;
