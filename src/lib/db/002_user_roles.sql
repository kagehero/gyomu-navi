-- Backfill for DBs created before app_role / staff_profile_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_role VARCHAR(20) NOT NULL DEFAULT 'admin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_profile_id TEXT;
