import {
  getAuthUser,
  getDisplayName,
  requireAuthForPage,
  initSiteAuth,
} from "./site-auth.js?v=settingsFix1";

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
    steps: "1. Bejelentkezés (admin)  ·  2. Járműlista  ·  3. Lista importálása (Módosítás oldalak)",
    action: "Lista importálása (összes autó)",
    footer: "Minden listás autót megnyitunk Módosításként, kimásoljuk az adatokat, majd mentjük (max. 50 / kör).",
    openLabel: "admin.hasznaltauto.hu megnyitása",
  },
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
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
  const src = `${origin}/js/ha-import-bookmarklet.js?v=haImp29`;
  return `javascript:void(function(){var o=${JSON.stringify(origin)};var m=${JSON.stringify(mode)};var src=${JSON.stringify(src)}+"&t="+Date.now();function go(){try{window.BymyHaImport.run({origin:o,mode:m});}catch(e){alert((e&&e.message)||e);}}try{delete window.BymyHaImport;}catch(e){window.BymyHaImport=undefined;}var s=document.createElement("script");s.src=src;s.onload=go;s.onerror=function(){alert("A hasznaltauto.hu blokkolta a Bymy scriptet. Másold a hirdetés URL-jét a Bymy Autóimport oldalra.");};(document.documentElement||document.body).appendChild(s);})();`;
}

