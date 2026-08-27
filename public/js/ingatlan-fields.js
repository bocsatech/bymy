/** Böngésző + szerver: ingatlan mezőopciók (kereső / űrlap / admin). */

export const INGATLAN_UZLETAG = [
  { value: "elado", label: "Eladó" },
  { value: "kiado", label: "Kiadó" },
  { value: "airbnb", label: "Airbnb" },
];

/** Régi értékek → Eladó / Kiadó / Airbnb. */
export function normalizeIngatlanUzletag(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "elado" || v === "kinal" || v === "eladó") return "elado";
  if (v === "airbnb" || v === "rovid" || v === "rövid") return "airbnb";
  if (
    v === "kiado" ||
    v === "kiadó" ||
    v === "berbe" ||
    v === "berles" ||
    v === "berelheto" ||
    v === "keres"
  ) {
    return "kiado";
  }
  return v || "kiado";
}

/** Admin kerék-séma variant a kategóriából. */
export function schemaVariantFromUzletag(uz) {
  const v = normalizeIngatlanUzletag(uz);
  if (v === "elado") return "elado-ingatlan";
  if (v === "airbnb") return "airbnb";
  return "ingatlan";
}

/** Ft (bérlés) vs M Ft (eladó). */
export function isIngatlanRentUzletag(uz) {
  const v = normalizeIngatlanUzletag(uz);
  return v === "kiado" || v === "airbnb";
}

/** Kereső + Eladó/Kiadó feladás — ingatlan típus. */
export const INGATLAN_LAKAS_TIPUS = [
  { value: "", label: "Mindegy" },
  { value: "lakas", label: "Lakás" },
  { value: "haz", label: "Ház" },
  { value: "telek", label: "Telek" },
  { value: "nyaralo", label: "Nyaraló" },
  { value: "iroda", label: "Iroda" },
  { value: "uzlethelyiseg", label: "Üzlethelyiség" },
  { value: "ipari", label: "Ipari" },
  { value: "mezogazdasagi", label: "Mezőgazdasági" },
  { value: "vendeglatas", label: "Vendéglátás" },
  { value: "garazs", label: "Garázs" },
  { value: "fejlesztesi_terulet", label: "Fejlesztési terület" },
  { value: "intezmeny", label: "Intézmény" },
  { value: "raktar", label: "Raktár" },
  { value: "egyeb", label: "Egyéb" },
];

/** Airbnb feladás — rövid távú / lakás típusok. */
export const INGATLAN_LAKAS_TIPUS_AIRBNB = [
  { value: "", label: "Mindegy" },
  { value: "teglalakas", label: "Téglalakás" },
  { value: "panellakas", label: "Panellakás" },
  { value: "szoba", label: "Szoba" },
  { value: "rovid_berles", label: "Rövid bérlés" },
];

/**
 * Típus 2 almenük (szülő Tipus value → opciók).
 * Forrás: data/ingatlan-tipus2-catalog.json
 * Az value-k szülővel prefixelve, hogy az „Egyéb” stb. ne ütközzön.
 */
