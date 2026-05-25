-- Employee self-registration requires admin approval before login.
-- Pending staff may not yet have an HR department assigned.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_approved_at TIMESTAMPTZ;

-- Existing employee logins were created before approval workflow.
UPDATE users
   SET login_approved_at = created_at
 WHERE app_role = 'employee'
   AND deleted_at IS NULL
   AND login_approved_at IS NULL;

ALTER TABLE staffs
  ALTER COLUMN department_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_pending_employee_login
  ON users(created_at)
  WHERE app_role = 'employee'
    AND deleted_at IS NULL
    AND login_approved_at IS NULL;
