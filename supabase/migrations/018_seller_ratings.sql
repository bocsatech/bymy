-- Kereskedő értékelések (1–10), felhasználónként egyszer.
CREATE TABLE IF NOT EXISTS seller_ratings (
  seller_user_id BIGINT NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  rater_user_id BIGINT NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_user_id, rater_user_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller
  ON seller_ratings (seller_user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
