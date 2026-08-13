/** Kliens oldali űrlap betöltés — ha a szerver nem injektálta a partialt. */
export async function loadAdFormPartial() {
  const form = document.getElementById("ad-form");
  if (!form) return false;
  if (document.getElementById("gyartasi_ev")) return true;

  try {
    const response = await fetch("/partials/ad-form.html", { cache: "no-store" });
    if (!response.ok) throw new Error(`partial HTTP ${response.status}`);
    const html = await response.text();
    if (!html.includes("gyartasi_ev")) throw new Error("partial üres vagy hibás");
    form.innerHTML = html;
    return Boolean(document.getElementById("gyartasi_ev"));
  } catch (error) {
    console.error("Űrlap partial betöltés:", error);
    return false;
  }
}
