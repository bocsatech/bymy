import {
  getAuthUser,
  getDisplayName,
  requireAuthForPage,
  initSiteAuth,
} from "./site-auth.js?v=haImp1";

const TOKEN_KEY = "bymy-auth-token";
const CAT_STORAGE_KEY = "bymy-hirdetes-category";
const CAT_STORAGE_VERSION = 2;
const MODES = {
  standard: {
    title: "Használtautó import",
    startURL: "https://www.hasznaltauto.hu/",
    steps: "1. Jelentkezz be  ·  2. Nyisd meg EGY autó gyorsnézetét  ·  3. Importálás",
    action: "Hirdetés importálása",
    footer: "A jelszavadat nem tároljuk — csak a megnyitott oldal adatait olvassuk ki.",
    openLabel: "hasznaltauto.hu megnyitása",
  },
  dealer: {
    title: "Kereskedői import",
    startURL: "https://admin.hasznaltauto.hu/",
    steps: "1. Bejelentkezés (admin)  ·  2. Hirdetéseim / járműlista  ·  3. Lista importálása",
    action: "Lista importálása (összes autó)",
    footer: "A listából automatikusan végigmegyünk a hirdetéseken (max. 50 / kör). Lapozás után futtasd újra.",
    openLabel: "admin.hasznaltauto.hu megnyitása",
  },
};

function authHeaders() {
  let token = "";
  try {
    token = localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    token = "";
  }
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  const src = `${origin}/js/ha-import-bookmarklet.js?v=haImp2`;
  return `javascript:(function(){var o=${JSON.stringify(origin)};var m=${JSON.stringify(mode)};function go(){window.BymyHaImport.run({origin:o,mode:m});}if(window.BymyHaImport){go();return;}var s=document.createElement('script');s.src=${JSON.stringify(src)};s.onload=go;s.onerror=function(){alert('A hasznaltauto.hu blokkolta a Bymy scriptet. Másold a hirdetés URL-jét a Bymy Autóimport oldalra.');};document.documentElement.appendChild(s);})();`;
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
  let summary = `${saved} hirdetés importálva.`;
  if (skipped > 0) summary += ` ${skipped} már bent volt.`;
  if (errors > 0) summary += ` ${errors} hiba.`;
  if (currentMode() === "dealer" && (result?.count ?? 0) >= 50) {
    summary += " Ha a listán több autó volt, lapozz, majd importáld újra a többit.";
  }
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
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Import sikertelen.");
  return data.result;
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
    return host === "hasznaltauto.hu" && /\/szemelyauto\/.+-\d{5,}$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function promptHaBookmark(url) {
  if (url) window.open(url, "bymy-ha-site");
  setStatus(
    currentMode() === "dealer"
      ? "Az admin / járműlista oldalt a szerver nem látja. A megnyílt hasznaltauto fülön kattints a „Lista importálása” könyvjelzőre."
      : "A gyorsnézetet a szerver nem látja. A megnyílt hasznaltauto fülön kattints a „Hirdetés importálása” könyvjelzőre.",
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
  const needsBrowser = urls.find((item) => isHaUrl(item) && !isPublicListingUrl(item));
  if (needsBrowser) {
    promptHaBookmark(needsBrowser);
    return;
  }
  setStatus("Hirdetés beolvasása…");
  try {
    const result = await postExtracted({
      urls,
      mode: currentMode(),
      listUrl: urls[0],
    });
    setStatus("");
    renderResult(result);
  } catch (error) {
    const message = error.message ?? "Import sikertelen.";
    if (/Cloudflare|gyorsnézet|járműlist|admin/i.test(message) && urls[0]) {
      promptHaBookmark(urls[0]);
      return;
    }
    setStatus(message, "err");
  }
}

async function runMessageImport(data) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  if (!pages.length) {
    setStatus("Üres import — nyisd meg a hirdetést, majd próbáld újra.", "err");
    return;
  }
  setStatus(pages.length > 1 ? `Mentés (${pages.length} hirdetés)…` : "Hirdetés feldolgozása…");
  try {
    const result = await postExtracted({
      pages,
      listUrl: data.listUrl,
      mode: data.mode || currentMode(),
    });
    setStatus("");
    renderResult(result);
  } catch (error) {
    setStatus(error.message ?? "Import sikertelen.", "err");
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
        /* ignore */
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

  bindAccountNav();
  renderMode();

  document.querySelectorAll("[data-ha-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.getAttribute("data-ha-mode")));
  });

  document.querySelector("[data-ha-open]")?.addEventListener("click", () => {
    window.open(MODES[currentMode()].startURL, "bymy-ha-site");
  });

  document.getElementById("ha-imp-bookmark")?.addEventListener("click", (event) => {
    event.preventDefault();
    setStatus("Húzd a narancssárga gombot a könyvjelzősávra, majd a hasznaltauto oldalon kattints rá.");
  });

  document.getElementById("ha-imp-start")?.addEventListener("click", runUrlImport);
  document.getElementById("ha-imp-url")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runUrlImport();
    }
  });

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "bymy-ha-import") return;
    const origin = String(event.origin || "");
    if (!origin.includes("hasznaltauto.hu") && origin !== location.origin) return;
    runMessageImport(data);
  });

  if (new URLSearchParams(location.search).has("ha")) {
    setStatus("Várom a hasznaltauto.hu oldal adatait…");
  }
}

initSiteAuth({ skipRefresh: true });
initHaImportPage();
