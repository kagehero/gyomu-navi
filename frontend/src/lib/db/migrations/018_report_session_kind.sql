-- 018_report_session_kind.sql
-- Leader aggregate vs individual record split (顧客要望: 複数人で業務に当たる拠点).
--
-- On a site where several staff work the same day, the client wants:
--   * 売上計上: the LEADER's "拠点全体の台数" report only
--   * 個人記録: each staff's own input, kept for 採算確認 but NOT counted as sales
--
-- Model: each report_session carries a `report_kind`:
--   'site_total'  — the sales source of truth (leader's 全体報告). Counted in
--                   revenue/analytics. This is the DEFAULT so every existing
--                   session and every solo report keeps counting as sales
--                   exactly as before (no behavioural change for the common case).
--   'individual'  — a personal work record for 採算確認 only. Its business_reports
--                   are excluded from sales/revenue aggregation.
--
-- The leader submits BOTH: one 'individual' session (their own 15台) and one
-- 'site_total' session (the whole site's 45台) — per the confirmed spec (A).
-- If individual inputs and the site total disagree, the site_total is always
-- authoritative for sales; individuals never contribute to revenue.

ALTER TABLE report_sessions
  ADD COLUMN IF NOT EXISTS report_kind VARCHAR(20) NOT NULL DEFAULT 'site_total'
    CHECK (report_kind IN ('site_total', 'individual'));

-- Analytics filters sales by report_kind; index the hot path.
CREATE INDEX IF NOT EXISTS idx_report_sessions_kind
  ON report_sessions(report_kind, work_date DESC);
