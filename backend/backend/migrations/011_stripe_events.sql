-- 011: Dedup table for Stripe webhook events.
-- We index by Stripe's event.id; processed_at is BIGINT milliseconds (Date.now()).

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  processed_at BIGINT NOT NULL,
  INDEX idx_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
