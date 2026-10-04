/**
 * Kereskedői Autóimport — CDN thumb → HQ URL → Bymy mentés.
 * Preferált út: postMessage a Bymy Autóimport fülre (same-origin mentés).
 * Fallback: közvetlen POST /api/import/extracted (CORS) — ha van token.
 */
(function (root) {
  const MAX = 200;

  function clean(t) {
    return String(t || "").replace(/\s+/g, " ").trim();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function showProgress(current, total, phase) {
    let el = document.getElementById("bymy-ha-progress");
    if (!el) {
      el = document.createElement("div");
      el.id = "bymy-ha-progress";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#111;color:#fff;" +
        "padding:12px 16px;border-radius:10px;font:600 14px/1.45 system-ui,sans-serif;" +
        "box-shadow:0 8px 28px rgba(0,0,0,.4);max-width:min(340px,92vw);";
      (document.body || document.documentElement).appendChild(el);
    }
    const cur = Math.max(0, Number(current) || 0);
    const tot = Math.max(1, Number(total) || 1);
    const pct = Math.min(100, Math.round((cur / tot) * 100));
    el.textContent = `Bymy import — ${phase || "folyamat"}: ${cur} / ${tot} (${pct}%)`;
  }

  function hideProgress(msg) {
    const el = document.getElementById("bymy-ha-progress");
    if (!el) return;
    if (msg) {
      el.textContent = `Bymy import — ${msg}`;
      setTimeout(() => {
        try {
          el.remove();
        } catch {
        }
      }, 8000);
      return;
    }
    try {
      el.remove();
    } catch {
    }
  }

  /** Szinkron: lib/ha-title-parse.mjs */
  const MULTI_BRANDS = [
    "MERCEDES-BENZ",
    "MERCEDES BENZ",
    "LAND ROVER",
    "ALFA ROMEO",
    "ASTON MARTIN",
    "ROLLS-ROYCE",
    "ROLLS ROYCE",
    "RANGE ROVER",
  ];

  function parseVehicleTitleFields(title) {
    const vehicleTitle = clean(String(title || "").split(/\n+/)[0]);
    if (!vehicleTitle || vehicleTitle.length < 4) {
      return { gyartmany: "", modell: "", tipus: "", visibleTitle: "" };
    }
    const upper = vehicleTitle.toLocaleUpperCase("hu-HU");
    let gyartmany = "";
    let rest = vehicleTitle;
    for (const name of MULTI_BRANDS) {
      if (upper.startsWith(name)) {
        gyartmany = vehicleTitle.slice(0, name.length).trim();
        rest = vehicleTitle.slice(name.length).trim();
        break;
      }
    }
    const tokens = rest.split(/\s+/).filter(Boolean);
    if (!gyartmany && tokens.length) {
      gyartmany = tokens.shift();
      rest = tokens.join(" ");
    }
    const parts = rest.split(/\s+/).filter(Boolean);
    const modell = parts[0] || "";
    const tipus = parts.slice(1).join(" ");
    gyartmany = normalizeGyartmany(gyartmany);
    return { gyartmany, modell, tipus, visibleTitle: vehicleTitle };
  }

  function normalizeGyartmany(brand) {
    const v = clean(brand);
    if (!v) return "";
    const upper = v.toLocaleUpperCase("hu-HU").replace(/\s+/g, " ");
    if (/^MERCEDES[\s-]?BENZ$/i.test(upper) || upper === "MERCEDES") return "MERCEDES-BENZ";
    if (upper === "VW") return "VOLKSWAGEN";
    return upper;
  }

  /** Szinkron: lib/ha-description-parse.mjs */
  const LEIRAS_SECTION_END =
    /(?:^|\n)\s*(?:Felszereltség|Általános|Műszaki|Megtalálható|Okmányok|Hirdetés|Beltér|Kültér|Egyéb információ|Autó jellemzői|Jármű adatok|Motor adatok|Ár,?\s*költségek|Abroncs)\b/i;

  function normalizeImportedLeiras(raw) {
    let desc = clean(String(raw || "").replace(/<[^>]+>/g, " ")).slice(0, 2000);
    desc = desc.replace(/^le[ií]r[aá]s\s*[:.\-]?\s*/i, "").trim();
    if (!desc || desc.length < 20) return "";
    if (/^le[ií]r[aá]s\b/i.test(desc) && desc.length < 90) return "";
    if (/^leírás$/i.test(desc)) return "";
    if (/megtekinthet[oő]\s+telefonon/i.test(desc) && desc.length < 160) return "";
    return desc;
  }

  function extractLeirasSectionText(text) {
    const body = String(text || "").replace(/\r\n/g, "\n");
    const m = body.match(
      new RegExp(
        `(?:^|\\n)\\s*Leírás\\s*[:.]?\\s*(?:\\n+|(?=[A-Za-zÁÉÍÓÖŐÚÜŰ0-9]))([\\s\\S]{8,12000}?)(?=${LEIRAS_SECTION_END.source}|$)`,
        "i"
      )
    );
    return m ? normalizeImportedLeiras(m[1]) : "";
  }

  function pickDescriptionHeadingBlocks(doc) {
    const d = doc || document;
    for (const el of d.querySelectorAll("h1,h2,h3,h4,h5,h6,label,legend,strong,th,dt")) {
      if (!/^leírás\s*[:.]?\s*$/i.test(clean(el.textContent || ""))) continue;
      let node = el.nextElementSibling;
      while (node && !node.matches("h1,h2,h3,h4,h5,h6,section,table")) {
        const t = normalizeImportedLeiras(node.value || node.innerText || node.textContent || "");
        if (t) return t;
        node = node.nextElementSibling;
      }
      const block = el.closest("section, .card, .field-stack, .labeled-field, tr, div");
      if (block) {
        const t = normalizeImportedLeiras(block.innerText || block.textContent || "");
        if (t) return t;
      }
    }
    return "";
  }

  function pickDescriptionFromDocument(doc) {
    const d = doc || document;
    for (const sel of [
      "textarea#leiras",
      "textarea[name*='leiras' i]",
      "textarea[id*='leiras' i]",
      "#leiras[contenteditable='true']",
      "[contenteditable='true'][id*='leiras' i]",
      ".cke_editable",
    ]) {
      for (const el of d.querySelectorAll(sel)) {
        const t = normalizeImportedLeiras(el.value || el.innerText || el.textContent || "");
        if (t) return t;
      }
    }
    const fromHeading = pickDescriptionHeadingBlocks(d);
    if (fromHeading) return fromHeading;
    for (const sel of ['[class*="leiras"]', '[id*="leiras"]']) {
      for (const el of d.querySelectorAll(sel)) {
        const t = normalizeImportedLeiras(el.value || el.innerText || el.textContent || "");
        if (t) return t;
      }
    }
    return extractLeirasSectionText(d.body?.innerText || d.body?.textContent || "");
  }

  function findDescriptionInHtml(html) {
    const raw = String(html || "");
    const textareaRe =
      /<textarea[^>]*(?:name|id)=["'][^"']*leiras[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/gi;
    let m;
    while ((m = textareaRe.exec(raw))) {
      const t = normalizeImportedLeiras(m[1]);
      if (t) return t;
    }
    const anyTextareaRe = /<textarea[^>]*>([\s\S]{20,12000}?)<\/textarea>/gi;
    while ((m = anyTextareaRe.exec(raw))) {
      const t = normalizeImportedLeiras(m[1]);
      if (t) return t;
    }
    const headingRe =
      /<h[1-6][^>]*>\s*Leírás\s*:?\s*<\/h[1-6]>\s*<(?:p|div|span|td)[^>]*>([\s\S]*?)<\/(?:p|div|span|td)>/i;
    m = raw.match(headingRe);
    if (m) {
      const t = normalizeImportedLeiras(m[1]);
      if (t) return t;
    }
    const plain = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "\n")
      .replace(/\r\n/g, "\n");
    return extractLeirasSectionText(plain);
  }

  function stripCellHtml(raw) {
    return clean(String(raw ?? "").replace(/<[^>]+>/g, " "));
  }

  /** Gyorsnézet táblázat → { "Állapot": "Kitűnő", "Kivitel": "...", ... } (ugyanaz a logika mint lib/parse-listing parseTableRows) */
  function extractMapFromHtml(html) {
    const map = {};
    const raw = String(html || "");
    for (const row of raw.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const block = row[1] || "";
      const cells = [...block.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
      if (cells.length < 2) continue;

      let keyCell = cells[0][1];
      let valueCell = cells[cells.length - 1][1];

      const keyFromBal = block.match(/<td[^>]*class="[^"]*bal[^"]*pontos[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
      if (keyFromBal) {
        keyCell = keyFromBal[1];
        const afterKey = block.slice(keyFromBal.index + keyFromBal[0].length);
        const valueAfterKey = afterKey.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
        if (valueAfterKey) valueCell = valueAfterKey[1];
      }

      const key = stripCellHtml(keyCell).replace(/:$/, "");
      const val = stripCellHtml(valueCell);
      if (key && val && val.length <= 500 && !/^válasszon|^nincs megadva$/i.test(val)) {
        map[key] = val;
      }
    }
    return map;
  }

  async function mapPool(items, concurrency, worker) {
    const list = Array.isArray(items) ? items : [];
    const out = new Array(list.length);
    let next = 0;
    const limit = Math.max(1, Math.min(concurrency, list.length || 1));
    async function slot() {
      while (next < list.length) {
        const index = next;
        next += 1;
        try {
          out[index] = await worker(list[index], index);
        } catch {
          out[index] = list[index];
        }
      }
    }
    await Promise.all(Array.from({ length: limit }, () => slot()));
    return out;
  }

  async function fetchGyorsnezetHtml(listingId) {
    const id = clean(listingId);
    if (!id) return "";
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const res = await fetch(`https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/${id}`, {
        credentials: "include",
        signal: controller?.signal,
      });
      if (!res.ok) return "";
      return await res.text();
    } catch {
      return "";
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function extractEquipmentFromHtml(html) {
    const items = [];
    const push = (raw) => {
      const t = clean(String(raw || "").replace(/^[-•·]\s*/, ""));
      if (!t || t.length < 2 || t.length > 90) return;
      if (/^(beltér|műszaki|kültér|multimédia|egyéb|felszereltség|navigáció|leírás)$/i.test(t)) return;
      if (/^\d{5,}$/.test(t.replace(/[\s./()-]/g, ""))) return;
      if (/\+36|\(\s*\+?\s*36\s*\)/i.test(t) || /\d{2,}\/\d{6,}/.test(t)) return;
      if (/\b(kft|bt|zrt|nyrt)\.?\b/i.test(t)) return;
      if (/keresked[eé]s\s+adatai|t[eé]rk[eé]p\s+megjelen/i.test(t)) return;
      if (/\d+\s*%/.test(t) && /elvihet/i.test(t)) return;
      if (/^(székesfehérvár|budapest|debrecen|szeged|pécs|győr|miskolc)$/i.test(t)) return;
      if (/:$/.test(t)) return;
      if (!items.includes(t)) items.push(t);
    };
    const splitTokens = (raw) => {
      for (const part of String(raw || "").split(/[\n,;·•|/]+/)) push(part);
    };

    const raw = String(html || "");
    if (!raw) return items;

    try {
      const doc = new DOMParser().parseFromString(raw, "text/html");
      for (const sel of [
        ".hirdetes-felszereltseg li",
        ".felszereltseg-list li",
        "[class*='felszer'] li",
        "[class*='extra'] li",
        "[class*='equipment'] li",
        "ul li",
        ".extranev",
        ".extra-badge",
        ".tooltip-badge",
      ]) {
        for (const node of doc.querySelectorAll(sel)) {
          const parentText = clean(
            node.closest("section, .box, .card, div")?.querySelector("h2, h3, h4, strong, b")?.innerText || ""
          );
          if (/beltér|műszaki|kültér|multimédia|egyéb|felszereltség|navigáció/i.test(parentText) || sel !== "ul li") {
            splitTokens(node.innerText || node.textContent || "");
          }
        }
      }
      for (const input of doc.querySelectorAll('input[type="checkbox"]:checked')) {
        const value = clean(input.value || "");
        if (value.length >= 2) push(value);
      }
    } catch {
      /* regex fallback alább */
    }

    for (const re of [
      /class="[^"]*\bextranev\b[^"]*"[^>]*>([^<]{2,90})</gi,
      /class="[^"]*(?:extra-badge|tooltip-badge)[^"]*"[^>]*>([^<]{2,90})</gi,
    ]) {
      let m;
      while ((m = re.exec(raw))) push(m[1]);
    }

    const plain = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/\r\n/g, "\n");
    const sectionRe =
      /(?:^|\n)\s*(Beltér|Műszaki|Kültér|Multimédia\s*\/\s*Navigáció|Multimédia|Egyéb információ|Egyéb|Felszereltség)\s*\n([\s\S]*?)(?=\n\s*(?:Beltér|Műszaki|Kültér|Multimédia|Egyéb információ|Egyéb|Felszereltség|Leírás|Általános|Hirdetés|Okmányok|Abroncs|Ár,?\s*költségek|Jármű adatok|Motor adatok)\b|$)/gi;
    for (const match of plain.matchAll(sectionRe)) {
      for (const line of String(match[2] || "").split("\n")) {
        const t = clean(line);
        if (t && !/:$/.test(t) && t.split(/\s+/).length <= 14) push(t);
      }
    }

    return items.slice(0, 300);
  }

  async function ensureCarDescription(car) {
    const existingHtml = String(car.html || car.gyorsnezetHtml || "");
    const html =
      existingHtml.length > 400 ? existingHtml : await fetchGyorsnezetHtml(car.listingId);
    if (!html || html.length <= 400) return car;
    const visibleDescription =
      normalizeImportedLeiras(car.visibleDescription || car.description || car.leiras || "") ||
      findDescriptionInHtml(html);
    const map = extractMapFromHtml(html);
    const felszereltseg = extractEquipmentFromHtml(html);
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "\n")
      .slice(0, 25000);
    const kmRaw = map["Km. óra állás"] || map["Futásteljesítmény"] || map["Futasteljesitmeny"] || "";
    const kmDigits = String(kmRaw).replace(/\D/g, "");
    return {
      ...car,
      html,
      gyorsnezetHtml: html,
      visibleDescription,
      map,
      felszereltseg,
      bodyText,
      km: kmDigits || car.km || "",
    };
  }

  function pickPageListingIdFromUrl(url) {
    const u = String(url || "");
    return (
      u.match(/[?&]id=(\d{5,12})\b/i)?.[1] ||
      u.match(/\/gyorsnezet\/[^/]+\/(\d{5,12})\b/i)?.[1] ||
      ""
    );
  }

  function enrichCarsWithDescriptions(cars, html, pageUrl) {
    const pageDesc = pickDescriptionFromDocument(document) || findDescriptionInHtml(html);
    if (!pageDesc) return cars;
    const urlId = pickPageListingIdFromUrl(pageUrl);
    return cars.map((car) => {
      if (car.visibleDescription || car.description || car.leiras) return car;
      const id = String(car.listingId || "");
      const attach = cars.length === 1 || (urlId && urlId === id);
      if (!attach) return car;
      return { ...car, visibleDescription: pageDesc };
    });
  }

  function pickTitleNearImg(img) {
    const row =
      img?.closest?.(
        ".jarmu-kartya, .listing-card, tr, article, li, [class*='jarmu'], [class*='hirdetes'], [class*='listing']"
      ) || null;
    if (row) {
      const el =
        row.querySelector(".cim, h1, h2, h3, [class*='cim'], [class*='title']") ||
        row.querySelector('a[href*="hasznaltauto"], a[href*="gyorsnezet"]');
      const t = clean(el?.innerText || el?.textContent || "");
      if (t.length >= 4 && !/^(módosítás|törlés|ártábla)$/i.test(t)) return t;
    }
    return "";
  }

  function enrichCarsWithTitles(cars, html) {
    const pageTitle = clean(document.querySelector("h1")?.innerText || document.querySelector("h1")?.textContent || "");
    return cars.map((car) => {
      let visibleTitle = clean(car.visibleTitle || "");
      if (!visibleTitle && html) {
        const esc = String(car.listingId || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const tries = [
          new RegExp(
            `data-id=["']${esc}["'][\\s\\S]{0,4000}?class=["'][^"']*\\bcim\\b[^"']*["'][^>]*>([^<]+)<`,
            "i"
          ),
          new RegExp(`class=["'][^"']*\\bcim\\b[^"']*["'][^>]*href=["'][^"']*${esc}[^"']*["'][^>]*>([^<]+)<`, "i"),
          new RegExp(`href=["'][^"']*${esc}[^"']*["'][^>]*>([^<]{4,160})<`, "i"),
          new RegExp(`-${esc}(?:["'/]|</)[^>]*>([^<]{4,160})<`, "i"),
        ];
        for (const re of tries) {
          const m = html.match(re);
          visibleTitle = clean(m?.[1] || "");
          if (visibleTitle.length >= 4) break;
        }
      }
      if (!visibleTitle) {
        for (const img of document.querySelectorAll("img")) {
          const src = img.currentSrc || img.src || img.getAttribute("data-src") || "";
          if (!src.includes(String(car.listingId))) continue;
          visibleTitle = pickTitleNearImg(img);
          if (visibleTitle) break;
        }
      }
      if (!visibleTitle && cars.length === 1 && pageTitle.length >= 4) visibleTitle = pageTitle;
      if (!visibleTitle) return car;
      const fields = parseVehicleTitleFields(visibleTitle);
      return { ...car, ...fields, visibleTitle: fields.visibleTitle || visibleTitle };
    });
  }

  /** Ugyanaz a logika, mint lib/ha-dealer-cdn-extract.mjs (bookmarklet nem importál ESM-et). */
  function extractCarsFromHtml(html, pageUrl) {
    const raw = String(html || "");
    const re =
      /(?:https?:)?\/\/(?:img\.)?hasznaltautocdn\.com\/(?:\d{2,4}x\d{2,4}\/)?(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)/gi;
    const byId = new Map();
    let m;
    while ((m = re.exec(raw))) {
      const listingId = m[1];
      const imageId = m[2];
      const ext = String(m[3] || "jpg").toLowerCase().replace("jpeg", "jpg");
      if (!listingId || byId.has(listingId)) continue;
      byId.set(listingId, {
        listingId,
        url: `https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=${listingId}`,
        adminUrl: `https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=${listingId}`,
        visibleImage: `https://img.hasznaltautocdn.com/2048x1536/${listingId}/${imageId}.${ext}`,
        photoOnly: true,
      });
    }
    const withTitles = enrichCarsWithTitles([...byId.values()], raw);
    return enrichCarsWithDescriptions(withTitles, raw, pageUrl);
  }

  function extractCarsFromPage() {
    const html = String(document.documentElement?.outerHTML || "");
    const chunks = [html];
    for (const img of document.querySelectorAll("img")) {
      chunks.push(
        img.getAttribute("src") || "",
        img.currentSrc || "",
        img.getAttribute("data-src") || "",
        img.getAttribute("data-lazy") || "",
        img.getAttribute("data-original") || "",
        img.getAttribute("data-full") || "",
        img.getAttribute("srcset") || ""
      );
    }
    for (const el of document.querySelectorAll("[style*='hasznaltautocdn'], [style*='url(']")) {
      chunks.push(el.getAttribute("style") || "");
    }
    for (const ta of document.querySelectorAll("textarea")) {
      const v = ta.value || "";
      if (v.length >= 20) {
        const name = ta.getAttribute("name") || ta.id || "leiras";
        chunks.push(`<textarea name="${name}">${v}</textarea>`);
      }
    }
    return extractCarsFromHtml(chunks.join("\n"), location.href).slice(0, MAX);
  }

  async function quickScrollThumbs() {
    try {
      const step = Math.max(500, Math.floor(window.innerHeight * 0.85) || 600);
      for (let i = 0; i < 8; i += 1) {
        window.scrollTo(0, i * step);
        await sleep(30);
      }
      window.scrollTo(0, 0);
      await sleep(40);
    } catch {
    }
  }

  function deliverOneAwait(target, body, maxTries = 16) {
    return new Promise((resolve) => {
      let acked = false;
      const onAck = (event) => {
        const data = event?.data;
        if (!data || data.type !== "bymy-ha-import-ack") return;
        if (data.importId && data.importId !== body.importId) return;
        acked = true;
        try {
          window.removeEventListener("message", onAck);
        } catch {
        }
        resolve({
          ok: data.ok !== false && (Number(data.savedCount || 0) > 0 || Number(data.skippedCount || 0) > 0 || data.savedCount == null),
          savedCount: data.savedCount == null ? null : Number(data.savedCount || 0),
          skippedCount: Number(data.skippedCount || 0),
          errorCount: Number(data.errorCount || 0),
          error: data.error || "",
        });
      };
      try {
        window.addEventListener("message", onAck);
      } catch {
      }
      const send = () => {
        if (!target || target.closed) return false;
        try {
          target.postMessage(body, "*");
          return true;
        } catch {
          return false;
        }
      };
      if (!send()) {
        try {
          window.removeEventListener("message", onAck);
        } catch {
        }
        resolve(null);
        return;
      }
      let n = 0;
      const tries = Math.max(4, Math.min(120, Number(maxTries) || 16));
      const timer = setInterval(() => {
        if (acked) {
          clearInterval(timer);
          return;
        }
        n += 1;
        send();
        if (n >= tries) {
          clearInterval(timer);
          try {
            window.removeEventListener("message", onAck);
          } catch {
          }
          resolve(null);
        }
      }, 500);
    });
  }

  const SAVE_CHUNK = 25;

  function slimDealerPage(car) {
    const page = car || {};
    const mapIn = page.map && typeof page.map === "object" ? page.map : {};
    const map = {};
    for (const [key, val] of Object.entries(mapIn)) {
      if (!/állapot|kivitel|üzemanyag|sebességváltó|hajtás|szín|klíma|okmány|henger|teljesítmény|ajtó|km|évjárat|gyártási/i.test(key)) {
        continue;
      }
      const text = String(val ?? "").trim();
      if (text && text.length < 200) map[key] = text;
    }
    return {
      url: page.url || page.adminUrl || page.clickUrl || page.publicUrl || "",
      listingId: page.listingId || "",
      visibleImage: page.visibleImage || page.imageUrl || "",
      visibleTitle: page.visibleTitle || page.title || "",
      visibleDescription: String(page.visibleDescription || page.description || page.leiras || "").slice(0, 2000),
      clickUrl: page.clickUrl || "",
      adminUrl: page.adminUrl || "",
      publicUrl: page.publicUrl || "",
      photoOnly: true,
      gyartmany: page.gyartmany || "",
      modell: page.modell || "",
      tipus: page.tipus || "",
      km: page.km || "",
      map,
      felszereltseg: Array.isArray(page.felszereltseg) ? page.felszereltseg.slice(0, 80) : [],
    };
  }
  const PROGRESS_KEY = "bymy-ha-dealer-progress";

  function listProgressKey() {
    try {
      return `${location.pathname}?${location.search || ""}`.replace(/\?$/, "");
    } catch {
      return location.href || "";
    }
  }

  function loadDealerProgress(total) {
    try {
      const raw = sessionStorage.getItem(PROGRESS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.listKey !== listProgressKey()) return null;
      const offset = Math.max(0, Number(parsed.offset) || 0);
      if (!parsed.batchId || offset <= 0 || offset >= total) return null;
      return {
        batchId: String(parsed.batchId),
        offset,
        ok: Number(parsed.ok) || 0,
        fail: Number(parsed.fail) || 0,
        skipped: Number(parsed.skipped) || 0,
      };
    } catch {
      return null;
    }
  }

  function saveDealerProgress(state) {
    try {
      if (!state) {
        sessionStorage.removeItem(PROGRESS_KEY);
        return;
      }
      sessionStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({
          listKey: listProgressKey(),
          batchId: state.batchId,
          offset: state.offset,
          ok: state.ok,
          fail: state.fail,
          skipped: state.skipped,
          total: state.total,
        })
      );
    } catch {
    }
  }

  /** Win7-barát: text/plain + token a body-ban → nincs CORS preflight (Authorization nélkül). */
  async function savePagesDirect(origin, token, pages, doneCount, total) {
    const list = Array.isArray(pages) ? pages : [];
    const payload = {
      authToken: token,
      photoOnly: true,
      mode: "dealer",
      listUrl: location.href,
      pages: list,
    };
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 60000) : null;
    let res;
    try {
      res = await fetch(`${origin}/api/import/extracted`, {
        method: "POST",
        mode: "cors",
        signal: controller?.signal,
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: JSON.stringify(payload),
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
    }
      if (!res.ok && !data.result) {
        throw new Error(data.error || `HTTP ${res.status} (${doneCount}/${total})`);
      }
      return data.result || {};
  }

  /** Ha a fetch CSP/CORS miatt elhasal: rejtett iframe + form POST (popup/COOP nélkül). */
  function savePagesFormBridge(origin, token, pages, chunkIndex) {
    return new Promise((resolve, reject) => {
      const list = Array.isArray(pages) ? pages : [];
      const bridgeId = `bymy_ha_br_${Date.now()}_${chunkIndex}`;
      const frameName = `bymy_ha_br_fr_${chunkIndex}_${Date.now()}`;
      let settled = false;
      let iframe = null;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          window.removeEventListener("message", onMsg);
        } catch {
        }
        try {
          if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch {
        }
        fn(value);
      };
      const onMsg = (event) => {
        const data = event?.data;
        if (!data || data.type !== "bymy-ha-bridge-result") return;
        if (data.bridgeId && data.bridgeId !== bridgeId) return;
        if (data.ok) finish(resolve, data.result || {});
        else finish(reject, new Error(data.error || "bridge hiba"));
      };
      try {
        window.addEventListener("message", onMsg);
      } catch {
      }
      const timer = setTimeout(() => finish(reject, new Error("bridge timeout")), 90000);
      try {
        iframe = document.createElement("iframe");
        iframe.name = frameName;
        iframe.setAttribute("title", "bymy-import");
        iframe.style.cssText = "position:fixed;width:1px;height:1px;left:-100px;top:-100px;opacity:0;border:0;";
        (document.body || document.documentElement).appendChild(iframe);
      } catch (error) {
        finish(reject, error);
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `${origin}/api/import/ha-bridge`;
      form.target = frameName;
      form.acceptCharset = "UTF-8";
      const fields = {
        bridgeId,
        token,
        payload: JSON.stringify({
          photoOnly: true,
          mode: "dealer",
          listUrl: location.href,
          pages: list,
        }),
      };
      Object.keys(fields).forEach((key) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = fields[key];
        form.appendChild(input);
      });
      (document.body || document.documentElement).appendChild(form);
      try {
        form.submit();
      } catch (error) {
        finish(reject, error);
      }
      try {
        form.remove();
      } catch {
      }
    });
  }

  async function savePagesWithFallback(origin, token, pages, doneCount, total, chunkIndex) {
    try {
      return await savePagesDirect(origin, token, pages, doneCount, total);
    } catch (error) {
      const msg = String(error?.message || error || "");
      if (!/failed to fetch|networkerror|load failed|timeout|időtúllépés/i.test(msg)) throw error;
      showProgress(doneCount, total, `form mentés ${doneCount}/${total}`);
      return savePagesFormBridge(origin, token, pages, chunkIndex);
    }
  }

  /**
   * Mindig a Bymy Autóimport fülön mentünk (postMessage).
   * A HA oldal CSP-je Win7-en gyakran blokkolja a fetch/formot a Bymy felé — semmi sem ér a szerverre.
   */
  async function ensureBymyTarget(origin) {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.focus();
      } catch {
      }
      return window.opener;
    }
    const importUrl = `${String(origin || "").replace(/\/$/, "")}/beallitasok.html?szekcio=import&mode=dealer`;
    let named = null;
    try {
      named = window.open("", "bymy-ha-import");
    } catch {
      named = null;
    }
    if (named && named !== window && !named.closed) {
      try {
        const href = String(named.location.href || "");
        if (!href || /^about:(blank|newtab)$/i.test(href)) {
          try {
            named.location.href = importUrl;
          } catch {
          }
          await sleep(2800);
          try {
            named.focus();
          } catch {
          }
          return named;
        }
        if (origin && href.indexOf(String(origin).replace(/\/$/, "")) === 0) {
          try {
            named.focus();
          } catch {
          }
          return named;
        }
      } catch {
        try {
          named.focus();
        } catch {
        }
        return named;
      }
    }
    try {
      named = window.open(importUrl, "bymy-ha-import");
    } catch {
      named = null;
    }
    if (named && named !== window && !named.closed) {
      await sleep(2800);
      try {
        named.focus();
      } catch {
      }
      return named;
    }
    return null;
  }

  async function run(opts) {
    const origin = clean(opts?.origin || "").replace(/\/$/, "");
    const token = clean(opts?.authToken || "");
    if (!origin) {
      alert("Hiányzik a Bymy cím.");
      return;
    }
    if (!/admin\.hasznaltauto\.hu$/i.test(location.hostname.replace(/^www\./, ""))) {
      alert("Nyisd meg az admin.hasznaltauto.hu Járműlista / Hirdetéseim oldalát, majd futtasd újra.");
      return;
    }

    showProgress(0, 1, "Bymy Autóimport keresése");
    const target = await ensureBymyTarget(origin);
    if (!target && !token) {
      alert(
        "Nem nyílt meg a Bymy Autóimport.\n\n1) Engedd a felugró ablakokat\n2) Nyisd meg kézzel: Bymy → Autóimport (kereskedői)\n3) Onnan: admin megnyitása → könyvjelző"
      );
      hideProgress();
      return;
    }
    if (!target) {
      showProgress(0, 1, "nincs Bymy fül — próbálkozás közvetlen mentéssel");
    }

    showProgress(0, 1, "képek keresése");
    await quickScrollThumbs();
    const cars = extractCarsFromPage();
    if (!cars.length) {
      hideProgress();
      alert(
        "Nem találtunk hasznaltautocdn képet a listán.\nGörgess le, amíg látszanak a thumbök, majd futtasd újra."
      );
      return;
    }

    let preparedDone = 0;
    const prepared = await mapPool(cars, 6, async (car) => {
      let next = car;
      try {
        next = await ensureCarDescription(car);
      } catch {
        next = car;
      }
      preparedDone += 1;
      showProgress(preparedDone, cars.length, `előkészítés ${preparedDone}/${cars.length}`);
      return slimDealerPage(next);
    });

    const resumed = loadDealerProgress(prepared.length);
    const batchId =
      resumed?.batchId || `ha-batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let ok = resumed?.ok || 0;
    let fail = resumed?.fail || 0;
    let skipped = resumed?.skipped || 0;
    const startOffset = resumed?.offset || 0;
    const errors = [];
    let chunkIndex = Math.floor(startOffset / SAVE_CHUNK);
    let usedDirect = false;
    let stoppedEarly = false;
    if (startOffset > 0) {
      showProgress(startOffset, prepared.length, `folytatás ${startOffset}/${prepared.length}`);
    }
    if (token && startOffset < prepared.length) {
      const rest = prepared.slice(startOffset);
      showProgress(prepared.length, prepared.length, `mentés ${rest.length} autó`);
      try {
        usedDirect = true;
        const result = await savePagesWithFallback(
          origin,
          token,
          rest,
          prepared.length,
          prepared.length,
          chunkIndex + 1
        );
        const savedN = Number(result?.savedCount || 0);
        const skippedN = Number(result?.skippedCount || 0);
        const errN = Number(result?.errorCount || 0);
        const skipMsg = (result?.items || []).find((it) => it?.skipped && it?.message)?.message;
        if (result?.errors?.[0]?.message) errors.push(result.errors[0].message);
        else if (skipMsg) errors.push(skipMsg);
        ok += savedN;
        skipped += skippedN;
        fail += errN;
        saveDealerProgress(null);
        const parts = [];
        if (ok) parts.push(`${ok} mentve`);
        if (skipped) parts.push(`${skipped} kihagyva`);
        if (fail) parts.push(`${fail} hiba`);
        hideProgress(
          parts.length
            ? `Kész: ${parts.join(", ")}${errors[0] && fail ? ` — ${errors[0]}` : ""}`
            : `Mentés sikertelen${errors[0] ? ` — ${errors[0]}` : ""}`
        );
        return;
      } catch (error) {
        hideProgress(`Mentés sikertelen — ${error.message || error}`);
        return;
      }
    }
    for (let offset = startOffset; offset < prepared.length; offset += SAVE_CHUNK) {
      const chunk = prepared.slice(offset, offset + SAVE_CHUNK);
      const doneCount = Math.min(offset + chunk.length, prepared.length);
      chunkIndex += 1;
      showProgress(doneCount, prepared.length, `mentés ${doneCount}/${prepared.length} (Bymy fül)`);
      try {
        let saved = false;
        let result = null;
        if (target && !target.closed) {
          const ack = await deliverOneAwait(
            target,
            {
              type: "bymy-ha-import",
              v: 1,
              mode: "dealer",
              photoOnly: true,
              listUrl: location.href,
              batchId,
              index: doneCount,
              total: prepared.length,
              importId: `${batchId}-c${chunkIndex}`,
              pages: chunk,
            },
            chunkIndex === 1 ? 70 : 50
          );
          if (ack) {
            if (ack.savedCount != null) {
              ok += Number(ack.savedCount || 0);
              skipped += Number(ack.skippedCount || 0);
              fail += Number(ack.errorCount || 0);
              if (ack.error) errors.push(ack.error);
              saved = Boolean(ack.ok);
            } else if (ack.ok) {
              ok += chunk.length;
              saved = true;
            }
          }
        }
        if (!saved && token) {
          usedDirect = true;
          showProgress(doneCount, prepared.length, `közvetlen mentés ${doneCount}/${prepared.length}`);
          result = await savePagesWithFallback(origin, token, chunk, doneCount, prepared.length, chunkIndex);
          const savedN = Number(result?.savedCount || 0);
          const skippedN = Number(result?.skippedCount || 0);
          const errN = Number(result?.errorCount || 0);
          const skipMsg = (result?.items || []).find((it) => it?.skipped && it?.message)?.message;
          if (result?.errors?.[0]?.message) errors.push(result.errors[0].message);
          else if (skipMsg) errors.push(skipMsg);
          ok += savedN;
          skipped += skippedN;
          fail += errN;
          if (savedN === 0 && skippedN === 0 && errN === 0) {
            fail += chunk.length;
            if (!errors.length) errors.push("mentés 0");
          }
          saved = savedN > 0 || skippedN > 0;
        } else if (saved) {
          // postMessage ack már növelte az ok/skipped számlálókat
        }
        if (!saved) {
          if (!token || (target && target.closed)) fail += chunk.length;
          if (!errors.length) {
            errors.push(
              target
                ? "A Bymy Autóimport nem fogadta — jelentkezz be ott, ne zárd be, engedd a felugrót"
                : "A hasznaltauto.hu blokkolja a közvetlen mentést — nyisd a Bymy Autóimportot és engedd a felugró ablakot"
            );
          }
          saveDealerProgress({
            batchId,
            offset,
            ok,
            fail,
            skipped,
            total: prepared.length,
          });
          stoppedEarly = true;
          break;
        }
        saveDealerProgress({
          batchId,
          offset: doneCount,
          ok,
          fail,
          skipped,
          total: prepared.length,
        });
      } catch (e) {
        fail += chunk.length;
        errors.push(e.message || String(e));
        saveDealerProgress({
          batchId,
          offset,
          ok,
          fail,
          skipped,
          total: prepared.length,
        });
        stoppedEarly = true;
        break;
      }
    }

    if (!stoppedEarly) saveDealerProgress(null);

    const parts = [];
    if (ok) parts.push(`${ok} mentve`);
    if (skipped) parts.push(`${skipped} kihagyva (más fiók / már megvan)`);
    if (fail) parts.push(`${fail} hiba`);
    let msg = parts.length
      ? `Kész: ${parts.join(", ")}${errors[0] && (fail || skipped) ? ` — ${errors[0]}` : ""}`
      : `Kész: semmi nem mentődött${errors[0] ? ` — ${errors[0]}` : ""}`;
    if (stoppedEarly && ok + skipped > 0) {
      msg = `Megszakítva ${ok + skipped + fail}/${prepared.length} után — futtasd újra a könyvjelzőt a folytatáshoz`;
    }
    if (usedDirect && fail && !ok) {
      msg += " · Nyisd a Bymy Autóimportot, engedd a felugrót, futtasd újra";
    }
    hideProgress(msg);
  }

  root.BymyHaDealerImport = { run, extractCarsFromPage, extractCarsFromHtml };
})(window);
