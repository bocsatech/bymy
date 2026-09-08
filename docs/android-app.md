# Bymy — Android app (Capacitor)

Az Android app a **bymy weboldalt** tölti be natív héjban (Capacitor WebView). Éles URL: **`https://bymy.hu`**.

Csomag azonosító: **`hu.bymy.app`** (megegyezik az iOS-sel).

---

## Mi kell a gépre?

1. **Android Studio** (Ladybug vagy újabb) — [developer.android.com/studio](https://developer.android.com/studio)
2. **Node.js 24** (már megvan a projekthez)
3. **USB-s Android telefon** vagy emulátor (API 24+, ajánlott API 34)

Android Studio első indításakor telepítsd:
- Android SDK
- Android SDK Platform-Tools
- Legalább egy **System Image** (pl. Pixel 8 / API 34)

---

## Első build (telefonon vagy emulátoron)

```bash
cd /Users/rbocsa/bymy
npm install
npm run android
```

Ez:
1. Szinkronizálja a Capacitor projektet (`cap sync android`)
2. Megnyitja az **Android Studio**-t az `android/` mappával

Android Studio-ban:
1. Várj, amíg a **Gradle sync** kész (alsó sáv)
2. Válaszd ki a telefont vagy emulátort (felső eszközválasztó)
3. **Run** ▶ (zöld gomb) vagy `Shift+F10`

Az app megnyílik, betölti a bymy éles oldalt.

---

## Parancsok

| Parancs | Mit csinál |
|---------|------------|
| `npm run android` | Sync + Android Studio megnyitása |
| `npm run cap:sync` | Web asset + plugin szinkron |
| `npm run cap:open` | Csak Android Studio megnyitása |

---

## Lokális szerver tesztelése (Mac + telefon, ugyanaz a Wi‑Fi)

Ha a Macen fut a `npm start` (3456), a telefon **nem** éri el a `localhost`-ot.

1. Mac IP cím: `ipconfig getifaddr en0` (pl. `192.168.1.42`)
2. Másold: `capacitor.config.local.example.json` → `capacitor.config.local.json`
3. A `capacitor.config.json` `server.url` mezőjét ideiglenesen állítsd `http://192.168.1.42:3456`-ra, `"cleartext": true`
4. `npm run cap:sync` → újra Run Android Studio-ban

**Fontos:** éles app mindig `https://bymy.hu`-t használ — lokális / Vercel URL csak fejlesztéshez.

---

## Play Store (később)

1. **Google Play Console** fiók (~25 USD egyszeri)
2. Android Studio → **Build → Generate Signed Bundle / APK** → **AAB**
3. Aláíró kulcs (keystore) — őrizd meg biztonságosan
4. Feltöltés: Play Console → Internal testing → Production

Store-hoz még kell: app ikon (512×512), screenshotok, adatvédelmi URL, rövid/hosszú leírás.

---

## OAuth (Google belépés)

Az app `bymy://oauth` deep linket kezeli (AndroidManifest). A Google Cloud Console-ban add hozzá az Android OAuth clientet:
- Package name: `hu.bymy.app`
- SHA-1: debug/release aláíró tanúsítvány ujjlenyomata (Android Studio: Gradle → signingReport)

---

## Projekt struktúra

```
bymy/
├── capacitor.config.json    # fő config (éles URL)
├── www/index.html           # fallback / splash szöveg
└── android/                 # Android Studio projekt
```

---

## iOS vs Android

| | iOS | Android |
|---|-----|---------|
| Technológia | Natív SwiftUI (`ios/`) | Capacitor + web (`android/`) |
| Éles API / web | bymy.hu API | bymy.hu web |
| Opcionális web-héj | `ios-capacitor/` | — |
| Bundle ID | hu.bymy.app | hu.bymy.app |

---

## Hibaelhárítás

**Gradle sync failed** — Android Studio → SDK Manager → telepítsd a hiányzó SDK-t.

**Üres fehér képernyő** — ellenőrizd: telefon nete, `https://bymy.hu` böngészőben megnyílik-e.

**„Cleartext not permitted”** lokális HTTP-nél — `cleartext: true` a configban + csak dev.

**Plugin hiba sync után** — `npm run cap:sync` újra, majd Android Studio **File → Invalidate Caches**.
