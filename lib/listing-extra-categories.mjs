/**
 * Hirdetésnézet Extrák csoportok — egyezik a részletes kereső / felszereltség szekciókkal.
 */

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @type {{ id: string, title: string, items: string[] }[]} */
export const EXTRA_CATEGORY_DEFS = [
  {
    id: "belter",
    title: "Beltér",
    items: [
      "függönylégzsák",
      "hátsó oldal légzsák",
      "kikapcsolható légzsák",
      "középső légzsák elöl",
      "oldallégzsák",
      "térdlégzsák",
      "utasoldali légzsák",
      "vezetőoldali légzsák",
      "beépített gyerekülés",
      "bukócső",
      "csomag rögzítő",
      "hátsó fejtámlák",
      "ISOFIX rendszer",
      "sebességváltó zár",
      "full extra",
      "állófűtés",
      "fűthető első és hátsó ülések",
      "fűthető első ülés",
      "ülésfűtés",
      "fűthető kormány",
      "álló helyzeti klíma",
      "hűthető kartámasz",
      "hűthető kesztyűtartó",
      "üléshűtés/szellőztetés",
      "bőr belső",
      "műbőr-kárpit",
      "velúr kárpit",
      "Alcantara kárpit",
      "állítható combtámasz",
      "állítható hátsó ülések",
      "automatikusan sötétedő belső tükör",
      "bőr-szövet huzat",
      "bőrkormány",
      "deréktámasz",
      "digitális műszeregység",
      "dönthető utasülések",
      "elektromos ülésállítás utasoldal",
      "elektromos ülésállítás vezetőoldal",
      "elektromosan állítható fejtámlák",
      "faberakás",
      "garázsajtó távirányító",
      "gesztusvezérlés",
      "hangvezérlés",
      "középső kartámasz",
      "masszírozós ülés",
      "memóriás utasülés",
      "memóriás vezetőülés",
      "multifunkciós kormánykerék",
      "plüss kárpit",
      "távirányítással ledönthető hátsó üléstámla",
      "ülésmagasság állítás",
      "állítható kormány",
      "fedélzeti komputer",
      "HUD / Head-Up Display",
      "HUD / Head-Up Display kiterjesztett valóság funkcióval",
      "kormányváltó",
      "sportülések",
      "manuális klíma",
      "automata klíma",
      "digitális klíma",
      "digitális kétzónás klíma",
      "digitális többzónás klíma",
      "hőszivattyús klíma",
    ],
  },
  {
    id: "muszaki",
    title: "Műszaki",
    items: [
      "bekanyarodási asszisztens",
      "éjjellátó asszisztens",
      "fáradtságérzékelő",
      "hátsó keresztirányú forgalomra figyelmeztetés",
      "holttér-figyelő rendszer",
      "koccanásgátló",
      "lejtmenet asszisztens",
      "parkolóasszisztens",
      "radaros fékasszisztens",
      "sávtartó rendszer",
      "sávváltó asszisztens",
      "távolságtartó tempomat",
      "tempomat",
      "vészfék asszisztens",
      "visszagurulás-gátló",
      "ABS (blokkolásgátló)",
      "ADS (adaptív lengéscsillapító)",
      "ARD (automatikus távolságtartó)",
      "ASR (kipörgésgátló)",
      "automatikus segélyhívó",
      "EBD/EBV (elektronikus fékerő-elosztó)",
      "EDS (elektronikus differenciálzár)",
      "elektronikus rögzítőfék",
      "ESP (menetstabilizátor)",
      "fékasszisztens",
      "GPS nyomkövető",
      "guminyomás-ellenőrző rendszer",
      "indításgátló (immobiliser)",
      "MSR (motorféknyomaték szabályzás)",
      "rablásgátló",
      "tábla-felismerő funkció",
      "ütközés veszélyre felkészítő rendszer",
      "4WS (összkerékkormányzás)",
      "állítható felfüggesztés",
      "automatikus hengerlekapcsolás",
      "centrálzár",
      "chiptuning",
      "EDC (elektronikus lengéscsillapítás vezérlés)",
      "kerámia féktárcsák",
      "pót üzemanyagtartály",
      "részecskeszűrő",
      "riasztó",
      "sebességfüggő szervokormány",
      "sperr differenciálmű",
      "sportfutómű",
      "start-stop/motormegállító rendszer",
      "szervokormány",
      "vonóhorog - elektromosan kihajtható",
      "vonóhorog - levehető fejjel",
      "230 V csatlakozó hátul",
      "360 fokos kamerarendszer",
      "elektronikus futómű hangolás",
      "első-hátsó parkolóradar",
      "kulcs nélküli indítás",
      "kulcsnélküli nyitórendszer",
      "távolsági fényszóró asszisztens",
      "tolatókamera",
      "tolatóradar",
      "otthoni hálózati töltő",
      "Type2 töltőkábel",
    ],
  },
  {
    id: "kulter",
    title: "Kültér",
    items: [
      "gyalogos légzsák",
      "automata fényszórókapcsolás",
      "automata távfény",
      "bekanyarodási segédfény",
      "bi-xenon fényszóró",
      "bukólámpa",
      "kanyarkövető fényszóró",
      "kiegészítő fényszóró",
      "ködlámpa",
      "LED fényszóró",
      "LED mátrix fényszóró",
      "menetfény",
      "xenon fényszóró",
      "defekttűrő abroncsok",
      "esőszenzor",
      "fűthető ablakmosó fúvókák",
      "fűtőszálas szélvédő",
      "ajtószervó",
      "automatikusan sötétedő külső tükör",
      "elektromos csomagtérajtó-mozgatás",
      "elektromosan behajtható külsó tükrök",
      "defektjavító készlet",
      "tetőcsomagtartó",
      "tetőre szerelhető kerékpártartó",
      "vonóhorgos kerékpártartó",
      "elektromos ablak elöl",
      "elektromos ablak hátul",
      "elektromos tükör",
      "fűthető tükör",
      "kétoldali tolóajtó",
      "könnyűfém felni",
      "króm felni",
      "színezett üveg",
      "tolóajtó",
      "tolótető - elektromos",
      "tolótető (napfénytető)",
      "vonóhorog",
      "pótkerék",
    ],
  },
  {
    id: "multimedia",
    title: "Multimédia / Navigáció",
    items: [
      "GPS (navigáció)",
      "rádió",
      "1 DIN",
      "2 DIN",
      "2 hangszóró",
      "4 hangszóró",
      "5 hangszóró",
      "6 hangszóró",
      "7 hangszóró",
      "8 hangszóró",
      "9 hangszóró",
      "10 hangszóró",
      "11 hangszóró",
      "12 hangszóró",
      "mélynyomó",
      "CD tár",
      "MP3 lejátszás",
      "MP4 lejátszás",
      "WMA lejátszás",
      "AUX csatlakozó",
      "bluetooth-os kihangosító",
      "DVB tuner",
      "DVB-T tuner",
      "erősítő kimenet",
      "FM transzmitter",
      "HDMI bemenet",
      "iPhone/iPod csatlakozó",
      "kihangosító",
      "memóriakártya-olvasó",
      "merevlemez",
      "mikrofon bemenet",
      "tolatókamera bemenet",
      "USB csatlakozó",
      "érintőkijelző",
      "erősítő",
      "fejtámlamonitor",
      "gyári erősítő",
      "kormányra szerelhető távirányító",
      "távirányító",
      "tetőmonitor",
      "Android Auto",
      "Apple CarPlay",
      "multifunkcionális kijelző",
      "vezeték nélküli telefontöltés",
      "WiFi Hotspot",
    ],
  },
  {
    id: "egyeb",
    title: "Egyéb információ",
    items: [
      "garanciális",
      "amerikai modell",
      "azonnal elvihető",
      "bemutató jármű",
      "jobbkormányos",
      "rendelhető",
      "ÁFA visszaigényelhető",
      "autóbeszámítás lehetséges",
      "első forgalomba helyezés Magyarországon",
      "első tulajdonostól",
      "frissen szervizelt",
      "garantált km futás",
      "garázsban tartott",
      "hölgy tulajdonostól",
      "keveset futott",
      "második tulajdonostól",
      "motorbeszámítás lehetséges",
      "mozgássérült",
      "nem dohányzó",
      "Nem dohányzó jármű",
      "rendszeresen karbantartott",
      "taxi",
      "törzskönyv",
      "végig vezetett szervizkönyv",
      "vezetett szervizkönyv",
    ],
  },
];

