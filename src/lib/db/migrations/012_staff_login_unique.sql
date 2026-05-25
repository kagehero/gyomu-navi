-- One active employee login per staff record.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_one_employee_per_staff
  ON users(staff_id)
  WHERE app_role = 'employee' AND deleted_at IS NULL AND staff_id IS NOT NULL;
