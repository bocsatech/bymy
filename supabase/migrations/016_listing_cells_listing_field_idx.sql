-- Feed cell lekérdezések: listing_id + field_key szűrés
CREATE INDEX IF NOT EXISTS idx_listing_cells_listing_field
  ON listing_cells (listing_id, field_key);
