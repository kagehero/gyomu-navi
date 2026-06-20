-- 016_report_session_drafts.sql
-- Draft (一時保存) support for report sessions (顧客要望: 入力途中の一時保存).
--
-- A draft holds the in-progress form state as JSONB and creates NO
-- business_reports rows, so it never reaches revenue/count analytics (which
-- aggregate over business_reports). On final submit the session transitions to
-- status='submitted' and its business_reports are written the normal way.
--
-- One draft per staff/day/business_line keeps autosave idempotent (the form
-- upserts onto it). Submitted sessions are unconstrained (multi-submit, 011).

ALTER TABLE report_sessions
  ADD COLUMN IF NOT EXISTS status        VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted')),
  ADD COLUMN IF NOT EXISTS draft_payload JSONB;

-- At most one draft per staff/day/business_line. Submitted rows are excluded
-- from the constraint so the multi-submit behaviour from 011 is preserved.
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_sessions_one_draft
  ON report_sessions(staff_id, work_date, business_line_id)
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_report_sessions_draft_staff
  ON report_sessions(staff_id, work_date DESC)
  WHERE status = 'draft';
