# partner.ingatlan.com partnerek → Excel (Chrome CDP)

A headless scrape-et a botvédelem blokkolja. Ezért a **te Chrome-odban** fut, amihez a script csatlakozik.

## Lépések

### 1. Chrome debug indítás

```bash
cd /Users/rbocsa/bymy
bash mac/chrome-debug-ingatlan-partners.command
```

Megnyílik egy külön Chrome profil (port **9223**), a partnerlistával.

Várd meg, amíg **nem** „Csak egy gyors ellenőrzés!”, és látszanak a partnerek (~1009).

### 2. Scrape indítás (másik terminál)

```bash
cd /Users/rbocsa/bymy
npm run scrape:ingatlan-partners
```

Próba (csak 20 db):

```bash
LIMIT=20 npm run scrape:ingatlan-partners
```

URL lista újraggyűjtése:

```bash
REFRESH_URLS=1 npm run scrape:ingatlan-partners
```

### 3. Hol van a fájl?

- Excel: `data/ingatlan-partners/ingatlan-partners.xlsx`
- Progress: `data/ingatlan-partners/progress.json`
- Log: `data/ingatlan-partners/scrape.log`
- Nyers sorok: `data/ingatlan-partners/results.jsonl`

Megszakítás után újraindításkor **folytatja** (`results.jsonl` alapján).

## Oszlopok

| Oszlop | Megjegyzés |
|--------|------------|
| Név | Profil `h1` |
| Cégnév | Ha van (iroda neve a kártyán) |
| Telefonszám | Látható szám — gyakran **csonka** (`+36 20 242`), mert a teljeshez „Felfedés” + CAPTCHA kell |
| E-mail | Ritka; a legtöbb profilon csak kapcsolatfelvételi űrlap van |
| Tel. maszkolt? | `igen`, ha még van Felfedés gomb |
| URL | Profil link |

## Fontos limit

A teljes telefonszám CAPTCHA mögött van profilonként. A scrape **nem oldja meg** a captchát automatikusan — a nyilvános / részleges számot menti.
