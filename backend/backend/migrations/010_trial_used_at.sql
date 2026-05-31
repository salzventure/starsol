-- 010: Track whether a user has already consumed their free trial.
-- Prevents trial farming via repeated sign-ups against the same user row.

ALTER TABLE users
  ADD COLUMN trial_used_at BIGINT;

CREATE INDEX idx_trial_used_at ON users (trial_used_at);
