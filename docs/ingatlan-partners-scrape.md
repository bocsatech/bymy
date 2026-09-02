# partner.ingatlan.com partnerek → Excel (Chrome CDP)

A headless scrape-et a botvédelem blokkolja. Ezért a **te Chrome-odban** fut, amihez a script csatlakozik.

## Lépések

### 1. Chrome debug indítás

```bash
cd /Users/rbocsa/bymy
bash mac/chrome-debug-ingatlan-partners.command
```

Megnyílik egy külön Chrome profil (port **9223**), a partnerlistával.

Várd meg, amíg **nem** „Csak egy gyors ellenőrzés!”, és látszanak a partnerek.

### 2. Scrape (teljes telefonszám)

```bash
cd /Users/rbocsa/bymy
npm run scrape:ingatlan-partners
```

Próba:

```bash
LIMIT=5 npm run scrape:ingatlan-partners
```

A script megnyomja a **Felfedés** gombot. Ha **Cloudflare Turnstile** captcha jön:

1. Nézd a debug Chrome ablakot
2. Pipáld / oldd meg a captchát
3. A script megvárja (alapból **180 mp**, állítható: `CAPTCHA_WAIT=300`)

Gyakran **egy sikeres captcha után** a következő profilok automatikusan felfedik a számot (`auto-reveal`).

Csonka / maszkolt sorok újra:

```bash
RETRY_MASKED=1 npm run scrape:ingatlan-partners
```

### 3. Hol van a fájl?

- Excel: `data/ingatlan-partners/ingatlan-partners.xlsx`
- Progress: `data/ingatlan-partners/progress.json`
- Log: `data/ingatlan-partners/scrape.log`
- Nyers sorok: `data/ingatlan-partners/results.jsonl`

Az Excelbe **csak a teljes telefonszámú** sorok kerülnek. A részlegesek a `results.jsonl`-ben maradnak, és `RETRY_MASKED=1`-gyel újrapróbálhatók.

## Oszlopok

| Oszlop | Megjegyzés |
|--------|------------|
| Név | Profil `h1` |
| Cégnév | Ha van |
| Telefonszám | Teljes szám a Felfedés után |
| E-mail | Ritka |
| Tel. maszkolt? | `nem` a siker esetén |
| URL | Profil link |
