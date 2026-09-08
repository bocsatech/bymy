(function (root) {
  const MAX_DEALER = 50;

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
      /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\.hu|regisztr|képkezelés|kepkezeles/i.test(
        v
      ) ||
      /^(19|20)\d{2}(\/\d{1,2})?$/.test(v)
    );
  }

  function isBadTitle(t) {
    const v = clean(t);
    return (
      !v ||
      v.length < 4 ||
      v.length > 240 ||
      /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\.hu|regisztr|képkezelés|kepkezeles/i.test(
        v
      ) ||
      /^(19|20)\d{2}(\/\d{1,2})?$/.test(v) ||
      /^(19|20)\d{2}\/\d{1,2}\b/.test(v) ||
      /\(\d{5,}\)\s*$/.test(v) && /^(19|20)\d{2}/.test(v) ||
      /^(módosítás|törlés|képek|felszereltség|leírás)$/i.test(v)
    );
  }

  function pickTitle(doc) {
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
      "strong",
      "b",
    ];
    for (const sel of selectors) {
      for (const el of doc.querySelectorAll(sel)) {
        const t = titleOf(el);
        const first = t.split("\n").map(clean).find(Boolean) || "";
        if (!isBadTitle(first) && first.length >= 8) return first;
      }
    }
    for (const el of doc.querySelectorAll("dt, td.bal.pontos, th, td.pontos")) {
      const label = textOf(el);
      if (!/c[ií]m|hirdet[eé]s c[ií]me|m[aá]rka|gy[aá]rtm[aá]ny/i.test(label)) continue;
      const val = titleOf(el.nextElementSibling);
      if (!isBadTitle(val) && /c[ií]m/i.test(label)) return val;
    }
    // Gyorsnézet: a cím sokszor nem h1, hanem a body első „autó” sora
    const bodyLines = String(doc.body?.innerText || doc.body?.textContent || "")
      .split("\n")
      .map((line) => clean(line))
      .filter(Boolean);
    for (const line of bodyLines.slice(0, 50)) {
      if (isBadTitle(line)) continue;
      if (/^(bez[aá]r[aá]s|hirdet[eé]s gyors|v[eé]tel[aá]r|[aá]r,?\s*k[oö]lts|gy[aá]rt[aá]si [eé]v|km\.?\s*[oó]ra|j[aá]rm[uű]|motor adatok|okm[aá]ny)/i.test(line))
        continue;
      if (line.length < 10 || line.length > 220) continue;
      if (/\b(?:1\.\d|2\.\d|tdi|gdi|hev|phev|automata|4wd|awd|benzin|d[ií]zel|hybrid|hibrid)\b/i.test(line)) {
        return line;
      }
    }
    const docTitle = clean((doc.title || "").replace(/\s*[|–-].*$/, ""));
    return isBadTitle(docTitle) ? "" : docTitle;
  }

  function pickImage(doc) {
    const og = doc.querySelector('meta[property="og:image"]');
    if (og && og.content && /^https?:/i.test(og.content)) return og.content;
    const imgs = [...doc.querySelectorAll("img")];
    imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
    for (const img of imgs) {
      let src = img.currentSrc || img.src || img.getAttribute("data-src") || "";
      if (src.startsWith("//")) src = "https:" + src;
      if (!src.startsWith("http")) continue;
      if (/close|logo|icon|sprite|placeholder|prototip|static\/images|avatar|badge/i.test(src)) continue;
      if (img.naturalWidth >= 80 || img.width >= 80 || /hasznaltauto|kep|photo|galeria/i.test(src)) return src;
    }
    return "";
  }

  function pickDescription(doc) {
    for (const sel of ["textarea", '[class*="leiras"]', '[class*="description"]', '[id*="leiras"]']) {
      for (const el of doc.querySelectorAll(sel)) {
        const t = clean(el.value || el.innerText || el.textContent || "");
        if (t.length >= 20 && !/^leírás$/i.test(t) && !/megtekinthető telefonon/i.test(t)) return t;
      }
    }
    const body = (doc.body?.innerText || doc.body?.textContent || "").replace(/\r\n/g, "\n");
    const m = body.match(
      /(?:^|\n)\s*Leírás\s*\n+([\s\S]{8,4000}?)(?=\n\s*(?:Felszereltség|Általános|Műszaki|Megtalálható|Okmányok|Hirdetés)\b|$)/i
    );
    if (m) {
      const t = clean(m[1]);
      if (t.length >= 20 && !/megtekinthető telefonon/i.test(t)) return t;
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

  function addPair(map, rawKey, rawValue) {
    const key = clean(rawKey).replace(/:$/, "");
    const value = clean(rawValue);
    if (!key || !value || key.length > 80 || value.length > 220) return;
    if (/válasszon/i.test(value)) return;
    if (value.length > 100 && value.split(/\s+/).length > 10) return;
    if (/^(ár|ar|költségek|altalanos adatok|muszaki adatok|felszereltseg|felszereltség|beltér|belter|műszaki|muszaki|kültér|kulter|egyéb|egyeb|hiba!?)$/i.test(key))
      return;
    const existing = map[key];
    const isName = /m[aá]rka|gy[aá]rtm[aá]ny|modell/i.test(key);
    if (!existing || (isName && existing.length > value.length) || (!isName && existing.length < value.length)) {
      map[key] = value;
    }
  }

  function extractEquipment(doc) {
    const items = [];
    const push = (raw) => {
      const t = clean(raw);
      if (!t || t.length < 2 || t.length > 60) return;
      if (/^(beltér|belter|műszaki|muszaki|kültér|kulter|multimédia|multimedia|egyéb|egyeb|felszereltség|leírás)$/i.test(t))
        return;
      if (!items.includes(t)) items.push(t);
    };
    for (const sel of [
      ".hirdetes-felszereltseg li",
      ".felszereltseg-list li",
      "[class*='felszer'] li",
      "[class*='extra'] li",
      ".extranev",
      ".extra-badge",
      ".tooltip-badge",
    ]) {
      for (const node of doc.querySelectorAll(sel)) push(node.innerText || node.textContent);
    }
    const body = String(doc.body?.innerText || "").replace(/\r\n/g, "\n");
    const sectionRe =
      /(?:^|\n)\s*(Beltér|Műszaki|Kültér|Multimédia\s*\/\s*Navigáció|Egyéb információ)\s*\n([\s\S]*?)(?=\n\s*(?:Beltér|Műszaki|Kültér|Multimédia|Egyéb információ|Leírás|Általános|Hirdetés)\b|$)/gi;
    for (const match of body.matchAll(sectionRe)) {
      for (const line of String(match[2] || "").split("\n")) {
        const t = clean(line);
        if (t && !/:$/.test(t) && t.split(/\s+/).length <= 8) push(t);
      }
    }
    return items.slice(0, 200);
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
    return /^(?:\d+[.,]?\d*|t-?gdi|gdi|tdi|cdi|dci|hev|phev|mhev|bhev|gt|line|4wd|awd|2wd|fwd|rwd|xdrive|quattro|automata|manual|manu[aá]lis|full|led|panor[aá]ma|b[oő]r|navi|hybrid|hibrid)(?:\b|$)/i.test(
      v
    );
  }

  function brandModelFromTitle(title) {
    const parts = String(title || "")
      .split(/\n+/)[0]
      .split(/\s+/)
      .filter(Boolean);
    let brand = "";
    let model = "";
    for (let i = 0; i < parts.length; i += 1) {
      if (isChromeName(parts[i]) || looksLikeSpecToken(parts[i])) continue;
      if (!brand) {
        brand = parts[i];
        continue;
      }
      if (!looksLikeSpecToken(parts[i])) {
        model = parts[i];
      }
      break;
    }
    return { brand, model };
  }

  function extractFromDoc(doc, href) {
    const map = extractMap(doc);
    const title = pickTitle(doc) || fieldFromMap(map, ["Cím", "Hirdetés címe"]);
    const brandRaw = fieldFromMap(map, ["Márka", "Gyártmány"]) || "";
    const modelRaw = fieldFromMap(map, ["Modell"]) || "";
    const fromTitle = brandModelFromTitle(title);
    const brand = isChromeName(brandRaw) ? fromTitle.brand : brandRaw;
    const model = isChromeName(modelRaw) ? fromTitle.model : modelRaw;
    const price =
      fieldFromMap(map, ["Vételár", "Hirdetési ár", "Ár"]) ||
      ((doc.body?.innerText || doc.body?.textContent || "").match(/(\d[\d\s.]{3,})\s*Ft/i) || [])[1] ||
      "";
    const km = fieldFromMap(map, ["Futásteljesítmény", "Kilométeróra", "Km. óra állás"]);
    const yearRaw = fieldFromMap(map, ["Évjárat", "Gyártási év"]);
    const year = (yearRaw.match(/(19|20)\d{2}/) || [])[0] || "";
    const fuel = fieldFromMap(map, ["Üzemanyag"]);
    const rawHtml = doc.documentElement?.outerHTML || "";
    const html = rawHtml.slice(0, Object.keys(map).length >= 6 ? 8000 : 40000);
    const felszereltseg = extractEquipment(doc);
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
      map,
      felszereltseg,
      bodyText: String(doc.body?.innerText || doc.body?.textContent || "").slice(0, 12000),
    };
  }

  function slimPageForDelivery(page) {
    if (!page || typeof page !== "object") return page;
    const mapCount = page.map && typeof page.map === "object" ? Object.keys(page.map).length : 0;
    const hasBody = String(page.bodyText || "").length >= 400;
    const html = mapCount >= 5 || hasBody ? "" : String(page.html || "").slice(0, 20000);
    return {
      url: page.url || "",
      listingId: page.listingId || "",
      visibleTitle: page.visibleTitle || page.title || "",
      visibleImage: page.visibleImage || "",
      visibleDescription: page.visibleDescription || page.description || "",
      price: page.price || "",
      km: page.km || "",
      year: page.year || "",
      fuel: page.fuel || "",
      brand: page.brand || "",
      model: page.model || "",
      map: page.map && typeof page.map === "object" ? page.map : {},
      felszereltseg: Array.isArray(page.felszereltseg) ? page.felszereltseg.slice(0, 120) : [],
      bodyText: String(page.bodyText || "").slice(0, 12000),
      html,
      fromListCard: Boolean(page.fromListCard),
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
          "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/" + n,
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
        if (/\/gyorsnezet\//i.test(u.pathname)) {
          add(id, { adminUrl: `${u.origin}${u.pathname}` });
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
      if (/\/gyorsnezet\//i.test(location.href)) add(self, { adminUrl: location.href.split("?")[0] });
      else if (isPublicListingPage()) add(self, { publicUrl: location.href.split("?")[0] });
      else add(self);
    }
    return Object.values(byId);
  }

  function discoverIds(html, pageUrl) {
    return discoverRefs().map((ref) => ({ id: ref.id, adminUrl: ref.adminUrl }));
  }

  const GYORS_CATS = [
    "szemelyauto",
    "kishaszonjarmu",
    "haszonjarmu",
    "motorkerekpar",
    "lakokocsi",
    "agro",
  ];

  function adminGyorsUrls(id, preferred) {
    const n = String(id || "").replace(/\D/g, "");
    if (!n) return [];
    const out = [];
    const push = (url) => {
      const u = String(url || "").trim();
      if (u && !out.includes(u)) out.push(u);
    };
    push(preferred);
    for (const cat of GYORS_CATS) {
      push(`https://admin.hasznaltauto.hu/gyorsnezet/${cat}/${n}`);
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

  function extractDealerListPages() {
    const byId = {};
    const rowNodes = [
      ...document.querySelectorAll(
        "table tbody tr, table tr, .talalati-sor, [class*='hirdetes'] tr, [class*='jarmu'] tr, [class*='list'] tr, article, li, [class*='row']"
      ),
    ];
    for (const row of rowNodes) {
      const text = String(row.innerText || "");
      if (text.length < 12) continue;
      if (!/m[oó]dos[ií]t[aá]s|t[oö]rl[eé]s|gyorsn[eé]zet|[aá]rt[aá]bla|lexus|kia|mercedes|bmw|audi|ford|opel|toyota|volkswagen|skoda|hyundai/i.test(text))
        continue;
      if (/menü|navig|belép|kijelent|^ssz/i.test(text) && text.length < 40) continue;

      const id = pickIdFromRow(row);
      if (id.length < 5) continue;

      let adminUrl = "";
      let publicUrl = "";
      for (const a of row.querySelectorAll("a[href]")) {
        const href = String(a.href || "");
        try {
          const u = new URL(href);
          const host = u.hostname.replace(/^www\./, "").toLowerCase();
          if (host.startsWith("admin.") && /\/gyorsnezet\//i.test(u.pathname)) {
            adminUrl = `${u.origin}${u.pathname}`;
          } else if (host.endsWith("hasznaltauto.hu") && !host.startsWith("admin.") && pickListingId(href)) {
            publicUrl = `${u.origin}${u.pathname}`;
          }
        } catch {
        }
      }

      const lines = text
        .split("\n")
        .map((line) => clean(line))
        .filter(Boolean);
      const title =
        lines.find((line) => {
          if (isBadTitle(line)) return false;
          if (/m[oó]dos[ií]t|t[oö]rl[eé]s|[aá]rt[aá]bla|kiemel|megtekint|lefoglal|inakt[ií]v|akt[ií]v|top\b|ssz\.|sorsz|megtekintve|találat/i.test(line))
            return false;
          if (/^\d+([.\s]\d+){0,3}\s*(ft|€)?$/i.test(line)) return false;
          if (/^\d{5,}$/.test(line)) return false;
          return /[a-záéíóöőúüű]{2,}/i.test(line) && line.length >= 5 && line.length <= 100;
        }) || "";

      const priceMatch = text.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{5,})\s*Ft/i);
      const price = priceMatch ? priceMatch[1].replace(/[.\s]/g, "") : "";
      const km = (text.match(/(\d[\d\s.]*)\s*km/i) || [])[0] || "";
      const year = (text.match(/\b((?:19|20)\d{2})(?:\/\d{1,2})?\b/) || [])[1] || "";
      let imageUrl = "";
      const img = row.querySelector("img[src], img[data-src], img[data-lazy]");
      const raw = img?.currentSrc || img?.src || img?.getAttribute("data-src") || img?.getAttribute("data-lazy") || "";
      if (/^https?:\/\//i.test(raw) && !/logo|icon|sprite|badge/i.test(raw)) imageUrl = raw;

      const page = {
        url: publicUrl || adminUrl || `https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/${id}`,
        listingId: id,
        visibleTitle: title,
        visibleImage: imageUrl,
        price,
        km,
        year,
        map: {},
        bodyText: clean(text).slice(0, 2500),
        felszereltseg: [],
        html: "",
        fromListCard: true,
        adminUrl: adminUrl || `https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/${id}`,
        publicUrl,
      };
      if (!isUsefulPage(page)) continue;
      const prev = byId[id];
      if (!prev || clean(page.visibleTitle).length > clean(prev.visibleTitle || "").length) {
        byId[id] = page;
      }
    }
    return Object.values(byId);
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
      if (onAdmin) {
        for (const u of adminGyorsUrls(ref.id, ref.adminUrl)) push(u);
        push(ref.publicUrl);
      } else {
        push(ref.publicUrl);
        for (const u of adminGyorsUrls(ref.id, ref.adminUrl)) push(u);
      }
      for (const url of candidates.slice(0, onAdmin ? 3 : 4)) {
        try {
          const page = await extractFromUrl(url);
          if (isUsefulPage(page)) {
            page.listingId = page.listingId || ref.id;
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

  const FETCH_CONCURRENCY = 8;

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
        target.postMessage(body, origin);
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
        if (n >= 12) clearInterval(timer);
      }, 500);
    };

    if (window.opener && !window.opener.closed && sendTo(window.opener)) {
      retrySend(window.opener);
      return;
    }

    const targetUrl = `${origin}/beallitasok.html?szekcio=import&ha=1`;
    let w = null;
    try {
      w = window.open("about:blank", "bymy-ha-import");
    } catch {
      w = null;
    }
    if (!w || w === window) {
      alert(
        "Nem sikerült új Bymy lapot nyitni (a hasznaltauto oldal így nyitva marad). Nyisd meg külön lapon a Bymy Autóimportot, majd futtasd újra a könyvjelzőt — vagy engedélyezd a felugró ablakot."
      );
      return;
    }
    try {
      w.location.href = targetUrl;
    } catch {
      try {
        w.location.replace(targetUrl);
      } catch {
        alert("A Bymy lapot nem sikerült megnyitni. A hasznaltauto oldal nyitva maradt.");
        return;
      }
    }
    sendTo(w);
    retrySend(w);
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
    const onGyorsnezet = /\/gyorsnezet\/[^/]+\/\d{5,}/i.test(location.pathname || "");
    // Egy megnyitott gyorsnézet / nyilvános adatlap — élő DOM (cím = KIA SPORTAGE…)
    if (onGyorsnezet || (mode === "standard" && isSingleListing())) {
      showProgress(1, 1, "beolvasás");
      const one = extractPage();
      if (isUsefulPage(one)) pages.push(one);
    } else if (mode === "dealer" || (onAdminHost && !isPublicListingPage())) {
      showProgress(0, 1, "lista beolvasása");
      const fromList = extractDealerListPages().slice(0, MAX_DEALER);
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
        if (isUsefulPage(card)) pages.push(card);
      }
      // Mindig gyorsnézet: a listában gyakran nincs márka, a cím a gyorsnézetben van
      if (pages.length) {
        showProgress(0, pages.length, "gyorsnézet kiegészítés");
        const base = pages.slice();
        pages.length = 0;
        const enriched = await mapPool(
          base,
          3,
          async (card) => {
            try {
              const detail = await extractRefPage({
                id: card.listingId,
                adminUrl: card.adminUrl,
                publicUrl: card.publicUrl,
              });
              if (!detail || !isUsefulPage(detail)) return card;
              const detailTitle = clean(detail.visibleTitle || "");
              const keepTitle =
                detailTitle && !isBadTitle(detailTitle) ? detailTitle : card.visibleTitle;
              const detailMapCount =
                detail.map && typeof detail.map === "object" ? Object.keys(detail.map).length : 0;
              const brand = detail.brand || card.brand || brandModelFromTitle(keepTitle).brand;
              const model = detail.model || card.model || brandModelFromTitle(keepTitle).model;
              const detailOk =
                (brand && !isChromeName(brand)) ||
                (keepTitle && !isBadTitle(keepTitle) && detailMapCount >= 3);
              return {
                ...card,
                visibleTitle: keepTitle,
                visibleImage: detail.visibleImage || card.visibleImage,
                price: detail.price || card.price,
                km: detail.km || card.km,
                year: detail.year || card.year,
                fuel: detail.fuel || card.fuel,
                brand,
                model,
                map: detailMapCount >= 5 ? detail.map : { ...(card.map || {}), ...(detail.map || {}) },
                html: String(detail.html || "").length > 800 ? detail.html : card.html,
                bodyText: detail.bodyText || card.bodyText,
                felszereltseg:
                  Array.isArray(detail.felszereltseg) && detail.felszereltseg.length
                    ? detail.felszereltseg
                    : card.felszereltseg,
                listingId: detail.listingId || card.listingId,
                fromListCard: !detailOk,
              };
            } catch {
              return card;
            }
          },
          (done, total) => showProgress(done, total, "gyorsnézet")
        );
        for (const page of enriched) {
          if (isUsefulPage(page)) pages.push(page);
          else if (isUsefulPage(base.find((c) => c.listingId === page?.listingId) || null)) {
            pages.push(base.find((c) => c.listingId === page.listingId));
          }
        }
        if (!pages.length) {
          for (const card of base) {
            if (isUsefulPage(card)) pages.push(card);
          }
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
        const one = extractPage();
        if (isUsefulPage(one)) pages.push(one);
      } else {
        showProgress(0, refs.length, "lista beolvasása");
        const extracted = await mapPool(
          refs,
          FETCH_CONCURRENCY,
          (ref) => extractRefPage(ref),
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
    deliver(origin, {
      type: "bymy-ha-import",
      v: 1,
      mode,
      listUrl: location.href,
      pages: pages.map(slimPageForDelivery),
    });
    hideProgress(`Kész: ${pages.length} hirdetés átadva a Bymy-nak`);
  }

  root.BymyHaImport = { run, extractPage, discoverIds, discoverRefs };
})(window);
