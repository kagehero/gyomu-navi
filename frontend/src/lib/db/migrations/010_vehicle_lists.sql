-- 010_vehicle_lists.sql
-- Per-customer vehicle tracking lists (Phase 2: visit dates auto-count toward reports).

CREATE TABLE IF NOT EXISTS vehicle_lists (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID         NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  list_type  VARCHAR(50)  NOT NULL DEFAULT 'station_vehicle',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_lists_client_name_live
  ON vehicle_lists(client_id, name)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_vehicle_lists_updated_at ON vehicle_lists;
CREATE TRIGGER trg_vehicle_lists_updated_at
  BEFORE UPDATE ON vehicle_lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS vehicles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_list_id UUID         NOT NULL REFERENCES vehicle_lists(id) ON DELETE CASCADE,
  station_name    VARCHAR(255),
  vehicle_label   VARCHAR(255) NOT NULL,
  surcharge_label VARCHAR(255),
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vehicles_list_id
  ON vehicles(vehicle_list_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS vehicle_visits (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  staff_id    UUID        NOT NULL REFERENCES staffs(id) ON DELETE RESTRICT,
  visit_date  DATE        NOT NULL,
  session_id  UUID        REFERENCES report_sessions(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_visits_date
  ON vehicle_visits(visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_visits_staff_date
  ON vehicle_visits(staff_id, visit_date DESC);
