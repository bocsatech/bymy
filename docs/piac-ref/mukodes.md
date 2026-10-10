# Piactér működés (referencia)

Forrás: Jófogás feladó (`/ai/form/1`) + kategóriafa + listanézet.  
Bymy scope: **nem** kell Ingatlan / Autó (Jármű) ág.

## 1. Hirdetésfeladás — egy oldal, felülről lefelé

A feladó **nem lépésvarázsló több URL-lel**, hanem egy hosszú űrlap. A zöld pipa / narancs sáv jelzi a szekció állapotát. Alul **Tovább** (közzététel felé).

### Sorrend

1. **Hirdetés neve** (`subject`)
   - Kötelező
   - **Min. 12, max. 70** karakter
   - Tippszöveg: egyértelmű tárgy, kerüld az „eladó/kiadó” jellegű szavakat
   - Cím alapján **kategória-ajánlás** is jön („ezeket ajánljuk” + „vagy az összes közül”)

2. **Képek**
   - Drag & drop + „Képek hozzáadása”
   - Tipikus limit: **max ~10** (normal), HD; shop/B2B magasabb lehet
   - Min. oldal ~640, max ~1920 px (UI szöveg)
   - Opcionális, de erősít: AI képbeolvasás / kategória-segéd

3. **Kategória** (oszlopos drill-down)
   - 1. sor: fő kategória ikonok
   - 2. oszlop: alkategória
   - 3. oszlop: levél (ha van)
   - Utána (ha kell): **szándék** — lásd lent
   - Üres alkategória (pl. „Műszaki alkatrészek”, „Babakocsi”): nincs 3. szint → rögtön szándék

4. **Leírás** (`body`) — kötelező, szabad szöveg + tippek (állapot, anyag, méret, szállítás, garancia)

5. **Ár** (`price`)
   - Kötelező szám (max ~10 karakter)
   - Vagy **Ingyen elvihető** checkbox → ár kiiktatva

6. **Helyszín**
   - Irányítószám (4 jegy) kötelező → város ebből

7. **Extra opciók**
   - Facebook Marketplace áttöltés (limitált)
   - Kiemelés / előresorolás (fizetős, kategóriaár-tábla)
   - Szállítás jelzés (MPL, GLS, Foxpost — listanézeten szűrő is)

8. **Elérhetőségek**
   - Email (fiók)
   - Megjelenített név
   - Telefon (+ „telefonon” / „üzenetben” kapcsolók)

## 2. Kategóriafa

Három szint (piactér-ágak):

| Szint | Példa |
|------|--------|
| Fő | Műszaki cikkek, elektronika |
| Al | Mobiltelefon, kommunikáció |
| Levél | Mobiltelefon |

**Bymy katalógusban** (`public/data/piac-catalog.json`):

- Állás, Otthon, Műszaki, Szabadidő, Divat, Üzlet, Baba-mama
- `leafSkip: true` = nincs további levél, mehet a szándék / mezők

## 3. Szándék (Kínál / Keres)

A kategória után megjelenő **típus** (ref. kódok a feladó JS-ben):

| Kód | Jelentés (piactér) |
|-----|-------------------|
| `s` | **Kínál** (elad / kínál) |
| `k` | **Keres** (vesz / keres) |
| `u` | Kiadó (inkább ingatlan — nálunk kihagyva) |
| `h` | Bérelnék (ingatlan — kihagyva) |

- Tipikus termékág: **`s,k`** (Kínál + Keres)
- Állás: gyakran csak **`s`** (állásajánlat)
- A képernyőn zöld kijelölés = kiválasztott út

## 4. Keresés / listanézet (piactér böngészés)

- Fő navigáció: Piactér + függőlegesek (nálunk releváns: Állás, Divat, …)
- Szabadszöveges kereső („Mit keresel?”)
- Terület: Országosan / település
- Gyors szűrők pl. **Szállítással**, **Magánszemély**
- Találatlista: kép, cím, ár, dátum, hely, eladó típus

## 5. Ami kategóriánként változhat

A feladó motor `category_settings` alapján kapcsol mezőket:

- **Ár / noprice** — van-e ár mező
- **Extra képszám** — normal vs shop
- **Paraméterek** — pl. állapot, méret, márka (autó/ingatlan gazdag; piactér termékeknél szegényebb)
- **Ruházat** — pl. max tétel a csomagban (`max_item`)
- **Állás** — más mezőkészlet (jelentkezés / hely), nincs klasszikus Kínál–Keres pár

## 6. Bymy-ra lefordítva (következő lépés)

Minimum feladási modell piactérhez:

1. Cím (12–70) + képek (≤10)  
2. Fő → al → (levél) a `piac-catalog.json`-ból  
3. Szándék: Kínál / Keres (ahol a fa engedi)  
4. Leírás + ár (vagy ingyen) + irányítószám  
5. Kapcsolat  

Ingatlan/autó mezőmotor **nem** kell ehhez az ághoz.
