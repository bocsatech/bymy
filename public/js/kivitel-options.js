/** Autó karosszéria / kivitel — közös lista (kereső, feladás, menü). */

export const KIVITEL_OPTIONS = [
  "Pickup",
  "Terepjáró",
  "Buggy",
  "Cabrio",
  "Coupe",
  "Egyterű",
  "Ferdehátú",
  "Hot rod",
  "Kisbusz",
  "Kombi",
  "Lépcsőshátú",
  "Mopedautó",
  "Sedan",
  "Sport",
  "Városi terepjáró (crossover)",
  "Egyéb",
];

const ALIASES = {
  szedan: "Sedan",
  sedan: "Sedan",
  lepcsoshata: "Lépcsőshátú",
  kupe: "Coupe",
  coupe: "Coupe",
  "suv / crossover": "Városi terepjáró (crossover)",
  suv: "Városi terepjáró (crossover)",
  crossover: "Városi terepjáró (crossover)",
  terepjaro: "Terepjáró",
};

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeKivitel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (KIVITEL_OPTIONS.includes(raw)) return raw;
  const key = normalizeKey(raw);
  if (ALIASES[key]) return ALIASES[key];
  for (const opt of KIVITEL_OPTIONS) {
    if (normalizeKey(opt) === key) return opt;
  }
  if (key.includes("suv") || key.includes("crossover") || key.includes("varosi terep")) {
    return "Városi terepjáró (crossover)";
  }
  if (key.includes("terepjaro") || key.includes("offroad") || key.includes("off-road")) {
    return "Terepjáró";
  }
  if (key.includes("kombi") || key.includes("wagon") || key.includes("estate")) return "Kombi";
  if (key.includes("ferde") || key.includes("hatchback")) return "Ferdehátú";
  if (key.includes("sedan") || key.includes("szedan") || key.includes("lepcosh")) return "Sedan";
  if (key.includes("egyteru") || key.includes("mpv")) return "Egyterű";
  if (key.includes("kupe") || key.includes("coupe")) return "Coupe";
  if (key.includes("cabrio") || key.includes("convertible")) return "Cabrio";
  if (key.includes("pickup") || key.includes("pick-up") || key.includes("pick up")) return "Pickup";
  if (key.includes("buggy")) return "Buggy";
  if (key.includes("hot rod") || key.includes("hotrod")) return "Hot rod";
  if (key.includes("kisbusz") || key.includes("minibus")) return "Kisbusz";
  if (key.includes("moped") || key.includes("microcar")) return "Mopedautó";
  if (key.includes("sport")) return "Sport";
  return raw;
}

export function kivitelMatches(listingValue, filterValue) {
  const want = normalizeKivitel(filterValue);
  const got = normalizeKivitel(listingValue);
  if (!want) return true;
  if (!got) return false;
  return got === want;
}

export function kivitelMenuHref(kivitel, { basePath = "/auto.html", searchParams = null } = {}) {
  const params = new URLSearchParams(searchParams || (typeof window !== "undefined" ? window.location.search : ""));
  if (kivitel) params.set("kivitel", kivitel);
  else params.delete("kivitel");
  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}
