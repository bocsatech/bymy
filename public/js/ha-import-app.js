import {
  getAuthUser,
  getAuthToken,
  getBookmarkletToken,
  getDisplayName,
  requireAuthForPage,
  initSiteAuth,
  ensureBookmarkletToken,
} from "./site-auth.js?v=secAuth3";

const HA_POSTMESSAGE_ORIGINS = new Set([
  "https://www.hasznaltauto.hu",
  "https://hasznaltauto.hu",
  "https://admin.hasznaltauto.hu",
]);

const CAT_STORAGE_KEY = "bymy-hirdetes-category";
const CAT_STORAGE_VERSION = 2;
const MODES = {
  standard: {
    title: "Használtautó import",
    startURL: "https://www.hasznaltauto.hu/",
    steps: "1. Jelentkezz be  ·  2. Nyisd meg a listát vagy egy hirdetést  ·  3. Importálás",
    action: "Hirdetés / lista importálása",
    footer: "Listánál a háttérben végigmegyünk a hirdetéseken (max. 50). A jelszavadat nem tároljuk.",
    openLabel: "hasznaltauto.hu megnyitása",
  },
  dealer: {
    title: "Kereskedői import",
    startURL: "https://admin.hasznaltauto.hu/",
    steps: "1. Autóimport nyitva  ·  2. Engedd a felugrót / admin ebből  ·  3. Friss könyvjelző a listán",
    action: "Lista → csak első kép (CDN)",
    footer: "A mentés a Bymy fülön történik (a HA oldal gyakran blokkolja a közvetlen mentést). Autóimport maradjon nyitva; Win7-en engedd a felugró ablakot.",
    openLabel: "admin.hasznaltauto.hu megnyitása",
  },
};

function authHeaders() {
  const token = getAuthToken();
  // imp1 csak a HA könyvjelzőnek — same-origin mentéshez session cookie elég
  const useBearer = token && !String(token).startsWith("imp1.");
  return {
    "Content-Type": "application/json",
    ...(useBearer ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function currentMode() {
  const q = new URLSearchParams(location.search).get("mode");
  return q === "dealer" ? "dealer" : "standard";
}

function setMode(mode) {
  const next = mode === "dealer" ? "dealer" : "standard";
  const url = new URL(location.href);
  if (next === "dealer") url.searchParams.set("mode", "dealer");
  else url.searchParams.delete("mode");
  history.replaceState({}, "", url);
  renderMode();
}

function bookmarkletHref(mode) {
  const origin = location.origin;
  const isDealer = mode === "dealer";
  const src = isDealer
    ? `${origin}/js/ha-dealer-import.js?v=haCdn19`
    : `${origin}/js/ha-import-bookmarklet.js?v=haDealerPhoto17`;
  const token = getBookmarkletToken() || getAuthToken() || "";
  const runner = isDealer ? "BymyHaDealerImport" : "BymyHaImport";
  return `javascript:void(function(){var o=${JSON.stringify(origin)};var m=${JSON.stringify(mode)};var t=${JSON.stringify(token)};var src=${JSON.stringify(src)}+"&t="+Date.now();function go(){try{window.${runner}.run({origin:o,mode:m,authToken:t});}catch(e){alert((e&&e.message)||e);}}try{delete window.${runner};}catch(e){window.${runner}=undefined;}var s=document.createElement("script");s.src=src;s.onload=go;s.onerror=function(){alert("A hasznaltauto.hu blokkolta a Bymy scriptet.");};(document.documentElement||document.body).appendChild(s);})();`;
}

async function copyBookmarkletLink() {
  renderMode();
  await ensureBookmarkletToken();
  const bookmark = document.getElementById("ha-imp-bookmark");
  // Friss href a külön import tokennel
  if (bookmark) bookmark.setAttribute("href", bookmarkletHref(currentMode()));
  const href = bookmark?.getAttribute("href") || bookmarkletHref(currentMode());
  if (!href || href === "#") {
    setStatus("A könyvjelző link most nem elérhető.", "err");
    return;
  }
  if (!getBookmarkletToken() && !getAuthToken()) {
    setStatus("Nincs bejelentkezési token — frissítsd az oldalt, majd másold újra a könyvjelzőt.", "err");
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(href);
    } else {
      const ta = document.createElement("textarea");
      ta.value = href;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setStatus(
      "Könyvjelző a vágólapon. Böngésző: Új könyvjelző → a cím/URL mezőbe illeszd be (Cmd/Ctrl+V), mentés."
    );
  } catch {
    setStatus("Nem sikerült a másolás. Próbáld a sárga gomb húzását a könyvjelzősávra.", "err");
  }
}

function isApplePlatform() {
  const ua = String(navigator.userAgent || "");
  const platform = String(navigator.platform || "");
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua);
}

function kbd(label) {
  return `<span class="ha-imp-kbd">${label}</span>`;
}

function detectHaBrowser() {
  const ua = String(navigator.userAgent || "");
  if (/Edg\//i.test(ua) || /EdgiOS\//i.test(ua)) return "edge";
  if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) return "firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/Chromium\//i.test(ua) && !/Edg\//i.test(ua)) {
    return "safari";
  }
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua) || /Chromium\//i.test(ua)) return "chrome";
  return isApplePlatform() ? "safari" : "chrome";
}

