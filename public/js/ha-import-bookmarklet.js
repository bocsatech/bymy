/**
 * Könyvjelző: a hasznaltauto.hu oldalon fut, kiolvassa a hirdetést,
 * majd átadja a Bymy Autóimport ablaknak (postMessage).
 */
(function (root) {
  const MAX_DEALER = 50;

  function clean(t) {
    return String(t || "").replace(/\s+/g, " ").trim();
  }

  function isBadTitle(t) {
    return (
      !t ||
      t.length < 4 ||
      t.length > 140 ||
      /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\.hu|regisztr/i.test(t)
    );
  }

  function pickTitle() {
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content && !isBadTitle(clean(og.content))) {
      return clean(og.content).replace(/\s*[|–-].*$/, "");
    }
    const selectors = ["h1", "h2", '[class*="hirdetes"][class*="cim"]', '[class*="title"]', '[class*="cim"]', ".jarmu-adat h1", ".adatlap h1"];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const t = clean(el.innerText || el.textContent || "");
        if (!isBadTitle(t)) return t;
      }
    }
    const docTitle = clean((document.title || "").replace(/\s*[|–-].*$/, ""));
    return isBadTitle(docTitle) ? "" : docTitle;
  }

  function pickImage() {
    const og = document.querySelector('meta[property="og:image"]');
    if (og && og.content && /^https?:/i.test(og.content)) return og.content;
    const imgs = [...document.querySelectorAll("img")];
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

  function fieldAfter(label) {
    const rows = document.querySelectorAll("tr, dl > *");
    for (const row of rows) {
      const text = clean(row.innerText || "");
      if (!text) continue;
      const re = new RegExp("^" + label + "\\s*[:\\n]\\s*(.+)$", "i");
      const m = text.match(re);
      if (m) return clean(m[1].split("\n")[0]);
    }
    const body = document.body.innerText || "";
    const re = new RegExp(label + "\\s*[:\\n]\\s*([^\\n]{1,80})", "i");
    const m = body.match(re);
    return m ? clean(m[1]) : "";
  }

  function pickListingId(href) {
    const u = String(href || location.href);
    let m = u.match(/\/gyorsnezet\/[^/]+\/(\d{5,})/i);
    if (m) return m[1];
    m = u.match(/-(\d{5,})(?:\?|$)/);
    return m ? m[1] : "";
  }

  function pickImageJpeg() {
    const imgs = [...document.querySelectorAll("img")];
    imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
    for (const img of imgs) {
      try {
        if ((img.naturalWidth || img.width || 0) < 120) continue;
        const src = img.currentSrc || img.src || "";
        if (/close|logo|icon|sprite|placeholder/i.test(src)) continue;
        const c = document.createElement("canvas");
        const w = Math.min(img.naturalWidth || img.width || 800, 1600);
        const h = Math.round(
          w * ((img.naturalHeight || img.height || 600) / Math.max(img.naturalWidth || img.width || 1, 1))
        );
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        const data = c.toDataURL("image/jpeg", 0.82);
        if (data && data.length > 2000) return data;
      } catch {
        /* tainted canvas */
      }
    }
    return "";
  }

  function extractPage() {
    const title = pickTitle();
    const parts = title.split(/\s+/).filter(Boolean);
    const priceMatch = (document.body.innerText || "").match(/(\d[\d\s.]{3,})\s*Ft/i);
    return {
      url: location.href,
      html: (document.documentElement.outerHTML || "").slice(0, 180000),
      listingId: pickListingId(),
      visibleTitle: title,
      visibleImage: pickImage(),
      visibleDescription: "",
      price: priceMatch ? priceMatch[1] : fieldAfter("Ár") || fieldAfter("Vételár"),
      km: fieldAfter("Kilométeróra") || fieldAfter("Km") || fieldAfter("Futásteljesítmény"),
      year: (fieldAfter("Évjárat") || fieldAfter("Gyártási év") || "").match(/(19|20)\d{2}/)?.[0] || "",
      fuel: fieldAfter("Üzemanyag") || "",
      brand: parts[0] || "",
      model: parts[1] || "",
      imageJpegBase64: pickImageJpeg(),
    };
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
    return discoverIds().length <= 1 && Boolean(pickListingId());
  }

  async function extractFromUrl(url) {
    const res = await fetch(url, { credentials: "include" });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = clean(
      doc.querySelector("h1")?.textContent ||
        doc.querySelector('meta[property="og:title"]')?.content ||
        ""
    ).replace(/\s*[|–-].*$/, "");
    const ogImg = doc.querySelector('meta[property="og:image"]')?.content || "";
    const text = clean(doc.body?.innerText || doc.body?.textContent || "");
    const price = (text.match(/(\d[\d\s.]{3,})\s*Ft/i) || [])[1] || "";
    const km = (text.match(/([\d\s.]+)\s*km/i) || [])[1] || "";
    const year = (text.match(/\b((?:19|20)\d{2})\b/) || [])[1] || "";
    const parts = title.split(/\s+/).filter(Boolean);
    return {
      url,
      html: html.slice(0, 180000),
      listingId: pickListingId(url),
      visibleTitle: title,
      visibleImage: /^https?:/i.test(ogImg) ? ogImg : "",
      visibleDescription: "",
      price,
      km,
      year,
      fuel: "",
      brand: parts[0] || "",
      model: parts[1] || "",
    };
  }

  function deliver(origin, payload) {
    let delivered = false;
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(payload, origin);
        delivered = true;
      } catch {
        delivered = false;
      }
    }
    const w = window.open(origin + "/import.html?ha=1", "bymy-ha-import");
    if (!w) {
      if (!delivered) alert("Engedélyezd a felugró ablakot, vagy illeszd be a hirdetés URL-jét a Bymy Autóimport oldalon.");
      return;
    }
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      try {
        w.postMessage(payload, origin);
      } catch {
        /* ignore */
      }
      if (n >= 25) clearInterval(timer);
    }, 350);
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
