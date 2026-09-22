-- Feed gyorsítás: denormalizált vertical + indexek
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS vertical TEXT;

CREATE INDEX IF NOT EXISTS idx_listings_status_updated
  ON listings (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_status_vertical_updated
  ON listings (status, vertical, updated_at DESC);

-- Backfill a listing_cells-ből
UPDATE listings l
SET vertical = COALESCE(
  (
    SELECT CASE
      WHEN lower(trim(v.value)) IN ('teher', 'ingatlan', 'auto')
        AND NOT (
          lower(trim(v.value)) = 'auto'
          AND lower(trim(COALESCE(a.value, ''))) IN ('kisteher', 'teherauto', 'teher')
        )
      THEN lower(trim(v.value))
      WHEN lower(trim(COALESCE(a.value, ''))) IN ('kisteher', 'teherauto', 'teher') THEN 'teher'
      WHEN lower(trim(COALESCE(a.value, ''))) LIKE 'ingatlan%' THEN 'ingatlan'
      ELSE 'auto'
    END
    FROM listing_cells v
    LEFT JOIN listing_cells a
      ON a.listing_id = v.listing_id AND a.field_key = 'hirdetes_alkategoria'
    WHERE v.listing_id = l.id AND v.field_key = 'hirdetes_vertical'
    LIMIT 1
  ),
  (
    SELECT CASE
      WHEN lower(trim(a.value)) IN ('kisteher', 'teherauto', 'teher') THEN 'teher'
      WHEN lower(trim(a.value)) LIKE 'ingatlan%' THEN 'ingatlan'
      ELSE 'auto'
    END
    FROM listing_cells a
    WHERE a.listing_id = l.id AND a.field_key = 'hirdetes_alkategoria'
    LIMIT 1
  ),
  'auto'
)
WHERE vertical IS NULL OR vertical = '';