function browserInstallGuide(browser) {
  const mac = isApplePlatform();
  const mod = mac ? "Cmd" : "Ctrl";
  let title = "Chrome";
  let steps = [];
  if (browser === "safari") {
    title = "Safari";
    steps = mac
      ? [
          `Legegyszerűbb: húzd a <strong>sárga</strong> gombot a Kedvencek sávra (lent)`,
          `Vagy: ${kbd("Cmd")} + ${kbd("D")} — mentsd az oldalt (bármilyen név)`,
          `${kbd("Option")} + ${kbd("Cmd")} + ${kbd("B")} — Kedvencek szerkesztése`,
          `URL szerkesztése → ${kbd("Cmd")} + ${kbd("V")} → Kész`,
        ]
      : [
          "Legegyszerűbb: húzd a sárga gombot a Kedvencek sávra (lent)",
          "Vagy: Kedvencek → Kedvencek szerkesztése",
          "Cím szerkesztése → beillesztés (Ctrl+V)",
          "Kész",
        ];
  } else if (browser === "firefox") {
    title = "Firefox";
    steps = [
      `${kbd(mod)} + ${kbd("Shift")} + ${kbd("B")} — könyvjelzősáv megjelenítése`,
      `${kbd(mod)} + ${kbd("D")} — új könyvjelző`,
      `A cím mezőbe ${kbd(mod)} + ${kbd("V")} (már a vágólapon van)`,
      "Mentés",
    ];
  } else {
    title = "Chrome / Edge";
    steps = [
      `${kbd(mod)} + ${kbd("Shift")} + ${kbd("B")} — könyvjelzősáv megjelenítése`,
      `${kbd(mod)} + ${kbd("D")} — új könyvjelző`,
      `A cím mezőbe ${kbd(mod)} + ${kbd("V")} (már a vágólapon van)`,
      "Mentés",
    ];
  }
  return { title, steps };
}

function renderBrowserInstall(browser) {
  const id = ["chrome", "edge", "firefox", "safari"].includes(browser) ? browser : "chrome";
  document.querySelectorAll("[data-ha-browser]").forEach((btn) => {
    const on = btn.getAttribute("data-ha-browser") === id;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const guide = browserInstallGuide(id);
  const titleEl = document.querySelector("[data-ha-install-title]");
  const stepsEl = document.querySelector("[data-ha-install-steps]");
  const hintEl = document.querySelector("[data-ha-install-hint]");
  const safariDrag = document.querySelector("[data-ha-safari-drag]");
  if (titleEl) titleEl.textContent = guide.title;
  if (stepsEl) {
    stepsEl.innerHTML = guide.steps.map((step) => `<li>${step}</li>`).join("");
  }
  if (hintEl) {
    hintEl.innerHTML =
      id === "safari"
        ? `<span class="ha-imp-hint-ico" aria-hidden="true">i</span> Safari: a Cmd+D nem fogadja a javascript: címet — húzd a sárga gombot, vagy szerkeszd a kedvenc URL-jét.`
        : `<span class="ha-imp-hint-ico" aria-hidden="true">i</span> Húzni nem kell — gomb + billentyűkombináció.`;
  }
  if (safariDrag) safariDrag.hidden = id !== "safari";
  try {
    sessionStorage.setItem("bymy-ha-install-browser", id);
  } catch {
  }
}

async function selectBrowserAndCopy(browser) {
  renderBrowserInstall(browser);
  await copyBookmarkletLink();
  const name = browserInstallGuide(browser).title;
  if (browser === "safari") {
    setStatus(
      "Safari: vágólapon a kód. Húzd a sárga gombot a Kedvencek sávra — vagy Option+Cmd+B → URL szerkesztése → Cmd+V."
    );
  } else {
    setStatus(`${name}: könyvjelző a vágólapon — kövesd a lépéseket alább.`);
  }
}

function initBrowserInstallUi() {
  if (!document.querySelector("[data-ha-install]")) return;
  let initial = detectHaBrowser();
  try {
    const saved = sessionStorage.getItem("bymy-ha-install-browser");
    if (saved && ["chrome", "edge", "firefox", "safari"].includes(saved)) initial = saved;
  } catch {
  }
  renderBrowserInstall(initial);
  document.querySelectorAll("[data-ha-browser]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void selectBrowserAndCopy(btn.getAttribute("data-ha-browser") || "chrome");
    });
  });
}

