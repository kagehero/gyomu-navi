-- 005_users_link_to_staff.sql
-- Rework users to integrate with the new master schema:
--   * drop legacy text staff_profile_id, add staff_id UUID FK to staffs
--   * add department_id UUID FK (used for manager scope)
--   * extend app_role to include 'manager'
--   * add deleted_at (soft delete) and updated_at (with trigger)
--   * enforce role/FK consistency via CHECK
--
-- NOTE: This migration drops the legacy seeded 'st1'/'st2' string identifiers.
-- Any pre-existing rows lose their staff_profile_id; seed.ts (rewritten) will
-- repopulate staff_id from the new staffs table by matching emails.

-- ---- 1) Drop the old CHECK so we can extend the allowed values ----
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_app_role_check;

-- ---- 2) Add new columns (idempotent) ----
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS staff_id      UUID REFERENCES staffs(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- ---- 3) Drop the legacy text column (was holding 'st2' etc.) ----
ALTER TABLE users
  DROP COLUMN IF EXISTS staff_profile_id;

-- ---- 4) Re-add the role CHECK with the new 'manager' value ----
ALTER TABLE users
  ADD CONSTRAINT users_app_role_check
  CHECK (app_role IN ('admin', 'manager', 'employee'));

-- ---- 5) Demote any legacy employee rows to admin before locking down with CHECK.
-- Pre-existing employees referenced staffs via the old TEXT staff_profile_id
-- (now dropped). Their new staff_id is NULL, which would violate the upcoming
-- consistency CHECK. seed.ts re-creates these users from scratch, so the demote
-- is a transient measure that has no real effect on app data.
UPDATE users
   SET app_role = 'admin'
 WHERE app_role = 'employee'
   AND staff_id IS NULL;

-- ---- 6) Consistency: role <-> FK presence ----
-- admin    : both NULL
-- manager  : department_id NOT NULL, staff_id NULL
-- employee : staff_id NOT NULL, department_id NULL
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_fk_consistency;

ALTER TABLE users
  ADD CONSTRAINT users_role_fk_consistency CHECK (
    (app_role = 'admin'    AND staff_id IS NULL     AND department_id IS NULL)
 OR (app_role = 'manager'  AND staff_id IS NULL     AND department_id IS NOT NULL)
 OR (app_role = 'employee' AND staff_id IS NOT NULL AND department_id IS NULL)
  );

-- ---- 7) Trigger for updated_at ----
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- 8) Helpful indexes ----
CREATE INDEX IF NOT EXISTS idx_users_staff_id
  ON users(staff_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_department_id
  ON users(department_id)
  WHERE deleted_at IS NULL;
