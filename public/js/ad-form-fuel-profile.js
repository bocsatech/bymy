/** Mezők, amik csak elektromos / hibrid hajtásnál (HA-szerű). */
export const EV_FUEL_FIELD_IDS = [
  "akkumulator_kwh",
  "jelenlegi_akkukapacitas",
  "ac_tolto_csatlakozas",
  "ac_toltesi_teljesitmeny",
  "dc_tolto_csatlakozas",
  "dc_toltesi_teljesitmeny",
  "hatotav",
  "autopalya_hatotav",
  "teli_hatotav",
  "tolto_csatlakozas",
  "villamtoltes",
  "zold_rendszam",
];

export function normalizeAdFuelValue(value) {
  const aliases = {
    Diesel: "Dízel",
    "Diesel/elektromos": "Dízel/elektromos",
  };
  return aliases[String(value ?? "").trim()] ?? String(value ?? "").trim();
}

/**
 * Használtautó.hu logika közelítése:
 * - tiszta benzin/dízel/gáz → csak belsőégésű mezők
 * - elektromos → töltés/akkumulátor, nincs hengerűrtartalom / l/100 km
 * - hibrid (és benzin/dízel + elektromos) → mindkét csoport
 */
export function fuelProfile(value) {
  const v = normalizeAdFuelValue(value).toLocaleLowerCase("hu");
  if (!v) return "unknown";
  if (v === "elektromos" || v === "hidrogén/elektromos" || v.includes("hidrogén")) return "electric";
  if (v.includes("hibrid")) return "hybrid";
  if (v.includes("elektromos") && (v.includes("/") || v.includes("benzin") || v.includes("dízel") || v.includes("dizel"))) {
    return "hybrid";
  }
  return "combustion";
}

/** Használtautó.hu: benzin/dízel/gáz/etanol = nincs EV blokk; hibrid = EV + henger; elektromos = EV + henger, nincs l/100 km. */
export function fuelFieldVisibility(profile) {
  const showElectric = profile === "electric" || profile === "hybrid";
  const showConsumption = profile === "combustion" || profile === "hybrid" || profile === "unknown";
  const showHenger = true;
  return { showElectric, showConsumption, showHenger };
}

export function readAdFormFuelValue(uzemanyagEl) {
  if (!uzemanyagEl) return "";
  const fromSelect = String(uzemanyagEl.value ?? "").trim();
  if (fromSelect) return normalizeAdFuelValue(fromSelect);
  const hidden = uzemanyagEl._adBmHidden?.value;
  if (hidden != null && String(hidden).trim()) return normalizeAdFuelValue(String(hidden).trim());
  return "";
}
