/** Böngésző + szerver: ingatlan mezőopciók (kereső / űrlap / admin). */

export const INGATLAN_UZLETAG = [{ value: "berles", label: "Bérlés" }];

export const INGATLAN_LAKAS_TIPUS = [
  { value: "", label: "Mindegy" },
  { value: "teglalakas", label: "Téglalakás" },
  { value: "panellakas", label: "Panellakás" },
  { value: "szoba", label: "Szoba" },
  { value: "rovid_berles", label: "Rövid bérlés" },
];

export const INGATLAN_ALLAPOT = [
  { value: "", label: "Mindegy" },
  { value: "uj_epitesu", label: "Új építésű" },
  { value: "felujitott", label: "Felújított" },
  { value: "jo_allapotu", label: "Jó állapotú" },
  { value: "kozepes_allapotu", label: "Közepes állapotú" },
  { value: "felujitando", label: "Felújítandó" },
  { value: "befejezetlen", label: "Befejezetlen" },
];

export const INGATLAN_KORA = [
  { value: "", label: "Mindegy" },
  { value: "0-1", label: "0–1 év" },
  { value: "2-5", label: "2–5 év" },
  { value: "6-10", label: "6–10 év" },
  { value: "10-15", label: "10–15 év" },
  { value: "15-20", label: "15–20 év" },
  { value: "20-30", label: "20–30 év" },
  { value: "30-40", label: "30–40 év" },
  { value: "40+", label: "40 év felett" },
];

export const MIN_BERLETI_IDO = [
  { value: "", label: "Mindegy" },
  { value: "6_honap_alatt", label: "6 hónap alatt" },
  { value: "1_ev_alatt", label: "1 év alatt" },
  { value: "2-5_ev", label: "2–5 év" },
];

export const MIN_BERLETI_IDO_ROVID = [
  { value: "", label: "Mindegy" },
  { value: "1_nap", label: "1 nap" },
  { value: "2_nap", label: "2 nap" },
  { value: "1_het", label: "1 hét" },
  { value: "2_het", label: "2 hét" },
];

export const BUTOROZOTT = [
  { value: "", label: "Mindegy" },
  { value: "reszben", label: "Részben" },
  { value: "igen", label: "Igen" },
  { value: "nem", label: "Nem" },
];

export const KILATAS = [
  { value: "", label: "Mindegy" },
  { value: "utcara_nezo", label: "Utcára néző" },
  { value: "kertre_nezo", label: "Kertre néző" },
  { value: "panoramas", label: "Panorámás" },
  { value: "udvari", label: "Udvari" },
  { value: "parkolora_nezo", label: "Parkolóra néző" },
];

export const TAJOLAS = [
  { value: "", label: "Mindegy" },
  { value: "eszak", label: "Észak" },
  { value: "eszakkelet", label: "Északkelet" },
  { value: "eszaknyugat", label: "Északnyugat" },
  { value: "kelet", label: "Kelet" },
  { value: "delkelet", label: "Délkelet" },
  { value: "delnyugat", label: "Délnyugat" },
  { value: "del", label: "Dél" },
];

export const FUTES = [
  { value: "", label: "Mindegy" },
  { value: "gaz_konvektor", label: "Gáz (konvektor)" },
  { value: "hazkozponti", label: "Házközponti" },
  { value: "hazkozponti_egyedi", label: "Házközponti egyedi méréssel" },
  { value: "tavfutes", label: "Távfűtés" },
  { value: "tavfutes_egyedi", label: "Távfűtés egyedi méréssel" },
  { value: "elektromos_konvektor", label: "Elektromos konvektor" },
  { value: "elektromos_futopanal", label: "Elektromos fűtőpanel" },
  { value: "elektromos_kazan", label: "Elektromos kazán" },
  { value: "huto_futo_klima", label: "Hűtő-fűtő klíma" },
  { value: "infrafutes", label: "Infrafűtés" },
  { value: "kandalo", label: "Kandalló" },
  { value: "kalyha", label: "Kályha" },
  { value: "fan_coil", label: "Fan-coil" },
  { value: "gazkazan", label: "Gázkazán" },
  { value: "vegyes_tuzelesu_kazan", label: "Vegyes tüzelésű kazán" },
  { value: "egyeb_kazan", label: "Egyéb kazán" },
  { value: "cserepkalyha", label: "Cserépkályha" },
  { value: "padlofutes", label: "Padlófűtés" },
  { value: "falfutes", label: "Falfűtés" },
  { value: "mennyezeti_hutes_futes", label: "Mennyezeti hűtés-fűtés" },
  { value: "hoszivattyu", label: "Hőszivattyú" },
  { value: "egyeb", label: "Egyéb" },
  { value: "nincs", label: "Nincs" },
];

