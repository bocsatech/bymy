import {
  fetchMyListings,
  updateListingStatusInDb,
  saveListingPhotosOrder,
  deleteListingFromDb,
} from "./db-client.js?v=myAds1";
import { compressListingPhotos } from "./listing-photo-compress.js?v=myAds1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function photoUrls(item) {
  const preview = item.preview || {};
  const urls = [...(preview.imageUrls || [])];
  if (preview.imageUrl && !urls.includes(preview.imageUrl)) urls.unshift(preview.imageUrl);
  if (item.fo_kep && !urls.includes(item.fo_kep)) urls.unshift(item.fo_kep);
  return urls.filter(Boolean);
}

function titleOf(item) {
  const f = item.form || {};
  const filter = item.preview?.filter || {};
  const brand = String(f.gyartmany || filter.gyartmany || "").trim();
  const model = String(f.modell || filter.modell || "").trim();
  const tipus = String(f.tipus || filter.tipus || "").trim();
  const fromIdentity = [brand, model, tipus].filter(Boolean).join(" ");
  if (fromIdentity) return fromIdentity;

  const previewTitle = String(item.preview?.title || "").trim();
  if (previewTitle && !/importált autó\s*\(\d{5,}\)/i.test(previewTitle)) return previewTitle;

  const cim = String(item.hirdetes_cime || f.hirdetes_cime || "").trim();
  if (cim && !/importált autó\s*\(\d{5,}\)/i.test(cim)) {
    return cim.replace(/^Eladó\s+/i, "").trim() || cim;
  }
  return `Hirdetés #${item.id}`;
}

function specOf(item) {
  const f = item.preview?.filter || {};
  const year = f.gyartasi_ev || "";
  const fuel = f.uzemanyag || "";
  return [year, fuel, `#${item.id}`].filter(Boolean).join(", ");
}

function isActive(item) {
  return (item.status || "feladott") === "feladott";
}

function readFeaturedIdSet() {
  const g = globalThis.BYMY_FEATURED_LISTING_IDS;
  if (!Array.isArray(g)) return new Set();
  return new Set(g.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0));
}

function sablonLabel(item) {
  const photos = item.form?.photos || item.photos;
  if (!Array.isArray(photos)) return "Sablon: nincs";
  const has = photos.some((p) => p?.overlayTemplateId || p?.overlayDataUrl);
  return has ? "Sablon: aktív" : "Sablon: nincs";
}

function editHref(id) {
  return `/hirdetesfeladas.html?id=${encodeURIComponent(String(id))}`;
}