const LOOKUP = [];
for (const cat of EXTRA_CATEGORY_DEFS) {
  for (const item of cat.items) {
    LOOKUP.push({ id: cat.id, title: cat.title, key: norm(item) });
  }
}
LOOKUP.sort((a, b) => b.key.length - a.key.length);

function matchCategory(raw) {
  const key = norm(raw);
  if (!key || key === "nincs") return null;
  for (const row of LOOKUP) {
    if (key === row.key || key.includes(row.key) || row.key.includes(key)) {
      return { id: row.id, title: row.title };
    }
  }
  return { id: "egyeb", title: "Egyéb információ" };
}

/**
 * @param {string[]} items
 * @returns {{ id: string, title: string, items: string[] }[]}
 */
export function categorizeListingExtras(items = []) {
  const buckets = new Map(EXTRA_CATEGORY_DEFS.map((cat) => [cat.id, { id: cat.id, title: cat.title, items: [] }]));
  const seen = new Set();

  for (const raw of items) {
    const text = String(raw ?? "").trim();
    if (text.length < 2) continue;
    const dedupe = norm(text);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const cat = matchCategory(text) || { id: "egyeb", title: "Egyéb információ" };
    if (!buckets.has(cat.id)) {
      buckets.set(cat.id, { id: cat.id, title: cat.title, items: [] });
    }
    buckets.get(cat.id).items.push(text);
  }

  return EXTRA_CATEGORY_DEFS.map((cat) => buckets.get(cat.id)).filter((group) => group.items.length > 0);
}
