/**
 * Könyvjelző: a hasznaltauto.hu oldalon fut, kiolvassa a hirdetést,
 * majd átadja a Bymy Autóimport ablaknak (postMessage).
 */
(function (root) {
  const MAX_DEALER = 50;

  function clean(t) {
    return String(t || "").replace(/\s+/g, " ").trim();
  }

  /** Cím: sortörések megmaradnak (1. sor márka/modell/típus, 2. sor → típus). */
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
    return !v || /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\.hu|regisztr/i.test(v);
  }

  function isBadTitle(t) {
    const v = clean(t);
    return (
      !v ||
      v.length < 4 ||
      v.length > 240 ||
      /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\.hu|regisztr/i.test(v)
    );
  }

  function pickTitle(doc) {
    const og = doc.querySelector('meta[property="og:title"]');
    if (og && og.content && !isBadTitle(clean(og.content))) {
      return clean(og.content).replace(/\s*[|–-].*$/, "");
    }
    const selectors = [
      "h1",
      "h2",
      '[class*="hirdetes"][class*="cim"]',
      '[class*="title"]',
      '[class*="cim"]',
      ".jarmu-adat h1",
      ".adatlap h1",
    ];
    for (const sel of selectors) {
      for (const el of doc.querySelectorAll(sel)) {
        const t = titleOf(el);
        if (!isBadTitle(t)) return t;
      }
    }
    for (const el of doc.querySelectorAll("dt, td.bal.pontos, th, td.pontos")) {
      const label = textOf(el);
      if (!/c[ií]m|hirdet[eé]s c[ií]me|m[aá]rka|gy[aá]rtm[aá]ny/i.test(label)) continue;
      const val = titleOf(el.nextElementSibling);
      if (!isBadTitle(val) && /c[ií]m/i.test(label)) return val;
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
    if (!key || !value || key.length > 80 || value.length > 200) return;
    if (/válasszon/i.test(value)) return;
    if (value.length > 70 && value.split(/\s+/).length > 6) return;
    if (/^(ár|ar|költségek|altalanos adatok|muszaki adatok|felszereltseg|felszereltség|hiba!?)$/i.test(key)) return;
    const existing = map[key];
    const isName = /m[aá]rka|gy[aá]rtm[aá]ny|modell/i.test(key);
    if (!existing || (isName && existing.length > value.length) || (!isName && existing.length < value.length)) {
      map[key] = value;
    }
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
      const match = line.match(/^(.{2,50}?):\s*(.{1,200})$/);
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
    m = u.match(/-(\d{5,})(?:\?|$)/);
    return m ? m[1] : "";
  }

  function extractFromDoc(doc, href) {
    const map = extractMap(doc);
    const title = pickTitle(doc) || fieldFromMap(map, ["Cím", "Hirdetés címe"]);
    const brandRaw = fieldFromMap(map, ["Márka", "Gyártmány"]) || "";
    const modelRaw = fieldFromMap(map, ["Modell"]) || "";
    const titleParts = title.split(/\s+/).filter(Boolean);
    const brand = isChromeName(brandRaw) ? (isChromeName(titleParts[0]) ? "" : titleParts[0] || "") : brandRaw;
    const model = isChromeName(modelRaw) ? "" : modelRaw;
    const price =
      fieldFromMap(map, ["Vételár", "Hirdetési ár", "Ár"]) ||
      ((doc.body?.innerText || doc.body?.textContent || "").match(/(\d[\d\s.]{3,})\s*Ft/i) || [])[1] ||
      "";
    const km = fieldFromMap(map, ["Futásteljesítmény", "Kilométeróra", "Km. óra állás"]);
    const yearRaw = fieldFromMap(map, ["Évjárat", "Gyártási év"]);
    const year = (yearRaw.match(/(19|20)\d{2}/) || [])[0] || "";
    const fuel = fieldFromMap(map, ["Üzemanyag"]);
    const rawHtml = doc.documentElement?.outerHTML || "";
    const html = rawHtml.slice(0, Object.keys(map).length >= 8 ? 80000 : 220000);
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
      bodyText: String(doc.body?.innerText || doc.body?.textContent || "").slice(0, 20000),
    };
  }

  function extractPage() {
    return extractFromDoc(document, location.href);
  }

  function discoverIds(html, pageUrl) {
    const byId = {};
    const source = String(html || document.documentElement.outerHTML || "");
    const add = (id) => {
      const n = String(id || "").replace(/\D/g, "");
      if (n.length < 5) return;
      byId[n] = {
        id: n,
        adminUrl: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/" + n,
      };
    };
    for (const m of source.matchAll(/\/gyorsnezet\/[^/"'\s]+\/(\d{5,})/gi)) add(m[1]);
    for (const m of source.matchAll(/\/szemelyauto\/[^"'?\s]+-(\d{5,})/gi)) add(m[1]);
    for (const m of source.matchAll(/data-(?:id|hirdetesid|adid)=["'](\d{5,})["']/gi)) add(m[1]);
    const self = pickListingId(pageUrl || location.href);
    if (self) add(self);
    return Object.values(byId);
  }

  function isSingleListing() {
    const href = location.href.toLowerCase();
    if (href.includes("/gyorsnezet/")) return true;
    if (/\/szemelyauto\/.+-\d{5,}/i.test(href)) return true;
    return discoverIds().length <= 1 && Boolean(pickListingId(location.href));
  }

  async function extractFromUrl(url) {
    const res = await fetch(url, { credentials: "include" });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return extractFromDoc(doc, url);
  }

  function deliver(origin, payload) {
    const sendTo = (target) => {
      if (!target || target.closed) return;
      try {
        target.postMessage(payload, origin);
      } catch {
        /* ignore */
      }
    };
    sendTo(window.opener);
    const w = window.open(`${origin}/import.html?ha=1`, "bymy-ha-import");
    if (!w) {
      if (!window.opener || window.opener.closed) {
        alert("Engedélyezd a felugró ablakot, vagy illeszd be a hirdetés URL-jét a Bymy Autóimport oldalon.");
      }
      return;
    }
    sendTo(w);
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      sendTo(w);
      if (n >= 2) clearInterval(timer);
    }, 700);
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
    if (mode === "standard" && isSingleListing()) {
      pages.push(extractPage());
    } else {
      const refs = discoverIds().slice(0, MAX_DEALER);
      if (!refs.length) {
        alert(
          mode === "dealer"
            ? "Nem találtunk autót a listán. Görgess le a táblázatig, vagy lapozz, majd próbáld újra."
            : "Nyisd meg egy autó gyorsnézetét / hirdetés oldalát, majd kattints újra."
        );
        return;
      }
      if (mode === "standard" && refs.length === 1) {
        pages.push(extractPage());
      } else {
        for (let i = 0; i < refs.length; i += 1) {
          try {
            pages.push(await extractFromUrl(refs[i].adminUrl));
          } catch {
            /* skip one */
          }
        }
      }
    }

    if (!pages.length) {
      alert("Nem sikerült kiolvasni a hirdetést.");
      return;
    }

    deliver(origin, {
      type: "bymy-ha-import",
      v: 1,
      mode,
      listUrl: location.href,
      pages,
    });
  }

  root.BymyHaImport = { run, extractPage, discoverIds };
})(window);
