export const UZEMANYAG_CATEGORIES = [
  { id: "benzin", label: "Benzin", value: "Benzin" },
  { id: "dizel", label: "Dízel", value: "Dízel" },
  {
    id: "benzin-gaz",
    label: "Benzin/Gáz",
    children: [
      { label: "Benzin/Gáz", value: "Benzin/Gáz" },
      { label: "LPG", value: "LPG" },
      { label: "CNG", value: "CNG" },
    ],
  },
  {
    id: "dizel-gaz",
    label: "Dízel/Gáz",
    children: [
      { label: "Dízel/Gáz", value: "Dízel/Gáz" },
      { label: "LPG/dízel", value: "LPG/dízel" },
      { label: "CNG/dízel", value: "CNG/dízel" },
    ],
  },
  {
    id: "hibrid",
    label: "Hibrid",
    children: [
      { label: "Hibrid", value: "Hibrid" },
      { label: "Hibrid (Benzin)", value: "Hibrid (Benzin)" },
      { label: "Hibrid (Dízel)", value: "Hibrid (Dízel)" },
    ],
  },
  { id: "elektromos", label: "Elektromos", value: "Elektromos" },
  { id: "etanol", label: "Etanol", value: "Etanol" },
  { id: "biodizel", label: "Biodízel", value: "Biodízel" },
  { id: "gaz", label: "Gáz", value: "Gáz" },
];

export const TEHER_KISTEHER_KIVITEL = [
  "Kisteher",
  "Dobozos",
  "Platós",
  "Ponyvás",
  "Hűtős",
  "Billenős",
  "Alváz",
];

export const TEHER_35_KIVITEL_CATEGORIES = [
  {
    id: "pickup",
    label: "Pickup",
    children: [
      { label: "Pickup", value: "Pickup" },
      { label: "Duplakabinos pickup", value: "Duplakabinos pickup" },
      { label: "Szimplakabinos pickup", value: "Szimplakabinos pickup" },
    ],
  },
  { id: "terepjaro", label: "Terepjáró", value: "Terepjáró" },
  {
    id: "zart",
    label: "Zárt",
    children: [
      { label: "Zárt", value: "Zárt" },
      { label: "Cargo", value: "Cargo" },
      { label: "Félig ablakos", value: "Félig ablakos" },
      { label: "Furgon", value: "Furgon" },
      { label: "Hűtős (zárt)", value: "Hűtős (zárt)" },
      { label: "Körbeüvegezett", value: "Körbeüvegezett" },
      { label: "Van", value: "Van" },
    ],
  },
  { id: "atv-utv", label: "ATV/UTV", value: "ATV/UTV" },
  { id: "darus-billeno", label: "Darus billenőplatós", value: "Darus billenőplatós" },
  {
    id: "duplakabinos-alvaz",
    label: "Duplakabinos alváz",
    children: [
      { label: "Duplakabinos alváz", value: "Duplakabinos alváz" },
      { label: "Duplakabinos autómentő", value: "Duplakabinos autómentő" },
      { label: "Duplakabinos billenőplatós", value: "Duplakabinos billenőplatós" },
      { label: "Duplakabinos darus", value: "Duplakabinos darus" },
      { label: "Duplakabinos dobozos (koffer)", value: "Duplakabinos dobozos (koffer)" },
      { label: "Duplakabinos dobozos-emelőhátfalas", value: "Duplakabinos dobozos-emelőhátfalas" },
      { label: "Duplakabinos élőállat-szállító", value: "Duplakabinos élőállat-szállító" },
      { label: "Duplakabinos emelőkosaras", value: "Duplakabinos emelőkosaras" },
      { label: "Duplakabinos létrás", value: "Duplakabinos létrás" },
      { label: "Duplakabinos platós", value: "Duplakabinos platós" },
      { label: "Duplakabinos ponyvás", value: "Duplakabinos ponyvás" },
      { label: "Duplakabinos ponyvás-emelőhátfalas", value: "Duplakabinos ponyvás-emelőhátfalas" },
    ],
  },
  { id: "eloallat", label: "Élőállat-szállító", value: "Élőállat-szállító" },
  { id: "halottas", label: "Halottas", value: "Halottas" },
  { id: "konteneres", label: "Konténeres", value: "Konténeres" },
  { id: "mento", label: "Mentő", value: "Mentő" },
  { id: "mini-nyerges", label: "Mini - nyerges", value: "Mini - nyerges" },
  { id: "pancelozott", label: "Páncélozott", value: "Páncélozott" },
  { id: "platos-emelo", label: "Platós - emelőhátfalas", value: "Platós - emelőhátfalas" },
  {
    id: "szimplakabinos-alvaz",
    label: "Szimplakabinos alváz",
    children: [
      { label: "Szimplakabinos alváz", value: "Szimplakabinos alváz" },
      { label: "Autómentő", value: "Autómentő" },
      { label: "Billenőplatós", value: "Billenőplatós" },
      { label: "Darus", value: "Darus" },
      { label: "Dobozos (emelőhátfalas)", value: "Dobozos (emelőhátfalas)" },
      { label: "Dobozos (koffer)", value: "Dobozos (koffer)" },
      { label: "Emelőkosaras", value: "Emelőkosaras" },
      { label: "Hűtős alváz", value: "Hűtős alváz" },
      { label: "Létrás", value: "Létrás" },
      { label: "Mozgóbolt, büfékocsi", value: "Mozgóbolt, büfékocsi" },
      { label: "Platós", value: "Platós" },
      { label: "Ponyvás", value: "Ponyvás" },
      { label: "Ponyvás (emelőhátfalas)", value: "Ponyvás (emelőhátfalas)" },
    ],
  },
  { id: "tuzolto", label: "Tűzoltó", value: "Tűzoltó" },
  { id: "zart-emelo", label: "Zárt - emelőhátfalas", value: "Zárt - emelőhátfalas" },
  { id: "egyeb", label: "Egyéb", value: "Egyéb" },
];