export const PARKOLAS = [
  { value: "", label: "Mindegy" },
  { value: "udvari_beallo", label: "Udvari beálló" },
  { value: "teremgarazs", label: "Teremgarázs" },
  { value: "onallo_garazs", label: "Önálló garázs" },
  { value: "utcai", label: "Utcai" },
  { value: "kozelben_berelheto", label: "Közelben bérelhető" },
];

export const KOMFORT = [
  { value: "", label: "Mindegy" },
  { value: "luxus", label: "Luxus" },
  { value: "duplakomfortos", label: "Duplakomfortos" },
  { value: "osszkomfortos", label: "Összkomfortos" },
  { value: "felkomfortos", label: "Félkomfortos" },
  { value: "komfort_nelkuli", label: "Komfort nélküli" },
];

export const TETOTER = [
  { value: "", label: "Mindegy" },
  { value: "tetoteri", label: "Tetőtéri" },
  { value: "nem_tetoteri", label: "Nem tetőtéri" },
  { value: "legfelso_nem_tetoteri", label: "Legfelső emelet, de nem tetőtéri" },
  { value: "zaroszint", label: "Zárószint" },
  { value: "penthouse", label: "Penthouse" },
];

export const FURDO_WC = [
  { value: "", label: "Mindegy" },
  { value: "kulon_helyisegben", label: "Külön helyiségben" },
  { value: "egy_helyisegben", label: "Egy helyiségben" },
  { value: "kulon_es_egyben", label: "Külön és egyben is" },
  { value: "kozos_hasznalat", label: "Közös használat" },
];