async function copyBookmarkletLink() {
  const bookmark = document.getElementById("ha-imp-bookmark");
  const href = bookmark?.getAttribute("href") || bookmarkletHref(currentMode());
  if (!href || href === "#") {
    setStatus("A könyvjelző link most nem elérhető.", "err");
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
  const bookmark = document.getElementById("ha-imp-bookmark");
  if (title) title.textContent = cfg.title;
  if (steps) steps.textContent = cfg.steps;
  if (footer) footer.textContent = cfg.footer;
  if (action) action.textContent = cfg.action;
  if (openBtn) openBtn.textContent = cfg.openLabel;
  if (bookmark) {
    bookmark.href = bookmarkletHref(mode);
    bookmark.textContent = mode === "dealer" ? "Lista importálása" : "Hirdetés importálása";
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

function renderResult(result) {
  const box = document.getElementById("ha-imp-result");
  if (!box) return;
  const saved = result?.savedCount ?? 0;
  const skipped = result?.skippedCount ?? 0;
  const errors = result?.errorCount ?? 0;
  const updated = (result?.items || []).filter((item) => item?.updated).length;
  const created = Math.max(0, saved - updated);
  let summary = "";
  if (saved === 0 && errors === 0) {
    summary = "Nem került be új / frissített hirdetés.";
  } else {
    const parts = [];
    if (created > 0) parts.push(`${created} új`);
    if (updated > 0) parts.push(`${updated} frissítve`);
    summary = parts.length ? `${parts.join(", ")}.` : `${saved} hirdetés mentve.`;
    if (errors > 0) summary += ` ${errors} hiba.`;
  }
  if (skipped > 0) summary += ` ${skipped} kihagyva.`;
  box.hidden = false;
  box.innerHTML = `<p>${summary}</p>`;
  const items = result?.items ?? [];
  if (items.length) {
    const list = document.createElement("ul");
    list.className = "ha-imp-items";
    for (const item of items.slice(0, 12)) {
      const li = document.createElement("li");
      li.textContent = `${item.cim || "—"} · ${item.ar || "—"} Ft${item.skipped ? " (már bent volt)" : ""}`;
      list.appendChild(li);
    }
    box.appendChild(list);
  }
  if (result?.errors?.length) {
    const err = document.createElement("p");
    err.className = "ha-imp-errors";
    err.textContent = result.errors
      .slice(0, 4)
      .map((entry) => entry.message)
      .join(" ");
    box.appendChild(err);
  }
}

async function postExtracted(payload) {
  const response = await fetch("/api/import/extracted", {
    method: "POST",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
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
  try {
    return await postExtracted({
      pages: list,
      listUrl: meta.listUrl,
      mode: meta.mode,
    });
  } catch (error) {
    if (list.length === 1 || ![502, 504, 413].includes(Number(error.status))) throw error;
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const items = [];
    const errors = [];
    for (const page of list) {
      try {
        const result = await postExtracted({
          pages: [page],
          listUrl: meta.listUrl,
          mode: meta.mode,
        });
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
  if (!origin.includes("hasznaltauto.hu") && origin !== location.origin) return null;
  return data;
}

function ackHaImport(event, data) {
  try {
    event.source?.postMessage(
      { type: "bymy-ha-import-ack", importId: data?.importId || null, pages: Array.isArray(data?.pages) ? data.pages.length : 0 },
      event.origin || "*"
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

window.addEventListener("message", (event) => {
  const data = acceptHaImportMessage(event);
  if (!data) return;
  ackHaImport(event, data);
  const key = haImportKey(data);
  if (seenHaImportKeys.has(key) || (importBusy && key === currentHaImportKey)) {
    return;
  }
  try {
    sessionStorage.setItem("bymy-ha-import-pending", JSON.stringify(data));
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
    return;
  }
  const key = haImportKey(data);
  if (seenHaImportKeys.has(key)) return;
  if (importBusy) {
    enqueueHaImport(data);
    return;
  }
  importBusy = true;
  currentHaImportKey = key;
  seenHaImportKeys.add(key);
  if (seenHaImportKeys.size > 40) {
    const first = seenHaImportKeys.values().next().value;
    seenHaImportKeys.delete(first);
  }
  const total = pages.length;
  const SAVE_BATCH = 1;
  setStatus(total > 1 ? `Mentés: 0 / ${total}…` : "Hirdetés feldolgozása…");
  try {
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const items = [];
    const errors = [];
    for (let offset = 0; offset < pages.length; offset += SAVE_BATCH) {
      const chunk = pages.slice(offset, offset + SAVE_BATCH);
      setStatus(`Mentés: ${Math.min(offset + chunk.length, total)} / ${total}…`);
      try {
        const result = await postExtractedResilient(chunk, {
          listUrl: data.listUrl,
          mode: data.mode || currentMode(),
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
    setStatus("");
    renderResult({
      savedCount,
      skippedCount,
      errorCount,
      count: items.length,
      items,
      errors,
    });
    try {
      sessionStorage.removeItem("bymy-ha-import-pending");
    } catch {
    }
  } catch (error) {
    setStatus(error.message ?? "Import sikertelen.", "err");
  } finally {
    importBusy = false;
    currentHaImportKey = "";
    while (pendingHaImports.length && seenHaImportKeys.has(haImportKey(pendingHaImports[0]))) {
      pendingHaImports.shift();
    }
    if (pendingHaImports.length) {
      const next = pendingHaImports.shift();
      queueMicrotask(() => runMessageImport(next));
    }
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
  const user = getAuthUser();
  const hello = document.querySelector("[data-mm-hello]");
  if (hello) hello.textContent = getDisplayName() || user?.email?.split("@")[0] || "—";

  if (document.body.classList.contains("ha-import-page")) {
    bindAccountNav();
  }
  renderMode();

  document.querySelectorAll("[data-ha-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.getAttribute("data-ha-mode")));
  });

  document.querySelector("[data-ha-open]")?.addEventListener("click", () => {
    window.open(MODES[currentMode()].startURL, "bymy-ha-site");
  });

  document.getElementById("ha-imp-bookmark")?.addEventListener("click", (event) => {
    event.preventDefault();
    setStatus(
      "Húzd a sárga gombot a könyvjelzősávra, vagy kattints a „Könyvjelző másolása” gombra."
    );
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
    setStatus("Várom a hasznaltauto.hu oldal adatait…");
  }
}

initSiteAuth({ skipRefresh: true });
initHaImportPage();