export const INGATLAN_TIPUS_2_BY_PARENT = {
  lakas: [
    { value: "lakas_tegla_lakas", label: "Tégla lakás" },
    { value: "lakas_panel_lakas", label: "Panel lakás" },
    { value: "lakas_csusztatott_zsalus", label: "Csúsztatott zsalus" },
  ],
  haz: [
    { value: "haz_csaladi_haz", label: "Családi ház" },
    { value: "haz_ikerhaz", label: "Ikerház" },
    { value: "haz_sorhaz", label: "Sorház" },
    { value: "haz_hazresz", label: "Házrész" },
    { value: "haz_kastely", label: "Kastély" },
    { value: "haz_tanya", label: "Tanya" },
    { value: "haz_konnyuszerkezetes_haz", label: "Könnyűszerkezetes ház" },
    { value: "haz_valyoghaz", label: "Vályogház" },
  ],
  telek: [
    { value: "telek_lakoovezeti_telek", label: "Lakóövezeti telek" },
    { value: "telek_uduloovezeti_telek", label: "Üdülőövezeti telek" },
    { value: "telek_kulteruleti_telek", label: "Külterületi telek" },
    { value: "telek_egyeb_telek", label: "Egyéb telek" },
  ],
  nyaralo: [
    { value: "nyaralo_nyaralotelek", label: "Nyaralótelek" },
    { value: "nyaralo_hetvegi_hazas_nyaralo", label: "Hétvégi házas nyaraló" },
    { value: "nyaralo_udulohazas_nyaralo", label: "Üdülőházas nyaraló" },
  ],
  iroda: [
    { value: "iroda_irodahelyiseg_irodahazban", label: "Irodahelyiség irodaházban" },
    { value: "iroda_csaladi_hazban_iroda", label: "Családi házban iroda" },
    { value: "iroda_lakasban_iroda", label: "Lakásban iroda" },
    { value: "iroda_egyeb_iroda", label: "Egyéb iroda" },
  ],
  uzlethelyiseg: [
    { value: "uzlethelyiseg_uzlethazban_uzlethelyiseg", label: "Üzletházban üzlethelyiség" },
    { value: "uzlethelyiseg_utcai_bejaratos_uzlethelyiseg", label: "Utcai bejáratos üzlethelyiség" },
    { value: "uzlethelyiseg_udvarban_uzlethelyiseg", label: "Udvarban üzlethelyiség" },
    { value: "uzlethelyiseg_egyeb_uzlethelyiseg", label: "Egyéb üzlethelyiség" },
  ],
  ipari: [
    { value: "ipari_muhely", label: "Műhely" },
    { value: "ipari_telephely", label: "Telephely" },
    { value: "ipari_egyeb_ipari_ingatlan", label: "Egyéb ipari ingatlan" },
    { value: "ipari_telek_ipari_hasznositasra", label: "Telek ipari hasznosításra" },
  ],
  mezogazdasagi: [
    { value: "mezogazdasagi_tanya", label: "Tanya" },
    { value: "mezogazdasagi_altalanos_mezogazdasagi_ingatlan", label: "Általános mezőgazdasági ingatlan" },
    { value: "mezogazdasagi_termofold_szanto", label: "Termőföld, szántó" },
    { value: "mezogazdasagi_erdo", label: "Erdő" },
    { value: "mezogazdasagi_pince_preshaz", label: "Pince, présház" },
  ],
  vendeglatas: [
    { value: "vendeglatas_szalloda_hotel_panzio", label: "Szálloda, hotel, panzió" },
    { value: "vendeglatas_etterem_vendeglo", label: "Étterem, vendéglő" },
    { value: "vendeglatas_egyeb_vendeglato_egyseg", label: "Egyéb vendéglátó egység" },
  ],
  garazs: [
    { value: "garazs_onallo_garazs", label: "Önálló garázs" },
    { value: "garazs_teremgarazs_hely", label: "Teremgarázs hely" },
    { value: "garazs_beallo", label: "Beálló" },
  ],
  fejlesztesi_terulet: [
    { value: "fejlesztesi_terulet_lakoterulet", label: "Lakóterület" },
    { value: "fejlesztesi_terulet_kereskedelmi_szolgaltato_terulet", label: "Kereskedelmi, szolgáltató terület" },
    { value: "fejlesztesi_terulet_vegyes_lako_es_kereskedelmi_terulet", label: "Vegyes (lakó- és kereskedelmi) terület" },
    { value: "fejlesztesi_terulet_ipari_terulet", label: "Ipari terület" },
    { value: "fejlesztesi_terulet_uduloterulet", label: "Üdülőterület" },
    { value: "fejlesztesi_terulet_kulonleges_terulet", label: "Különleges terület" },
  ],
  intezmeny: [
    { value: "intezmeny_egeszsegugyi_intezmeny", label: "Egészségügyi intézmény" },
    { value: "intezmeny_iskola", label: "Iskola" },
    { value: "intezmeny_muzeum", label: "Múzeum" },
    { value: "intezmeny_ovoda", label: "Óvoda" },
  ],
  /* Nem jött új lista — régi fallback */
  raktar: [
    { value: "raktar_raktarhelyiseg", label: "Raktárhelyiség" },
    { value: "raktar_egyeb", label: "Egyéb" },
  ],
  egyeb: [{ value: "egyeb_egyeb", label: "Egyéb" }],
};

