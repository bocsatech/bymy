# ingatlan.com hirdetésfeladás — típus → méret → részletek

Forrás: `https://hirdetesfeladas.ingatlan.com/js/adform_v2.js` + createAd bundle
(`property_type_id` / `property_subtype_id` címkék). Ellenőrizve: 2026-09.

Bymy döntések: saját UI marad; csak a **viselkedés** (láthatóság / kaszkád / zárolás).
Airbnb külön útvonal. Üzletág + típus **csak publikálás után** zárolódik.

## Üzletág (`listing_type_id`)

| ID | Címke |
|----|--------|
| 1 | Eladó |
| 2 | Kiadó |

Figyelmeztetés náluk: utólag **nem** módosítható az eladó/kiadó, sem az ingatlan típusa.

## Típus (`property_type_id`)

| ID | Címke | Bymy `ingatlan_lakas_tipus` |
|----|--------|----------------------------|
| 1 | Lakás | `lakas` |
| 2 | Ház | `haz` |
| 3 | Telek | `telek` |
| 4 | Garázs | `garazs` |
| 5 | Nyaraló | `nyaralo` |
| 6 | Iroda | `iroda` |
| 7 | Üzlethelyiség | `uzlethelyiseg` |
| 8 | Vendéglátás | `vendeglatas` |
| 9 | Ipari | `ipari` |
| 10 | Mezőgazdasági | `mezogazdasagi` |
| 11 | Fejlesztési terület | `fejlesztesi_terulet` |
| 13 | Intézmény | `intezmeny` |
| 14 | Raktár | `raktar` |

Fő chip: Lakás · Ház · Telek · Nyaraló · **További típusok** (többi).

## Altípus kaszkád (`property_subtype_id` → `SFH.so`)

| Típus | Eladó altípusok | Kiadó eltérés |
|-------|-----------------|---------------|
| Lakás (1) | 1 Tégla, 2 Panel, 55 Csúszózsalus | + **6 Szoba** |
| Ház (2) | 7 Családi ház, 8 Ikerház, 9 Sorház, 10 Házrész, 11 Kastély, 12 Tanya, 56 Könnyűszerkezetes, 57 Vályogház | ugyanaz |
| Telek (3) | 13–16 (lakó / üdülő / külterületi / egyéb) | |
| Garázs (4) | 17 Önálló, 18 Teremgarázs, 64 Beálló | |
| Nyaraló (5) | 19–21 | |
| Iroda (6) | 23 Irodaházban, 25 Családi házban, 26 Lakásban, 39 Egyéb | |
| Üzlethelyiség (7) | 27–30 | |
| Vendéglátás (8) | 41–42, 40 | |
| Ipari (9) | 34–36, 43 | |
| Mezőgazdasági (10) | 12 Tanya, 38 Általános, 58 Termőföld, 59 Erdő, 60 Pince/présház | |
| Fejlesztési (11) | 44–49 | |
| Intézmény (13) | 51–54 | |
| Raktár (14) | 33 Raktárhelyiség | |

## Méret (`property_type` → `SFH.sf`)

| Mező | Látható típusok |
|------|-----------------|
| `area_size_living` (lakó alapterület) | 1, 2, 5 |
| `area_size` (általános alapterület) | 4, 6, 7, 8, 9, 13, 14 |
| `lot_size` (telek) | 2, 3, 5, 9, 10, 11, 13, 14 |
| `balcony_size` | csak 1 (Lakás) |
| `room_count` / `small_room_count` | 1, 2, 5 (+ iroda altípus 25/26 félszoba) |
| `parking_place_count` | csak 4 (Garázs) |
| `lot_coverability` / `szintteruleti_mutato` | csak 3 (Telek) |
| `optional_building_size` | csak 10 (Mezőgazdasági) |
| `minimum_rentable_size` | Kiadó + Iroda (6) |

## Részletek — típus mátrix (fő szabályok)