function renderMode() {
  const mode = currentMode();
  const cfg = MODES[mode];
  document.querySelectorAll("[data-ha-mode]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-ha-mode") === mode);
  });
  const title = document.querySelector("[data-ha-title]");
  const steps = document.querySelector("[data-ha-steps]");
  const footer = document.querySelector("[data-ha-footer]");
  const action = document.querySelector("[data-ha-action]");
  const openBtn = document.querySelector("[data-ha-open]");
  const openLabel = document.querySelector("[data-ha-open-label]");
  const bookmark = document.getElementById("ha-imp-bookmark");
  const bookmarkSafari = document.getElementById("ha-imp-bookmark-safari");
  if (title) title.textContent = cfg.title;
  if (steps) steps.textContent = cfg.steps;
  if (footer) footer.textContent = cfg.footer;
  if (action) action.textContent = cfg.action;
  if (openLabel) openLabel.textContent = cfg.openLabel;
  else if (openBtn) openBtn.textContent = cfg.openLabel;
  const href = bookmarkletHref(mode);
  const label = mode === "dealer" ? "Lista importálása" : "Hirdetés importálása";
  if (bookmark) {
    bookmark.href = href;
    bookmark.textContent = label;
  }
  if (bookmarkSafari) {
    bookmarkSafari.href = href;
    bookmarkSafari.textContent = label;
  }
  const urlHint = document.querySelector("[data-ha-url-label]");
  if (urlHint) {
    urlHint.textContent =
      mode === "dealer"
        ? "Vagy illeszd be a nyilvános hirdetés URL-eket (soronként, max. 50)"
        : "Vagy illeszd be a nyilvános hirdetés URL-jét";
  }
}

function setStatus(message, type = "") {
  const el = document.getElementById("ha-imp-status");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
  el.dataset.type = type;
}

function renderResult(result, { partial = false, index = 0, total = 0 } = {}) {
  const box = document.getElementById("ha-imp-result");
  if (!box) return;
  const saved = result?.savedCount ?? 0;
  const skipped = result?.skippedCount ?? 0;
  const errors = result?.errorCount ?? 0;
  const items = result?.items ?? [];
  const updated = items.filter((item) => item?.updated).length;
  const created = Math.max(0, saved - updated);
  const otherOwner = items.filter(
    (item) => item?.skipped && /más Bymy fiók/i.test(String(item.message || ""))
  ).length;
  let summary = "";
  if (partial && total > 0) {
    summary = `Folyamatban: ${index} / ${total}. eddig ${saved} mentve`;
    if (errors > 0) summary += `, ${errors} hiba`;
    summary += "…";
  } else if (saved === 0 && errors === 0 && skipped === 0) {
    summary = "Nem került be új / frissített hirdetés.";
  } else if (saved === 0 && otherOwner > 0 && errors === 0) {
    summary = `${otherOwner} hirdetés már más Bymy fiókhoz tartozik — mentés kihagyva.`;
  } else {
    const parts = [];
    if (created > 0) parts.push(`${created} új`);
    if (updated > 0) parts.push(`${updated} frissítve`);
    summary = parts.length ? `${parts.join(", ")}.` : `${saved} hirdetés mentve.`;
    if (total > 1) summary = `${total}-ből ${summary}`;
    if (errors > 0) summary += ` ${errors} hiba.`;
  }
  if (skipped > 0 && otherOwner !== skipped) {
    summary += ` ${skipped} kihagyva.`;
  } else if (skipped > 0 && saved > 0 && otherOwner > 0) {
    summary += ` ${otherOwner} más fióké (kihagyva).`;
  }
  box.hidden = false;
  box.innerHTML = `<p>${summary}</p>`;
  if (items.length) {
    const list = document.createElement("ul");
    list.className = "ha-imp-items";
    for (const item of items.slice(-12)) {
      const li = document.createElement("li");
      const label = item.cim || item.url || "—";
      const price = item.ar ? ` · ${item.ar} Ft` : "";
      let note = "";
      if (item.skipped) {
        note = item.message
          ? ` (${item.message})`
          : " (már bent volt / kihagyva)";
      } else if (item.updated) {
        note = " (frissítve)";
      }
      li.textContent = `${label}${price}${note}`;
      list.appendChild(li);
    }
    box.appendChild(list);
  }
  if (result?.errors?.length) {
    const err = document.createElement("p");
    err.className = "ha-imp-errors";
    err.textContent = result.errors
      .slice(-4)
      .map((entry) => entry.message)
      .join(" ");
    box.appendChild(err);
  }
}

