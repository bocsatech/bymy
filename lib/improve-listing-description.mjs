/**
 * Hirdetésleírás AI-javítás — OpenAI chat completions.
 * Nem talál ki adatot; emberszerű, magyar eladói hangnem.
 */

const FACT_KEYS = [
  ["gyartmany", "Gyártmány"],
  ["modell", "Modell"],
  ["tipus", "Típus"],
  ["hirdetes_cime", "Cím"],
  ["gyartasi_ev", "Gyártási év"],
  ["gyartasi_honap", "Gyártási hónap"],
  ["km", "Km. óra állás"],
  ["uzemanyag", "Üzemanyag"],
  ["hengerurtartalom", "Hengerűrtartalom"],
  ["teljesitmeny_kw", "Teljesítmény (kW)"],
  ["teljesitmeny_le", "Teljesítmény (LE)"],
  ["sebessegvalto", "Sebességváltó"],
  ["hajtas", "Hajtás"],
  ["kivitel", "Kivitel"],
  ["ajtok", "Ajtók száma"],
  ["szemelyek", "Szállítható személyek"],
  ["szin", "Szín"],
  ["karpit_szin", "Kárpit szín"],
  ["karpit_szin_1", "Kárpit szín (1)"],
  ["karpit_szin_2", "Kárpit szín (2)"],
  ["sajat_tomeg", "Saját tömeg"],
  ["teljes_tomeg", "Teljes tömeg"],
  ["csomagtarto", "Csomagtartó"],
  ["klima", "Klíma"],
  ["klima_fajtaja", "Klíma fajtája"],
  ["henger_elrendezes", "Henger-elrendezés"],
  ["okmany_jelleg", "Okmányok"],
  ["muszaki_ev", "Műszaki év"],
  ["muszaki_honap", "Műszaki hónap"],
  ["vetelar", "Vételár"],
  ["allapot", "Állapot"],
  ["fogyasztas_autopalya", "Autópálya fogyasztás"],
  ["fogyasztas_kombinalt", "Kombinált fogyasztás"],
];

const BLOCKED_KEYS = new Set([
  "telefon",
  "phone",
  "email",
  "megtekintesi_cim",
  "iranyitoszam",
  "telepules",
  "megye",
  "megtalalhato_orszag",
  "leiras",
  "owner_user_id",
]);

export function buildListingFacts(form = {}) {
  const lines = [];
  const seen = new Set();
  for (const [key, label] of FACT_KEYS) {
    const raw = form?.[key];
    const value = Array.isArray(raw)
      ? raw.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ")
      : String(raw ?? "").trim();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    lines.push(`${label}: ${value}`);
  }
  // Extrák / felszereltség röviden
  const extras = form?.felszereltseg;
  if (Array.isArray(extras) && extras.length) {
    const list = extras.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 25);
    if (list.length) lines.push(`Felszereltség: ${list.join(", ")}`);
  }
  return lines;
}

export function buildImproveDescriptionMessages({ draft = "", facts = [], title = "" } = {}) {
  const draftText = String(draft ?? "").trim();
  const factBlock = (facts || []).join("\n") || "(nincs megadott adat)";
  const titleLine = String(title ?? "").trim();

  const system = [
    "Te egy magyar autó-/járműhirdetés szövegírója vagy a bymy piactéren.",
    "Írj természetes, emberszerű, barátságos eladói hangon — ne legyen száraz adatlap vagy reklámsablon.",
    "Csak a megadott vázlatból és a járműadatokból dolgozz. Ne találj ki felszereltséget, garanciát, balesetmentességet, szerviztörténetet vagy egyéb állítást.",
    "Ha valamit a feladó nem írt, ne említsd.",
    "Ne írj címet, telefonszámot, emailcímet, linket.",
    "Ne használj markdownot, csillagokat, felsorolásjeleket — sima bekezdések.",
    "Hossz: kb. 80–140 szó, 2–4 rövid bekezdés.",
    "Magyar nyelven írj.",
  ].join(" ");

  const user = [
    titleLine ? `Hirdetés címe: ${titleLine}` : "",
    "Járműadatok:",
    factBlock,
    "",
    "Feladó vázlata / megjegyzései:",
    draftText || "(üres — csak az adatokból írj rövid, emberi bemutatkozást, kitalálás nélkül)",
    "",
    "Írd meg a kész hirdetésszöveget.",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function sanitizeFormForImprove(form = {}) {
  const out = {};
  for (const [key, value] of Object.entries(form || {})) {
    if (BLOCKED_KEYS.has(key)) continue;
    if (value == null) continue;
    out[key] = value;
  }
  return out;
}

/**
 * @returns {Promise<{ ok: true, text: string } | { ok: false, error: string, code?: string }>}
 */
export async function improveListingDescription({ draft, form, fetchImpl = fetch } = {}) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, error: "Az AI javítás nincs beállítva (OPENAI_API_KEY).", code: "NOT_CONFIGURED" };
  }

  const cleanForm = sanitizeFormForImprove(form);
  const facts = buildListingFacts(cleanForm);
  const draftText = String(draft ?? "").trim();
  if (!draftText && facts.length < 3) {
    return {
      ok: false,
      error: "Írj pár mondatot a leírásba, vagy tölts ki több járműadatot.",
      code: "TOO_SHORT",
    };
  }

  const title =
    [cleanForm.gyartmany, cleanForm.modell || cleanForm.tipus].filter(Boolean).join(" ") ||
    cleanForm.hirdetes_cime ||
    "";
  const messages = buildImproveDescriptionMessages({ draft: draftText, facts, title });
  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";

  let response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 500,
        messages,
      }),
    });
  } catch (error) {
    return { ok: false, error: error.message ?? "AI hívás sikertelen.", code: "NETWORK" };
  }

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const msg = data?.error?.message || data?.error || `AI hiba (${response.status}).`;
    return { ok: false, error: String(msg), code: "PROVIDER" };
  }

  const text = String(data?.choices?.[0]?.message?.content ?? "")
    .trim()
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "");
  if (!text) {
    return { ok: false, error: "Üres választ kaptunk az AI-tól.", code: "EMPTY" };
  }
  return { ok: true, text };
}
