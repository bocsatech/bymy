const STORAGE_KEY = "bymy_partner_postal_code";

export function loadSavedPostalCode() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export async function fetchPartnerRecommendations(postalCode) {
  const params = new URLSearchParams({ postal_code: String(postalCode).trim() });
  const response = await fetch(`/api/partners/recommendations?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Ajánlások betöltése sikertelen.");
  return data;
}

export async function deletePartner(id) {
  const response = await fetch(`/api/partners/${id}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Törlés sikertelen.");
  return data;
}
