/**
 * Kereskedői Autóimport — csak CDN thumb → HQ URL → Bymy API.
 * Szándékosan rövid: nincs sor-DOM, nincs lapozás-fetch, nincs opener kényszer.
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

  async function fetchGyorsnezetHtml(listingId) {
    const id = clean(listingId);
    if (!id) return "";
    try {
      const res = await fetch(`https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/${id}`, {
        credentials: "include",
      });
      if (!res.ok) return "";
      return await res.text();
    } catch {
      return "";
    }
  }

  async function ensureCarDescription(car) {
    if (car.html && String(car.html).length > 400) return car;
    const html = await fetchGyorsnezetHtml(car.listingId);
    if (!html) return car;
    const visibleDescription =
      normalizeImportedLeiras(car.visibleDescription || car.description || car.leiras || "") ||
      findDescriptionInHtml(html);
    return { ...car, html, gyorsnezetHtml: html, visibleDescription };
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

  async function saveOne(origin, token, page, index, total) {
    const res = await fetch(`${origin}/api/import/extracted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        photoOnly: true,
        mode: "dealer",
        listUrl: location.href,
        pages: [page],
      }),
    });
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
    }
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status} (#${index}/${total})`);
    }
    return data.result || {};
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
    if (!token) {
      alert(
        "Nincs Bymy session token a könyvjelzőben.\n\n1) Frissítsd a Bymy Autóimport lapot\n2) Másold újra a könyvjelzőt\n3) Futtasd a listán"
      );
      return;
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

    let ok = 0;
    let fail = 0;
    const errors = [];
    for (let i = 0; i < cars.length; i += 1) {
      showProgress(i + 1, cars.length, `mentés ${i + 1}/${cars.length}`);
      try {
        const car = await ensureCarDescription(cars[i]);
        const result = await saveOne(origin, token, car, i + 1, cars.length);
        if ((result.savedCount || 0) > 0 || result.ok !== false) ok += 1;
        else {
          fail += 1;
          errors.push(result.errors?.[0]?.message || "mentés 0");
        }
      } catch (e) {
        fail += 1;
        errors.push(e.message || String(e));
      }
    }

    hideProgress(
      fail === 0
        ? `Kész: ${ok} autó mentve`
        : `Kész: ${ok} ok, ${fail} hiba${errors[0] ? ` — ${errors[0]}` : ""}`
    );
  }

  root.BymyHaDealerImport = { run, extractCarsFromPage, extractCarsFromHtml };
})(window);