export function flattenTeher35KivitelOptions() {
  const out = [];
  for (const cat of TEHER_35_KIVITEL_CATEGORIES) {
    if (cat.children?.length) {
      for (const child of cat.children) out.push(child.value);
    } else if (cat.value) {
      out.push(cat.value);
    }
  }
  return out;
}

export const ALLAPOT_CATEGORIES = [
  { id: "normal", label: "Normál", value: "Normál" },
  { id: "megkimelt", label: "Megkímélt", value: "Megkímélt" },
  { id: "ujszeru", label: "Újszerű", value: "Újszerű" },
  { id: "serulesmentes", label: "Sérülésmentes", value: "Sérülésmentes" },
  {
    id: "serult",
    label: "Sérült",
    children: [
      { label: "Sérült", value: "Sérült" },
      { label: "Optikai hibás", value: "Optikai hibás" },
      { label: "Enyhén sérült", value: "Enyhén sérült" },
      { label: "Eleje sérült", value: "Eleje sérült" },
      { label: "Hátulja sérült", value: "Hátulja sérült" },
      { label: "Baloldala sérült", value: "Baloldala sérült" },
      { label: "Jobboldala sérült", value: "Jobboldala sérült" },
    ],
  },
  { id: "hianyos", label: "Hiányos", value: "Hiányos" },
  {
    id: "fodarab",
    label: "Fődarab hibás",
    children: [
      { label: "Fődarab hibás", value: "Fődarab hibás" },
      { label: "Motorhibás", value: "Motorhibás" },
      { label: "Váltóhibás", value: "Váltóhibás" },
      { label: "Elektronika hibás", value: "Elektronika hibás" },
      { label: "Fékhibás", value: "Fékhibás" },
      { label: "Futómű hibás", value: "Futómű hibás" },
    ],
  },
];

export function flattenAllapotOptions() {
  const out = [];
  for (const cat of ALLAPOT_CATEGORIES) {
    if (cat.children?.length) {
      for (const child of cat.children) out.push(child.value);
    } else if (cat.value) {
      out.push(cat.value);
    }
  }
  return out;
}

export function flattenUzemanyagOptions() {
  const out = [];
  for (const cat of UZEMANYAG_CATEGORIES) {
    if (cat.children?.length) {
      for (const child of cat.children) out.push(child.value);
    } else if (cat.value) {
      out.push(cat.value);
    }
  }
  return out;
}

export const SEBESSEGVALTO_CATEGORIES = [
  { id: "manualis", label: "Manuális", value: "Manuális" },
  { id: "automata", label: "Automata", value: "Automata" },
  { id: "felautomata", label: "Félautomata", value: "Félautomata" },
];

export function flattenSebessegvaltoOptions() {
  const out = [];
  for (const cat of SEBESSEGVALTO_CATEGORIES) {
    if (cat.children?.length) {
      for (const child of cat.children) out.push(child.value);
    } else if (cat.value) {
      out.push(cat.value);
    }
  }
  return out;
}

