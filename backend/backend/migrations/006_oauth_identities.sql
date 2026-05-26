-- oauth_identities: one row per (provider, provider_user_id)
CREATE TABLE IF NOT EXISTS oauth_identities (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider          VARCHAR(32) NOT NULL,
    provider_user_id  VARCHAR(255) NOT NULL,
    user_id           INT NOT NULL,
    email_at_link     VARCHAR(255) NULL,
    created_at        BIGINT NOT NULL,
    last_used_at      BIGINT NULL,
    UNIQUE KEY uniq_provider_sub (provider, provider_user_id),
    INDEX idx_oauth_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
