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
  return item.preview?.title || item.hirdetes_cime || `Hirdetés #${item.id}`;
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
      <div class="myads-table-wrap">
        <table class="myads-table">
          <thead>
            <tr>
              <th>Ssz.</th>
              <th>Kép</th>
              <th>Gyártmány, típus</th>
              <th>Vételár / Statisztika</th>
              <th>Funkciók</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((item, index) => rowHtml(item, index + 1)).join("") : `<tr><td colspan="5" class="myads-empty-cell">Nincs megjeleníthető hirdetés.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="myads-actions">
        <a class="site-header-btn site-header-btn--outline" href="/hirdetesfeladas.html" data-auth-guard>Új hirdetés feladása</a>
      </div>
      ${photoModalHtml()}
    `;
    bind();
    restoreListingReturn();
  }

  function rowHtml(item, index) {
    const urls = photoUrls(item);
    const thumb = urls[0] || "";
    const count = urls.length;
    const views = item.views || item.preview?.views || { web: item.views_web || 0, app: item.views_app || 0 };
    const web = Number(views.web || item.views_web || 0);
    const app = Number(views.app || item.views_app || 0);
    const active = isActive(item);
    return `
      <tr data-id="${item.id}">
        <td class="myads-ssz">${index}.</td>
        <td class="myads-photo-cell">
          <div class="myads-thumb">
            ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : `<span class="myads-thumb-empty">Nincs kép</span>`}
            <span class="myads-photo-count">${count}</span>
          </div>
          <button type="button" class="myads-link" data-photos="${item.id}">Képkezelés</button>
        </td>
        <td>
          <a class="myads-title" href="/hirdetes.html?id=${item.id}" data-listing-id="${item.id}">${escapeHtml(titleOf(item))}</a>
          <p class="myads-spec">${escapeHtml(specOf(item))}</p>
          <label class="myads-inactive">
            <input type="checkbox" data-inactive="${item.id}" ${active ? "" : "checked"} />
            Lefoglalózva / inaktív
          </label>
        </td>
        <td>
          <strong class="myads-price">${escapeHtml(item.preview?.price || "—")}</strong>
          <p class="myads-views">Megtekintve: ${web + app}</p>
          <p class="myads-views-split">Web: <strong>${web}</strong> · Mobilapp: <strong>${app}</strong></p>
        </td>
        <td class="myads-fn">
          <a class="myads-link" href="/hirdetesfeladas.html?id=${item.id}">Módosítás</a>
          <a class="myads-link" href="/hirdetes.html?id=${item.id}" data-listing-id="${item.id}">Megtekintés</a>
          <button type="button" class="myads-link myads-link--danger" data-delete="${item.id}">Törlés</button>
        </td>
      </tr>
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
