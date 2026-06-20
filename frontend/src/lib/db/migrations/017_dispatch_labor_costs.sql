-- 017_dispatch_labor_costs.sql
-- External (派遣) staff labour costs (顧客要望: 現場の採算を明確にするため、社外の
-- 派遣スタッフの人件費のみ追加入力できるようにする).
--
-- Attached to a report_session so the cost is scoped to a staff/day/business_line
-- (the leader's session). These rows do NOT affect revenue; they are a cost
-- layer the analytics P&L subtracts to show 現場の収支.

CREATE TABLE IF NOT EXISTS dispatch_labor_costs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID         NOT NULL REFERENCES report_sessions(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  hours       NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0),
  labor_cost  NUMERIC(12, 2) NOT NULL CHECK (labor_cost >= 0),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_labor_costs_session
  ON dispatch_labor_costs(session_id);
