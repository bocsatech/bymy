-- Bővített látogató-monitoring (oldalcím, viewport, user, stb.)

ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS last_path TEXT;
ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS viewport TEXT;
ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS pixel_ratio REAL;
ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS connection_type TEXT;
ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS hardware_concurrency INTEGER;
ALTER TABLE site_visitor_sessions ADD COLUMN IF NOT EXISTS device_memory REAL;

ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS page_title TEXT;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS viewport TEXT;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS pixel_ratio REAL;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS connection_type TEXT;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS hardware_concurrency INTEGER;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS device_memory REAL;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS cookie_enabled BOOLEAN;
ALTER TABLE site_page_hits ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'page';

CREATE INDEX IF NOT EXISTS idx_site_hits_user ON site_page_hits(user_id);
CREATE INDEX IF NOT EXISTS idx_site_visitors_user ON site_visitor_sessions(user_id);

NOTIFY pgrst, 'reload schema';
