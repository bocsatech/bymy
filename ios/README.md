# Bymy — iOS (natív SwiftUI)

Újraépített natív app. Kinézet és navigáció = mobil web 1:1.

## Indítás

```bash
npm run ios
```

Vagy Xcode: `ios/Bymy.xcodeproj` → saját iPhone → **Run** (⌘R).

Signing: **Automatically manage signing** → Team = Apple ID.

## Spec (v2)

- Bundle: `hu.bymy.app`
- Backend: `https://bymy.hu` (online-only)
- Felső sáv lapozás: Kezdőlap → Autó → Teherautó → Ingatlan → Ajánlások
- Alsó tab: Főoldal / Keresés / Feladás / Hírfolyam / Fiók
- Auth: ugyanaz mint weben (`/api/auth/*`)
- HA / autoimport: nincs

## Nincs

- Capacitor iOS héj (törölve)
- Offline cache / push (később)
