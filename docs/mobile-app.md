# iOS mobil app — éles web (Capacitor)

Az **aktuális iOS app** a Capacitor héj: `ios/App/App.xcodeproj`.  
Betölti az éles weboldalt: **`https://bymy.hu`** (ugyanaz, mint a böngésző).

A korábbi natív SwiftUI forrás megmaradt: `ios-native/` (archivált / referencia).

**Android:** ugyanígy Capacitor — [`docs/android-app.md`](android-app.md).

## Első indítás

```bash
cd /Users/rbocsa/bymy
npm install
npm run ios
```

Ez syncel, majd megnyitja az Xcode-ot. Utána: telefon / szimulátor → **Run** (⌘R).

## Parancsok

| Parancs | Mit csinál |
|---------|------------|
| `npm run ios` | Sync + Xcode |
| `npm run cap:sync` | Android + iOS sync |
| `npm run cap:open:ios` | Csak Xcode |

## API / web

- Éles: `https://bymy.hu` (`capacitor.config.json` → `server.url`)
- Vercel teszt: állítsd ideiglenesen `https://bymy.vercel.app`-ra, majd `npm run cap:sync`
- Lokális: lásd `capacitor.config.local.example.json`

## OAuth

Deep link: `bymy://oauth` (Info.plist `CFBundleURLSchemes`).

## Bundle ID

`hu.bymy.app` — megegyezik az Androiddal és a régi natív appal.