export const OKMANY_JELLEG_OPTIONS = [
  "Külföldi okmányokkal",
  "Magyar okmányokkal",
  "Okmányok nélkül",
];

export function normalizeOkmanyJelleg(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (OKMANY_JELLEG_OPTIONS.includes(raw)) return raw;
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (key.includes("nelkul") || key.includes("nincs okmany")) return "Okmányok nélkül";
  if (key.includes("kulfold")) return "Külföldi okmányokkal";
  if (key.includes("magyar") || key.includes("forgalmi")) return "Magyar okmányokkal";
  return raw;
}

export const AC_TOLTO_CSATLAKOZAS_OPTIONS = ["Type 1", "Type 2"];

export function normalizeAcToltoCsatlakozas(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (AC_TOLTO_CSATLAKOZAS_OPTIONS.includes(raw)) return raw;
  const key = raw.toLowerCase().replace(/\s+/g, "");
  if (key.includes("type1") || key === "t1" || key.includes("j1772")) return "Type 1";
  if (key.includes("type2") || key === "t2" || key.includes("mennekes")) return "Type 2";
  return raw;
}

export const EQUIPMENT_SECTIONS = {
  muszaki: {
    title: "Műszaki felszereltség",
    items: [
      "4WS (összkerékkormányzás)",
      "állítható felfüggesztés",
      "állítható kormány",
      "automatikus hengerlekapcsolás",
      "centrálzár",
      "chiptuning",
      "EDC (elektronikus lengéscsillapítás vezérlés)",
      "elektromos ablak elöl",
      "elektromos ablak hátul",
      "elektromos tükör",
      "fedélzeti komputer",
      "fűthető tükör",
      "HUD / Head-Up Display",
      "kerámia féktárcsák",
      "kétoldali tolóajtó",
      "könnyűfém felni",
      "kormányváltó",
      "króm felni",
      "részecskeszűrő",
      "riasztó",
      "sebességfüggő szervokormány",
      "sperr differenciálmű",
      "sportfutómű",
      "sportülések",
      "start-stop/motormegállító rendszer",
      "szervokormány",
      "színezett üveg",
      "tolóajtó",
      "tolótető - elektromos",
      "tolótető (napfénytető)",
      "vonóhorog",
    ],
  },
  kenyelem: {
    title: "Kényelmi felszereltség",
    items: [
      "full extra",
      "állófűtés",
      "fűthető első ülés",
      "fűthető kormány",
      "álló helyzeti klíma",
      "bőr belső",
      "műbőr-kárpit",
      "360 fokos kamerarendszer",
      "Alcantara kárpit",
      "bőrkormány",
      "digitális műszeregység",
      "elektromos csomagtérajtó-mozgatás",
      "kulcs nélküli indítás",
      "masszírozós ülés",
      "multifunkciós kormánykerék",
      "tolatókamera",
      "tolatóradar",
      "távolsági fényszóró asszisztens",
    ],
  },
  biztonsag: {
    title: "Biztonsági felszereltség",
    items: [
      "függönylégzsák",
      "oldallégzsák",
      "vezetőoldali légzsák",
      "utasoldali légzsák",
      "automata fényszórókapcsolás",
      "LED fényszóró",
      "xenon fényszóró",
      "koccanásgátló",
      "sávtartó rendszer",
      "tempomat",
      "ABS (blokkolásgátló)",
      "ESP (menetstabilizátor)",
      "indításgátló (immobiliser)",
      "ISOFIX rendszer",
      "defekttűrő abroncsok",
    ],
  },
  hifi: {
    title: "HiFi és multimédia",
    items: [
      "GPS (navigáció)",
      "bluetooth-os kihangosító",
      "USB csatlakozó",
      "Android Auto",
      "Apple CarPlay",
      "érintőkijelző",
      "vezeték nélküli telefontöltés",
      "WiFi Hotspot",
    ],
  },
  kiegeszito: {
    title: "Kiegészítő felszereltség",
    items: [
      "defektjavító készlet",
      "otthoni hálózati töltő",
      "pótkerék",
      "tetőcsomagtartó",
      "Type2 töltőkábel",
    ],
  },
};

export const KLIM_OPTIONS = [
  "nincs",
  "manuális klíma",
  "automata klíma",
  "digitális klíma",
  "digitális kétzónás klíma",
  "digitális többzónás klíma",
  "hőszivattyús klíma",
];

