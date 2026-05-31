-- 008: Password reset tokens table (gap-filler — ensures runner stays sequential)
-- This table may already exist from the initial schema; CREATE IF NOT EXISTS is safe.

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
