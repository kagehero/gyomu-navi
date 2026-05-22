-- 004_master_data.sql
-- Master data: departments, client_companies, sites, business_types, staffs, staff_site_assigns.
-- All master tables use soft delete via deleted_at.

-- ---------- departments ----------
CREATE TABLE IF NOT EXISTS departments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_name_live
  ON departments(name)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- client_companies ----------
CREATE TABLE IF NOT EXISTS client_companies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  code       VARCHAR(20)  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_companies_code_live
  ON client_companies(code)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_client_companies_updated_at ON client_companies;
CREATE TRIGGER trg_client_companies_updated_at
  BEFORE UPDATE ON client_companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- sites ----------
CREATE TABLE IF NOT EXISTS sites (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID         NOT NULL REFERENCES client_companies(id),
  name       VARCHAR(255) NOT NULL,
  latitude   NUMERIC(9,6) NOT NULL,
  longitude  NUMERIC(9,6) NOT NULL,
  radius_m   INTEGER      NOT NULL DEFAULT 100 CHECK (radius_m > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sites_client_id
  ON sites(client_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_sites_updated_at ON sites;
CREATE TRIGGER trg_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- business_types ----------
CREATE TABLE IF NOT EXISTS business_types (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID         NOT NULL REFERENCES client_companies(id),
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_types_client_name_live
  ON business_types(client_id, name)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_business_types_updated_at ON business_types;
CREATE TRIGGER trg_business_types_updated_at
  BEFORE UPDATE ON business_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- staffs ----------
CREATE TABLE IF NOT EXISTS staffs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID         NOT NULL REFERENCES departments(id),
  name          VARCHAR(100) NOT NULL,
  hourly_rate   INTEGER      NOT NULL CHECK (hourly_rate >= 0),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staffs_department_id
  ON staffs(department_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_staffs_updated_at ON staffs;
CREATE TRIGGER trg_staffs_updated_at
  BEFORE UPDATE ON staffs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- staff_site_assigns (M:N) ----------
CREATE TABLE IF NOT EXISTS staff_site_assigns (
  staff_id    UUID NOT NULL REFERENCES staffs(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id)  ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_assigns_site_id
  ON staff_site_assigns(site_id);