/** Tipus 1 érték(ek) → Tipus 2 opciólista (üres szülőnél csak Mindegy). */
export function tipus2OptionsForParents(parentValues) {
  const parents = (Array.isArray(parentValues) ? parentValues : String(parentValues ?? "").split(","))
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  const out = [{ value: "", label: "Mindegy" }];
  if (!parents.length) return out;
  const seen = new Set();
  for (const p of parents) {
    for (const opt of INGATLAN_TIPUS_2_BY_PARENT[p] || []) {
      if (!opt.value || seen.has(opt.value)) continue;
      seen.add(opt.value);
      out.push(opt);
    }
  }
  return out;
}

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

/** Közmű mezők — opciólista később pontosítható adminból. */
export const KOZMU_OPTIONS = [
  { value: "", label: "Mindegy" },
  { value: "van", label: "Van" },
  { value: "nincs", label: "Nincs" },
  { value: "kozmuvesitheto", label: "Közművesíthető" },
];

/** Irodaház kategória — placeholder, amíg nincs végleges lista. */
export const IRODAHAZ_KATEGORIA = [
  { value: "", label: "Mindegy" },
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

/**
 * Bool / igen-van mezők. value mindig "igen" (szűrés), a yesLabel a UI szöveg.
 */
export const INGATLAN_BOOL_FIELDS = [
  { field_key: "lift", label: "Lift", yesLabel: "Van" },
  { field_key: "erkely", label: "Erkély", yesLabel: "Van" },
  { field_key: "szigeteles", label: "Szigetelés", yesLabel: "Van" },
  { field_key: "energiahatekonys", label: "Energiahatékony", yesLabel: "Igen" },
  { field_key: "akadalymentesitett", label: "Akadálymentesített", yesLabel: "Igen" },
  { field_key: "legkondicionalo", label: "Légkondicionáló", yesLabel: "Van" },
  { field_key: "kertkapcsolatos", label: "Kertkapcsolatos", yesLabel: "Igen" },
  { field_key: "panelprogram", label: "Panelprogram", yesLabel: "Részt vett" },
  { field_key: "gepesitett", label: "Gépesített", yesLabel: "Igen" },
  { field_key: "kisallat_megengedett", label: "Kisállat hozható", yesLabel: "Igen" },
  { field_key: "dohanyzas_megengedett", label: "Dohányzás megengedett", yesLabel: "Megengedett" },
  { field_key: "pince", label: "Pince", yesLabel: "Van" },
  { field_key: "napelem", label: "Napelem", yesLabel: "Van" },
  { field_key: "uj_parcellazasu", label: "Csak új parcellázású", yesLabel: "Igen" },
];

export function boolOptionsForField(fieldOrKey) {
  const key = typeof fieldOrKey === "string" ? fieldOrKey : fieldOrKey?.field_key;
  const def = INGATLAN_BOOL_FIELDS.find((f) => f.field_key === key);
  const yes = def?.yesLabel || "Igen";
  return [
    { value: "", label: "Mindegy" },
    { value: "igen", label: yes },
  ];
}

/** Mindig látszik (típus független). Területmezők NEM itt — típus szerint. */
export const INGATLAN_CORE_FIELD_KEYS = [
  "keresesi_hely",
  "ar_tol",
  "ar_ig",
  "szobaszam",
  "ingatlan_lakas_tipus",
  "ingatlan_tipus_2",
];

/**
 * Típus → területmezők (a küldött listákból).
 * alapterulet = épület / ház területe
 * telekterulet = telek, amin áll / önálló telek
 */
export const INGATLAN_AREA_BY_TIPUS = {
  lakas: ["alapterulet"],
  haz: ["alapterulet", "telekterulet"],
  telek: ["telekterulet"],
  garazs: [],
  nyaralo: ["alapterulet", "telekterulet"],
  iroda: ["alapterulet"],
  uzlethelyiseg: ["alapterulet"],
  vendeglatas: ["alapterulet"],
  raktar: ["telekterulet"],
  ipari: ["telekterulet"],
  mezogazdasagi: ["telekterulet", "epitmeny_terulet"],
  fejlesztesi_terulet: ["telekterulet"],
  intezmeny: ["alapterulet", "telekterulet"],
  egyeb: ["alapterulet", "telekterulet"],
};

const AREA_FIELD_KEYS = {
  alapterulet: ["alapterulet_tol", "alapterulet_ig", "alapterulet"],
  telekterulet: ["telekterulet_tol", "telekterulet_ig", "telekterulet"],
  epitmeny_terulet: ["epitmeny_terulet_tol", "epitmeny_terulet_ig", "epitmeny_terulet"],
};

/** Tipus(ok) → terület kulcsok (tol/ig/post). Üres típusnál csak alapterület (általános kereső). */
export function areaFieldKeysForTipus(parentValues) {
  const parents = (Array.isArray(parentValues) ? parentValues : String(parentValues ?? "").split(","))
    .map((v) => resolveTipusFieldParent(v))
    .filter(Boolean);
  const out = new Set();
  if (!parents.length) {
    for (const keys of Object.values(AREA_FIELD_KEYS)) {
      for (const k of keys) out.add(k);
    }
    return out;
  }
  const kinds = new Set();
  for (const p of parents) {
    const list = INGATLAN_AREA_BY_TIPUS[p];
    if (list == null && p === "egyeb") {
      kinds.add("alapterulet");
      kinds.add("telekterulet");
      continue;
    }
    for (const kind of list || []) kinds.add(kind);
  }
  for (const kind of kinds) {
    for (const k of AREA_FIELD_KEYS[kind] || []) out.add(k);
  }
  return out;
}

/**
 * Típus 1 → megjelenő mezőkulcsok (a screenshot listák alapján).
 * Üres típusnál csak a CORE mezők látszanak (+ alap alapterület).
 */
export const INGATLAN_FIELDS_BY_TIPUS = {
  lakas: [
    "lift",
    "erkely",
    "szigeteles",
    "energiahatekonys",
    "akadalymentesitett",
    "legkondicionalo",
    "kertkapcsolatos",
    "panelprogram",
    "gepesitett",
    "kisallat_megengedett",
    "dohanyzas_megengedett",
  ],
  haz: [
    "allapot",
    "ingatlan_kora",
    "kilatas",
    "futes",
    "parkolas",
    "komfort",
    "tetoter",
    "furdo_wc",
    "telekterulet_tol",
    "telekterulet_ig",
    "szintek_tol",
    "szintek_ig",
    "pince",
    "napelem",
    "szigeteles",
    "energiahatekonys",
    "akadalymentesitett",
    "legkondicionalo",
  ],
  telek: [
    "ingatlan_kora",
    "villany",
    "viz",
    "gaz",
    "csatorna",
    "telekterulet_tol",
    "telekterulet_ig",
    "uj_parcellazasu",
  ],
  garazs: ["allapot", "ingatlan_kora"],
  nyaralo: [
    "allapot",
    "ingatlan_kora",
    "kilatas",
    "futes",
    "tetoter",
    "villany",
    "viz",
    "gaz",
    "csatorna",
    "telekterulet_tol",
    "telekterulet_ig",
    "napelem",
    "szigeteles",
    "energiahatekonys",
    "akadalymentesitett",
    "legkondicionalo",
  ],
  iroda: [
    "allapot",
    "ingatlan_kora",
    "min_berleti_ido",
    "butorozott",
    "irodahaz_kategoria",
    "tetoter",
    "koltozheto",
    "emelet_tol",
    "emelet_ig",
    "emelet",
    "uzemeltetesi_dij_tol",
    "uzemeltetesi_dij_ig",
    "kaucio_max",
    "energiahatekonys",
    "akadalymentesitett",
    "legkondicionalo",
  ],
  uzlethelyiseg: [
    "allapot",
    "ingatlan_kora",
    "min_berleti_ido",
    "koltozheto",
    "energiahatekonys",
    "akadalymentesitett",
    "legkondicionalo",
  ],
  vendeglatas: [
    "allapot",
    "ingatlan_kora",
    "min_berleti_ido",
    "koltozheto",
    "energiahatekonys",
    "akadalymentesitett",
    "legkondicionalo",
  ],
  raktar: [
    "allapot",
    "ingatlan_kora",
    "min_berleti_ido",
    "koltozheto",
    "telekterulet_tol",
    "telekterulet_ig",
    "energiahatekonys",
  ],
  ipari: [
    "ingatlan_kora",
    "min_berleti_ido",
    "koltozheto",
    "telekterulet_tol",
    "telekterulet_ig",
    "energiahatekonys",
  ],
  mezogazdasagi: [
    "ingatlan_kora",
    "min_berleti_ido",
    "koltozheto",
    "telekterulet_tol",
    "telekterulet_ig",
    "epitmeny_terulet_tol",
    "epitmeny_terulet_ig",
  ],
  fejlesztesi_terulet: [
    "ingatlan_kora",
    "min_berleti_ido",
    "koltozheto",
    "telekterulet_tol",
    "telekterulet_ig",
  ],
  intezmeny: [
    "allapot",
    "ingatlan_kora",
    "min_berleti_ido",
    "butorozott",
    "kilatas",
    "futes",
    "parkolas",
    "komfort",
    "tetoter",
    "koltozheto",
    "telekterulet_tol",
    "telekterulet_ig",
    "napelem",
    "szigeteles",
    "energiahatekonys",
    "akadalymentesitett",
    "legkondicionalo",
  ],
  /* Nincs külön lista — minden típusmező uniója */
  egyeb: null,
};

/** Airbnb / rövid típusok → lakás mezőkészlet. */
export const INGATLAN_TIPUS_FIELD_ALIAS = {
  teglalakas: "lakas",
  panellakas: "lakas",
  szoba: "lakas",
  rovid_berles: "lakas",
};

export function resolveTipusFieldParent(tipusValue) {
  const v = String(tipusValue || "").trim();
  if (!v) return "";
  return INGATLAN_TIPUS_FIELD_ALIAS[v] || v;
}

/** Adminban pipálható mezők (típus → mezők oldal). CORE mezők nem ide tartoznak. */
export const INGATLAN_ASSIGNABLE_FIELD_DEFS = [
  { field_key: "allapot", label: "Állapot", group: "lista" },
  { field_key: "ingatlan_kora", label: "Építés éve", group: "lista" },
  { field_key: "min_berleti_ido", label: "Minimum bérleti idő", group: "lista" },
  { field_key: "butorozott", label: "Bútorozott", group: "lista" },
  { field_key: "kilatas", label: "Kilátás", group: "lista" },
  { field_key: "tajolas", label: "Tájolás", group: "lista" },
  { field_key: "futes", label: "Fűtés", group: "lista" },
  { field_key: "parkolas", label: "Parkolás", group: "lista" },
  { field_key: "komfort", label: "Komfort", group: "lista" },
  { field_key: "tetoter", label: "Tetőtér", group: "lista" },
  { field_key: "furdo_wc", label: "Fürdő és WC", group: "lista" },
  { field_key: "belmagassag", label: "Belmagasság", group: "lista" },
  { field_key: "koltozheto", label: "Mikortól költözhető", group: "lista" },
  { field_key: "villany", label: "Villany", group: "lista" },
  { field_key: "viz", label: "Víz", group: "lista" },
  { field_key: "gaz", label: "Gáz", group: "lista" },
  { field_key: "csatorna", label: "Csatorna", group: "lista" },
  { field_key: "irodahaz_kategoria", label: "Irodaház kategóriája", group: "lista" },
  { field_key: "emelet_tol", label: "Emelet · min", group: "tartomany" },
  { field_key: "emelet_ig", label: "Emelet · max", group: "tartomany" },
  { field_key: "emelet", label: "Emelet (feladás)", group: "tartomany" },
  { field_key: "telekterulet_tol", label: "Telekterület · min", group: "tartomany" },
  { field_key: "telekterulet_ig", label: "Telekterület · max", group: "tartomany" },
  { field_key: "szintek_tol", label: "Szintek · min", group: "tartomany" },
  { field_key: "szintek_ig", label: "Szintek · max", group: "tartomany" },
  { field_key: "uzemeltetesi_dij_tol", label: "Üzemeltetési díj · min", group: "tartomany" },
  { field_key: "uzemeltetesi_dij_ig", label: "Üzemeltetési díj · max", group: "tartomany" },
  { field_key: "kaucio_max", label: "Kaució mértéke", group: "tartomany" },
  { field_key: "epitmeny_terulet_tol", label: "Építmény terület · min", group: "tartomany" },
  { field_key: "epitmeny_terulet_ig", label: "Építmény terület · max", group: "tartomany" },
  ...INGATLAN_BOOL_FIELDS.map((f) => ({
    field_key: f.field_key,
    label: f.label,
    group: "igen_van",
  })),
];

/** Élő admin config (null = kód alapértelmezés). */
let liveFieldsByTipus = null;

export function applyIngatlanTipusFieldsConfig(config) {
  if (!config?.by_tipus || typeof config.by_tipus !== "object") {
    liveFieldsByTipus = null;
    return;
  }
  liveFieldsByTipus = { ...config.by_tipus };
}

export function effectiveIngatlanFieldsByTipus() {
  return liveFieldsByTipus || INGATLAN_FIELDS_BY_TIPUS;
}

/** Kiválasztott típus(ok) → látható mezőkulcsok (CORE + terület + típusmezők). */
export function fieldKeysVisibleForTipus(parentValues) {
  const map = effectiveIngatlanFieldsByTipus();
  const parents = (Array.isArray(parentValues) ? parentValues : String(parentValues ?? "").split(","))
    .map((v) => resolveTipusFieldParent(v))
    .filter(Boolean);
  const out = new Set(INGATLAN_CORE_FIELD_KEYS);
  for (const k of areaFieldKeysForTipus(parents)) out.add(k);

  const allTypeKeys = () => {
    const s = new Set();
    for (const [k, list] of Object.entries(map)) {
      if (k === "egyeb" || !list) continue;
      for (const f of list) s.add(f);
    }
    return s;
  };

  if (!parents.length) {
    for (const f of allTypeKeys()) out.add(f);
    return out;
  }

  for (const p of parents) {
    const list = map[p];
    if (list == null && p === "egyeb") {
      for (const f of allTypeKeys()) out.add(f);
      continue;
    }
    if (!Array.isArray(list)) continue;
    for (const f of list) out.add(f);
  }
  return out;
}

export function telekteruletOptions() {
  const out = [];
  for (const n of [100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 5000, 10000]) {
    out.push({ value: String(n), label: `${n.toLocaleString("hu-HU")} m²` });
  }
  return out;
}

export function szintekOptions() {
  const out = [];
  for (let n = 1; n <= 10; n += 1) out.push({ value: String(n), label: String(n) });
  out.push({ value: "10+", label: "10+" });
  return out;
}

export function epitmenyTeruletOptions() {
  return alapteruletOptions();
}

export function ingatlanFormFieldCatalog() {
  const fields = [
    { field_key: "ingatlan_uzletag", label: "Kategória (Eladó / Kiadó / Airbnb)", step: 1 },
    { field_key: "ingatlan_lakas_tipus", label: "Lakás típus", step: 1 },
    { field_key: "ingatlan_tipus_2", label: "Típus 2", step: 1 },
    { field_key: "allapot", label: "Állapot", step: 1 },
    { field_key: "ingatlan_kora", label: "Építés éve", step: 1 },
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
    { field_key: "villany", label: "Villany", step: 2 },
    { field_key: "viz", label: "Víz", step: 2 },
    { field_key: "gaz", label: "Gáz", step: 2 },
    { field_key: "csatorna", label: "Csatorna", step: 2 },
    { field_key: "irodahaz_kategoria", label: "Irodaház kategóriája", step: 2 },
    { field_key: "telekterulet", label: "Telekterület (m²)", step: 2 },
    { field_key: "szintek", label: "Szintek száma", step: 2 },
    { field_key: "uzemeltetesi_dij", label: "Üzemeltetési díj", step: 2 },
    { field_key: "kaucio_max", label: "Kaució mértéke", step: 2 },
    { field_key: "epitmeny_terulet", label: "Esetleges építmény területe (m²)", step: 2 },
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

export function priceMillionOptions() {
  const out = [];
  const pushM = (millions) => {
    out.push({ value: String(millions * 1_000_000), label: millions >= 1000 ? `${millions / 1000} Mrd Ft` : `${millions} M Ft` });
  };
  for (let m = 20; m <= 100; m += 10) pushM(m);
  for (let m = 150; m <= 500; m += 50) pushM(m);
  for (let m = 600; m <= 1000; m += 100) pushM(m);
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
