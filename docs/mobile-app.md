# iOS mobil app — natív SwiftUI

Az **iOS app** natív SwiftUI program: `ios/Bymy.xcodeproj`.  
Nem böngészős „asztalra mentett” oldal — saját UI, az API-t hívja: **`https://bymy.hu`**.

Opcionális web-héj (Capacitor, mint az Android): `ios-capacitor/` — ez szándékosan a weboldalt tölti.

**Android:** Capacitor web héj — [`docs/android-app.md`](android-app.md).

## Első indítás (natív app)

```bash
cd /Users/rbocsa/bymy
npm run ios
```

Vagy Xcode: nyisd meg `ios/Bymy.xcodeproj` → telefon / szimulátor → **Run** (⌘R).

## Mit tud a natív app

- Belépés / regisztráció / OAuth a `bymy.hu` API-ra
- Hirdetések, keresés, üzenetek, beállítások (SwiftUI)
- **Szerződéses adatok** csak a telefonon (`DeviceContractIdentityStore`)
- Magán utca/lakcím nem megy a szerverre

## Capacitor web-héj (opcionális)

```bash
npm run ios:capacitor
```

Ez a `https://bymy.hu` weboldalt jeleníti meg — kinézetre web, nem külön natív felület.

## Bundle ID

`hu.bymy.app`
