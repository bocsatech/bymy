
const SAVED_SEARCH_VERSION = 1;

const LABELS = {
  gyartmanyok: "Márka",
  modellek: "Modell",
  gyartmany: "Márka",
  modell: "Modell",
  ev_tol: "Év",
  ev_ig: "Év",
  ar_tol: "Ár",
  ar_ig: "Ár",
  km_tol: "Km",
  km_ig: "Km",
  le_tol: "LE",
  le_ig: "LE",
  ccm_tol: "ccm",
  ccm_ig: "ccm",
  uzemanyagok: "Üzemanyag",
  uzemanyag: "Üzemanyag",
  kivitel: "Kivitel",
  allapot: "Állapot",
  sebessegvalto: "Sebességváltó",
  okmany_jelleg: "Okmány",
  iranyitoszam: "Irányítószám",
  keresesi_korzet: "Körzet",
  telepules: "Település",
};

function pagePath(page) {
  if (page === "teherauto") return "/teherauto.html";
  if (page === "ingatlan") return "/ingatlan.html";
  return "/auto.html";
}

function base64UrlEncode(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(str) {
  const b64 = String(str || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return decodeURIComponent(escape(atob(b64 + pad)));
}

function stripEmpty(value) {
  if (value == null || value === "") return undefined;
  if (Array.isArray(value) && !value.length) return undefined;
  if (typeof value === "object" && !Array.isArray(value)) {
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = stripEmpty(v);
      if (cleaned !== undefined) next[k] = cleaned;
    }
    return Object.keys(next).length ? next : undefined;
  }
  return value;
}

export function normalizeSavedSearchFilters(filters) {
  if (!filters || typeof filters !== "object") return {};
  const { detailed, ...rest } = filters;
  const out = stripEmpty(rest) || {};
  const cleanedDetailed = stripEmpty(detailed);
  if (cleanedDetailed) out.detailed = cleanedDetailed;
  return out;
}

export function encodeSavedSearchParam(page, filters) {
  const payload = {
    v: SAVED_SEARCH_VERSION,
    page: page || "auto",
    filters: normalizeSavedSearchFilters(filters),
  };
  if (!Object.keys(payload.filters).length) return "";
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeSavedSearchParam(param) {
  if (!param) return null;
  try {
    const json = base64UrlDecode(param);
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") return null;
    return {
      page: data.page || "auto",
      filters: normalizeSavedSearchFilters(data.filters || {}),
    };
  } catch {
    return null;
  }
}

export function buildSavedSearchUrl(page, filters, extraParams = {}) {
  const encoded = encodeSavedSearchParam(page, filters);
  const url = new URL(pagePath(page), window.location.origin);
  if (encoded) url.searchParams.set("ss", encoded);
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

export function savedSearchHref(item) {
  if (item?.href) return item.href;
  if (item?.filters && Object.keys(item.filters).length) {
    return buildSavedSearchUrl(item.page || "auto", item.filters);
  }
  const query = String(item?.query || "").trim();
  if (query.startsWith("/")) return query;
  if (query) {
    const url = new URL(pagePath(item?.page || "auto"), window.location.origin);
    url.searchParams.set("q", query);
    return `${url.pathname}${url.search}`;
  }
  return pagePath(item?.page || "auto");
}

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  if (num >= 1_000_000) return `${Math.round(num / 100_000) / 10} M Ft`;
  return `${Math.round(num / 1000)} e Ft`;
}

function formatRange(tol, ig, fmt = (v) => String(v)) {
  const a = tol != null && tol !== "" ? fmt(tol) : "";
  const b = ig != null && ig !== "" ? fmt(ig) : "";
  if (a && b) return `${a}–${b}`;
  if (a) return `${a}+`;
  if (b) return `≤ ${b}`;
  return "";
}

function summarizeList(values, label) {
  if (!Array.isArray(values) || !values.length) return "";
  if (values.length <= 2) return `${label}: ${values.join(", ")}`;
  return `${label}: ${values.length} db`;
}

export function summarizeSavedSearchFilters(filters) {
  if (!filters || typeof filters !== "object") return "";
  const parts = [];

  const brand = summarizeList(filters.gyartmanyok, "Márka") || (filters.gyartmany ? `Márka: ${filters.gyartmany}` : "");
  if (brand) parts.push(brand);

  const model = summarizeList(filters.modellek, "Modell") || (filters.modell ? `Modell: ${filters.modell}` : "");
  if (model) parts.push(model);

  const year = formatRange(filters.ev_tol, filters.ev_ig);
  if (year) parts.push(`Év: ${year}`);

  const price = formatRange(filters.ar_tol, filters.ar_ig, formatMoney);
  if (price) parts.push(`Ár: ${price}`);

  const km = formatRange(filters.km_tol, filters.km_ig, (v) => `${Number(v).toLocaleString("hu-HU")} km`);
  if (km) parts.push(`Km: ${km}`);

  const fuel =
    summarizeList(filters.uzemanyagok, "Üzemanyag") ||
    (filters.uzemanyag ? `Üzemanyag: ${filters.uzemanyag}` : "");
  if (fuel) parts.push(fuel);

  if (filters.kivitel) parts.push(`Kivitel: ${filters.kivitel}`);
  if (filters.allapot) parts.push(`Állapot: ${filters.allapot}`);
  if (filters.sebessegvalto) parts.push(`Váltó: ${filters.sebessegvalto}`);

  const postal = String(filters.iranyitoszam || "").replace(/\D/g, "").slice(0, 4);
  const radius = filters.keresesi_korzet;
  if (postal.length === 4) {
    parts.push(radius ? `${postal} · ${radius} km` : postal);
  }

  const detailed = filters.detailed;
  if (detailed) {
    const extraCount = detailed.extras?.length || 0;
    const flagCount = Object.keys(detailed.flags || {}).length;
    const selectCount = Object.values(detailed.selects || {}).filter((v) =>
      Array.isArray(v) ? v.length : v != null && v !== ""
    ).length;
    const rangeCount = Object.entries(detailed.ranges || {}).filter(([k, v]) => k.endsWith("_tol") && v != null).length;
    const dTotal = extraCount + flagCount + selectCount + rangeCount;
    if (dTotal) parts.push(`Részletes: ${dTotal} szűrő`);
  }

  if (!parts.length) {
    const keys = Object.keys(filters).filter((k) => k !== "detailed");
    if (keys.length) {
      return keys
        .slice(0, 4)
        .map((k) => {
          const label = LABELS[k] || k;
          const val = filters[k];
          if (Array.isArray(val)) return summarizeList(val, label);
          return `${label}: ${val}`;
        })
        .join(" · ");
    }
  }

  return parts.slice(0, 6).join(" · ");
}

function setJsonFilterKey(form, key, values) {
  const el = form.querySelector(`[data-filter-key="${key}"]`);
  if (!el) return;
  const list = Array.isArray(values) ? values.map((v) => String(v)).filter(Boolean) : [];
  el.value = list.length ? JSON.stringify(list) : "";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setScalarFilterKey(form, key, value) {
  if (value == null || value === "") return;
  const els = form.querySelectorAll(`[data-filter-key="${key}"]`);
  if (!els.length) return;
  const str = String(value);
  els.forEach((el) => {
    if (el.type === "checkbox") {
      el.checked = Boolean(value);
    } else {
      el.value = str;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function updatePickerSummaries(form, filters) {
  const brandSummary = form.querySelector("[data-auto-bm-brand-summary]");
  if (brandSummary && filters.gyartmanyok?.length) {
    brandSummary.textContent =
      filters.gyartmanyok.length === 1 ? filters.gyartmanyok[0] : `${filters.gyartmanyok.length} márka`;
  }
  const modelSummary = form.querySelector("[data-auto-bm-model-summary]");
  if (modelSummary && filters.modellek?.length) {
    modelSummary.textContent =
      filters.modellek.length === 1 ? filters.modellek[0] : `${filters.modellek.length} modell`;
  }
  const fuelSummary = form.querySelector("[data-auto-fuel-summary]");
  if (fuelSummary && filters.uzemanyagok?.length) {
    fuelSummary.textContent =
      filters.uzemanyagok.length <= 2 ? filters.uzemanyagok.join(", ") : `${filters.uzemanyagok.length} üzemanyag`;
  }
}

async function applyDetailedFilters(form, detailed) {
  if (!detailed || typeof detailed !== "object") return;
  const panel = form.querySelector("#qs-detailed-panel");
  if (!panel || panel.dataset.detailedMounted !== "1") {
    const { mountDetailedSearch } = await import("./auto-detailed-search.js?v=savedSearch1");
    await mountDetailedSearch(form, { force: true });
  }

  const { ranges = {}, selects = {}, extras = [], flags = {} } = detailed;

  for (const [key, value] of Object.entries(ranges)) {
    if (value == null) continue;
    setScalarFilterKey(form, key, value);
  }

  for (const [key, value] of Object.entries(selects)) {
    if (Array.isArray(value)) {
      setJsonFilterKey(form, key, value);
      const wrap = form.querySelector(`[data-multi-select="${key}"]`);
      if (wrap) {
        wrap.querySelectorAll(`input[type="checkbox"][data-multi-filter-key="${key}"]`).forEach((el) => {
          el.checked = value.includes(String(el.value || ""));
        });
      }
    } else {
      setScalarFilterKey(form, key, value);
    }
  }

  for (const [key, on] of Object.entries(flags)) {
    const el = form.querySelector(`[data-filter-key="${key}"]`);
    if (el?.type === "checkbox") el.checked = Boolean(on);
  }

  if (extras.length) {
    form.querySelectorAll('input[type="checkbox"][data-extra]').forEach((el) => {
      const label = el.getAttribute("data-extra");
      el.checked = extras.includes(label);
    });
  }
}

export async function applySavedSearchFilters(form, filters) {
  if (!form || !filters || typeof filters !== "object") return;
  const { detailed, ...quick } = filters;

  for (const [key, value] of Object.entries(quick)) {
    if (key === "gyartmanyok" || key === "modellek" || key === "uzemanyagok") {
      setJsonFilterKey(form, key, value);
      continue;
    }
    if (Array.isArray(value)) {
      setJsonFilterKey(form, key, value);
      continue;
    }
    setScalarFilterKey(form, key, value);
  }

  updatePickerSummaries(form, quick);

  if (detailed) {
    await applyDetailedFilters(form, detailed);
  }

  form.dispatchEvent(new CustomEvent("bymy-saved-search-applied", { bubbles: true, detail: filters }));
}
