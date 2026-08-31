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

/** Autó / teher — állapot (kereső + feladás). */
export const ALLAPOT_CATEGORIES = [
  {
    id: "normal",
    label: "Normál",
    children: [
      { label: "Normál", value: "Normál" },
      { label: "Kitűnő", value: "Kitűnő" },
      { label: "Megkímélt", value: "Megkímélt" },
      { label: "Újszerű", value: "Újszerű" },
      { label: "Sérülésmentes", value: "Sérülésmentes" },
    ],
  },
  {
    id: "serult",
    label: "Sérült",
    children: [
      { label: "Sérült", value: "Sérült" },
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

/** Autó / teher — sebességváltó (kereső). */
export const SEBESSEGVALTO_CATEGORIES = [
  {
    id: "manualis",
    label: "Manuális",
    children: [
      { label: "Manuális (5 seb.)", value: "Manuális (5 seb.)" },
      { label: "Manuális (6 seb.)", value: "Manuális (6 seb.)" },
    ],
  },
  {
    id: "automata",
    label: "Automata",
    children: [
      { label: "Automata", value: "Automata" },
      { label: "Fokozatmentes automata", value: "Fokozatmentes automata" },
    ],
  },
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
  egyeb: {
    title: "Egyéb információk",
    items: [
      "garanciális",
      "azonnal elvihető",
      "első tulajdonostól",
      "garázsban tartott",
      "keveset futott",
      "nem dohányzó",
      "rendszeresen karbantartott",
      "vezetett szervizkönyv",
      "ÁFA visszaigényelhető",
      "autóbeszámítás lehetséges",
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

/** Kisteher 3,5 t-ig — Extrák lépés (Klíma select + ezek a pipák). */
export const KISTEHER_EQUIPMENT_ITEMS = [
  "állítható kormány",
  "centrálzár",
  "elektromos ablak",
  "elektromos tükör",
  "fedélzeti komputer",
  "fűthető tükör",
  "immobiliser",
  "könnyűfém felni",
  "riasztó",
  "szervokormány",
  "színezett üveg",
  "tempomat",
  "vonóhorog",
];
