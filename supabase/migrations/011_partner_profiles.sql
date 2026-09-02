CREATE TABLE IF NOT EXISTS partner_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES web_users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  service_areas TEXT NOT NULL DEFAULT '',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  reviewed_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS application_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS reviewed_by TEXT NOT NULL DEFAULT '';

UPDATE partner_profiles
SET application_status = 'approved', approved_at = COALESCE(approved_at, updated_at)
WHERE is_verified = true AND application_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_partner_profiles_public_slug ON partner_profiles(is_public, slug);
CREATE INDEX IF NOT EXISTS idx_partner_profiles_review ON partner_profiles(application_status, created_at DESC);

CREATE OR REPLACE FUNCTION update_partner_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_profiles_updated_at ON partner_profiles;
CREATE TRIGGER trg_partner_profiles_updated_at
BEFORE UPDATE ON partner_profiles
FOR EACH ROW
EXECUTE FUNCTION update_partner_profiles_updated_at();

NOTIFY pgrst, 'reload schema';