async function postExtracted(payload, timeoutMs = 25000) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const wait = Math.max(10000, Number(timeoutMs) || 25000);
  const timer = controller ? setTimeout(() => controller.abort(), wait) : null;
  let response;
  try {
    response = await fetch("/api/import/extracted", {
      method: "POST",
      headers: authHeaders(),
      credentials: "same-origin",
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
  } catch (error) {
    if (timer) clearTimeout(timer);
    const err = new Error(
      error?.name === "AbortError"
        ? `Mentés időtúllépés (${Math.round(wait / 1000)}s) — ugrok a következő csomagra.`
        : error.message || "Hálózati hiba."
    );
    err.status = 504;
    throw err;
  }
  if (timer) clearTimeout(timer);
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const detail =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      (data.error && typeof data.error.message === "string" && data.error.message) ||
      "";
    const err = new Error(
      response.status === 401
        ? detail || "Az importhoz be kell jelentkezned a Bymy fiókodba."
        : response.status === 413
          ? "Túl nagy az import csomag. Próbáld kisebb listával."
          : response.status === 504 || response.status === 502
            ? detail || "Időtúllépés (504) — újrapróbáljuk kisebb csomaggal."
            : detail || `Import sikertelen (${response.status}).`
    );
    err.status = response.status;
    throw err;
  }
  return data.result;
}

async function postExtractedResilient(pages, meta = {}) {
  const list = Array.isArray(pages) ? pages : [];
  if (!list.length) return { savedCount: 0, skippedCount: 0, errorCount: 0, items: [], errors: [] };
  const photoOnly =
    meta.photoOnly === true ||
    meta.mode === "dealer" ||
    list.every((p) => p?.photoOnly);
  const timeoutMs = meta.timeoutMs;
  try {
    return await postExtracted(
      {
        pages: list,
        listUrl: meta.listUrl,
        mode: meta.mode,
        photoOnly,
      },
      timeoutMs
    );
  } catch (error) {
    if (list.length === 1 || ![502, 504, 413].includes(Number(error.status))) throw error;
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const items = [];
    const errors = [];
    for (const page of list) {
      try {
        const result = await postExtracted(
          {
            pages: [page],
            listUrl: meta.listUrl,
            mode: meta.mode,
            photoOnly,
          },
          timeoutMs
        );
        savedCount += result?.savedCount ?? 0;
        skippedCount += result?.skippedCount ?? 0;
        errorCount += result?.errorCount ?? 0;
        if (Array.isArray(result?.items)) items.push(...result.items);
        if (Array.isArray(result?.errors)) errors.push(...result.errors);
      } catch (inner) {
        errorCount += 1;
        errors.push({ url: page?.url || "", message: inner.message ?? "Import sikertelen." });
      }
    }
    return { savedCount, skippedCount, errorCount, items, errors, count: items.length };
  }
}

function isHaUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase().includes("hasznaltauto.hu");
  } catch {
    return false;
  }
}

function isPublicListingUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host === "hasznaltauto.hu" && /\/[^/?#]+\/.+-\d{5,}\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function promptHaBookmark(url) {
  if (url) window.open(url, "bymy-ha-site");
  setStatus(
    currentMode() === "dealer"
      ? "Az admin / járműlista oldalt a szerver nem látja. A megnyílt hasznaltauto fülön kattints a „Lista importálása” könyvjelzőre."
      : "A megnyitott hirdetést a szerver nem látja. A hasznaltauto fülön kattints a „Hirdetés importálása” könyvjelzőre.",
    "err"
  );
}

async function runUrlImport() {
  const input = document.getElementById("ha-imp-url");
  const raw = String(input?.value ?? "").trim();
  if (!raw) {
    setStatus("Illeszd be a hasznaltauto.hu hirdetés URL-jét.", "err");
    return;
  }
  const urls = raw
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const bad = urls.find((item) => !isHaUrl(item));
  if (bad) {
    setStatus("Csak hasznaltauto.hu linket lehet importálni.", "err");
    return;
  }
  promptHaBookmark(urls[0]);
}

let importBusy = false;
const pendingHaImports = [];
let haImportReady = false;
const seenHaImportKeys = new Set();
/** Kereskedői sorozat: több egyautós postMessage → egy összesített progress */
let dealerBatchState = null;

function haImportKey(data) {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const ids = pages
    .map((page) => String(page?.listingId || page?.id || page?.url || "").trim())
    .filter(Boolean)
    .slice(0, 40)
    .join(",");
  return `${data?.importId || ""}|${data?.listUrl || ""}|${pages.length}|${ids}`;
}

function acceptHaImportMessage(event) {
  const data = event.data;
  if (!data || data.type !== "bymy-ha-import") return null;
  const origin = String(event.origin || "");
  if (origin !== location.origin && !HA_POSTMESSAGE_ORIGINS.has(origin)) return null;
  return data;
}

function ackHaImport(eventOrSource, data, targetOrigin = "*", result = null) {
  const source = eventOrSource?.source ?? eventOrSource;
  const origin =
    typeof targetOrigin === "string" && targetOrigin
      ? targetOrigin
      : eventOrSource?.origin || "*";
  const savedCount = result ? Number(result.savedCount || 0) : null;
  const skippedCount = result ? Number(result.skippedCount || 0) : null;
  const errorCount = result ? Number(result.errorCount || 0) : null;
  const ok = result == null ? true : savedCount > 0 || skippedCount > 0;
  try {
    source?.postMessage(
      {
        type: "bymy-ha-import-ack",
        importId: data?.importId || null,
        pages: Array.isArray(data?.pages) ? data.pages.length : 0,
        index: data?.index || null,
        total: data?.total || null,
        ok,
        savedCount,
        skippedCount,
        errorCount,
        error: result?.errors?.[0]?.message || null,
      },
      origin
    );
  } catch {
  }
}

function enqueueHaImport(data) {
  const key = haImportKey(data);
  if (seenHaImportKeys.has(key)) return false;
  if (pendingHaImports.some((item) => haImportKey(item) === key)) return false;
  pendingHaImports.push(data);
  return true;
}

function ensureDealerBatch(data) {
  const batchId = String(data?.batchId || "").trim();
  const total = Math.max(1, Number(data?.total) || 1);
  if (!batchId) return null;
  if (!dealerBatchState || dealerBatchState.batchId !== batchId) {
    dealerBatchState = {
      batchId,
      total,
      savedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      items: [],
      errors: [],
    };
  }
  dealerBatchState.total = Math.max(dealerBatchState.total, total);
  return dealerBatchState;
}

window.addEventListener("message", (event) => {
  const data = acceptHaImportMessage(event);
  if (!data) return;
  const deferAck = data.photoOnly === true || data.mode === "dealer";
  // Kereskedői: ack csak mentés után — így a bookmarklet nem küldi egyszerre az összes nagy képet
  if (!deferAck) ackHaImport(event, data, event.origin);
  else {
    data.__ackSource = event.source;
    data.__ackOrigin = event.origin;
  }

  const index = Math.max(1, Number(data.index) || 1);
  const total = Math.max(1, Number(data.total) || (Array.isArray(data.pages) ? data.pages.length : 1) || 1);
  setStatus(
    total > 1 || deferAck
      ? `Érkezett: ${index} / ${total} — mentés indul…`
      : Array.isArray(data.pages) && data.pages.length
        ? `Érkezett: ${data.pages.length} tétel a hasznaltauto.hu-ról…`
        : "Érkezett üzenet a hasznaltauto.hu-ról…"
  );

  const key = haImportKey(data);
  // Kereskedői: ne ack-eljük a retry üzeneteket mentés nélkül (hamis siker)
  if (seenHaImportKeys.has(key) || (importBusy && key === currentHaImportKey)) {
    if (!deferAck) ackHaImport(event, data, event.origin);
    return;
  }
  try {
    const light = {
      ...data,
      __ackSource: undefined,
      pages: (Array.isArray(data.pages) ? data.pages : []).map((page) => ({
        ...page,
        imageJpegBase64: "",
      })),
    };
    sessionStorage.setItem("bymy-ha-import-pending", JSON.stringify(light));
  } catch {
  }
  if (!haImportReady) {
    enqueueHaImport(data);
    return;
  }
  runMessageImport(data);
});