export function initMyAdsPanel(root) {
  if (!root) return { reload() {} };
  bindListingOpen(root);

  let items = [];
  let filter = "all";
  let query = "";
  let photoState = null;

  async function reload() {
    root.innerHTML = `<p class="mm-empty">Hirdetések betöltése…</p>`;
    try {
      items = await fetchMyListings({ limit: 200 });
      render();
    } catch (error) {
      root.innerHTML = `<p class="mm-empty">${escapeHtml(error.message ?? "Nem sikerült betölteni.")}</p>`;
    }
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "active" && !isActive(item)) return false;
      if (filter === "inactive" && isActive(item)) return false;
      if (!q) return true;
      const hay = `${titleOf(item)} ${item.id} ${item.preview?.hirdeteskod || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const rows = filtered();
    root.innerHTML = `
      <div class="myads-toolbar">
        <label class="myads-radio"><input type="radio" name="myads-filter" value="all" ${filter === "all" ? "checked" : ""} /> Összes hirdetés</label>
        <label class="myads-radio"><input type="radio" name="myads-filter" value="inactive" ${filter === "inactive" ? "checked" : ""} /> Inaktív hirdetések</label>
        <label class="myads-radio"><input type="radio" name="myads-filter" value="active" ${filter === "active" ? "checked" : ""} /> Aktív hirdetések</label>
        <div class="myads-search">
          <span>Keresés hirdetéskód szerint:</span>
          <input type="search" data-myads-q value="${escapeHtml(query)}" placeholder="gyártmány, modell vagy #" />
          <button type="button" class="site-header-btn site-header-btn--primary" data-myads-search>Keresés</button>
        </div>
      </div>
      <p class="myads-count">Megjelenített járművek száma: <strong>${rows.length} db</strong></p>
      <div class="myads-list-wrap">
        <div class="myads-list" role="list">
          ${
            rows.length
              ? rows.map((item) => rowHtml(item)).join("")
              : `<p class="myads-empty-cell">Nincs megjeleníthető hirdetés.</p>`
          }
        </div>
      </div>
      <div class="myads-actions">
        <a class="site-header-btn site-header-btn--outline" href="/hirdetesfeladas.html" data-auth-guard>Új hirdetés feladása</a>
      </div>
      ${photoModalHtml()}
    `;
    bind();
    restoreListingReturn();
  }

  function rowHtml(item) {
    const urls = photoUrls(item);
    const thumb = urls[0] || "";
    const count = urls.length;
    const views = item.views || item.preview?.views || { web: item.views_web || 0, app: item.views_app || 0 };
    const web = Number(views.web || item.views_web || 0);
    const app = Number(views.app || item.views_app || 0);
    const active = isActive(item);
    const featuredIds = readFeaturedIdSet();
    const isFeatured = featuredIds.has(Number(item.id));
    const sablon = sablonLabel(item);
    const edit = editHref(item.id);
    return `
      <article class="myads-card${isFeatured ? " myads-card--featured" : ""}" role="listitem" data-id="${item.id}">
        <div class="myads-card-main">
          <div class="myads-photo-cell">
            <div class="myads-thumb">
              ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : `<span class="myads-thumb-empty">Nincs kép</span>`}
              ${count ? `<span class="myads-photo-count">${count}</span>` : ""}
            </div>
            <div class="myads-photo-links">
              <button type="button" class="myads-link" data-photos="${item.id}">Képkezelés</button>
              <a class="myads-link myads-sablon-meta" href="${escapeHtml(edit)}">${escapeHtml(sablon)}</a>
            </div>
          </div>
          <div class="myads-card-content">
            <a class="myads-title" href="/hirdetes.html?id=${item.id}" data-listing-id="${item.id}">${escapeHtml(titleOf(item))}</a>
            <p class="myads-spec">${escapeHtml(specOf(item))}</p>
            <p class="myads-views">Megtekintve: ${web + app}</p>
            <p class="myads-views-split">Web: <strong>${web}</strong> · Mobilapp: <strong>${app}</strong></p>
            <label class="myads-inactive">
              <input type="checkbox" data-inactive="${item.id}" ${active ? "" : "checked"} />
              Lefoglalózva / inaktív
            </label>
            <div class="myads-promo-strip" role="group" aria-label="Promóció">
              <button type="button" class="myads-promo-btn${isFeatured ? " is-on" : ""}" data-promo="kiemelt" data-id="${item.id}" aria-pressed="${isFeatured ? "true" : "false"}">★ Kiemelés</button>
              <button type="button" class="myads-promo-btn" data-promo="top" data-id="${item.id}" aria-pressed="false">TOP ajánlat</button>
              <a class="myads-promo-btn myads-promo-btn--link" href="${escapeHtml(edit)}">Sablon</a>
            </div>
          </div>
        </div>
        <footer class="myads-card-foot">
          <strong class="myads-price">${escapeHtml(item.preview?.price || "—")}</strong>
          <div class="myads-fn">
            <a class="myads-link" href="${escapeHtml(edit)}">Módosítás</a>
            <a class="myads-link" href="/hirdetes.html?id=${item.id}" data-listing-id="${item.id}">Megtekintés</a>
            <button type="button" class="myads-link myads-link--danger" data-delete="${item.id}">Törlés</button>
          </div>
        </footer>
      </article>
    `;
  }

  function photoModalHtml() {
    return `
      <div class="myads-modal" data-photo-modal hidden>
        <div class="myads-modal-card">
          <header class="myads-modal-head">
            <h3>Képkezelés</h3>
            <button type="button" class="myads-link" data-photo-close>Bezárás</button>
          </header>
          <p class="myads-modal-lead" data-photo-title></p>
          <div class="myads-photo-list" data-photo-list></div>
          <div class="myads-photo-add">
            <label class="site-header-btn site-header-btn--outline">
              Képek hozzáadása
              <input type="file" accept="image/*" multiple hidden data-photo-file />
            </label>
          </div>
          <div class="myads-modal-actions">
            <button type="button" class="site-header-btn site-header-btn--primary" data-photo-save>Mentés</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderPhotoList() {
    const list = root.querySelector("[data-photo-list]");
    if (!list || !photoState) return;
    list.innerHTML = photoState.items
      .map((item, index) => {
        const src = item.url || item.preview || "";
        return `
          <div class="myads-photo-item" data-idx="${index}">
            <img src="${escapeHtml(src)}" alt="" />
            <div class="myads-photo-item-actions">
              <button type="button" data-photo-up="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" data-photo-down="${index}" ${index === photoState.items.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" data-photo-del="${index}">Törlés</button>
            </div>
            ${index === 0 ? `<span class="myads-photo-primary">Főkép</span>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function openPhotos(id) {
    const item = items.find((row) => Number(row.id) === Number(id));
    if (!item) return;
    photoState = {
      id: item.id,
      title: titleOf(item),
      items: photoUrls(item).map((url) => ({ url })),
    };
    const modal = root.querySelector("[data-photo-modal]");
    const title = root.querySelector("[data-photo-title]");
    if (title) title.textContent = photoState.title;
    modal.hidden = false;
    renderPhotoList();
  }

  function bind() {
    root.querySelectorAll('input[name="myads-filter"]').forEach((el) => {
      el.addEventListener("change", () => {
        filter = el.value;
        render();
      });
    });
    const applyQuery = (restoreCaret = false) => {
      const input = root.querySelector("[data-myads-q]");
      const start = input?.selectionStart;
      const end = input?.selectionEnd;
      query = input?.value ?? "";
      render();
      if (!restoreCaret) return;
      const next = root.querySelector("[data-myads-q]");
      if (!next) return;
      next.focus();
      if (typeof start === "number" && typeof end === "number") {
        next.setSelectionRange(start, end);
      }
    };
    root.querySelector("[data-myads-q]")?.addEventListener("input", () => applyQuery(true));
    root.querySelector("[data-myads-q]")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyQuery(true);
      }
    });
    root.querySelector("[data-myads-search]")?.addEventListener("click", () => applyQuery(true));
    root.querySelectorAll("[data-photos]").forEach((btn) => {
      btn.addEventListener("click", () => openPhotos(btn.dataset.photos));
    });
    root.querySelectorAll("[data-inactive]").forEach((box) => {
      box.addEventListener("change", async () => {
        const id = Number(box.dataset.inactive);
        try {
          await updateListingStatusInDb(id, box.checked ? "inaktiv" : "feladott");
          await reload();
        } catch (error) {
          alert(error.message ?? "A státusz mentése sikertelen.");
          box.checked = !box.checked;
        }
      });
    });
    root.querySelectorAll("[data-promo='kiemelt'], [data-promo='top']").forEach((btn) => {
      btn.addEventListener("click", () => {
        alert("A Kiemelés és TOP ajánlat beállítása hamarosan elérhető a fiókodból.");
      });
    });
    root.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.delete);
        const item = items.find((row) => Number(row.id) === id);
        if (!confirm(`Törlöd ezt a hirdetést?\n\n${titleOf(item || { id })}`)) return;
        try {
          await deleteListingFromDb(id);
          await reload();
        } catch (error) {
          alert(error.message ?? "A törlés sikertelen.");
        }
      });
    });
    root.querySelector("[data-photo-close]")?.addEventListener("click", () => {
      root.querySelector("[data-photo-modal]").hidden = true;
      photoState = null;
    });
    root.querySelector("[data-photo-list]")?.addEventListener("click", (event) => {
      const up = event.target.closest("[data-photo-up]");
      const down = event.target.closest("[data-photo-down]");
      const del = event.target.closest("[data-photo-del]");
      if (!photoState) return;
      if (up) {
        const i = Number(up.dataset.photoUp);
        if (i > 0) {
          const [moved] = photoState.items.splice(i, 1);
          photoState.items.splice(i - 1, 0, moved);
          renderPhotoList();
        }
      }
      if (down) {
        const i = Number(down.dataset.photoDown);
        if (i < photoState.items.length - 1) {
          const [moved] = photoState.items.splice(i, 1);
          photoState.items.splice(i + 1, 0, moved);
          renderPhotoList();
        }
      }
      if (del) {
        const i = Number(del.dataset.photoDel);
        photoState.items.splice(i, 1);
        renderPhotoList();
      }
    });
    root.querySelector("[data-photo-file]")?.addEventListener("change", async (event) => {
      const files = [...(event.target.files || [])];
      event.target.value = "";
      if (!files.length || !photoState) return;
      try {
        const dataUrls = await compressListingPhotos(files);
        for (const data of dataUrls) {
          photoState.items.push({ data, preview: data });
        }
        renderPhotoList();
      } catch (error) {
        alert(error.message ?? "A kép hozzáadása sikertelen.");
      }
    });
    root.querySelector("[data-photo-save]")?.addEventListener("click", async () => {
      if (!photoState) return;
      if (!photoState.items.length) {
        alert("Legalább egy kép kell.");
        return;
      }
      const btn = root.querySelector("[data-photo-save]");
      btn.disabled = true;
      try {
        await saveListingPhotosOrder(
          photoState.id,
          photoState.items.map((item) => (item.url ? { url: item.url } : { data: item.data }))
        );
        root.querySelector("[data-photo-modal]").hidden = true;
        photoState = null;
        await reload();
      } catch (error) {
        alert(error.message ?? "A képek mentése sikertelen.");
      } finally {
        btn.disabled = false;
      }
    });
  }

  return { reload };
}
