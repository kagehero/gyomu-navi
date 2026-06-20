-- 008_notices.sql
-- Notices (broadcast / department / individual), per-user read tracking,
-- and per-site board posts.

-- ---------- notices ----------
CREATE TABLE IF NOT EXISTS notices (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id         UUID         NOT NULL REFERENCES users(id)             ON DELETE RESTRICT,
  target_type          VARCHAR(20)  NOT NULL CHECK (target_type IN ('all', 'department', 'individual')),
  target_department_id UUID                  REFERENCES departments(id)       ON DELETE RESTRICT,
  target_user_id       UUID                  REFERENCES users(id)             ON DELETE RESTRICT,
  client_id            UUID                  REFERENCES client_companies(id)  ON DELETE RESTRICT,
  title                VARCHAR(255) NOT NULL,
  body                 TEXT         NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT notices_target_consistency CHECK (
    (target_type = 'all'        AND target_department_id IS NULL     AND target_user_id IS NULL)
 OR (target_type = 'department' AND target_department_id IS NOT NULL AND target_user_id IS NULL)
 OR (target_type = 'individual' AND target_user_id IS NOT NULL       AND target_department_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notices_created
  ON notices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notices_target_user
  ON notices(target_user_id)
  WHERE target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notices_target_department
  ON notices(target_department_id)
  WHERE target_department_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_notices_updated_at ON notices;
CREATE TRIGGER trg_notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- notice_reads ----------
-- Single source of truth for "who has read which notice".
-- Aggregates (read_count / total_target) are derived on read.
CREATE TABLE IF NOT EXISTS notice_reads (
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  read_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_reads_user
  ON notice_reads(user_id);

-- ---------- board_posts ----------
CREATE TABLE IF NOT EXISTS board_posts (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID         NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  author_user_id UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title          VARCHAR(255) NOT NULL,
  body           TEXT         NOT NULL,
  pinned         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_site_pinned_created
  ON board_posts(site_id, pinned DESC, created_at DESC);

DROP TRIGGER IF EXISTS trg_board_posts_updated_at ON board_posts;
CREATE TRIGGER trg_board_posts_updated_at
  BEFORE UPDATE ON board_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