let currentHaImportKey = "";

async function runMessageImport(data) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  if (!pages.length) {
    setStatus("Üres import — nyisd meg a hirdetést, majd próbáld újra.", "err");
    if (data.__ackSource) ackHaImport(data.__ackSource, data, data.__ackOrigin);
    return;
  }
  const key = haImportKey(data);
  if (seenHaImportKeys.has(key)) {
    if (data.__ackSource) ackHaImport(data.__ackSource, data, data.__ackOrigin);
    return;
  }
  if (importBusy) {
    enqueueHaImport(data);
    return;
  }
  importBusy = true;
  currentHaImportKey = key;
  seenHaImportKeys.add(key);
  if (seenHaImportKeys.size > 80) {
    const first = seenHaImportKeys.values().next().value;
    seenHaImportKeys.delete(first);
  }

  const index = Math.max(1, Number(data.index) || 1);
  const total = Math.max(1, Number(data.total) || pages.length);
  const batch = ensureDealerBatch(data);
  const SAVE_BATCH = data.mode === "dealer" || data.photoOnly === true ? 3 : 1;
  const abortMs = SAVE_BATCH > 1 ? 90000 : 45000;
  setStatus(`Mentés: ${index} / ${total}…`);

  let savedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const items = [];
  const errors = [];

  try {
    for (let offset = 0; offset < pages.length; offset += SAVE_BATCH) {
      const chunk = pages.slice(offset, offset + SAVE_BATCH);
      setStatus(`Mentés: ${index} / ${total}…`);
      try {
        const result = await postExtractedResilient(chunk, {
          listUrl: data.listUrl,
          mode: data.mode || currentMode(),
          photoOnly: data.photoOnly === true || data.mode === "dealer",
          timeoutMs: abortMs,
        });
        savedCount += result?.savedCount ?? 0;
        skippedCount += result?.skippedCount ?? 0;
        errorCount += result?.errorCount ?? 0;
        if (Array.isArray(result?.items)) items.push(...result.items);
        if (Array.isArray(result?.errors)) errors.push(...result.errors);
      } catch (error) {
        errorCount += chunk.length;
        errors.push({
          url: chunk[0]?.url || "",
          message: error.message ?? "Import sikertelen.",
        });
      }
    }

    if (batch) {
      batch.savedCount += savedCount;
      batch.skippedCount += skippedCount;
      batch.errorCount += errorCount;
      batch.items.push(...items);
      batch.errors.push(...errors);
      const done = index >= batch.total;
      if (done) {
        setStatus(
          batch.savedCount > 0
            ? `Kész: ${batch.savedCount} mentve` +
              (batch.skippedCount ? `, ${batch.skippedCount} kihagyva` : "") +
              (batch.errorCount ? `, ${batch.errorCount} hiba` : "")
            : batch.skippedCount
              ? `Kész: 0 mentve, ${batch.skippedCount} kihagyva (más fiók)`
              : `Mentés sikertelen${batch.errors[0]?.message ? ` — ${batch.errors[0].message}` : ""}`
        );
        renderResult(batch);
        dealerBatchState = null;
      } else {
        setStatus(`Mentés: ${index} / ${batch.total} kész — várom a következőt…`);
        renderResult(batch, { partial: true, index, total: batch.total });
      }
    } else {
      setStatus("");
      renderResult({
        savedCount,
        skippedCount,
        errorCount,
        count: items.length,
        items,
        errors,
      });
    }
    try {
      sessionStorage.removeItem("bymy-ha-import-pending");
    } catch {
    }
  } catch (error) {
    setStatus(error.message ?? "Import sikertelen.", "err");
    errors.push({ url: "", message: error.message ?? "Import sikertelen." });
    errorCount += 1;
  } finally {
    // Előbb szabadítsuk a busy flaget, aztán ack — ne ragadjon a következő autó
    importBusy = false;
    currentHaImportKey = "";
    while (pendingHaImports.length && seenHaImportKeys.has(haImportKey(pendingHaImports[0]))) {
      pendingHaImports.shift();
    }
    const next = pendingHaImports.length ? pendingHaImports.shift() : null;
    if (data.__ackSource) {
      ackHaImport(data.__ackSource, data, data.__ackOrigin, {
        savedCount,
        skippedCount,
        errorCount,
        errors,
      });
    }
    if (next) queueMicrotask(() => runMessageImport(next));
  }
}

