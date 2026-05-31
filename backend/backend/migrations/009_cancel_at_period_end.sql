-- 009: Ensure subscriptions table has cancel_at_period_end (idempotent guard).
-- The original 001 schema already declares this column, but on older databases that
-- were rolled out before it was added we add it defensively. The migration runner
-- swallows ER_DUP_FIELDNAME, so this is safe to re-apply.

ALTER TABLE subscriptions
  ADD COLUMN cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE subscriptions
  ADD COLUMN current_period_end BIGINT;

ALTER TABLE subscriptions
  ADD COLUMN current_period_start BIGINT;
