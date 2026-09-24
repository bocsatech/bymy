# Használtautó kereskedések → Excel (Chrome CDP)

A headless scrape-et a botvédelem blokkolja. Ezért a **te Chrome-odban** fut, amihez a script csatlakozik.

## Lépések

### 1. Chrome debug indítás

```bash
cd /Users/rbocsa/bymy
bash mac/chrome-debug-hasznaltauto.command
```

Megnyílik egy külön Chrome profil, a kereskedéslista oldallal.

Várd meg, amíg **nem** „Egy pillanat…” a cím, és látszanak a kereskedések.

### 2. Scrape indítás (másik terminál)

```bash
cd /Users/rbocsa/bymy
npm run scrape:ha-dealers
```

Próba (csak 20 db):

```bash
LIMIT=20 npm run scrape:ha-dealers
```

URL lista újraggyűjtése:

```bash
REFRESH_URLS=1 npm run scrape:ha-dealers
```

Hiányzó mezők pótlása (találat db, nyitvatartás) a már mentett URL-ekre:

```bash
REFRESH_FIELDS=1 npm run scrape:ha-dealers
```

Teljes újra-scrape (régi `results.jsonl` → `.bak-…`):

```bash
RESCRAPE=1 npm run scrape:ha-dealers
```

### 3. Hol van a fájl?

- Excel: `data/hasznaltauto-kereskedesek/hasznaltauto-kereskedesek.xlsx`
- Progress: `data/hasznaltauto-kereskedesek/progress.json`
- Log: `data/hasznaltauto-kereskedesek/scrape.log`
- Nyers sorok: `data/hasznaltauto-kereskedesek/results.jsonl`

A terminálban folyamatosan kiírja: `kész X/Y | hátra Z`.

Megszakítás után újraindításkor **folytatja** (a `results.jsonl` alapján kihagyja a kész URL-eket), kivéve `RESCRAPE=1` / `REFRESH_FIELDS=1`.

## Oszlopok

Cégnév | Cím | Web | Találat (db) | Nyitvatartás | Akikhez fordulhat | E-mail | Elsődleges tel. | Másodlagos tel. | URL

**Megjegyzés:** e-mail / telefon a HTML `data-contact-value` mezőiből jön (UI-n gomb mögött is gyakran már a DOM-ban van). Nyitvatartás naponta (`Hétfő: … | Kedd: …`). Találat = „N db találat” a kereskedés oldaláról.
