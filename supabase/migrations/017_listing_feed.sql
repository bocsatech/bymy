-- Előkészített lista-feed (kártyaadatok), listing_cells nélkül a GET /api/listings-hez.
CREATE TABLE IF NOT EXISTS listing_feed (
  listing_id BIGINT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'mentett',
  vertical TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_listing_feed_status_updated
  ON listing_feed (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_feed_status_vertical_updated
  ON listing_feed (status, vertical, updated_at DESC);

NOTIFY pgrst, 'reload schema';
