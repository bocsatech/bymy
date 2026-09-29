/** Google Maps JS API betöltő (Places + Geometry). */

let mapsPromise = null;

export async function fetchGoogleMapsApiKey() {
  const res = await fetch("/api/maps-config", { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Maps config nem elérhető.");
  const key = String(data.googleMapsApiKey || data.key || "").trim();
  if (!key) {
    throw new Error(
      "Google Maps API kulcs hiányzik. Állítsd be a GOOGLE_MAPS_API_KEY környezeti változót (Vercel / .env)."
    );
  }
  return key;
}

export function loadGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = (async () => {
    const key = await fetchGoogleMapsApiKey();
    await new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-google-maps]");
      if (existing) {
        if (window.google?.maps?.Map) {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps betöltési hiba.")), {
          once: true,
        });
        return;
      }
      const cb = `__bymyGmapsInit_${Date.now()}`;
      window[cb] = () => {
        try {
          delete window[cb];
        } catch {
          window[cb] = undefined;
        }
        resolve();
      };
      const script = document.createElement("script");
      script.dataset.googleMaps = "1";
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry&language=hu&region=HU&callback=${cb}&v=weekly`;
      script.onerror = () => reject(new Error("Google Maps betöltési hiba."));
      document.head.appendChild(script);
    });
    if (!window.google?.maps?.Map) throw new Error("Google Maps nem elérhető.");
    return window.google.maps;
  })().catch((error) => {
    mapsPromise = null;
    throw error;
  });

  return mapsPromise;
}
