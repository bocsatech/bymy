# iOS mobil app — bymy cloud

Az iOS app forrása: `ios/Bymy/` (SwiftUI, natív).

**Android:** Capacitor héj — lásd [`docs/android-app.md`](android-app.md) (`npm run android`).

## Production backend

- **API:** `https://bymy.vercel.app` (`AutoswebBaseURL.defaultProduction`)
- **Adatbázis:** Supabase (Postgres)
- Alapértelmezett URL az appban: éles Vercel (nem localhost)

## Lokális Mac dev (opcionális)

Beállítások / UserDefaults `autosweb.baseURL` → `http://127.0.0.1:3456` vagy Mac Wi‑Fi IP.

## Profil és adatvédelem

| Adat | Hol |
|------|-----|
| Név, irányítószám, város, telefon, cégnév | Szerver (`PUT /api/auth/profile`) |
| Magán utca / lakcím, születési / okmány adatok, cég székhely + cégjegyzék + képviselő | **Csak telefon** (`DeviceContractIdentityStore`) |

## Xcode

1. Nyisd meg: `ios/Bymy.xcodeproj`
2. Clean Build Folder (⇧⌘K), majd Run (⌘R)
3. Simulator vagy iPhone — első indítás: cloud szerver

## Megjegyzés

Push értesítés: outbox + poll (nem APNs). Üzenet-csatolmány Vercelen `/tmp`-ben (nem tartós cold start után).
