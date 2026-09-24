/**
 * IP → ország / település (admin Látogatók).
 * Cache-elve; privát IP-kre nem hív külső API-t.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map(); // ip -> { country, region, city, label, at }

function isPrivateIp(ip) {
  const s = String(ip || "").trim().toLowerCase();
  if (!s) return true;
  if (s === "::1" || s === "127.0.0.1") return true;
  if (s.startsWith("10.") || s.startsWith("192.168.") || s.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(s)) return true;
  if (s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80")) return true;
  return false;
}

function packLabel(country, region, city) {
  const parts = [city, region, country].map((x) => String(x || "").trim()).filter(Boolean);
  // drop duplicate region≈city
  const uniq = [];
  for (const p of parts) {
    if (!uniq.some((u) => u.toLowerCase() === p.toLowerCase())) uniq.push(p);
  }
  return uniq.join(", ");
}

async function fetchGeo(ip) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`geo HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.success === false) {
      return { country: "", region: "", city: "", label: "" };
    }
    const country = String(data.country || "").trim();
    const region = String(data.region || data.regionName || "").trim();
    const city = String(data.city || "").trim();
    return { country, region, city, label: packLabel(country, region, city) };
  } finally {
    clearTimeout(t);
  }
}

export async function lookupIpGeo(ipRaw) {
  const ip = String(ipRaw || "").trim();
  if (!ip || isPrivateIp(ip)) {
    return { country: "", region: "", city: "", label: "helyi / privát" };
  }
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { country: hit.country, region: hit.region, city: hit.city, label: hit.label };
  }
  try {
    const geo = await fetchGeo(ip);
    cache.set(ip, { ...geo, at: Date.now() });
    return geo;
  } catch {
    const fallback = { country: "", region: "", city: "", label: "" };
    cache.set(ip, { ...fallback, at: Date.now() - CACHE_TTL_MS + 60_000 });
    return fallback;
  }
}

export async function attachGeoToDevices(devices = []) {
  const ips = [...new Set((devices || []).map((d) => String(d.ip || "").trim()).filter(Boolean))];
  const geoByIp = new Map();
  // parallel, but cap concurrency lightly
  const chunk = 6;
  for (let i = 0; i < ips.length; i += chunk) {
    const slice = ips.slice(i, i + chunk);
    const results = await Promise.all(slice.map(async (ip) => [ip, await lookupIpGeo(ip)]));
    for (const [ip, geo] of results) geoByIp.set(ip, geo);
  }
  return (devices || []).map((d) => {
    const geo = geoByIp.get(String(d.ip || "").trim()) || { country: "", region: "", city: "", label: "" };
    return {
      ...d,
      geoCountry: geo.country || "",
      geoRegion: geo.region || "",
      geoCity: geo.city || "",
      geoLabel: geo.label || "",
    };
  });
}
