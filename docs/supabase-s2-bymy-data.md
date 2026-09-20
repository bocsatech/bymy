# Supabase az S2-n (bymy-data) — grafikus Studio

## Mi van már kint?

| Szerep | Gép | SSH | Megjegyzés |
|--------|-----|-----|------------|
| App (bymy.hu) | **S1** `bymy-app` | `179.198.205.130` | `/var/www/bymy` |
| Postgres + Supabase stack | **S2** `bymy-data` | `168.231.110.159` | `/root/supabase-project` |

**bymy.hu (S1)** env:

```env
SUPABASE_URL=http://168.231.110.159:8000
SUPABASE_PUBLIC_URL=https://bymy.hu
SUPABASE_SERVICE_ROLE_KEY=…   # S2 stack .env SERVICE_ROLE_KEY (ugyanaz a projekt)
```

A képek **R2** (`img.bymy.hu`), nem Supabase Storage.

**Vercel** továbbra is **külön** Supabase.com projekt (szándékosan más adat).

## Grafikus felület (Supabase Studio)

A Studio konténer alapból **nem** nyilvános — csak belső Docker hálózaton fut.

### A) Ajánlott: SSH tunnel (Mac)

1. Egyszer: `node scripts/s2-studio-localhost.mjs`  
   → Studio: `127.0.0.1:54323` **csak az S2 gépen** (localhost).
2. Minden admin munkához: dupla katt **`mac/bymy-data-studio.command`**  
   → tunnel + böngésző: http://127.0.0.1:54323

Táblák, SQL, adatok — ugyanaz, mint a felhős Supabase Studio.

### B) Később: `studio.bymy.hu` (HTTPS + jelszó)

Ha kell böngészőből VPN/tunnel nélkül:

1. Cloudflare DNS: **`studio`** A rekord → `168.231.110.159` (**DNS only**, szürke felhő — Let's Encrypt miatt).
2. S2 `/root/supabase-project/.env`:
   - `PROXY_DOMAIN=studio.bymy.hu`
   - `DASHBOARD_USERNAME=…` / `DASHBOARD_PASSWORD=…` (nginx basic auth)
   - `CERTBOT_EMAIL=…`
3. Override: `sh run.sh config add nginx` (a supabase self-host `run.sh` a szerveren).
4. `sh run.sh start`

A nginx sablon: `/` → Studio (basic auth), `/rest`, `/auth`, … → API.

**Figyelem:** ne tedd nyilvánosra a **5432** Postgres portot; az appnak elég a **8000** (Kong/Envoy) S1-ről.

## Séma / migrációk

Repo: `supabase/migrations/*.sql`

Lokál vagy CI (Postgres URI):

```bash
# .env.local
SUPABASE_DB_URL=postgresql://postgres:JELSZO@168.231.110.159:5432/postgres

node scripts/apply-supabase-migrations.mjs
```

S2-n közvetlenül (docker):

```bash
ssh bymy-data 'docker exec -i supabase-db psql -U postgres -d postgres' < supabase/migrations/010_image_assets.sql
```

Siker után: `NOTIFY pgrst, 'reload schema';` (PostgREST cache).

## Ellenőrzés

```bash
ssh bymy-data 'docker ps --format "table {{.Names}}\t{{.Status}}"'
curl -s http://168.231.110.159:8000/rest/v1/ -H "apikey: ANON" | head
curl -s https://bymy.hu/api/health
```

## Backup

S2: `/root/backups/` — rendszeres `pg_dump` ajánlott (cron már lehet fent; ellenőrizd).

## Összefoglaló

- **„Supabase S2-re”** élesben **már megvan** a bymy.hu adatbázisnak.
- **Grafikus UI:** `mac/bymy-data-studio.command` + egyszeri `s2-studio-localhost.mjs`.
- **Felhős Supabase** csak Vercel preview / külön környezet — összevonás külön döntés (dump + cutover).
