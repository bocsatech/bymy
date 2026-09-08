# Production live setup for Vercel + Supabase

This is the exact list of cloud-side tasks that must be done in the Vercel and Supabase dashboards.

## 1) Vercel env variables

In Vercel project settings, add these as Production variables:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
PUBLIC_BASE_URL=https://bymy.vercel.app
NODE_ENV=production
PORT=3000
TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET_KEY
```

Turnstile (belépés / regisztráció botvédelem):
- Cloudflare Dashboard → Turnstile → Add widget
- Domain: `bymy.vercel.app` (és később `bymy.hu`)
- Widget mode: Managed
- A site key + secret key a fenti két env változó
- Ha nincs beállítva, a formok Turnstile nélkül is mennek (lokális / WIP)

If you are using OAuth later, also add:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
OAUTH_PUBLIC_BASE_URL=https://bymy.vercel.app
OAUTH_STATE_SECRET=
```

Important:
- PUBLIC_BASE_URL must be the public prod URL, not localhost
- use the same Supabase project for all keys
- never expose SUPABASE_SERVICE_ROLE_KEY to the browser

## 2) Redeploy

After saving env values:
- open Vercel Project
- click Deployments
- trigger a fresh deploy / redeploy

## 3) Supabase migration order

Run these in SQL Editor in order:

1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_seed_baseline.sql
3. supabase/migrations/005_level1.sql
4. supabase/migrations/006_drop_unused_form_fields.sql
5. supabase/migrations/007_visitors_and_last_login.sql
6. supabase/migrations/008_visitor_monitoring.sql
7. supabase/migrations/009_password_reset.sql
8. supabase/migrations/010_image_assets.sql

## 4) Supabase Storage buckets

Create these buckets exactly:

- listing-images
- profile-images
- recommendation-images
- partner-images

## 5) Verify production health

After redeploy, open:

- https://bymy.vercel.app/api/health
- should return ok: true

Then open:

- https://bymy.vercel.app/belepes.html

Expected result:
- page loads normally
- no fetch failed error
- no auth 500

## 6) If the auth endpoints still fail

Check these in order:

1. Supabase migration SQL executed successfully
2. Vercel env vars are present in the Production environment
3. SUPABASE_URL matches the same project as the DB
4. SUPABASE_SERVICE_ROLE_KEY is the service role key, not anon key
5. fresh Vercel redeploy is triggered

## 7) Root cause from the code

The live issue was caused by missing auth tables in the Supabase project, which triggered schema errors and browser fetch failures. The code now handles that case gracefully and returns a logged-out state instead of crashing the page.

The actual cloud configuration still requires a valid Vercel login and a valid Supabase project access token in the cloud dashboard.
