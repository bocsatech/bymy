import { fetchListing, fetchListings, recordListingView, deleteListingFromDb } from "./db-client.js?v=openFast3";
import { getAuthUser, getDisplayName, getProfile } from "./site-auth.js?v=auth20260805localdb9";
import { startConversation, sendMessage } from "./messages-api.js?v=msgLive1";
import { canMessageListing, openListingMessage } from "./start-listing-message.js?v=msgLive1";
import { getParkplatz, addParkplatzItem, removeParkplatzItem } from "./fok-data.js?v=auth20260805localdb9";
import { listingReturnHref, listingDetailHref, rememberListingOpen } from "./listing-return.js?v=scrollTop1";

const root = document.getElementById("hd-root");
const ICON = {
  back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6 9 12l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  prev: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  star: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m12 3.6 2.1 4.4 4.8.5-3.6 3.1 1.1 4.7L12 14.2 7.6 16.3l1.1-4.7-3.6-3.1 4.8-.5L12 3.6Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
  share: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 8a3 3 0 1 0-2.8-4M8 12a3 3 0 1 0 0 0.01M16 20a3 3 0 1 0-2.8-4M8.7 13.2l6.6 3.6M15.3 7.2l-6.6 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  print: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 8V5h10v3M6 14h12v5H6v-5Z" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 9h14.4A1.7 1.7 0 0 1 21 10.7v4.2h-3M3 14.9V10.7A1.7 1.7 0 0 1 4.8 9" stroke="currentColor" stroke-width="1.6"/></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4V7Z" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6"/></svg>`,
  phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6.5 4.8h3.2l1.1 3.2-1.8 1.1a12 12 0 0 0 6 6l1.1-1.8 3.2 1.1v3.2A2 2 0 0 1 17.3 20 15 15 0 0 1 4 6.7 2 2 0 0 1 6.5 4.8Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value.includes("T") ? value : `${value}Z`).toLocaleString("hu-HU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

/** Breadcrumb címke: ne legyen végig nagybetűs márkanév. */
function formatCrumbLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw !== raw.toLocaleUpperCase("hu-HU")) return raw;
  return raw
    .toLocaleLowerCase("hu-HU")
    .split(/([\s/-]+)/)
    .map((part) => {
      if (/^[\s/-]+$/.test(part) || !part) return part;
      return part.charAt(0).toLocaleUpperCase("hu-HU") + part.slice(1);
    })
    .join("");
}

function currentUserId() {
  const id = Number(getAuthUser()?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function kvHtml(rows) {
  if (!rows?.length) return "";
  return `<dl class="hd-grid">${rows
    .map(
      (row) =>
        `<div class="hd-kv"><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`
    )
    .join("")}</dl>`;
}

function relatedCard(item) {
  const p = item.preview || {};
  const title = p.title || item.hirdetes_cime || `Hirdetés #${item.id}`;
  const year = p.filter?.gyartasi_ev || "";
  const km = p.km || "";
  const le = p.filter?.teljesitmeny_le ? `${p.filter.teljesitmeny_le} LE` : "";
  const spec = [year, km, le].filter(Boolean).join(", ");
  const img = p.imageUrl || item.fo_kep || "";
  return `<a class="hd-rel" data-listing-id="${item.id}" href="${listingDetailHref(item.id)}">
    ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" />` : `<div class="hd-rel-empty"></div>`}
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(spec)}</span>
    <b>${escapeHtml(p.price || "—")}</b>
  </a>`;
}

function applyRelated(view, related) {
  if (!related.length || !root) return;

  const aside = root.querySelector(".hd-side") || root.querySelector("aside");
  if (aside && !aside.querySelector('a[href="#hd-related"]')) {
    const link = document.createElement("a");
    link.className = "hd-btn hd-btn--ghost";
    link.href = "#hd-related";
    link.textContent = `Több ettől a hirdetőtől ${related.length}`;
    const owner = aside.querySelector(".hd-owner");
    if (owner) aside.insertBefore(link, owner);
    else aside.appendChild(link);
  }

  if (document.getElementById("hd-related")) return;

  const section = document.createElement("section");
  section.className = "hd-section";
  section.id = "hd-related";
  section.innerHTML = `
    <div class="hd-related-head">
      <h2 class="hd-h2">Több ettől a hirdetőtől</h2>
      <a class="hd-more" href="${escapeHtml(view.categoryHref)}">Több megjelenítése</a>
    </div>
    <div class="hd-related">${related.map(relatedCard).join("")}</div>
  `;
  const dealer = root.querySelector(".hd-dealer");
  if (dealer) root.insertBefore(section, dealer);
  else root.appendChild(section);

  section.querySelectorAll("a[data-listing-id]").forEach((a) => {
    a.addEventListener("click", () => rememberListingOpen(a.dataset.listingId, a));
  });
}

async function loadRelatedInBackground(listingId, view) {
  if (!view?.userId) return;
  // Ne versenyezzen a detail API-val — késleltetve, idle-ben.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  try {
    const all = await fetchListings({ limit: 50 });
    const related = all
      .filter((item) => Number(item.user_id) === Number(view.userId) && Number(item.id) !== Number(listingId))
      .slice(0, 5);
    applyRelated(view, related);
  } catch {
    /* ignore — a fő tartalom már látszik */
  }
}

function render(view, listing, related) {
  const images = view.images?.length ? view.images : [];
  const first = images[0] || "";
  const extras = view.equipment || [];
  const extrasShort = extras.slice(0, 6);
  const extrasRest = extras.slice(6);
  const own = currentUserId() && currentUserId() === Number(view.userId);
  const canMsg = !own && canMessageListing(view.userId);
  const user = getAuthUser();
  const profile = getProfile() || {};
  const loginNext = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;

  document.title = `${view.title} — Bymy`;
  document.body.classList.toggle("hd-has-msg-bar", canMsg);

  root.innerHTML = `
    <nav class="hd-crumbs" aria-label="Navigáció">
      <button type="button" class="hd-back" data-hd-back>${ICON.back} Vissza</button>
      <ol class="hd-crumb-list">
        <li><a href="/">Kezdőlap</a></li>
        <li><a href="${escapeHtml(view.categoryHref)}">${escapeHtml(view.categoryLabel)}</a></li>
        ${view.brand ? `<li aria-current="page">${escapeHtml(formatCrumbLabel(view.brand))}</li>` : ""}
      </ol>
    </nav>

    <div class="hd-head">
      <h1 class="hd-title">${escapeHtml(view.title)}</h1>
      <div class="hd-tools">
        <button type="button" class="hd-tool" data-hd-star aria-label="Mentés">${ICON.star}</button>
        <button type="button" class="hd-tool" data-hd-share aria-label="Megosztás">${ICON.share}</button>
        <button type="button" class="hd-tool" data-hd-print aria-label="Nyomtatás">${ICON.print}</button>
      </div>
    </div>
    <div class="hd-specbar">
      <div class="hd-specbar-main">${view.headerSpecs.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</div>
      <div class="hd-specbar-meta">
        ${view.updatedAt ? `Utoljára módosítva: ${escapeHtml(formatDate(view.updatedAt))}` : ""}
        ${view.code ? ` · Bymy-kód: ${escapeHtml(view.code)}` : ""}
      </div>
    </div>

    <div class="hd-hero">
      <div class="hd-gallery">
        <div class="hd-stage">
          ${first ? `<button type="button" class="hd-stage-open" data-hd-open aria-label="Kép nagyítása"><img data-hd-main src="${escapeHtml(first)}" alt="" /></button>` : ""}
          ${
            images.length > 1
              ? `<button type="button" class="hd-stage-nav hd-stage-nav--prev" data-hd-prev aria-label="Előző kép">${ICON.prev}</button>
                 <button type="button" class="hd-stage-nav hd-stage-nav--next" data-hd-next aria-label="Következő kép">${ICON.next}</button>`
              : ""
          }
          <span class="hd-count" data-hd-count>${images.length ? `1 / ${images.length}` : "0 / 0"}</span>
        </div>
        ${
          images.length
            ? `<div class="hd-thumbs">
          <div class="hd-thumbs-track" data-hd-thumbs>
            ${images
              .map(
                (url, i) =>
                  `<button type="button" class="hd-thumb${i === 0 ? " is-on" : ""}" data-hd-thumb="${i}"><img src="${escapeHtml(url)}" alt="" /></button>`
              )
              .join("")}
          </div>
        </div>`
            : ""
        }
      </div>
      ${
        images.length
          ? `<dialog class="hd-lb" data-hd-lb>
        <div class="hd-lb-inner">
          <button type="button" class="hd-lb-close" data-hd-lb-close aria-label="Bezárás">${ICON.close}</button>
          <div class="hd-lb-stage">
            <img data-hd-lb-main src="${escapeHtml(first)}" alt="" />
            ${
              images.length > 1
                ? `<button type="button" class="hd-stage-nav hd-stage-nav--prev" data-hd-lb-prev aria-label="Előző kép">${ICON.prev}</button>
                   <button type="button" class="hd-stage-nav hd-stage-nav--next" data-hd-lb-next aria-label="Következő kép">${ICON.next}</button>`
                : ""
            }
            <span class="hd-count" data-hd-lb-count>1 / ${images.length}</span>
          </div>
          <div class="hd-thumbs hd-lb-thumbs">
            <div class="hd-thumbs-track" data-hd-lb-thumbs>
              ${images
                .map(
                  (url, i) =>
                    `<button type="button" class="hd-thumb${i === 0 ? " is-on" : ""}" data-hd-lb-thumb="${i}"><img src="${escapeHtml(url)}" alt="" /></button>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </dialog>`
          : ""
      }
      <aside class="hd-side">
        <div>
          <p class="hd-price">${escapeHtml(view.price)}</p>
          <p class="hd-price-sub">Eladási ár${view.salePrice ? ` · korábbi: ${escapeHtml(view.salePrice)}` : ""}</p>
        </div>
        <p class="hd-seller-name">${escapeHtml(view.sellerName)}</p>
        ${view.addressLines.length ? `<p class="hd-seller-addr">${view.addressLines.map(escapeHtml).join("<br>")}</p>` : ""}
        ${
          canMsg
            ? `<button type="button" class="hd-btn hd-btn--primary" data-hd-message>${ICON.mail} Üzenet</button>`
            : own
              ? ""
              : `<button type="button" class="hd-btn hd-btn--primary" data-hd-goto-form>${ICON.mail} Hirdető kapcsolata</button>`
        }
        ${
          view.phone
            ? `<button type="button" class="hd-btn hd-btn--ghost" data-hd-phone data-full="${escapeHtml(view.phone)}">${ICON.phone} ${escapeHtml(view.phoneMasked)} szám mutatása</button>`
            : ""
        }
        <a class="hd-btn hd-btn--ghost" href="/adasveteli-szerzodes.html?id=${encodeURIComponent(view.id)}">Adásvételi szerződés</a>
        ${
          related.length
            ? `<a class="hd-btn hd-btn--ghost" href="#hd-related">Több ettől a hirdetőtől ${related.length}</a>`
            : ""
        }
        ${view.website ? `<a class="hd-web" href="${escapeHtml(view.website)}" target="_blank" rel="noopener">Céges weboldal</a>` : ""}
        ${
          own
            ? `<div class="hd-owner">
                <a class="hd-btn hd-btn--ghost" href="/hirdetesfeladas.html?id=${view.id}">Szerkesztés</a>
                <button type="button" class="hd-btn hd-btn--ghost" data-hd-delete>Törlés</button>
              </div>`
            : ""
        }
      </aside>
    </div>

    <section class="hd-section">
      <h2 class="hd-h2">Járműadatok</h2>
      <h3 class="hd-h3">Alapadatok</h3>
      ${kvHtml(view.basics)}
      <h3 class="hd-h3" style="margin-top:1.1rem">Karosszéria és technika</h3>
      ${kvHtml(view.bodyTech)}
      ${
        view.perks.length
          ? `<h3 class="hd-h3" style="margin-top:1.1rem">További előnyök</h3>${view.perks.map((p) => `<span class="hd-check">${escapeHtml(p)}</span>`).join("")}`
          : ""
      }
    </section>

    <section class="hd-section">
      <h2 class="hd-h2">Leírás</h2>
      ${view.description ? `<p class="hd-desc is-clip" data-hd-desc>${escapeHtml(view.description)}</p>` : "<p class=\"hd-desc\">Nincs leírás.</p>"}
      ${view.description ? `<button type="button" class="hd-more" data-hd-desc-more>Több megjelenítése +</button>` : ""}
      ${
        extras.length
          ? `<h3 class="hd-h3" style="margin-top:1.1rem">Beépített opciók</h3>
             <p class="hd-desc">${escapeHtml(extras.join(", "))}</p>
             <h3 class="hd-h3" style="margin-top:1.1rem">Extrák</h3>
             <ul class="hd-list" data-hd-extras>${extrasShort.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
             ${extrasRest.length ? `<button type="button" class="hd-more" data-hd-extras-more>Több megjelenítése +</button>` : ""}`
          : ""
      }
    </section>

    ${
      related.length
        ? `<section class="hd-section" id="hd-related">
        <div class="hd-related-head">
          <h2 class="hd-h2">Több ettől a hirdetőtől</h2>
          <a class="hd-more" href="${escapeHtml(view.categoryHref)}">Több megjelenítése</a>
        </div>
        <div class="hd-related">${related.map(relatedCard).join("")}</div>
      </section>`
        : ""
    }

    <section class="hd-dealer">
      <div class="hd-card">
        <p class="hd-seller-name">${escapeHtml(view.sellerName)}</p>
        ${view.addressLines.length ? `<p class="hd-seller-addr">${view.addressLines.map(escapeHtml).join("<br>")}</p>` : ""}
        <p class="hd-seller-addr">Hivatkozási szám: ${escapeHtml(view.code || String(view.id))}</p>
        ${view.website ? `<p><a class="hd-web" href="${escapeHtml(view.website)}" target="_blank" rel="noopener">Weboldal</a></p>` : ""}
        ${
          view.phone
            ? `<button type="button" class="hd-btn hd-btn--ghost" data-hd-phone data-full="${escapeHtml(view.phone)}">${ICON.phone} ${escapeHtml(view.phoneMasked)} szám mutatása</button>`
            : ""
        }
      </div>
      <div>
        ${
          view.mapQuery
            ? `<iframe class="hd-map" title="Térkép" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" src="https://maps.google.com/maps?q=${encodeURIComponent(view.mapQuery)}&output=embed"></iframe>`
            : ""
        }
        <form class="hd-card" id="hd-contact" style="margin-top:0.9rem" ${canMsg || own ? "hidden" : ""}>
          <h2 class="hd-h2">Hirdető kapcsolata</h2>
          <p class="hd-h3">Amit a járműről tudni szeretnék</p>
          <div class="hd-ask">
            <label><input type="checkbox" name="q" value="Próbaút lehetséges?" /> Próbaút lehetséges?</label>
            <label><input type="checkbox" name="q" value="Elérhető még a jármű?" /> Elérhető még a jármű?</label>
            <label><input type="checkbox" name="q" value="További információ a járműről" /> További információ a járműről</label>
            <label><input type="checkbox" name="q" value="Beszámítás lehetséges?" /> Beszámítás lehetséges?</label>
          </div>
          <div class="hd-field" style="margin-bottom:0.75rem">
            <span>Név</span>
            <input name="name" required value="${escapeHtml(getDisplayName() || "")}" />
          </div>
          <div class="hd-fields">
            <label class="hd-field"><span>E-mail cím</span><input type="email" name="email" required value="${escapeHtml(user?.email || "")}" /></label>
            <label class="hd-field"><span>Telefonszám <small>(opcionális)</small></span><input type="tel" name="phone" value="${escapeHtml(profile.phone || "")}" /></label>
          </div>
          <label class="hd-field" style="margin-top:0.75rem"><span>Megjegyzés</span><textarea name="comment" rows="3"></textarea></label>
          <label class="hd-copy"><input type="checkbox" name="copy" /> Másolat küldése nekem erről az érdeklődésről</label>
          <button type="submit" class="hd-btn hd-btn--primary">${ICON.mail} E-mail küldése</button>
          <p class="hd-seller-addr" data-hd-form-status hidden></p>
          ${!user ? `<p class="hd-seller-addr">Küldéshez <a href="${loginNext}">jelentkezz be</a>.</p>` : ""}
        </form>
      </div>
    </section>

    <div class="hd-foot">
      <span>Bymy-kód: ${escapeHtml(view.code || String(view.id))} ${view.updatedAt ? `| Utoljára módosítva: ${escapeHtml(formatDate(view.updatedAt))}` : ""}</span>
      <a class="hd-report" href="/uzenetek.html">! Hirdetés jelentése</a>
    </div>
    ${
      canMsg
        ? `<div class="hd-msg-bar" role="region" aria-label="Üzenet">
            ${
              view.phone
                ? `<button type="button" class="hd-btn hd-btn--primary" data-hd-phone data-full="${escapeHtml(view.phone)}">${ICON.phone} Hívás</button>`
                : ""
            }
            <button type="button" class="hd-btn hd-btn--primary" data-hd-message>${ICON.mail} Üzenet</button>
          </div>`
        : ""
    }
  `;

  bindUi(view, listing, extrasRest);
}

function bindUi(view, listing, extrasRest) {
  let index = 0;
  const images = view.images || [];
  const main = root.querySelector("[data-hd-main]");
  const count = root.querySelector("[data-hd-count]");
  const lightbox = root.querySelector("[data-hd-lb]");
  const lbMain = root.querySelector("[data-hd-lb-main]");
  const lbCount = root.querySelector("[data-hd-lb-count]");

  function markThumbs(selector) {
    root.querySelectorAll(selector).forEach((btn) => {
      const on = Number(btn.dataset.hdThumb ?? btn.dataset.hdLbThumb) === index;
      btn.classList.toggle("is-on", on);
      if (on && btn.closest("[data-hd-lb]")) {
        btn.scrollIntoView({ block: "nearest", inline: "center" });
      }
    });
  }

  function show(i) {
    if (!images.length) return;
    index = (i + images.length) % images.length;
    if (main) main.src = images[index];
    if (lbMain) lbMain.src = images[index];
    const label = `${index + 1} / ${images.length}`;
    if (count) count.textContent = label;
    if (lbCount) lbCount.textContent = label;
    markThumbs("[data-hd-thumb]");
    markThumbs("[data-hd-lb-thumb]");
  }

  function openLightbox() {
    if (!lightbox || !images.length) return;
    show(index);
    if (typeof lightbox.showModal === "function") lightbox.showModal();
    else lightbox.setAttribute("open", "");
  }

  function closeLightbox() {
    if (!lightbox) return;
    if (typeof lightbox.close === "function" && lightbox.open) lightbox.close();
    else lightbox.removeAttribute("open");
  }

  root.querySelector("[data-hd-back]")?.addEventListener("click", () => {
    window.location.href = listingReturnHref(view.categoryHref);
  });
  root.querySelector("[data-hd-prev]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    show(index - 1);
  });
  root.querySelector("[data-hd-next]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    show(index + 1);
  });
  root.querySelector("[data-hd-open]")?.addEventListener("click", openLightbox);
  root.querySelectorAll("[data-hd-thumb]").forEach((btn) => {
    btn.addEventListener("click", () => show(Number(btn.dataset.hdThumb)));
  });
  root.querySelector("[data-hd-lb-prev]")?.addEventListener("click", () => show(index - 1));
  root.querySelector("[data-hd-lb-next]")?.addEventListener("click", () => show(index + 1));
  root.querySelectorAll("[data-hd-lb-thumb]").forEach((btn) => {
    btn.addEventListener("click", () => show(Number(btn.dataset.hdLbThumb)));
  });
  root.querySelector("[data-hd-lb-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  lightbox?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (!images.length) return;
    const open = lightbox?.open || lightbox?.hasAttribute("open");
    if (!open && event.target !== document.body && event.target?.tagName !== "BODY") return;
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
    if (event.key === "Escape" && open) closeLightbox();
  });
  root.querySelector("[data-hd-print]")?.addEventListener("click", () => window.print());
  root.querySelector("[data-hd-share]")?.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: view.title, url });
      else {
        await navigator.clipboard.writeText(url);
        window.alert("A link a vágólapra került.");
      }
    } catch {
      /* cancelled */
    }
  });

  const star = root.querySelector("[data-hd-star]");
  const email = getAuthUser()?.email;
  const saved = email && getParkplatz(email).some((row) => String(row.id) === String(view.id));
  if (star && saved) star.classList.add("is-on");
  star?.addEventListener("click", () => {
    if (!email) {
      window.location.href = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    const on = star.classList.contains("is-on");
    if (on) removeParkplatzItem(email, view.id);
    else {
      addParkplatzItem(email, {
        id: view.id,
        title: view.title,
        price: view.price,
        url: listingDetailHref(view.id),
      });
    }
    star.classList.toggle("is-on", !on);
  });

  root.querySelectorAll("[data-hd-phone]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const full = btn.getAttribute("data-full") || "";
      btn.textContent = full;
      const digits = full.replace(/[^\d+]/g, "");
      if (digits.length >= 7) window.location.href = `tel:${digits}`;
    });
  });

  root.querySelector("[data-hd-goto-form]")?.addEventListener("click", () => {
    document.getElementById("hd-contact")?.scrollIntoView({ behavior: "smooth" });
  });

  root.querySelectorAll("[data-hd-message]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        await openListingMessage({
          listingId: view.id,
          title: view.title,
          priceLabel: view.price,
          meta: view.metaLine,
          code: view.code,
          sellerId: view.userId,
        });
      } catch (error) {
        alert(error.message ?? "Az üzenet indítása sikertelen.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  root.querySelector("[data-hd-desc-more]")?.addEventListener("click", (event) => {
    root.querySelector("[data-hd-desc]")?.classList.remove("is-clip");
    event.currentTarget.hidden = true;
  });

  root.querySelector("[data-hd-extras-more]")?.addEventListener("click", (event) => {
    const list = root.querySelector("[data-hd-extras]");
    extrasRest.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list?.appendChild(li);
    });
    event.currentTarget.hidden = true;
  });

  root.querySelector("[data-hd-delete]")?.addEventListener("click", async () => {
    if (!confirm(`Törlöd ezt a hirdetést?\n\n${view.title}`)) return;
    await deleteListingFromDb(view.id);
    window.location.href = listingReturnHref("/beallitasok.html?szekcio=hirdetes");
  });

  document.getElementById("hd-contact")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = root.querySelector("[data-hd-form-status]");
    const user = getAuthUser();
    if (!user) {
      window.location.href = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    const data = new FormData(event.currentTarget);
    const questions = data.getAll("q");
    const parts = [
      `Érdeklődés: ${view.title}`,
      questions.length ? `Kérdések: ${questions.join("; ")}` : "",
      data.get("comment") ? `Megjegyzés: ${data.get("comment")}` : "",
      `Név: ${data.get("name")}`,
      `E-mail: ${data.get("email")}`,
      data.get("phone") ? `Telefon: ${data.get("phone")}` : "",
      data.get("copy") ? "Másolatot kér a feladónak." : "",
    ].filter(Boolean);
    try {
      const conv = await startConversation({
        listingId: view.id,
        title: view.title,
        priceLabel: view.price,
        meta: view.metaLine,
        code: view.code,
        sellerId: view.userId,
      });
      await sendMessage(conv.id, { body: parts.join("\n") });
      if (status) {
        status.hidden = false;
        status.textContent = "Az érdeklődés elküldve.";
      }
      event.currentTarget.reset();
      window.location.href = `/uzenetek.html?c=${encodeURIComponent(conv.id)}`;
    } catch (error) {
      if (status) {
        status.hidden = false;
        status.textContent = error.message ?? "Küldés sikertelen.";
      }
    }
  });

  root.querySelectorAll("a[data-listing-id]").forEach((a) => {
    a.addEventListener("click", () => rememberListingOpen(a.dataset.listingId, a));
  });
}

async function init() {
  const id = Number(new URLSearchParams(location.search).get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    root.innerHTML = `<p class="hd-empty">Hiányzó hirdetés.</p>`;
    return;
  }
  try {
    const listing = await fetchListing(id, { view: "detail" });
    if (!listing) throw new Error("Nincs ilyen hirdetés.");
    const view = listing.detail;
    if (!view) throw new Error("A hirdetés adatai hiányosak.");
    // Először rajzolunk — view számláló és „több ettől” ne blokkolja a megnyitást.
    render(view, listing, []);
    recordListingView(id, "web").catch(() => {});
    loadRelatedInBackground(id, view);
  } catch (error) {
    root.innerHTML = `<p class="hd-empty">${escapeHtml(error.message ?? "A hirdetés nem tölthető be.")}</p>`;
  }
}

init();
