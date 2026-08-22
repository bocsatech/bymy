-- Oldallátogatók (Bocsatech admin)
CREATE TABLE IF NOT EXISTS site_visitor_sessions (
  id TEXT PRIMARY KEY,
  ip TEXT,
  user_agent TEXT,
  device_type TEXT,
  device_name TEXT,
  device_label TEXT,
  browser TEXT,
  os TEXT,
  language TEXT,
  screen TEXT,
  timezone TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_page_hits (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  ip TEXT,
  user_agent TEXT,
  device_type TEXT,
  device_name TEXT,
  device_label TEXT,
  browser TEXT,
  os TEXT,
  language TEXT,
  screen TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_visitors_last ON site_visitor_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_hits_created ON site_page_hits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_hits_visitor ON site_page_hits(visitor_id);

ALTER TABLE web_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- PostgREST séma cache frissítése (új táblák azonnal látszanak az API-n)
NOTIFY pgrst, 'reload schema';
