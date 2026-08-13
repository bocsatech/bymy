# Supabase — bymy (2. lépés)

Új, **üres** Supabase projekt, teljesen külön a bocsa-app-tól és minden más projekttől.

## A) Projekt létrehozása (dashboard)

1. Nyisd meg: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project**
3. Beállítások:
   - **Name:** `bymy`
   - **Database password:** erős jelszó (mentsd el biztonságos helyre)
   - **Region:** **West EU (Ireland)** vagy **Central EU (Frankfurt)** — EU kötelező
4. **Create new project** — várj ~1–2 percet, amíg készül.

## B) Kulcsok másolása

1. Project → **Settings** → **API**
2. Másold ki (NE küldd chatbe a service role kulcsot):
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (csak szerveroldalon)

3. Lokálisan a bymy mappában:

```bash
cp .env.example .env.local
# Szerkeszd .env.local — töltsd ki a három értéket
```

`.env.local` gitignore alatt van, nem kerül fel GitHubra.

## C) Séma futtatása (üres DB)

1. Project → **SQL Editor** → **New query**
2. Futtasd sorrendben:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_baseline.sql` (előbb generáld: `node scripts/generate-supabase-seed-sql.mjs`)

3. Ellenőrzés: **Table Editor** — látszanak a táblák (`listings`, `web_users`, `conversations`, stb.), adat csak a seed fájlokból (`field_defs`, `service_categories`).

## D) Storage (későbbi lépés)

A hirdetés- és üzenet-csatolmány képekhez külön bucket kell (`listings`, `message-attachments`). Ezt a Next.js + Supabase integráció lépésénél állítjuk be.

## E) Mi NINCS benne (szándékosan)

- Nincs adatmigráció a régi SQLite-ból
- Nincs RLS policy még — a szerver a service role-lal fog kapcsolódni
- Nincs Supabase Auth — egyelőre a meglévő `web_users` modell marad

## Következő lépés (3)

Vercel projekt + env változók, majd a kód Supabase-re kötése.
