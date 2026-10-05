// Browser Runtime.evaluate snippet — returns extract object from HA public detail page.
(() => {
  const clean = (s) => String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const h1 = clean(document.querySelector("h1")?.innerText || "");
  const pairs = {};
  for (const item of document.querySelectorAll(".print-basic-info-item")) {
    const label = clean(item.querySelector(".print-basic-info-item__label")?.innerText || "");
    const cols = item.querySelectorAll(":scope > .row > [class*=col]");
    let val = "";
    if (cols.length >= 2) val = clean(cols[1].innerText);
    else {
      const clone = item.cloneNode(true);
      clone.querySelector(".print-basic-info-item__label")?.remove();
      val = clean(clone.innerText);
    }
    if (label && val && val.length <= 500) pairs[label] = val;
  }
  for (const row of document.querySelectorAll("tr")) {
    const cells = [...row.querySelectorAll("th,td")];
    if (cells.length < 2) continue;
    const key = clean(cells[0].innerText).replace(/:$/, "");
    const val = clean(cells[cells.length - 1].innerText);
    if (key && val && val.length <= 500 && !pairs[key]) pairs[key] = val;
  }
  const equip = [];
  const hs = [...document.querySelectorAll("h2,h3")];
  const eh = hs.find((x) => /felszereltség/i.test(x.innerText || ""));
  if (eh) {
    let n = eh.nextElementSibling;
    for (let i = 0; i < 25 && n && !/^H2$/i.test(n.tagName); i++, n = n.nextElementSibling) {
      for (const li of n.querySelectorAll("li")) {
        const t = clean(li.innerText || "");
        if (t.length >= 2 && t.length <= 90 && !equip.includes(t)) equip.push(t);
      }
    }
  }
  let desc = "";
  const dh = hs.find((x) => /^\s*leírás\s*$/i.test(clean(x.innerText)));
  if (dh) {
    const block = dh.nextElementSibling;
    desc = clean(block?.innerText || "")
      .replace(/\s*Bővebben\s*$/i, "")
      .slice(0, 8000);
  }
  const hq = [];
  for (const img of document.querySelectorAll(
    'img[src*="hasznaltautocdn"],img[data-src*="hasznaltautocdn"]'
  )) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    const m = src.match(
      /hasznaltautocdn\.com\/(?:\d{2,4}x\d{2,4}\/)?(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)/i
    );
    if (!m) continue;
    const u = `https://img.hasznaltautocdn.com/2048x1536/${m[1]}/${m[2]}.jpg`;
    if (!hq.includes(u)) hq.push(u);
  }
  return {
    title: h1,
    priceText: pairs["Vételár"] || "",
    pairs,
    equip: equip.slice(0, 300),
    desc,
    hq: hq.slice(0, 20),
    url: location.href.split("#")[0],
  };
})()
