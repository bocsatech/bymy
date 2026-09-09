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

  /** Ugyanaz a logika, mint lib/ha-dealer-cdn-extract.mjs (bookmarklet nem importál ESM-et). */
  function extractCarsFromHtml(html) {
    const re =
      /(?:https?:)?\/\/(?:img\.)?hasznaltautocdn\.com\/(?:\d{2,4}x\d{2,4}\/)?(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)/gi;
    const byId = new Map();
    let m;
    while ((m = re.exec(String(html || "")))) {
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
    return [...byId.values()];
  }

  function extractCarsFromPage() {
    const chunks = [String(document.documentElement?.outerHTML || "")];
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
    // style background
    for (const el of document.querySelectorAll("[style*='hasznaltautocdn'], [style*='url(']")) {
      chunks.push(el.getAttribute("style") || "");
    }
    return extractCarsFromHtml(chunks.join("\n")).slice(0, MAX);
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
        const result = await saveOne(origin, token, cars[i], i + 1, cars.length);
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