function bindAccountNav() {
  document.querySelectorAll("[data-mm-subtoggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".mm-nav-group");
      const sub = group?.querySelector("[data-mm-sub]");
      if (!sub) return;
      const open = sub.hidden;
      document.querySelectorAll("[data-mm-sub]").forEach((el) => {
        el.hidden = true;
      });
      document.querySelectorAll("[data-mm-subtoggle]").forEach((el) => {
        el.setAttribute("aria-expanded", "false");
      });
      if (open) {
        sub.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
  document.querySelectorAll("[data-post-ad-category]").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        const raw = link.getAttribute("data-post-ad-category") || "";
        const parsed = JSON.parse(raw);
        if (!parsed.v) parsed.v = CAT_STORAGE_VERSION;
        sessionStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
      }
    });
  });
}

export async function initHaImportPage() {
  const ok = await requireAuthForPage();
  if (!ok) return;
  await ensureBookmarkletToken();
  try {
    // Könyvjelző ezzel a névvel találja meg / fókuszálja ezt a lapot (ne új tab)
    window.name = "bymy-ha-import";
  } catch {
  }
  const user = getAuthUser();
  const hello = document.querySelector("[data-mm-hello]");
  if (hello) hello.textContent = getDisplayName() || user?.email?.split("@")[0] || "—";

  if (document.body.classList.contains("ha-import-page")) {
    bindAccountNav();
  }
  renderMode();
  initBrowserInstallUi();

  document.querySelectorAll("[data-ha-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.getAttribute("data-ha-mode")));
  });

  document.querySelector("[data-ha-open]")?.addEventListener("click", () => {
    window.open(MODES[currentMode()].startURL, "bymy-ha-site");
  });

  document.getElementById("ha-imp-bookmark")?.addEventListener("click", (event) => {
    event.preventDefault();
    // Friss token a könyvjelzőbe, majd másolás — kattintás a Bymy lapon nem futtat HA-n
    renderMode();
    void copyBookmarkletLink().then(() => {
      setStatus(
        currentMode() === "dealer"
          ? "Friss könyvjelző a vágólapon. Az admin Járműlista fülön futtasd — az Autóimport lap maradjon nyitva."
          : "Friss könyvjelző a vágólapon. A hasznaltauto fülön futtasd."
      );
    });
  });

  document.getElementById("ha-imp-bookmark-copy")?.addEventListener("click", () => {
    void copyBookmarkletLink();
  });

  document.getElementById("ha-imp-start")?.addEventListener("click", runUrlImport);
  document.getElementById("ha-imp-url")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runUrlImport();
    }
  });

  haImportReady = true;
  try {
    const raw = sessionStorage.getItem("bymy-ha-import-pending");
    if (raw) {
      sessionStorage.removeItem("bymy-ha-import-pending");
      pendingHaImports.push(JSON.parse(raw));
    }
  } catch {
  }
  if (pendingHaImports.length) {
    const queued = pendingHaImports.splice(0);
    for (const data of queued) {
      await runMessageImport(data);
    }
  } else if (new URLSearchParams(location.search).has("ha")) {
    // Régi hibás flow nyitott üres várakozó tabot — ne ragadjunk „Várom…”-on
    const url = new URL(location.href);
    url.searchParams.delete("ha");
    history.replaceState({}, "", url);
    setStatus(
      "Használd az „admin megnyitása” gombot ezen a lapon, majd a listán a könyvjelzőt. Új Autóimport tabot már nem nyitunk."
    );
  }
}

initSiteAuth({ skipRefresh: true });
initHaImportPage();