Jelölés: szám = `property_type_id`. Kiadó-only: csak `listing_type_id === 2`.

| Mező (ingatlan.com) | Bymy kulcs (közelítés) | Látható |
|---------------------|------------------------|---------|
| condition | `allapot` | 1,2,4,5,6,7,8,13,14 |
| year_built | `ingatlan_kora` | 1,2,4,5,6,7,8,13,14 |
| heating ×3 | `futes` | 1,2,5,13 |
| energy cert | `energiahatekonys` (A+++…I) | 1,2,5,6,7,8,9,13,14 |
| utility_costs / common_charges | `rezsikoltseg` / `kozos_koltseg` | 1,2,5,7,13 / 1,2,5,13 + eladó\|kiadó |
| average_electric / average_gas | `atlagos_aram_fogyasztas` / `atlagos_gaz_fogyasztas` | 1,2,5,13 |
| without_gas_connection | `nincs_gaz_bekotve` | 1,2,5,13 |
| solar_panel (+ kW) | `napelem` / `napelem_kw` | **2,5,13** (nem lakás!); kW ha van |
| insulation (+ cm) | `szigeteles` / `szigeteles_cm` | 1,2,5,13; cm ha van |
| building_floor_count | `szintek_*` | 1,2,5,6,7,8,9,13,14 |
| floor_id | `emelet` | 1,6,7,8,9,14 |
| is_attic | (~tetőtéri) | 1,6 |
| attic_type | `tetoter` | 2,5,13 |
| cellar | `pince` | 2,13 |
| comfort | `komfort` | 1,2,13 |
| accessibility | `akadalymentesitett` | 1,2,5,6,7,8,13 |
| view | `kilatas` | 1,2,3,5,11,13 |
| bathroom | `furdo_wc` | 1,2,13 |
| air_conditioner | `legkondicionalo` | 1,2,5,6,7,8,13 |
| parking_place_type | `parkolas` | 1,2,6,13 |
| elevator | `lift` | csak 1 |
| garden_access | `kertkapcsolatos` | csak 1 |
| orientation | `tajolas` | csak 1 |
| inner_height | `belmagassag` | csak 1 |
| panelprogram | `panelprogram` | Lakás + altípus Panel |
| közművek (villany/víz/gáz/csatorna) | `villany`… | 3,5,11 |
| is_new_subdivision | `uj_parcellazasu` | csak 3 |
| is_rent_right | — | Eladó + 1,2,3,4,5,7,8 |
| furniture / smoking / pets | `butorozott` / dohányzás / kisállat | **Kiadó** + 1,2,5,13 (gépesített: kiadó+lakás) |
| available_from / min_rent_months | `koltozheto` / `min_berleti_ido` | **Kiadó** |
| office_category | `irodahaz_kategoria` | Iroda + altípus 23 |
| operational_price* | `uzemeltetesi_dij_*` | **Kiadó** + Iroda |

### Ház eladó — megfigyelt Részletek (Kőér köz, családi ház, 0/22)

Kötelezőnek jelölt UI mezők: Állapot, Átlagos áram/gáz, Fűtés (+2–3), Energetikai tanúsítvány, Rezsiköltség, Közös költség, Napelem, Szigetelés, Hány szintes, Tetőtér, Bérleti jog eladó, Pince, Komfort, Akadálymentesített, Kilátás, Fürdő+WC, Légkondi, Parkolóhely típusa. Építés éve opcionális.

Rejtett ezen a típuson: Lift, Panelprogram, emelet, bútorozott, közművek, iroda kategória, telek-only, kiadó-only.

Méret (ház): Alapterület, Telekterület, Egész/félszobák.

## Wizard lépések (create)

Adataim → Típus → Cím → Méret → Leírás → Ár → szerkesztő szekciók (Cím, Részletek, Fotók, Videó, Alaprajzok, Ár, Méret, Szöveg).
