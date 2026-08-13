/** Import sor kiegészítése (km, forrás URL, hiányzó alapértékek) — böngésző és teszt is használja. */

const IMPORT_DEFAULTS = {
  allapot: "Normál",
  okmany_jelleg: "Érvényes magyar okmányokkal",
  okmany_ervenyesseg: "Érvényes",
};

function inferKivitel(text) {
  const v = String(text ?? "").toLowerCase();
  if (!v) return "";
  if (/\bsuv\b|\bcrossover\b|\bglc\b|\bgle\b|\bgls\b|\bx\d|\bq\d|\btucson\b|\bkuga\b|\brav4\b/.test(v)) {
    return "SUV / Crossover";
  }
  if (/\bkombi\b|\bestate\b|\bwagon\b/.test(v)) return "Kombi";
  if (/\bferde\b|\bhatchback\b/.test(v)) return "Ferdehátú";
  if (/\bszedan\b|\bsedan\b/.test(v)) return "Szedán";
  return "";
}

function inferFuel(text) {
  const v = String(text ?? "").toLowerCase();
  if (!v) return "";
  if (/phev|plug-in|plugin|hibrid.*benzin|benzin.*hibrid/.test(v)) return "Benzin/elektromos";
  if (/hibrid.*diesel|diesel.*hibrid|hibrid.*dízel|dízel.*hibrid/.test(v)) return "Dízel/elektromos";
  if (/elektromos| e-tron|\be\d{2,3}\b/.test(v)) return "Elektromos";
  if (/\b\d{2,3}\s*d\b|diesel|dízel|tdi|cdi|cdti|multijet|220 d|250 d|350 d/.test(v)) return "Dízel";
  if (/lpg.*dízel|lpg.*diesel|dízel.*lpg|diesel.*lpg/.test(v)) return "LPG/dízel";
  if (/cng.*dízel|cng.*diesel|dízel.*cng|diesel.*cng/.test(v)) return "CNG/dízel";
  if (/lpg|gáz/.test(v)) return "LPG/benzin";
  if (/cng/.test(v)) return "CNG/benzin";
  if (/etanol/.test(v)) return "Etanol";
  if (/biodízel|biodizel/.test(v)) return "Biodízel";
  if (/hidrogén|hidrogen/.test(v)) return "Hidrogén/elektromos";
  if (/hibrid/.test(v)) return "Benzin/elektromos";
  if (/benzin|tsi|tfsi|mpi|ecoboost/.test(v)) return "Benzin";
  return "";
}

export function enrichFormFromImportItem(formData, item) {
  const data = { ...(formData ?? {}) };
  const hint = [item?.cim, item?.ar, item?.km, item?.evjarat, data.tipus, data.hirdetes_cime, data.modell]
    .filter(Boolean)
    .join(" ");

  if ((!data.km || String(data.km).trim() === "") && item?.km) {
    const digits = String(item.km).replace(/[^\d]/g, "");
    if (digits) data.km = digits;
  }
  if (item?.url && !data.forras_url) data.forras_url = item.url;
  if (item?.id && !data.hasznaltauto_hirdetes_id) data.hasznaltauto_hirdetes_id = String(item.id);

  if (item?.evjarat && !data.gyartasi_ev) {
    const ym = String(item.evjarat).match(/(19|20)\d{2}(?:\/(\d{1,2}))?/);
    if (ym) {
      data.gyartasi_ev = ym[0].slice(0, 4);
      if (ym[2]) data.gyartasi_honap = String(Number(ym[2]));
    }
  }

  if (item?.ar && !data.vetelar) {
    const digits = String(item.ar).replace(/[^\d]/g, "");
    if (digits) data.vetelar = digits;
  }

  for (const [key, value] of Object.entries(IMPORT_DEFAULTS)) {
    if (!data[key]) data[key] = value;
  }

  if (!data.kivitel) {
    data.kivitel = inferKivitel(hint);
  }
  if (!data.uzemanyag) {
    data.uzemanyag = inferFuel(hint);
  }

  return data;
}