export const EMELET = [
  { value: "", label: "Mindegy" },
  { value: "alagsor", label: "Alagsor" },
  { value: "felemelet", label: "Félemelet" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
  { value: "7", label: "7" },
  { value: "8", label: "8" },
  { value: "9", label: "9" },
  { value: "10", label: "10" },
  { value: "10+", label: "10 felett" },
];

export const BELMAGASSAG = [
  { value: "", label: "Mindegy" },
  { value: "3m_alatt", label: "3 méternél alacsonyabb" },
  { value: "3m_felett", label: "3 méternél magasabb" },
];

export const KOLTOZHETO = [
  { value: "", label: "Mindegy" },
  { value: "azonnal", label: "Azonnal" },
  { value: "1_heten_belul", label: "1 héten belül" },
  { value: "1_honapon_belul", label: "1 hónapon belül" },
  { value: "2-4_honap", label: "2–4 hónapon belül" },
  { value: "5-6_honap", label: "5–6 hónapon belül" },
  { value: "7-8_honap", label: "7–8 hónapon belül" },
  { value: "9-10_honap", label: "9–10 hónapon belül" },
  { value: "11-12_honap", label: "11–12 hónapon belül" },
];

export const KOLTOZHETO_ROVID = [
  { value: "", label: "Mindegy" },
  { value: "azonnal", label: "Azonnal" },
  { value: "1-2_nap", label: "1–2 napon belül" },
  { value: "1_heten_belul", label: "1 héten belül" },
  { value: "2_heten_belul", label: "2 héten belül" },
];

export const IGEN_MINDEGY = [
  { value: "", label: "Mindegy" },
  { value: "igen", label: "Igen" },
];

export const INGATLAN_BOOL_FIELDS = [
  { field_key: "lift", label: "Lift" },
  { field_key: "erkely", label: "Erkély" },
  { field_key: "szigeteles", label: "Szigetelés" },
  { field_key: "energiahatekonys", label: "Energiahatékony" },
  { field_key: "akadalymentesitett", label: "Akadálymentesített" },
  { field_key: "legkondicionalo", label: "Légkondicionáló" },
  { field_key: "kertkapcsolatos", label: "Kertkapcsolatos" },
  { field_key: "panelprogram", label: "Panelprogram" },
  { field_key: "gepesitett", label: "Gépesített" },
  { field_key: "kisallat_megengedett", label: "Kisállat megengedett" },
  { field_key: "dohanyzas_megengedett", label: "Dohányzás megengedett" },
];

export function ingatlanFormFieldCatalog() {
  const fields = [
    { field_key: "ingatlan_uzletag", label: "Ingatlan típus (bérlés)", step: 1 },
    { field_key: "ingatlan_lakas_tipus", label: "Lakás típus", step: 1 },
    { field_key: "allapot", label: "Állapot", step: 1 },
    { field_key: "ingatlan_kora", label: "Ingatlan kora", step: 1 },
    { field_key: "min_berleti_ido", label: "Minimum bérleti idő", step: 1 },
    { field_key: "butorozott", label: "Bútorozott", step: 1 },
    { field_key: "kilatas", label: "Kilátás", step: 1 },
    { field_key: "tajolas", label: "Tájolás", step: 1 },
    { field_key: "futes", label: "Fűtés módja", step: 2 },
    { field_key: "parkolas", label: "Parkolás", step: 2 },
    { field_key: "komfort", label: "Komfort", step: 2 },
    { field_key: "tetoter", label: "Tetőtér", step: 2 },
    { field_key: "furdo_wc", label: "Fürdő és WC", step: 2 },
    { field_key: "emelet", label: "Emelet", step: 2 },
    { field_key: "belmagassag", label: "Belmagasság", step: 2 },
    { field_key: "koltozheto", label: "Mikortól költözhető", step: 2 },
    { field_key: "alapterulet", label: "Alapterület (m²)", step: 1 },
    { field_key: "szobaszam", label: "Szobaszám", step: 1 },
    { field_key: "vetelar", label: "Ár (Ft)", step: 5 },
    { field_key: "akcios_ar", label: "Akciós ár", step: 5 },
    { field_key: "leiras", label: "Leírás", step: 5 },
    { field_key: "megye", label: "Megye", step: 5 },
    { field_key: "telepules", label: "Település", step: 5 },
    { field_key: "iranyitoszam", label: "Irányítószám", step: 5 },
    { field_key: "megtekintesi_cim", label: "Megtekintési cím", step: 5 },
    { field_key: "email", label: "E-mail", step: 5 },
    { field_key: "email_megjelenik", label: "E-mail megjelenik", step: 5 },
    { field_key: "hirdetes_cime", label: "Hirdetés címe", step: 1 },
    { field_key: "hirdetes_vertical", label: "Hirdetés kategória", step: 1 },
    { field_key: "hirdetes_alkategoria", label: "Hirdetés alkategória", step: 1 },
    { field_key: "ingatlan_tipus", label: "Ingatlan típus (picker)", step: 1 },
    { field_key: "ingatlan_kategoria", label: "Ingatlan kategória (picker)", step: 1 },
    { field_key: "fotok", label: "Fotók", step: 4 },
    { field_key: "owner_user_id", label: "Tulajdonos", step: 9 },
    { field_key: "views_web", label: "Web nézetek", step: 9 },
    { field_key: "views_app", label: "App nézetek", step: 9 },
    { field_key: "telefon1_orszag", label: "Telefon 1 ország", step: 5 },
    { field_key: "telefon1_korzet", label: "Telefon 1 körzet", step: 5 },
    { field_key: "telefon1_szam", label: "Telefon 1 szám", step: 5 },
    { field_key: "telefon2_orszag", label: "Telefon 2 ország", step: 5 },
    { field_key: "telefon2_korzet", label: "Telefon 2 körzet", step: 5 },
    { field_key: "telefon2_szam", label: "Telefon 2 szám", step: 5 },
  ];
  for (const bool of INGATLAN_BOOL_FIELDS) {
    fields.push({ field_key: bool.field_key, label: bool.label, step: 3 });
  }
  return fields;
}

export function priceMillionOptions({ maxMillions = 20 } = {}) {
  const out = [];
  for (let m = 1; m <= maxMillions; m += 1) {
    out.push({ value: String(m * 1_000_000), label: `${m} M Ft` });
  }
  return out;
}

export function alapteruletOptions() {
  const out = [];
  for (const n of [20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120, 150, 200, 250, 300]) {
    out.push({ value: String(n), label: `${n} m²` });
  }
  return out;
}

export function szobaszamOptions() {
  return [
    { value: "1", label: "1" },
    { value: "1.5", label: "1,5" },
    { value: "2", label: "2" },
    { value: "2.5", label: "2,5" },
    { value: "3", label: "3" },
    { value: "3.5", label: "3,5" },
    { value: "4", label: "4" },
    { value: "5", label: "5" },
    { value: "6", label: "6+" },
  ];
}

export function arFtMinOptions() {
  const out = [];
  for (let n = 50_000; n <= 2_000_000; n += 50_000) {
    out.push({ value: String(n), label: `${n.toLocaleString("hu-HU")} Ft` });
  }
  return out;
}

export function emeletRank(value) {
  const order = EMELET.map((o) => o.value).filter(Boolean);
  const idx = order.indexOf(String(value ?? ""));
  return idx < 0 ? null : idx;
}