/** HA Kishaszonjármű részletes kereső — Extrák (2026). */
export const KISTEHER_EQUIPMENT_SECTIONS = {
  muszaki: {
    title: "Műszaki felszereltség",
    items: [
      "középső légzsák elöl",
      "térdlégzsák",
      "ABS (blokkolásgátló)",
      "ASR (kipörgésgátló)",
      "automata fényszórókapcsolás",
      "bekanyarodási segédfény",
      "EDS (elektronikus differenciálzár)",
      "esőszenzor",
      "ESP (menetstabilizátor)",
      "fáradtságérzékelő",
      "GPS nyomkövető",
      "guminyomás-ellenőrző rendszer",
      "hátsó keresztirányú forgalomra figyelmeztetés",
      "holttérfigyelő rendszer",
      "LED fényszóró",
      "LED mátrix fényszóró",
      "menetfény",
      "parkolóasszisztens",
      "sávtartó rendszer",
      "sávváltó asszisztens",
      "tábla-felismerő funkció",
      "ütközés veszélyre felkészítő rendszer",
      "230 V csatlakozó hátul",
      "360 fokos kamerarendszer",
      "digitális műszeregység",
      "fűthető kormány",
      "hátsó légkondicionáló előkészítés",
      "kulcs nélküli indítás",
      "kulcs nélküli nyitórendszer",
      "multifunkciós kormánykerék",
      "raktér világítás",
      "tolatókamera",
      "tolatóradar",
      "USB csatlakozó",
      "vezeték nélküli telefontöltés",
      "defektjavító készlet",
      "immobiliser",
      "kábelköteg felépítményhez",
      "megerősített akkumulátor",
      "riasztó",
      "start-stop/motormegállító rendszer",
      "távolságtartó tempomat",
      "tempomat",
    ],
  },
  belter: {
    title: "Beltér",
    items: [
      "függönylégzsák",
      "hátsó oldal légzsák",
      "kikapcsolható légzsák",
      "oldallégzsák",
      "utasoldali légzsák",
      "vezetőoldali légzsák",
      "bukócső",
      "csomag rögzítő",
      "ISOFIX rendszer",
      "full extra",
      "állófűtés",
      "automatikusan sötétedő belső tükör",
      "bőr belső",
      "bőrkormány",
      "egyszemélyes utasülés",
      "fa padlóburkolat a raktérben",
      "fűthető ülés",
      "fűtőszálas szélvédő",
      "kétszemélyes utasülés",
      "középső kartámasz",
      "térelválasztó",
      "ülésmagasság állítás",
      "üvegezett válaszfal",
      "állítható kormány",
      "centrálzár",
      "fedélzeti komputer",
      "felső rakodópolc",
      "szervokormány",
    ],
  },
  kulter: {
    title: "Kültér",
    items: [
      "automatikusan sötétedő külső tükör",
      "elektromos tető",
      "visszapillantó tükör szárhosszabbítás",
      "dupla hátsókerék",
      "elektromos ablak",
      "elektromos tükör",
      "erősített felfüggesztés",
      "fűthető tükör",
      "kétoldali tolóajtó",
      "könnyűfém felni",
      "sötétített hátsó és hátsó-oldalsó ablakok",
      "színezett üveg",
      "vonóhorog",
      "vonóhorog - elektromosan kihajtható",
      "vonóhorog - levehető fejjel",
      "ködlámpa",
      "xenon fényszóró",
    ],
  },
  multimedia: {
    title: "Multimédia / Navigáció",
    items: [
      "Android Auto",
      "Apple CarPlay",
      "CD tár",
      "CD-s autórádió",
      "GPS (navigáció)",
      "Hi-Fi",
      "rádiós magnó",
    ],
  },
};

/** Flatten — visszafelé kompatibilis. */
export const KISTEHER_EQUIPMENT_ITEMS = Object.values(KISTEHER_EQUIPMENT_SECTIONS).flatMap(
  (section) => section.items
);

/** HA Kishaszon „Egyéb információ”. */
export const KISTEHER_EGYEB_INFO_OPTIONS = [
  "garanciális",
  "amerikai modell",
  "azonnal elvihető",
  "bemutató jármű",
  "jobbkormányos",
  "rendelhető",
  "autóbeszámítás lehetséges",
  "első tulajdonostól",
  "garázsban tartott",
  "keveset futott",
  "második tulajdonostól",
  "motorbeszámítás lehetséges",
  "nem dohányzó",
  "szervizkönyv",
  "törzskönyv",
];
