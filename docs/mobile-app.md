# iOS mobil app — natív SwiftUI (v2)

Az **iOS app** natív SwiftUI: `ios/Bymy.xcodeproj`.  
Kinézet és menük = **mobil web 1:1**. Backend: **`https://bymy.hu`**.

**Android:** Capacitor web héj — [`docs/android-app.md`](android-app.md).

## Indítás

```bash
cd /Users/rbocsa/bymy
npm run ios
```

Xcode: `ios/Bymy.xcodeproj` → saját iPhone → **Run** (⌘R).

## Mit tud (váz)

- Felső menüsáv + iOS oldal-lapozás: Kezdőlap / Autó / Teherautó / Ingatlan / Ajánlások
- Alsó tab: Főoldal / Keresés / Feladás / Hírfolyam / Fiók
- Belépés / regisztráció a `bymy.hu` API-ra
- Hirdetéslisták a `/api/listings` végpontról
- Online-only (nincs offline cache, nincs push első körben)
- HA / autoimport: **nincs** (telefonon nem)

## Bundle ID

`hu.bymy.app` · verzió **2.0.0**
