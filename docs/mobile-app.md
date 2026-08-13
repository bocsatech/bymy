# iOS mobil app — bymy cloud

Az iOS app forrása: `/Users/rbocsa/Downloads/autosapp/`

## Production backend

- **API:** `https://bymy.vercel.app`
- **Adatbázis:** Supabase (Postgres)
- Alapértelmezett URL az appban: `AutoswebBaseURL.productionCloud`

## Lokális Mac dev (opcionális)

Beállítások → Autosweb szerver → `http://127.0.0.1:3456` vagy Mac Wi‑Fi IP.

## API-k amit az app használ

| Végpont | Funkció |
|---------|---------|
| `GET /api/health` | Elérhetőség (`service: bymy-autosweb`) |
| `GET/POST /api/listings` | Hirdetések |
| `POST /api/auth/login` | Belépés |
| `GET /api/auth/me` | Session |
| `PUT /api/auth/avatar` | Profilkép |
| `PUT /api/auth/prefs` | Lap elrendezés |
| `/api/messages/*` | Chat |

## Xcode

1. Nyisd meg: `Downloads/autosapp/AddElAutod.xcodeproj`
2. Build & Run (Simulator vagy iPhone)
3. Első indítás: automatikusan a cloud szervert használja

## Megjegyzés

Push értesítés: outbox + 12 mp-es poll (nem APNs). Üzenet-csatolmány Vercelen `/tmp`-ben (nem tartós cold start után).
