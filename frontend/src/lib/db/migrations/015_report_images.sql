-- 015_report_images.sql
-- Multiple images per business report (顧客要望: 1報告に最大10枚).
-- Phase1 stored a single image in business_reports.image_url. That column is
-- KEPT for backward compatibility; new uploads go into report_images and reads
-- merge both. The 10-image cap is enforced in the application layer.

CREATE TABLE IF NOT EXISTS report_images (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID         NOT NULL REFERENCES business_reports(id) ON DELETE CASCADE,
  object_key  TEXT         NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_images_report
  ON report_images(report_id, sort_order);
