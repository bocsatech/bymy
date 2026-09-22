ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS commission TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
