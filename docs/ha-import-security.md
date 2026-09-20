# Hasznaltauto import — biztonság és limitek

## Hova ment?

`POST /api/import/extracted` → S2 Postgres (`listings`) + R2 képek. Csak **bejelentkezett** user adatai alá.

## Import token (könyvjelző)

| | Session (30 nap) | Import token (`imp1.…`) |
|--|------------------|-------------------------|
| Hol | Bymy lap cookie / sessionStorage | Könyvjelző `javascript:…` URL |
| Lejárat | 30 nap | **Alap 4 óra** (`BYMY_IMPORT_TOKEN_TTL_MS`) |
| Jog | Teljes fiók | **Csak import API** |
| HA oldalról | **Nem** elfogadva | **Kötelező** |

Friss token: Autóimport → **Másolás** ( `/api/auth/bookmarklet-token` ).

Aláírás: `BYMY_IMPORT_TOKEN_SECRET` vagy meglévő `OAUTH_STATE_SECRET` (S1 `.env`).

## Rate limit (felhasználónként)

- **Alap:** 120 mentett hirdetés / óra / fiók (`BYMY_IMPORT_RATE_LIMIT`).
- Számláló: minden importált „oldal” / autó a batchben.
- Túllépés: **429** `IMPORT_RATE_LIMIT`.

## Tulajdonos (HA ID duplikátum)

Ha ugyanaz a hasznaltauto ID már **más user** hirdetése → **kihagyás** (nem felülírás).

## Env (S1 éles példa)

```env
BYMY_IMPORT_TOKEN_TTL_MS=14400000
BYMY_IMPORT_RATE_LIMIT=120
# BYMY_IMPORT_TOKEN_SECRET=…  # opcionális, külön kulcs
```

## Gate „public”

`/api/import/extracted` a members gate-en kívül van **CORS miatt**; a handler mindig auth-ot kér.
