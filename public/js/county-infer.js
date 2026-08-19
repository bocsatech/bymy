/** Település / irányítószám → vármegye (HU) — hirdetés Megtalálható mezőhöz. */

const COUNTY_SEATS = {
  Budapest: "Budapest",
  Debrecen: "Hajdú-Bihar",
  Miskolc: "Borsod-Abaúj-Zemplén",
  Szeged: "Csongrád-Csanád",
  Pécs: "Baranya",
  Győr: "Győr-Moson-Sopron",
  "Székesfehérvár": "Fejér",
  Kecskemét: "Bács-Kiskun",
  Sopron: "Győr-Moson-Sopron",
  Eger: "Heves",
  Szombathely: "Vas",
  Tatabánya: "Komárom-Esztergom",
  Kaposvár: "Somogy",
  Veszprém: "Veszprém",
  "Békéscsaba": "Békés",
  Zalaegerszeg: "Zala",
  "Nyíregyháza": "Szabolcs-Szatmár-Bereg",
  Szolnok: "Jász-Nagykun-Szolnok",
  Érd: "Pest",
  "Salgótarján": "Nógrád",
  Szekszárd: "Tolna",
  Dabas: "Pest",
  Velence: "Fejér",
  Gárdony: "Fejér",
  Pusztaszabolcs: "Fejér",
  Adony: "Fejér",
  "Ráckeve": "Pest",
  Ercsi: "Fejér",
  "Várpalota": "Veszprém",
  Polgárdi: "Fejér",
  "Budaörs": "Pest",
};

function fold(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function inferMegyeFromCity(city, postalCode = "") {
  const postal = String(postalCode ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
  const n = Number(postal);
  if (postal.length === 4 && n >= 1000 && n <= 1239) return "Budapest";

  const raw = String(city ?? "").trim();
  if (!raw) return "";
  if (COUNTY_SEATS[raw]) return COUNTY_SEATS[raw];
  if (/^budapest$/i.test(raw)) return "Budapest";

  const folded = fold(raw);
  for (const [name, county] of Object.entries(COUNTY_SEATS)) {
    if (fold(name) === folded) return county;
  }
  return "";
}
