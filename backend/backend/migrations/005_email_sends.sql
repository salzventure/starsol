-- 005: Email send log (Resend integration)

CREATE TABLE IF NOT EXISTS email_sends (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  campaign VARCHAR(100),
  email_address VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  resend_id VARCHAR(255),
  status ENUM('sent','stub','error') NOT NULL DEFAULT 'sent',
  sent_at BIGINT NOT NULL,
  INDEX idx_user_campaign (user_id, campaign),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
