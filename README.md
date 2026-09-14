# bymy

Magyar autóhirdetés portál — független projekt.

**Nem kapcsolódik** a `bocsa-app`, Bocsa CRM vagy más repóhoz.

## Stack (cél)

- **Vercel** — `bymy.vercel.app`
- **Supabase** — PostgreSQL + Storage (EU)
- **Node** + **Supabase** (egyetlen adatbázis: bymy.hu = Vercel = lokális fejlesztés)

## Helyi futtatás (fejlesztés)

`.env.local` kötelező (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — ugyanaz, mint bymy.hu / S1).

```bash
npm install
npx playwright install chromium
npm start
```

→ http://127.0.0.1:3456

Env szinkron: `mac/sync-supabase-env.command` (S1 + Vercel).

## Repo

- GitHub: https://github.com/bocsatech/bymy
- Publikus; külön Supabase és Vercel projekt.
