-- Users for authentication (email stored lowercased in application code)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(255) NOT NULL DEFAULT '',
  app_role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (app_role IN ('admin', 'employee')),
  staff_profile_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
