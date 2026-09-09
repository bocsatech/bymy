(function (root) {
  const MAX_DEALER = 500;
  const MAX_LIST_PAGES = 80;

  function clean(t) {
    return String(t || "").replace(/\s+/g, " ").trim();
  }

  function cleanTitleMultiline(t) {
    return String(t || "")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }

  function textOf(el) {
    if (!el) return "";
    return clean(el.innerText || el.textContent || "");
  }

  function titleOf(el) {
    if (!el) return "";
    return cleanTitleMultiline(el.innerText || el.textContent || "");
  }

  function isChromeName(t) {
    const v = clean(t);
    return (
      !v ||
      /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\.hu|regisztr|képkezelés|kepkezeles|címlapra|cimlapra|^keretes$/i.test(
        v
      ) ||
      /^(19|20)\d{2}(\/\d{1,2})?$/.test(v) ||
      /^(19|20)\d{2}\/\d{1,2}\b/.test(v) ||
      /^(benzin|d[ií]zel|elektromos|hibrid|hybrid)(\/|\s|,|$)/i.test(v)
    );
  }

  function isBadTitle(t) {
    const v = clean(t);
    const n = v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return (
      !v ||
      v.length < 4 ||
      v.length > 240 ||
      /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\.hu|regisztr|képkezelés|kepkezeles|címlapra|cimlapra|^keretes$/i.test(
        v
      ) ||
      /^(új[!.,]*)+$/i.test(v) ||
      /^uj[!.,]*(\s+uj[!.,]*)*$/i.test(n) ||
      /^\d{1,2}\.\s*\d{1,2}\.?$/.test(v) ||
      /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(v) ||
      /^(19|20)\d{2}(\/\d{1,2})?$/.test(v) ||
      /^(19|20)\d{2}\/\d{1,2}\b/.test(v) ||
      (/\(\d{5,}\)\s*$/.test(v) && /^(19|20)\d{2}/.test(v)) ||
      /^(benzin|d[ií]zel|elektromos|hibrid|hybrid)(\/|\s|,|$)/i.test(v) ||
      /^(módosítás|törlés|képek|felszereltség|leírás|aktív|inaktív)$/i.test(v) ||
      /^ár egyeztetés/i.test(v)
    );
  }

  function looksLikeVehicleTitleLink(text) {
    const t = clean(text);
    if (isBadTitle(t) || t.length < 8) return false;
    if (/m[oó]dos[ií]t|t[oö]rl[eé]s|[aá]rt[aá]bla|kiemel|megtekint|lefoglal|gyorsn/i.test(t)) return false;
    if (/^(új[!.,]*)+$/i.test(t)) return false;
    // Márka + modell jelleg: betű + nem csak dátum
    if (!/[A-Za-záéíóöőúüűÁÉÍÓÖŐÚÜŰ]{2,}/.test(t)) return false;
    if (/MERCEDES|BMW|AUDI|FORD|OPEL|TOYOTA|VOLKSWAGEN|VW|SKODA|ŠKODA|HYUNDAI|KIA|LEXUS|VOLVO|MAZDA|NISSAN|HONDA|SUZUKI|PEUGEOT|RENAULT|CITROEN|CITROËN|FIAT|SEAT|DACIA|TESLA|PORSCHE|JAGUAR|LAND\s*ROVER|RANGE\s*ROVER|MASERATI|MINI|JEEP|DODGE|CHEVROLET|CUPRA|DS\b|MG\b|BYD/i.test(t))
      return true;
    if (t.length >= 12 && /\s/.test(t) && !/^\d/.test(t)) return true;
    return false;
  }

  function pickTitleLinkFromRow(row, rootDoc = document) {
    let best = null;
    let bestScore = 0;
    for (const a of row.querySelectorAll("a[href]")) {
      const text = clean(a.innerText || a.textContent || "");
      if (!looksLikeVehicleTitleLink(text)) continue;
      let href = "";
      try {
        href = new URL(a.getAttribute("href") || a.href || "", rootDoc.baseURI || location.href).href.split("#")[0];
      } catch {
        continue;
      }
      if (!/hasznaltauto\.hu/i.test(href)) continue;
      let score = text.length;
      if (/\/hirdetesfeladas\//i.test(href) || /m[oó]dos[ií]t/i.test(text)) score += 1000;
      if (/[?&]id=\d{5,}/i.test(href) || /-\d{5,}(?:[/?#]|$)/.test(href)) score += 200;
      if (/\/gyorsnezet\//i.test(href)) score += 50;
      if (score > bestScore) {
        bestScore = score;
        best = { href, text };
      }
    }
    return best;
  }

  function pickTitle(doc) {
    // Űrlap mező: Hirdetés címe — ez a megbízható forrás a Módosítás oldalon
    for (const el of doc.querySelectorAll("input, textarea")) {
      const name = `${el.getAttribute("name") || ""} ${el.getAttribute("id") || ""} ${el.getAttribute("placeholder") || ""}`;
      if (!/c[ií]m|title|hirdetes.*cim/i.test(name)) continue;
      const val = clean(el.value || "");
      if (!isBadTitle(val) && val.length >= 8) return val;
    }
    const og = doc.querySelector('meta[property="og:title"]');
    if (og && og.content && !isBadTitle(clean(og.content))) {
      return clean(og.content).replace(/\s*[|–-].*$/, "");
    }
    // h1 előbb — h2 gyakran admin fül (Képkezelés)
    const selectors = [
      "h1",
      '[class*="hirdetes"][class*="cim"]',
      ".jarmu-adat h1",
      ".adatlap h1",
      "h2",
      '[class*="title"]',
      '[class*="cim"]',
    ];
    for (const sel of selectors) {
      for (const el of doc.querySelectorAll(sel)) {
        const t = titleOf(el);
        const first = t.split("\n").map(clean).find(Boolean) || "";
        if (!isBadTitle(first) && first.length >= 8 && looksLikeVehicleTitleLink(first)) return first;
      }
    }
    for (const el of doc.querySelectorAll("dt, td.bal.pontos, th, td.pontos, label")) {
      const label = textOf(el);
      if (!/c[ií]m|hirdet[eé]s c[ií]me/i.test(label)) continue;
      const val = titleOf(el.nextElementSibling) || clean(el.parentElement?.querySelector("input, textarea")?.value || "");
      if (!isBadTitle(val) && val.length >= 8) return val;
    }
    const bodyLines = String(doc.body?.innerText || doc.body?.textContent || "")
      .split("\n")
      .map((line) => clean(line))
      .filter(Boolean);
    for (const line of bodyLines.slice(0, 80)) {
      if (isBadTitle(line)) continue;
      if (/^(bez[aá]r[aá]s|hirdet[eé]s gyors|v[eé]tel[aá]r|[aá]r,?\s*k[oö]lts|gy[aá]rt[aá]si [eé]v|km\.?\s*[oó]ra|j[aá]rm[uű]|motor adatok|okm[aá]ny|új!)/i.test(line))
        continue;
      if (line.length < 10 || line.length > 220) continue;
      if (looksLikeVehicleTitleLink(line)) return line;
    }
    const docTitle = clean((doc.title || "").replace(/\s*[|–-].*$/, ""));
    return isBadTitle(docTitle) ? "" : docTitle;
  }

  function upgradeImageUrl(src) {
    let url = String(src || "").trim();
    if (url.startsWith("//")) url = "https:" + url;
    if (!/^https?:\/\//i.test(url)) return "";
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      // HA CDN: mindig 2048x1536/{hirdetesId}/{kepId}.jpg
      if (host === "hasznaltautocdn.com" || host.endsWith(".hasznaltautocdn.com")) {
        const m = u.pathname.match(/\/(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)$/i);
        if (m) {
          const ext = m[3].toLowerCase().replace("jpeg", "jpg");
          return `https://img.hasznaltautocdn.com/2048x1536/${m[1]}/${m[2]}.${ext}`;
        }
        u.pathname = u.pathname.replace(/\/\d{2,4}x\d{2,4}\//i, "/2048x1536/");
        u.search = "";
        return u.href;
      }
      let next = u.href
        .replace(/\/(?:thumb|thumbs|mini|small|icon|preview)\//gi, "/nagy/")
        .replace(/_(?:thumb|mini|small|sm|xs)(\.[a-z0-9]+)(?:\?|$)/i, "_nagy$1")
        .replace(/\/t\d+\//gi, "/nagy/");
      const parsed = new URL(next);
      if (/imgix\.net|cloudinary|hasznaltauto|hazn/i.test(parsed.hostname)) {
        parsed.searchParams.delete("w");
        parsed.searchParams.delete("h");
        parsed.searchParams.delete("width");
        parsed.searchParams.delete("height");
        parsed.searchParams.delete("q");
        parsed.searchParams.delete("quality");
        if (/imgix/i.test(parsed.hostname)) {
          parsed.searchParams.set("w", "1600");
          parsed.searchParams.set("auto", "format");
          parsed.searchParams.set("q", "85");
        }
        next = parsed.href;
      }
      return next;
    } catch {
      return url;
    }
  }

  function pickImage(doc) {
    const candidates = [];
    const push = (raw, bonus = 0) => {
      let src = String(raw || "").trim();
      if (src.startsWith("//")) src = "https:" + src;
      src = upgradeImageUrl(src);
      if (!src.startsWith("http")) return;
      if (/close|logo|icon|sprite|placeholder|prototip|static\/images|avatar|badge|favicon|pixel/i.test(src)) return;
      let score = bonus;
      if (/hasznaltauto|hazn|kep|photo|galeria|images|hasznaltautocdn/i.test(src)) score += 50000;
      if (/\/2048x1536\//i.test(src)) score += 400000;
      if (/\/(nagy|large|orig|full|main|fo)\b/i.test(src)) score += 250000;
      if (/thumb|mini|small|icon|118x88|240x180/i.test(src)) score -= 150000;
      candidates.push({ src, score });
    };
    const og = doc.querySelector('meta[property="og:image"]');
    if (og?.content) push(og.content, 400000);
    // Galéria első képe = fő fénykép (jó minőségre upgradelve)
    const gallery = [
      ...doc.querySelectorAll(
        ".gallery img, .galeria img, [class*='gallery'] img, [class*='galeria'] img, [class*='swiper'] img, [data-gallery] img, a[href*='kep'] img, a[href*='photo'] img"
      ),
    ];
    if (gallery[0]) {
      const g = gallery[0];
      push(
        g.getAttribute("data-full") ||
          g.getAttribute("data-zoom") ||
          g.getAttribute("data-large") ||
          g.getAttribute("data-original") ||
          g.getAttribute("data-src") ||
          g.getAttribute("data-lazy") ||
          g.currentSrc ||
          g.src,
        350000
      );
      const parentHref = g.closest("a[href]")?.getAttribute("href") || "";
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(parentHref) || /hasznaltauto|hazn|kep/i.test(parentHref)) {
        push(parentHref, 380000);
      }
    }
    for (const img of doc.querySelectorAll("img")) {
      const w = Number(img.naturalWidth || img.width || img.getAttribute("width") || 0);
      const h = Number(img.naturalHeight || img.height || img.getAttribute("height") || 0);
      push(
        img.getAttribute("data-full") ||
          img.getAttribute("data-zoom") ||
          img.getAttribute("data-large") ||
          img.getAttribute("data-original") ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy") ||
          img.currentSrc ||
          img.src,
        w * h
      );
      const srcset = img.getAttribute("srcset") || "";
      if (srcset) {
        let best = "";
        let bestW = -1;
        for (const part of srcset.split(",")) {
          const bits = part.trim().split(/\s+/);
          const candidate = bits[0] || "";
          const desc = bits[1] || "";
          const wm = desc.match(/(\d+)w/i);
          const ww = wm ? Number(wm[1]) : 0;
          if (candidate && ww >= bestW) {
            bestW = ww;
            best = candidate;
          }
        }
        if (best) push(best, 200000 + bestW);
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.src || "";
  }

  function upgradeImageUrlForTransfer(src) {
    const hq = upgradeImageUrl(src);
    if (!hq) return "";
    return hq.replace(/\/2048x1536\//i, "/1280x960/");
  }

  const MIN_PHOTO_BYTES = 20000;

  async function fetchImageBase64(url, allowDownsize = true) {
    let src = String(url || "").trim();
    if (src.startsWith("//")) src = "https:" + src;
    if (!/^https?:\/\//i.test(src)) return "";
    if (/\/(?:118x88|240x180|100x75|80x60)\//i.test(src)) return "";
    try {
      const res = await fetch(src, { credentials: "omit", mode: "cors", cache: "no-store" });
      if (!res.ok) return "";
      const blob = await res.blob();
      if (!blob || blob.size < MIN_PHOTO_BYTES) return "";
      if (blob.type && !/^image\//i.test(blob.type) && !/octet-stream/i.test(blob.type)) return "";
      if (blob.size > 1_200_000 && allowDownsize) {
        const smaller = src.replace(/\/(?:2048x1536|1600x1200|1280x960|1024x768)\//i, "/800x600/");
        if (smaller !== src) return fetchImageBase64(smaller, false);
        return "";
      }
      if (blob.size > 1_200_000) return "";
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    } catch {
      return "";
    }
  }

  function fetchImageBase64ViaImg(url) {
    return new Promise((resolve) => {
      const src = String(url || "").trim();
      if (!/^https?:\/\//i.test(src) || /\/(?:118x88|240x180)\//i.test(src)) {
        resolve("");
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timer = setTimeout(() => {
        try {
          img.src = "";
        } catch {
        }
        resolve("");
      }, 12000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          if (img.naturalWidth < 400 || img.naturalHeight < 300) {
            resolve("");
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          const data = canvas.toDataURL("image/jpeg", 0.9);
          const b64 = (data.split(",")[1] || "").replace(/\s/g, "");
          resolve(b64.length >= 27000 ? b64 : "");
        } catch {
          resolve("");
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve("");
      };
      img.src = src;
    });
  }

  async function attachPhotoBase64(page) {
    if (!page || typeof page !== "object") return page;
    if (page.imageJpegBase64 && String(page.imageJpegBase64).length >= 27000) return page;
    page.imageJpegBase64 = "";
    const url = page.visibleImage || "";
    if (!url) return page;
    const hq = upgradeImageUrl(url) || url;
    page.visibleImage = hq;
    const ladder = ["1280x960", "1024x768", "800x600", "2048x1536"];
    for (const size of ladder) {
      const candidate = /\/2048x1536\//i.test(hq)
        ? hq.replace(/\/2048x1536\//i, `/${size}/`)
        : upgradeImageUrlForTransfer(hq) || hq;
      const b64 = (await fetchImageBase64(candidate, false)) || (await fetchImageBase64ViaImg(candidate));
      if (b64) {
        page.imageJpegBase64 = b64;
        return page;
      }
    }
    return page;
  }

  function pickDescription(doc) {
    for (const sel of ["textarea[name*='leiras' i]", "textarea[id*='leiras' i]", '[class*="leiras"]', '[class*="description"]', '[id*="leiras"]']) {
      for (const el of doc.querySelectorAll(sel)) {
        const t = clean(el.value || el.innerText || el.textContent || "");
        if (t.length >= 20 && !/^leírás$/i.test(t) && !/megtekinthető telefonon/i.test(t)) return t.slice(0, 12000);
      }
    }
    const body = (doc.body?.innerText || doc.body?.textContent || "").replace(/\r\n/g, "\n");
    const m = body.match(
      /(?:^|\n)\s*Leírás\s*\n+([\s\S]{8,12000}?)(?=\n\s*(?:Felszereltség|Általános|Műszaki|Megtalálható|Okmányok|Hirdetés|Beltér|Kültér|Egyéb információ)\b|$)/i
    );
    if (m) {
      const t = clean(m[1]);
      if (t.length >= 20 && !/megtekinthető telefonon/i.test(t)) return t.slice(0, 12000);
    }
    return "";
  }

  function selectedText(el) {
    if (!el) return "";
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "SELECT") {
      const opt = el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0] : el.querySelector("option[selected]");
      const t = clean((opt && (opt.textContent || opt.value)) || el.value || "");
      if (/^v[aá]lasszon|^-$|^nincs/i.test(t)) return "";
      return t;
    }
    if (tag === "INPUT" || tag === "TEXTAREA") return clean(el.value || "");
    const inner = el.querySelector && el.querySelector("select, input, textarea");
    if (inner) return selectedText(inner);
    return textOf(el);
  }

  function splitChainedValue(value) {
    const v = clean(value);
    if (!v) return "";
    return clean(
      v.split(
        /\s+(?=(?:Saját tömeg|Össztömeg|Kárpit színe(?:\s*\(\d+\))?|Csomagtartó|Hengerűrtartalom|Teljesítmény|Sebességváltó|Hajtás|Üzemanyag|Állapot|Évjárat|Futásteljesítmény|Vételár|Ajtók száma|Szállítható|Klíma(?:\s+fajtája)?|Tető|Nyári gumi|Téli gumi|Okmányok|Szín)\s*:)/i
      )[0] || v
    );
  }

  function valueScore(value) {
    const v = clean(value);
    if (!v) return -1;
    if (/\b(?:Saját tömeg|Össztömeg|Kárpit színe)\s*:/i.test(v)) return -500;
    if (v.length > 120) return 40;
    return 220 - Math.min(v.length, 80);
  }

  function addPair(map, rawKey, rawValue) {
    const key = clean(rawKey).replace(/:$/, "");
    const value = splitChainedValue(rawValue);
    if (!key || !value || key.length > 100 || value.length > 400) return;
    if (/válasszon/i.test(value)) return;
    if (value.length > 180 && value.split(/\s+/).length > 18) return;
    if (/^(ár|ar|ár, költségek|költségek|általános adatok|altalanos adatok|jármű adatok|jarmu adatok|motor adatok|muszaki adatok|felszereltseg|felszereltség|beltér|belter|műszaki|muszaki|kültér|kulter|egyéb|egyeb|okmányok|abroncs|hirdetés|hitel|hiba!?)$/i.test(key))
      return;
    const existing = map[key];
    if (!existing || valueScore(value) > valueScore(existing)) {
      map[key] = value;
    }
  }

  function extractEquipment(doc) {
    const items = [];
    const push = (raw) => {
      const t = clean(raw).replace(/^[-•·]\s*/, "");
      if (!t || t.length < 2 || t.length > 90) return;
      if (/^(beltér|belter|műszaki|muszaki|kültér|kulter|multimédia|multimedia|egyéb|egyeb|egyéb információ|felszereltség|leírás|navigáció)$/i.test(t))
        return;
      if (/:$/.test(t)) return;
      if (!items.includes(t)) items.push(t);
    };
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
        const parentText = clean(node.closest("section, .box, .card, div")?.querySelector("h2, h3, h4, strong, b")?.innerText || "");
        if (/beltér|műszaki|kültér|multimédia|egyéb|felszereltség|navigáció/i.test(parentText) || sel !== "ul li") {
          push(node.innerText || node.textContent);
        }
      }
    }
    const body = String(doc.body?.innerText || "").replace(/\r\n/g, "\n");
    const sectionRe =
      /(?:^|\n)\s*(Beltér|Műszaki|Kültér|Multimédia\s*\/\s*Navigáció|Multimédia|Egyéb információ|Egyéb)\s*\n([\s\S]*?)(?=\n\s*(?:Beltér|Műszaki|Kültér|Multimédia|Egyéb információ|Egyéb|Leírás|Általános|Hirdetés|Okmányok|Abroncs|Ár,?\s*költségek|Jármű adatok|Motor adatok)\b|$)/gi;
    for (const match of body.matchAll(sectionRe)) {
      for (const line of String(match[2] || "").split("\n")) {
        const t = clean(line);
        if (t && !/:$/.test(t) && t.split(/\s+/).length <= 12) push(t);
      }
    }
    return items.slice(0, 300);
  }

  function extractMap(doc) {
    const map = {};
    const parseTable = (table) => {
      for (const row of table.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td, th")];
        if (cells.length < 2) continue;
        const keyCell = row.querySelector("td.bal.pontos, td.pontos, th.pontos, .bal.pontos");
        if (keyCell) {
          const valueCell = keyCell.nextElementSibling;
          if (valueCell) {
            addPair(map, textOf(keyCell), selectedText(valueCell));
            continue;
          }
        }
        addPair(map, textOf(cells[0]), selectedText(cells[cells.length - 1]));
      }
    };
    for (const table of doc.querySelectorAll(
      "table.hirdetesadatok, table[class*='hirdetesadatok'], .hirdetesadatok table, table[class*='adat'], table"
    )) {
      parseTable(table);
    }
    for (const row of doc.querySelectorAll("tr")) {
      const keyCell = row.querySelector("td.bal.pontos, td.pontos, th.pontos, .bal.pontos");
      if (!keyCell) continue;
      const valueCell = keyCell.nextElementSibling;
      if (valueCell) addPair(map, textOf(keyCell), selectedText(valueCell));
    }
    for (const dl of doc.querySelectorAll("dl")) {
      for (const dt of dl.querySelectorAll("dt")) {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === "DD") addPair(map, textOf(dt), selectedText(dd));
      }
    }
    for (const el of doc.querySelectorAll("select, input, textarea")) {
      const name = clean(el.name || el.id || "");
      const labelEl = el.labels && el.labels[0];
      const row = el.closest("tr, .form-group, .form-row, li, .mezo, [class*='field']");
      const label = textOf(labelEl) || textOf(row && row.querySelector("label, td.bal, td.pontos, th, dt")) || name;
      const value = selectedText(el);
      if (!value) continue;
      addPair(map, label, value);
      if (/marka|gyartmany|brand/i.test(name)) addPair(map, "Márka", value);
      if (/^modell|model/i.test(name) && !/tipus/i.test(name)) addPair(map, "Modell", value);
    }
    const body = doc.body?.innerText || doc.body?.textContent || "";
    for (const line of body.split("\n")) {
      const match = line.match(/^(.{2,55}?)\s*:\s*(.{1,200})$/);
      if (match) addPair(map, match[1], match[2]);
    }
    return map;
  }

  function fieldFromMap(map, labels) {
    const keys = Object.keys(map);
    for (const label of labels) {
      const want = label.toLowerCase();
      for (const key of keys) {
        if (key.toLowerCase() === want && map[key]) return map[key];
      }
    }
    for (const label of labels) {
      const want = label.toLowerCase();
      for (const key of keys) {
        if (key.toLowerCase().includes(want) && map[key]) return map[key];
      }
    }
    return "";
  }

  function pickListingId(href) {
    const u = String(href || "");
    let m = u.match(/\/gyorsnezet\/[^/]+\/(\d{5,})/i);
    if (m) return m[1];
    m = u.match(/[?&](?:id|hirdetesid|adid|hirdetes_id)=(\d{5,})/i);
    if (m) return m[1];
    m = u.match(/-(\d{5,})(?:[/?#]|$)/);
    if (m) return m[1];
    m = u.match(/\/(\d{5,})(?:\/?(?:szerk|edit|modosit|gyorsnezet)?(?:[/?#]|$))/i);
    return m ? m[1] : "";
  }

  function looksLikeSpecToken(t) {
    const v = clean(t);
    if (!v) return true;
    return /^(?:\d+[.,]?\d*|t-?gdi|gdi|tdi|cdi|dci|hev|phev|mhev|bhev|gt|line|4wd|awd|2wd|fwd|rwd|xdrive|quattro|automata|manual|manu[aá]lis|full|led|panor[aá]ma|b[oő]r|navi|hybrid|hibrid|benzin|d[ií]zel|elektromos)(?:\b|$)/i.test(
      v
    );
  }

  function brandModelFromTitle(title) {
    const line = String(title || "")
      .split(/\n+/)[0]
      .replace(/\s+/g, " ")
      .trim();
    if (!line || isBadTitle(line)) return { brand: "", model: "" };
    const upper = line.toLocaleUpperCase("hu-HU");
    const multi = [
      "MERCEDES-BENZ",
      "MERCEDES BENZ",
      "LAND ROVER",
      "ALFA ROMEO",
      "ASTON MARTIN",
      "ROLLS-ROYCE",
      "ROLLS ROYCE",
      "RANGE ROVER",
    ];
    let brand = "";
    let rest = line;
    for (const name of multi) {
      if (upper.startsWith(name)) {
        brand = line.slice(0, name.length);
        rest = line.slice(name.length).trim();
        break;
      }
    }
    const parts = rest.split(/\s+/).filter(Boolean);
    if (!brand) {
      for (let i = 0; i < parts.length; i += 1) {
        if (isChromeName(parts[i]) || looksLikeSpecToken(parts[i])) continue;
        brand = parts[i];
        rest = parts.slice(i + 1).join(" ");
        break;
      }
      parts.length = 0;
      parts.push(...rest.split(/\s+/).filter(Boolean));
    }
    let model = "";
    // RANGE ROVER VELAR / DS 7 Crossback — több token amíg nem spec
    const modelBits = [];
    for (const part of parts) {
      if (looksLikeSpecToken(part) || isChromeName(part)) break;
      if (/^\(/.test(part)) break;
      modelBits.push(part);
      if (modelBits.length >= 3) break;
    }
    model = modelBits.join(" ");
    return {
      brand: isChromeName(brand) ? "" : brand,
      model: isChromeName(model) ? "" : model,
    };
  }

  function extractFromDoc(doc, href) {
    const map = extractMap(doc);
    let title = pickTitle(doc) || fieldFromMap(map, ["Cím", "Hirdetés címe"]);
    let featureLine = "";
    const titleLines = String(title || "")
      .split(/\n+/)
      .map(clean)
      .filter(Boolean);
    if (titleLines.length >= 2) {
      title = titleLines[0];
      featureLine = titleLines.slice(1).join(" / ");
    } else if (/\b(Navi|LED|Tempomat|Parkszenzor|Ülésfűtés)\b/i.test(title) && /\//.test(title)) {
      const split = title.match(/^(.+?\))\s+(.+)$/) || title.match(/^(.+?)\s+((?:Navi|LED|Tempomat).+)$/i);
      if (split) {
        title = clean(split[1]);
        featureLine = clean(split[2]);
      }
    }
    const brandRaw = fieldFromMap(map, ["Márka", "Gyártmány"]) || "";
    const modelRaw = fieldFromMap(map, ["Modell"]) || "";
    const fromTitle = brandModelFromTitle(title);
    const brand = isChromeName(brandRaw) ? fromTitle.brand : brandRaw;
    const model = isChromeName(modelRaw) ? fromTitle.model : modelRaw;
    const price =
      fieldFromMap(map, ["Vételár", "Hirdetési ár", "Ár"]) ||
      ((doc.body?.innerText || doc.body?.textContent || "").match(/(\d[\d\s.]{3,})\s*Ft/i) || [])[1] ||
      "";
    const km = fieldFromMap(map, [
      "Futásteljesítmény",
      "Kilométeróra",
      "Km. óra állás",
      "Km. óra állása",
      "Km óra állás",
    ]);
    const yearRaw = fieldFromMap(map, ["Évjárat", "Gyártási év"]);
    const year = (yearRaw.match(/(19|20)\d{2}/) || [])[0] || "";
    const fuel = fieldFromMap(map, ["Üzemanyag"]);
    const rawHtml = doc.documentElement?.outerHTML || "";
    const html = rawHtml.slice(0, Object.keys(map).length >= 8 ? 40000 : 100000);
    const felszereltseg = extractEquipment(doc);
    if (featureLine) {
      for (const part of featureLine.split(/\/+/)) {
        const t = clean(part);
        if (t && t.length >= 2 && t.length <= 40 && !felszereltseg.includes(t)) felszereltseg.unshift(t);
      }
    }
    return {
      url: href,
      html,
      listingId: pickListingId(href),
      visibleTitle: isBadTitle(title) ? [brand, model].filter(Boolean).join(" ") : title,
      visibleImage: pickImage(doc),
      visibleDescription: pickDescription(doc),
      price,
      km,
      year,
      fuel,
      brand: isChromeName(brand) || /^a$/i.test(brand) ? "" : brand,
      model: isChromeName(model) || /^a$/i.test(model) ? "" : model,
      featureLine,
      map,
      felszereltseg: felszereltseg.slice(0, 300),
      bodyText: String(doc.body?.innerText || doc.body?.textContent || "").slice(0, 25000),
    };
  }

  function slimPageForDelivery(page) {
    if (!page || typeof page !== "object") return page;
    if (page.photoOnly) {
      const visibleImage = upgradeImageUrl(page.visibleImage || "") || page.visibleImage || "";
      const b64 = String(page.imageJpegBase64 || "");
      // Thumb base64 (~4k) elutasítva; egy autó / üzenet max ~1.6M
      const useB64 = b64.length >= 27000 && b64.length < 1_600_000;
      return {
        url: page.url || page.clickUrl || "",
        listingId: page.listingId || "",
        visibleImage,
        imageJpegBase64: useB64 ? b64 : "",
        clickUrl: page.clickUrl || page.url || "",
        adminUrl: page.adminUrl || "",
        publicUrl: page.publicUrl || "",
        photoOnly: true,
      };
    }
    const mapCount = page.map && typeof page.map === "object" ? Object.keys(page.map).length : 0;
    const hasBody = String(page.bodyText || "").length >= 400;
    const htmlRaw = String(page.html || "");
    const html =
      mapCount >= 12 && hasBody
        ? ""
        : htmlRaw.slice(0, mapCount >= 5 ? 60000 : 120000);
    const visibleImage = upgradeImageUrl(page.visibleImage || "") || page.visibleImage || "";
    const b64 = String(page.imageJpegBase64 || "");
    const useB64 = b64.length >= 27000 && b64.length < 1_600_000;
    return {
      url: page.url || "",
      listingId: page.listingId || "",
      visibleTitle: page.visibleTitle || page.title || "",
      visibleImage,
      imageJpegBase64: useB64 ? b64 : "",
      visibleDescription: page.visibleDescription || page.description || "",
      price: page.price || "",
      km: page.km || "",
      year: page.year || "",
      fuel: page.fuel || "",
      brand: page.brand || "",
      model: page.model || "",
      featureLine: page.featureLine || "",
      map: page.map && typeof page.map === "object" ? page.map : {},
      felszereltseg: Array.isArray(page.felszereltseg) ? page.felszereltseg.slice(0, 300) : [],
      bodyText: String(page.bodyText || "").slice(0, 25000),
      html,
      fromListCard: Boolean(page.fromListCard),
      clickUrl: page.clickUrl || page.url || "",
      adminUrl: page.adminUrl || "",
      publicUrl: page.publicUrl || "",
    };
  }

  function extractPage() {
    return extractFromDoc(document, location.href);
  }

  function discoverRefs() {
    const byId = {};
    const add = (id, extra = {}) => {
      const n = String(id || "").replace(/\D/g, "");
      if (n.length < 5) return;
      const prev = byId[n] || { id: n };
      byId[n] = {
        id: n,
        adminUrl:
          extra.adminUrl ||
          prev.adminUrl ||
          "https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=" + n,
        publicUrl: extra.publicUrl || prev.publicUrl || "",
      };
    };

    for (const a of document.querySelectorAll("a[href]")) {
      const href = String(a.href || "");
      const id = pickListingId(href);
      if (!id) continue;
      try {
        const u = new URL(href);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        if (!host.endsWith("hasznaltauto.hu")) continue;
        if (/\/hirdetesfeladas\//i.test(u.pathname)) {
          add(id, { adminUrl: href.split("#")[0] });
        } else if (/\/gyorsnezet\//i.test(u.pathname)) {
          // gyorsnézet csak tartalék — a teljes hirdetés (Módosítás) az elsődleges
          add(id, {});
        } else if (/\/[^/?#]+\/.+-\d{5,}\/?$/i.test(u.pathname)) {
          add(id, { publicUrl: `${u.origin}${u.pathname}` });
        }
      } catch {
      }
    }

    const source = String(document.documentElement?.outerHTML || "");
    for (const m of source.matchAll(/\/gyorsnezet\/[^/"'\s]+\/(\d{5,})/gi)) {
      add(m[1]);
    }
    for (const m of source.matchAll(
      /https?:\/\/(?:www\.)?hasznaltauto\.hu\/([^"'?\s]+-\d{5,})/gi
    )) {
      const id = pickListingId(m[0]);
      if (id) add(id, { publicUrl: "https://www.hasznaltauto.hu/" + m[1] });
    }
    for (const m of source.matchAll(/data-(?:id|hirdetesid|adid)=["'](\d{5,})["']/gi)) {
      add(m[1]);
    }
    const self = pickListingId(location.href);
    if (self) {
      if (/\/hirdetesfeladas\//i.test(location.href)) add(self, { adminUrl: location.href.split("#")[0] });
      else if (isPublicListingPage()) add(self, { publicUrl: location.href.split("?")[0] });
      else add(self);
    }
    return Object.values(byId);
  }

  function discoverIds(html, pageUrl) {
    return discoverRefs().map((ref) => ({ id: ref.id, adminUrl: ref.adminUrl }));
  }

  const EDIT_CATS = [
    "szemelyauto",
    "kishaszonjarmu",
    "haszonjarmu",
    "motorkerekpar",
    "lakokocsi",
    "agro",
  ];

  /** Teljes hirdetés (Módosítás) — NEM gyorsnézet. */
  function adminEditUrls(id, preferred) {
    const n = String(id || "").replace(/\D/g, "");
    if (!n) return [];
    const out = [];
    const push = (url) => {
      const u = String(url || "").trim();
      if (u && !out.includes(u)) out.push(u);
    };
    push(preferred);
    for (const cat of EDIT_CATS) {
      push(`https://admin.hasznaltauto.hu/hirdetesfeladas/${cat}?id=${n}`);
      push(`https://admin.hasznaltauto.hu/hirdetesfeladas/${cat}/${n}`);
      push(`https://admin.hasznaltauto.hu/hirdetesfeladas/${cat}/modositas/${n}`);
    }
    return out;
  }

  function isUsefulPage(page) {
    if (!page || typeof page !== "object") return false;
    const mapCount = page.map && typeof page.map === "object" ? Object.keys(page.map).length : 0;
    const title = clean(page.visibleTitle || page.title || "");
    const price = String(page.price || "").replace(/\D/g, "");
    const htmlLen = String(page.html || "").length;
    const goodTitle =
      title &&
      !isBadTitle(title) &&
      !/^hirdetés\s*#?\s*\d+$/i.test(title) &&
      !/^m[oó]dos[ií]t|^t[oö]rl[eé]s|^[aá]rt[aá]bla|^kiemel|^top\b/i.test(title) &&
      title.length >= 5;
    if (goodTitle) return true;
    if (htmlLen > 1200 && goodTitle) return true;
    if (mapCount >= 5 && price.length >= 4 && goodTitle) return true;
    if (price.length >= 5 && mapCount >= 3 && !isBadTitle(title)) return true;
    return false;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pickIdFromRow(row) {
    const attrs = [
      row.getAttribute("data-id"),
      row.getAttribute("data-hirdetesid"),
      row.getAttribute("data-adid"),
      row.getAttribute("data-hirdetes-id"),
      row.getAttribute("data-jarmu-id"),
    ];
    for (const raw of attrs) {
      const n = String(raw || "").replace(/\D/g, "");
      if (n.length >= 5) return n;
    }
    for (const el of row.querySelectorAll("input[type='checkbox'], input[type='hidden'], input[name*='id' i]")) {
      const n = String(el.value || el.getAttribute("data-id") || "").replace(/\D/g, "");
      if (n.length >= 5 && n.length <= 12) return n;
    }
    for (const a of row.querySelectorAll("a[href]")) {
      const found = pickListingId(a.href || "");
      if (found) return found;
    }
    const html = String(row.innerHTML || "");
    let m = html.match(/\/gyorsnezet\/[^/"'\s]+\/(\d{5,12})/i);
    if (m) return m[1];
    m = html.match(/[?&](?:id|hirdetesid|adid|hirdetes_id|jarmu_id)=(\d{5,12})/i);
    if (m) return m[1];
    m = html.match(/hirdetes(?:kod|kód|code)?["'\s:=]+(\d{5,12})/i);
    if (m) return m[1];
    const nums = [...html.matchAll(/\b(\d{7,10})\b/g)].map((x) => x[1]);
    if (nums.length === 1) return nums[0];
    if (nums.length > 1) {
      nums.sort((a, b) => b.length - a.length || Number(b) - Number(a));
      return nums[0];
    }
    return "";
  }

  function pickRowImage(row) {
    const candidates = [];
    const push = (raw, bonus = 0) => {
      let src = String(raw || "").trim();
      if (src.startsWith("//")) src = "https:" + src;
      if (!/^https?:\/\//i.test(src)) return;
      if (/logo|icon|sprite|badge|avatar|favicon|pixel|placeholder/i.test(src)) return;
      let score = bonus;
      if (/hasznaltauto|hazn|kep|photo|img\.|cdn|hasznaltautocdn/i.test(src)) score += 50000;
      if (/thumb|mini|small|118x88|240x180|t\d+\b/i.test(src)) score -= 150000;
      if (/\/2048x1536\//i.test(src)) score += 400000;
      if (/\/(nagy|large|2048|orig|full)\b/i.test(src)) score += 200000;
      candidates.push({ src: upgradeImageUrl(src), score });
    };
    for (const img of row.querySelectorAll("img")) {
      push(
        img.getAttribute("data-full") ||
          img.getAttribute("data-zoom") ||
          img.getAttribute("data-large") ||
          img.getAttribute("data-original") ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy") ||
          "",
        10000
      );
      push(img.currentSrc || img.src || "", Number(img.naturalWidth || img.width || 0) * Number(img.naturalHeight || img.height || 0));
      const srcset = img.getAttribute("srcset") || "";
      if (srcset) {
        let best = "";
        let bestW = -1;
        for (const part of srcset.split(",")) {
          const bits = part.trim().split(/\s+/);
          const candidate = bits[0] || "";
          const desc = bits[1] || "";
          const wm = desc.match(/(\d+)w/i);
          const ww = wm ? Number(wm[1]) : 0;
          if (candidate && ww >= bestW) {
            bestW = ww;
            best = candidate;
          }
        }
        if (best) push(best, 8000 + bestW);
      }
    }
    for (const el of row.querySelectorAll("[style*='background'], [data-bg], [data-background], [data-image]")) {
      const style = el.getAttribute("style") || "";
      const m = style.match(/url\(\s*['"]?(https?:\/\/[^'")\s]+|\/\/[^'")\s]+)/i);
      if (m) push(m[1], 20000);
      push(el.getAttribute("data-bg") || el.getAttribute("data-background") || el.getAttribute("data-image") || "", 15000);
    }
    for (const a of row.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(href)) push(href, 12000);
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.src || "";
  }

  function extractDealerListPages(rootDoc = document) {
    const byId = {};
    const rowNodes = [
      ...rootDoc.querySelectorAll(
        "table tbody tr, table tr, .talalati-sor, [class*='hirdetes'] tr, [class*='jarmu'] tr, [class*='list'] tr, article, li, [class*='row'], [class*='jarmu'], [class*='hirdetes-sor']"
      ),
    ];
    // Fallback: minden Módosítás / hirdetesfeladas link sorából
    for (const a of rootDoc.querySelectorAll("a[href]")) {
      const href = String(a.getAttribute("href") || a.href || "");
      const aText = clean(a.innerText || a.textContent || "");
      if (!/\/hirdetesfeladas\//i.test(href) && !/m[oó]dos[ií]t/i.test(aText)) continue;
      const row =
        a.closest("tr, article, li, .talalati-sor, [class*='row'], [class*='hirdetes'], [class*='jarmu']") || a.parentElement;
      if (row && !rowNodes.includes(row)) rowNodes.push(row);
    }
    for (const row of rowNodes) {
      const text = String(row.innerText || "");
      if (text.length < 8) continue;
      if (
        !/m[oó]dos[ií]t|t[oö]rl[eé]s|gyorsn[eé]zet|[aá]rt[aá]bla|kiemel|c[ií]mlap|lexus|kia|mercedes|bmw|audi|ford|opel|toyota|volkswagen|skoda|hyundai|maserati|land\s*rover|volvo|suzuki|nissan|honda|peugeot|renault|\bE\s*250\b|\bCDI\b/i.test(
          text
        )
      ) {
        continue;
      }
      if (/menü|navig|belép|kijelent|^ssz/i.test(text) && text.length < 40) continue;

      const titleLink = pickTitleLinkFromRow(row, rootDoc);
      let id = pickIdFromRow(row) || (titleLink ? pickListingId(titleLink.href) : "");
      if (id.length < 5) {
        for (const a of row.querySelectorAll("a[href]")) {
          id = pickListingId(a.href || a.getAttribute("href") || "");
          if (id.length >= 5) break;
        }
      }
      if (id.length < 5) continue;

      let adminUrl = "";
      let publicUrl = "";
      let clickUrl = titleLink?.href || "";
      for (const a of row.querySelectorAll("a[href]")) {
        const href = String(a.href || a.getAttribute("href") || "");
        const aText = clean(a.innerText || a.textContent || "");
        try {
          const u = new URL(href, rootDoc.baseURI || location.href);
          const host = u.hostname.replace(/^www\./, "").toLowerCase();
          if (host.startsWith("admin.") && (/\/hirdetesfeladas\//i.test(u.pathname) || /m[oó]dos[ií]t/i.test(aText))) {
            adminUrl = u.href.split("#")[0];
            if (/m[oó]dos[ií]t/i.test(aText) || /\/hirdetesfeladas\//i.test(u.pathname)) {
              clickUrl = clickUrl || adminUrl;
            }
          } else if (host.endsWith("hasznaltauto.hu") && !host.startsWith("admin.") && pickListingId(u.href)) {
            publicUrl = `${u.origin}${u.pathname}`;
          }
        } catch {
        }
      }
      // 1. lépés: a járműlista cím-linkje (kattintás) — ez az elsődleges URL
      if (!clickUrl) clickUrl = adminUrl || publicUrl || `https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=${id}`;
      if (!adminUrl && /\/hirdetesfeladas\//i.test(clickUrl)) adminUrl = clickUrl;
      if (!adminUrl) adminUrl = `https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=${id}`;

      const title =
        (titleLink && !isBadTitle(titleLink.text) ? titleLink.text : "") ||
        [...row.querySelectorAll("a[href]")]
          .map((a) => clean(a.innerText || a.textContent || ""))
          .find((line) => looksLikeVehicleTitleLink(line)) ||
        "";

      const priceMatch = text.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{5,})\s*Ft/i);
      const price = priceMatch ? priceMatch[1].replace(/[.\s]/g, "") : "";
      const km = (text.match(/(\d[\d\s.]*)\s*km/i) || [])[0] || "";
      const year = (text.match(/\b((?:19|20)\d{2})(?:\/\d{1,2})?\b/) || [])[1] || "";
      const imageUrl = pickRowImage(row);

      const fromTitle = brandModelFromTitle(title);
      const page = {
        url: clickUrl,
        listingId: id,
        visibleTitle: title,
        visibleImage: imageUrl,
        price,
        km,
        year,
        brand: fromTitle.brand || "",
        model: fromTitle.model || "",
        map: {},
        bodyText: clean(text).slice(0, 2500),
        felszereltseg: [],
        html: "",
        fromListCard: true,
        clickUrl,
        adminUrl,
        publicUrl,
      };
      const prev = byId[id];
      if (!prev || clean(page.visibleTitle).length > clean(prev.visibleTitle || "").length || (!prev.visibleImage && page.visibleImage)) {
        byId[id] = page;
      }
    }
    return Object.values(byId);
  }

  function discoverPaginationUrls(rootDoc = document) {
    const selfUrl = String(location.href || "").split("#")[0];
    const urls = new Set([selfUrl]);
    const push = (href) => {
      try {
        const u = new URL(href, rootDoc.baseURI || location.href);
        if (u.hostname.replace(/^www\./, "") !== location.hostname.replace(/^www\./, "")) return;
        const bare = u.href.split("#")[0];
        if (bare) urls.add(bare);
      } catch {
      }
    };
    for (const a of rootDoc.querySelectorAll("a[href]")) {
      const href = String(a.getAttribute("href") || a.href || "");
      const text = clean(a.innerText || a.textContent || "");
      if (
        /[?&](page|oldal|p|offset|start)=/i.test(href) ||
        /\/(page|oldal)\/\d+/i.test(href) ||
        /^(?:\d+|következ[oő]|kovetkezo|előző|elozo|next|prev|›|»|‹|«)$/i.test(text) ||
        /következ|kovetkez|next|előző|elozo|prev/i.test(text)
      ) {
        push(href);
      }
    }
    for (const opt of rootDoc.querySelectorAll("select option[value]")) {
      const value = String(opt.value || "");
      if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 200) {
        try {
          const u = new URL(selfUrl);
          if (u.searchParams.has("page")) u.searchParams.set("page", value);
          else if (u.searchParams.has("oldal")) u.searchParams.set("oldal", value);
          else if (u.searchParams.has("p")) u.searchParams.set("p", value);
          else u.searchParams.set("page", value);
          urls.add(u.href.split("#")[0]);
        } catch {
        }
      }
    }
    return [...urls].slice(0, MAX_LIST_PAGES);
  }

  async function fetchListDocument(url) {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) throw new Error(`Lista oldal hiba (${res.status})`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  async function collectAllDealerListPages(onProgress) {
    const byId = {};
    const merge = (pages) => {
      for (const page of pages) {
        const id = page.listingId;
        if (!id) continue;
        const prev = byId[id];
        if (!prev || clean(page.visibleTitle).length > clean(prev.visibleTitle || "").length) {
          byId[id] = page;
        }
      }
    };

    merge(extractDealerListPages(document));
    const queue = discoverPaginationUrls(document);
    const seen = new Set([String(location.href || "").split("#")[0]]);
    let i = 0;
    while (i < queue.length && seen.size < MAX_LIST_PAGES) {
      const url = queue[i];
      i += 1;
      if (seen.has(url)) continue;
      seen.add(url);
      if (typeof onProgress === "function") onProgress(seen.size, Math.max(queue.length, seen.size), "lista lapozás");
      try {
        const doc = await fetchListDocument(url);
        merge(extractDealerListPages(doc));
        for (const next of discoverPaginationUrls(doc)) {
          if (!seen.has(next) && !queue.includes(next) && queue.length < MAX_LIST_PAGES) queue.push(next);
        }
      } catch {
        /* skip unreachable list page */
      }
    }
    return Object.values(byId).slice(0, MAX_DEALER);
  }

  function extractListCardFallback(ref) {
    try {
      const id = ref.id;
      const anchors = [...document.querySelectorAll("a[href]")].filter((a) =>
        String(a.href || "").includes(id)
      );
      let row = null;
      for (const a of anchors) {
        row = a.closest(
          "tr, .talalati-sor, .row, article, li, .hirdetes, [class*='hirdetes'], [class*='jarmu'], [class*='listing']"
        );
        if (row) break;
      }
      if (!row) {
        row =
          document.querySelector(`[data-id="${id}"], [data-hirdetesid="${id}"], [data-adid="${id}"]`) ||
          null;
      }
      if (!row && !anchors.length) return null;
      const text = clean((row || anchors[0]?.parentElement)?.innerText || "").slice(0, 2000);
      const title = clean(
        (row && (row.querySelector("h2, h3, .cim, [class*='cim'], [class*='title']")?.innerText || "")) ||
          anchors[0]?.innerText ||
          text.split("\n").find((line) => {
            const t = clean(line);
            return t && !isBadTitle(t) && !/módosítás|törlés|ártábla|megtekint|kiemel/i.test(t);
          }) ||
          ""
      );
      const price = ((text.match(/(\d[\d\s.]{3,})\s*Ft/i) || [])[1] || "").replace(/\s/g, "");
      const km = (text.match(/(\d[\d\s.]*)\s*km/i) || [])[0] || "";
      const year = (text.match(/\b((?:19|20)\d{2})(?:\/\d{1,2})?\b/) || [])[1] || "";
      let imageUrl = "";
      const img = row?.querySelector("img[src], img[data-src]");
      const raw = img?.currentSrc || img?.src || img?.getAttribute("data-src") || "";
      if (/^https?:\/\//i.test(raw) && !/logo|icon|sprite/i.test(raw)) imageUrl = raw;
      const page = {
        url: ref.publicUrl || ref.adminUrl || location.href,
        listingId: id,
        visibleTitle: title,
        visibleImage: imageUrl,
        price,
        km,
        year,
        map: {},
        bodyText: text,
        felszereltseg: [],
        html: "",
        fromListCard: true,
      };
      return isUsefulPage(page) ? page : null;
    } catch {
      return null;
    }
  }

  async function extractFromUrlIframe(url) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("title", "bymy-ha-detail");
      iframe.style.cssText =
        "position:fixed;left:-10000px;top:0;width:900px;height:1200px;opacity:0;pointer-events:none;border:0;";
      let settled = false;
      const finish = (err, page) => {
        if (settled) return;
        settled = true;
        try {
          iframe.remove();
        } catch {
        }
        if (err) reject(err);
        else resolve(page);
      };
      const timer = setTimeout(() => finish(new Error("iframe timeout")), 12000);
      iframe.onload = async () => {
        try {
          await sleep(1400);
          const doc = iframe.contentDocument;
          if (!doc?.body) throw new Error("iframe empty");
          const page = extractFromDoc(doc, url);
          clearTimeout(timer);
          finish(null, page);
        } catch (error) {
          clearTimeout(timer);
          finish(error);
        }
      };
      iframe.onerror = () => {
        clearTimeout(timer);
        finish(new Error("iframe error"));
      };
      (document.body || document.documentElement).appendChild(iframe);
      iframe.src = url;
    });
  }

  async function extractRefPage(ref) {
    try {
      const onAdmin = /admin\.hasznaltauto\.hu$/i.test(location.hostname.replace(/^www\./, ""));
      const candidates = [];
      const push = (url) => {
        const u = String(url || "").trim();
        if (u && !candidates.includes(u)) candidates.push(u);
      };
      // 1. Kattintás a lista cím-linkjén
      push(ref.clickUrl);
      // Teljes hirdetés (Módosítás / hirdetesfeladas) — gyorsnézet NEM első
      if (onAdmin) {
        for (const u of adminEditUrls(ref.id, ref.adminUrl)) push(u);
        push(ref.publicUrl);
      } else {
        push(ref.publicUrl);
        for (const u of adminEditUrls(ref.id, ref.adminUrl)) push(u);
      }
      for (const url of candidates.slice(0, onAdmin ? 5 : 6)) {
        try {
          const page = await extractFromUrl(url);
          if (isUsefulPage(page) || (page && clean(page.visibleTitle) && !isBadTitle(page.visibleTitle))) {
            page.listingId = page.listingId || ref.id;
            page.clickUrl = ref.clickUrl || page.clickUrl || "";
            if (ref.visibleTitle && (!page.visibleTitle || isBadTitle(page.visibleTitle))) {
              page.visibleTitle = ref.visibleTitle;
            }
            return page;
          }
        } catch {
        }
      }
      return extractListCardFallback(ref);
    } catch {
      return extractListCardFallback(ref);
    }
  }

  function isPublicListingPage() {
    const href = location.href;
    if (/\/gyorsnezet\//i.test(href)) return true;
    try {
      const path = new URL(href).pathname;
      return /\/[^/?#]+\/.+-\d{5,}\/?$/i.test(path);
    } catch {
      return /-\d{5,}(?:[/?#]|$)/.test(href);
    }
  }

  function isSingleListing() {
    if (isPublicListingPage()) return true;
    return discoverRefs().length <= 1 && Boolean(pickListingId(location.href));
  }

  async function extractFromUrl(url) {
    const onAdmin = /admin\.hasznaltauto\.hu$/i.test(location.hostname.replace(/^www\./, ""));
    if (onAdmin) {
      try {
        const page = await extractFromUrlIframe(url);
        if (isUsefulPage(page)) return page;
      } catch {
      }
    }
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html || html.length < 40) throw new Error("Üres válasz");
    return extractFromDoc(new DOMParser().parseFromString(html, "text/html"), url);
  }

  async function mapPool(items, concurrency, worker, onProgress) {
    const out = new Array(items.length);
    let next = 0;
    let done = 0;
    const limit = Math.max(1, Math.min(concurrency, items.length));
    async function workerSlot() {
      while (next < items.length) {
        const index = next;
        next += 1;
        try {
          out[index] = await worker(items[index], index);
        } catch {
          out[index] = null;
        }
        done += 1;
        if (onProgress) onProgress(done, items.length);
      }
    }
    await Promise.all(Array.from({ length: limit }, () => workerSlot()));
    return out;
  }

  const FETCH_CONCURRENCY = 1;

  function showProgress(current, total, phase) {
    let el = document.getElementById("bymy-ha-progress");
    if (!el) {
      el = document.createElement("div");
      el.id = "bymy-ha-progress";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#111;color:#fff;" +
        "padding:12px 16px;border-radius:10px;font:600 14px/1.45 system-ui,-apple-system,sans-serif;" +
        "box-shadow:0 8px 28px rgba(0,0,0,.4);max-width:min(320px,92vw);";
      (document.body || document.documentElement).appendChild(el);
    }
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    el.textContent =
      total > 1
        ? `Bymy import — ${phase}: ${current} / ${total} (${pct}%)`
        : `Bymy import — ${phase}`;
    el.hidden = false;
  }

  function hideProgress(finalMsg) {
    const el = document.getElementById("bymy-ha-progress");
    if (!el) return;
    if (finalMsg) {
      el.textContent = finalMsg;
      setTimeout(() => {
        try {
          el.remove();
        } catch {
        }
      }, 4500);
      return;
    }
    try {
      el.remove();
    } catch {
    }
  }

  function resolveBymyTarget() {
    // CSAK az Autóimport lap (opener) — soha ne nyissunk új Bymy tabot
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.focus();
      } catch {
      }
      return window.opener;
    }
    return null;
  }

  function noOpenerAlert(mode) {
    alert(
      mode === "dealer"
        ? "Nincs meg a Bymy Autóimport lap (opener).\n\n1) Nyisd meg a Bymy Autóimportot\n2) Onnan kattints: admin.hasznaltauto.hu megnyitása\n3) A listán futtasd a könyvjelzőt\n\nNe nyiss külön böngészőből admin oldalt — és ne zárd be az Autóimport lapot."
        : "Nincs meg a Bymy Autóimport lap (opener).\n\n1) Nyisd meg a Bymy Autóimportot\n2) Onnan nyisd a hasznaltauto.hu-t\n3) Ott futtasd a könyvjelzőt\n\nNe zárd be az Autóimport lapot."
    );
  }

  function deliver(origin, payload) {
    const body = {
      ...payload,
      importId: payload.importId || `ha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
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
    };
    try {
      window.addEventListener("message", onAck);
    } catch {
    }

    const sendTo = (target) => {
      if (!target || target.closed) return false;
      try {
        target.postMessage(body, "*");
        return true;
      } catch {
        return false;
      }
    };

    const retrySend = (target) => {
      let n = 0;
      const timer = setInterval(() => {
        if (acked || !target || target.closed) {
          clearInterval(timer);
          return;
        }
        n += 1;
        sendTo(target);
        if (n >= 40) clearInterval(timer);
      }, 500);
    };

    const target = resolveBymyTarget();
    if (!target) {
      noOpenerAlert(payload.mode);
      return false;
    }
    sendTo(target);
    retrySend(target);
    return true;
  }

  function deliverOneAwait(origin, target, payload) {
    return new Promise((resolve) => {
      const body = {
        ...payload,
        importId: payload.importId || `ha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
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
        resolve(true);
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
      send();
      let n = 0;
      // Mentés (kép feltöltés) sokáig tarthat — várjuk az ack-ot mentés után
      const timer = setInterval(() => {
        if (acked) {
          clearInterval(timer);
          return;
        }
        n += 1;
        send();
        if (n >= 240) {
          clearInterval(timer);
          try {
            window.removeEventListener("message", onAck);
          } catch {
          }
          resolve(false);
        }
      }, 500);
    });
  }

  async function deliverDealerPages(origin, payload) {
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    if (!pages.length) return false;

    const target = resolveBymyTarget();
    if (!target) {
      noOpenerAlert("dealer");
      return false;
    }

    const batchId = `ha-batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < pages.length; i += 1) {
      showProgress(i + 1, pages.length, `mentés Bymy-n (${i + 1}/${pages.length})`);
      const acked = await deliverOneAwait(origin, target, {
        type: "bymy-ha-import",
        v: 1,
        mode: "dealer",
        photoOnly: true,
        listUrl: payload.listUrl || location.href,
        batchId,
        index: i + 1,
        total: pages.length,
        importId: `${batchId}-${i + 1}`,
        pages: [pages[i]],
      });
      if (acked) ok += 1;
      else {
        failed += 1;
        showProgress(i + 1, pages.length, `hiba — újra (${i + 1}/${pages.length})`);
        const retry = await deliverOneAwait(origin, target, {
          type: "bymy-ha-import",
          v: 1,
          mode: "dealer",
          photoOnly: true,
          listUrl: payload.listUrl || location.href,
          batchId,
          index: i + 1,
          total: pages.length,
          importId: `${batchId}-${i + 1}-retry`,
          pages: [pages[i]],
        });
        if (retry) {
          ok += 1;
          failed -= 1;
        }
      }
    }
    return ok > 0;
  }

  async function run(opts) {
    const origin = String(opts?.origin || "").replace(/\/$/, "");
    const mode = opts?.mode === "dealer" ? "dealer" : "standard";
    if (!origin) {
      alert("Hiányzik a Bymy cím.");
      return;
    }
    if (!/hasznaltauto\.hu$/i.test(location.hostname.replace(/^www\./, ""))) {
      alert(mode === "dealer" ? "Először jelentkezz be az admin.hasznaltauto.hu-ra." : "Először nyisd meg a hasznaltauto.hu-t.");
      return;
    }
    if (mode === "dealer" && !/admin\.hasznaltauto\.hu$/i.test(location.hostname)) {
      alert("Kereskedői importhoz az admin.hasznaltauto.hu Hirdetéseim / járműlista oldal kell.");
      return;
    }

    const pages = [];
    const onAdminHost = /admin\.hasznaltauto\.hu$/i.test(location.hostname.replace(/^www\./, ""));
    const onEditListing = /\/hirdetesfeladas\//i.test(location.pathname || "");
    const onGyorsnezet = /\/gyorsnezet\/[^/]+\/\d{5,}/i.test(location.pathname || "");
    // Egy megnyitott teljes hirdetés (Módosítás) / nyilvános adatlap — élő DOM
    if (onEditListing || onGyorsnezet || (mode === "standard" && isSingleListing())) {
      showProgress(1, 1, "beolvasás");
      const one = await attachPhotoBase64(extractPage());
      if (isUsefulPage(one)) pages.push(one);
    } else if (mode === "dealer" || (onAdminHost && !isPublicListingPage())) {
      showProgress(0, 1, "lista beolvasása");
      const fromList = await collectAllDealerListPages((done, total, label) => showProgress(done, total, label));
      if (!fromList.length) {
        hideProgress();
        const trCount = document.querySelectorAll("table tr, .talalati-sor").length;
        alert(
          `Nem találtunk autót a listán (táblázatsor: ${trCount}). Görgess le a Módosítás / Törlés sorokig, majd próbáld újra.`
        );
        return;
      }
      showProgress(0, fromList.length, "lista feldolgozása");
      for (const card of fromList) {
        if (mode === "dealer") {
          if (card?.listingId) pages.push(card);
        } else if (isUsefulPage(card)) {
          pages.push(card);
        }
      }
      // Mindig teljes hirdetés (Módosítás): a listában gyakran hiányzik márka/km
      // Kereskedői mód: csak első kép — semmi más mező
      if (pages.length) {
        showProgress(0, pages.length, "hirdetés megnyitás");
        const base = pages.slice();
        pages.length = 0;
        const enriched = await mapPool(
          base,
          1,
          async (card) => {
            try {
              const detail = await extractRefPage({
                id: card.listingId,
                adminUrl: card.adminUrl,
                publicUrl: card.publicUrl,
                clickUrl: card.adminUrl || card.clickUrl || card.url,
                visibleTitle: card.visibleTitle,
              });
              const imageUrl =
                upgradeImageUrl((detail && detail.visibleImage) || "") ||
                upgradeImageUrl(card.visibleImage || "") ||
                "";
              const listingId = (detail && detail.listingId) || card.listingId || "";
              const detailUrl =
                (detail && detail.url) || card.adminUrl || card.clickUrl || card.url || "";
              const withPhoto = await attachPhotoBase64({
                url: detailUrl,
                clickUrl: card.clickUrl || card.url || "",
                listingId,
                visibleImage: imageUrl || upgradeImageUrl(card.visibleImage || "") || "",
                adminUrl: card.adminUrl || "",
                publicUrl: card.publicUrl || "",
                photoOnly: true,
              });
              if (!withPhoto.imageJpegBase64 && card.visibleImage) {
                return attachPhotoBase64({
                  ...withPhoto,
                  visibleImage: upgradeImageUrl(card.visibleImage) || card.visibleImage,
                });
              }
              return withPhoto;
            } catch {
              return attachPhotoBase64({
                url: card.adminUrl || card.clickUrl || card.url || "",
                listingId: card.listingId || "",
                visibleImage: upgradeImageUrl(card.visibleImage || "") || "",
                adminUrl: card.adminUrl || "",
                publicUrl: card.publicUrl || "",
                photoOnly: true,
              });
            }
          },
          (done, total) => showProgress(done, total, "kép")
        );
        for (const page of enriched) {
          if (page && page.listingId && (page.imageJpegBase64 || page.visibleImage)) {
            pages.push(page);
          }
        }
        if (!pages.length) {
          for (const card of base) {
            if (!card?.listingId) continue;
            const fallback = await attachPhotoBase64({
              url: card.adminUrl || card.clickUrl || card.url || "",
              listingId: card.listingId,
              visibleImage: upgradeImageUrl(card.visibleImage || "") || "",
              adminUrl: card.adminUrl || "",
              publicUrl: card.publicUrl || "",
              photoOnly: true,
            });
            if (fallback.imageJpegBase64 || fallback.visibleImage) pages.push(fallback);
          }
        }
        if (!pages.length) {
          hideProgress();
          alert(
            `Találtunk ${base.length} autót a listán, de egyikről sem sikerült az első képet menteni. Próbáld újra, vagy nyiss meg egy Módosítás oldalt.`
          );
          return;
        }
      }
    } else {
      const refs = discoverRefs().slice(0, MAX_DEALER);
      if (!refs.length) {
        hideProgress();
        alert(
          mode === "dealer"
            ? "Nem találtunk autót a listán. Görgess le a táblázatig, vagy lapozz, majd próbáld újra."
            : "Nyisd meg a járműlistát (vagy egy hirdetést), görgess le, majd kattints újra."
        );
        return;
      }
      if (mode === "standard" && refs.length === 1 && isPublicListingPage()) {
        showProgress(1, 1, "beolvasás");
        const one = await attachPhotoBase64(extractPage());
        if (isUsefulPage(one)) pages.push(one);
      } else {
        showProgress(0, refs.length, "lista beolvasása");
        const extracted = await mapPool(
          refs,
          FETCH_CONCURRENCY,
          async (ref) => attachPhotoBase64(await extractRefPage(ref)),
          (done, total) => showProgress(done, total, "beolvasás")
        );
        for (const page of extracted) {
          if (isUsefulPage(page)) pages.push(page);
        }
      }
    }

    if (!pages.length) {
      hideProgress();
      alert(
        "Nem sikerült kiolvasni a hirdetés adatait. Görgess a lista végére, hogy látszódjanak az autók, majd futtasd újra."
      );
      return;
    }

    showProgress(pages.length, pages.length, "küldés a Bymy-ra");
    const slim = pages.map(slimPageForDelivery);
    if (mode === "dealer") {
      const ok = await deliverDealerPages(origin, {
        type: "bymy-ha-import",
        v: 1,
        mode,
        photoOnly: true,
        listUrl: location.href,
        pages: slim,
      });
      hideProgress(
        ok
          ? `Kész: ${ok}/${slim.length} autó átadva / mentve a Bymy-n`
          : "A Bymy nem fogadta az adatokat — nézd az Autóimport lapot, majd próbáld újra."
      );
      return;
    }
    deliver(origin, {
      type: "bymy-ha-import",
      v: 1,
      mode,
      photoOnly: false,
      listUrl: location.href,
      pages: slim,
    });
    hideProgress(`Kész: ${pages.length} hirdetés átadva a Bymy-nak`);
  }

  root.BymyHaImport = { run, extractPage, discoverIds, discoverRefs };
})(window);
