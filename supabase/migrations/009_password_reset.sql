-- Jelszó-visszaállítás token (email link)
ALTER TABLE web_users ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
ALTER TABLE web_users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
