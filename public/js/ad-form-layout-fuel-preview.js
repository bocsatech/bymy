import { fuelFieldVisibility } from "./ad-form-fuel-profile.js?v=fuelProfile3";
import { EV_LAYOUT_GROUP_KEYS } from "./ad-form-desk-pinned-blocks.js?v=layoutFromKv1";

const COMBUSTION_ONLY_FIELD_KEYS = new Set([
  "fogyasztas_varosi",
  "fogyasztas_orszaguti",
  "fogyasztas_kombinalt",
]);

export const DESK_FUEL_PREVIEW_PROFILES = [
  { id: "combustion", label: "Normál autó feladás" },
  { id: "electric", label: "Elektromos autó feladás" },
  { id: "hybrid", label: "Hibrid autó feladás" },
];

export function deskFuelPreviewFromLayoutIntent(intent) {
  const v = String(intent ?? "").trim().toLowerCase();
  if (v === "fuel-electric") return "electric";
  if (v === "fuel-hybrid") return "hybrid";
  return "combustion";
}

export function normalizeDeskFuelPreviewProfile(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "electric" || v === "elektromos") return "electric";
  if (v === "hybrid" || v === "hibrid") return "hybrid";
  return "combustion";
}

/** Admin elrendezés-szerkesztő: mely csempe látszik az adott üzemanyag-előnézetben (nem ment külön layoutot). */
export function layoutFieldVisibleForFuelProfile(fieldKey, profileInput) {
  const profile = normalizeDeskFuelPreviewProfile(profileInput);
  const { showElectric, showConsumption, showHenger } = fuelFieldVisibility(profile);
  const key = String(fieldKey || "");
  if (key === "__desk_electric_block__") return showElectric;
  if (key === "__desk_tire_sizes__") return true;
  if (EV_LAYOUT_GROUP_KEYS.has(key)) return showElectric;
  if (COMBUSTION_ONLY_FIELD_KEYS.has(key)) return showConsumption;
  if (key === "hengerurtartalom") return showHenger;
  return true;
}
