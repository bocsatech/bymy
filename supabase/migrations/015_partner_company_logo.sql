-- Céglogó külön a profilképtől (publikus partnerprofil)
ALTER TABLE partner_profiles
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
