/** Böngésző Maps JS / Geocoding kulcs (HTTP referrer korlátozással). */
export function getGoogleMapsApiKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_KEY || "").trim();
}
