/**
 * Piactér feladás: kategóriamenük (piac-catalog) + cím / szándék / ingyen.
 */
let catalogPromise = null;

const PIAC_TOP_LABELS = {
  allas: "Állás",
  "otthon-haztartas": "Otthon, háztartás",
  "muszaki-elektronika": "Műszaki, elektronika",
  "szabadido-sport": "Szabadidő, sport",
  "divat-ruhazat": "Divat, ruházat",
  "uzlet-szolgaltatas": "Üzlet, szolgáltatás",
  "baba-mama": "Baba-mama",
};

function readVertical(form) {
  const el = form?.elements?.namedItem("hirdetes_vertical");
  const raw = el instanceof RadioNodeList ? el[0]?.value : el?.value;
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function readField(form, name) {
  const el = form?.elements?.namedItem(name);
  const field = el instanceof RadioNodeList ? el[0] : el;
  return String(field?.value ?? "").trim();
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch("/data/piac-catalog.json", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("piac catalog");
        return res.json();
      })
      .catch(() => ({ categories: [], listing: { intent: [] } }));
  }
  return catalogPromise;
}

export function shortPiacTopLabel(slugOrLabel) {
  const key = String(slugOrLabel || "").trim();
  if (PIAC_TOP_LABELS[key]) return PIAC_TOP_LABELS[key];
  const s = key;
  if (s.startsWith("Állás")) return "Állás";
  if (s.startsWith("Otthon")) return "Otthon, háztartás";
  if (s.startsWith("Műszaki")) return "Műszaki, elektronika";
  if (s.startsWith("Szabadidő")) return "Szabadidő, sport";
  if (s.startsWith("Divat")) return "Divat, ruházat";
  if (s.startsWith("Üzlet")) return "Üzlet, szolgáltatás";
  if (s.startsWith("Baba")) return "Baba-mama";
  return s;
}

export function topSlugFromPiacPath(path) {
  return String(path || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)[0] || "";
}

function removePiacFormFields(form) {
  form?.querySelector("#piac-fields")?.remove();
}

function syncTitleToHidden(form) {
  const visible = form.querySelector("#piac_cim");
  const hidden = form.elements.namedItem("hirdetes_cime");
  if (!visible || !hidden) return;
  const field = hidden instanceof RadioNodeList ? hidden[0] : hidden;
  if (!field) return;
  field.value = String(visible.value || "").trim();
  field.dataset.userEdited = "1";
}

function syncAlkategoria(form, pathSlugs) {
  const leaf = pathSlugs.filter(Boolean).at(-1) || "";
  for (const name of ["hirdetes_alkategoria", "jarmu_kategoria"]) {
    const el = form.elements.namedItem(name);
    const field = el instanceof RadioNodeList ? el[0] : el;
    if (field) field.value = leaf;
  }
  const pathEl = form.querySelector("#piac_path");
  if (pathEl) pathEl.value = pathSlugs.filter(Boolean).join("/");
}

function nodeComplete(node) {
  if (!node) return false;
  const kids = node.children || [];
  return !kids.length || node.leafSkip === true;
}

function isCompletePath(tops, path) {
  if (!path[0]) return false;
  const top = tops.find((t) => t.slug === path[0]);
  if (!top) return false;
  const l2 = top.children || [];
  if (!l2.length) return true;
  if (!path[1]) return false;
  const mid = l2.find((c) => c.slug === path[1]);
  if (!mid) return false;
  if (nodeComplete(mid)) return true;
  return Boolean(path[2]);
}

function renderCol(col, items, selectedSlug, onPick) {
  if (!col) return;
  col.innerHTML = "";
  col.hidden = !items.length;
  if (!items.length) return;
  const list = document.createElement("div");
  list.className = "piac-cat-list";
  list.setAttribute("role", "listbox");
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "piac-cat-item" + (item.slug === selectedSlug ? " is-active" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", item.slug === selectedSlug ? "true" : "false");
    btn.textContent = item._short || item.label;
    btn.addEventListener("click", () => onPick(item));
    list.appendChild(btn);
  }
  col.appendChild(list);
}

function resolvePathFromPreset(tops, presetSub, storedPath) {
  const fromStored = String(storedPath || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromStored.length && tops.some((t) => t.slug === fromStored[0])) {
    return fromStored.slice(0, 3);
  }
  const sub = String(presetSub || "").trim();
  if (!sub) return [];
  if (tops.some((t) => t.slug === sub)) return [sub];
  for (const top of tops) {
    for (const mid of top.children || []) {
      if (mid.slug === sub) return [top.slug, mid.slug];
      if ((mid.children || []).some((leaf) => leaf.slug === sub)) {
        return [top.slug, mid.slug, sub];
      }
    }
  }
  return [];
}

export async function ensurePiacFormFields(form) {
  if (!form) return null;
  const host =
    form.querySelector('.step-panel[data-step="1"] .card > .card-body') ||
    form.querySelector('.step-panel[data-step="1"]');
  if (!host) return null;

  const catalog = await loadCatalog();
  const tops = (catalog.categories || []).map((node) => ({
    ...node,
    _short: shortPiacTopLabel(node.slug) || shortPiacTopLabel(node.label),
  }));
  const intents = catalog.listing?.intent || [
    { slug: "kinal", label: "Kínál" },
    { slug: "keres", label: "Keres" },
  ];

  const last = form._bymyLastFormData && typeof form._bymyLastFormData === "object" ? form._bymyLastFormData : {};
  const presetSub =
    readField(form, "hirdetes_alkategoria") ||
    readField(form, "jarmu_kategoria") ||
    String(last.hirdetes_alkategoria || last.jarmu_kategoria || "").trim();
  const storedPath = readField(form, "piac_path") || String(last.piac_path || "").trim();
  let path = resolvePathFromPreset(tops, presetSub, storedPath);
  const topKey = path[0] || "";

  const existing = form.querySelector("#piac-fields");
  const seedTitle =
    existing?.querySelector("#piac_cim")?.value ||
    readField(form, "hirdetes_cime") ||
    readField(form, "piac_cim") ||
    String(last.hirdetes_cime || last.piac_cim || "").trim() ||
    "";
  const seedIntent =
    existing?.querySelector('input[name="piac_intent"]:checked')?.value ||
    readField(form, "piac_intent") ||
    String(last.piac_intent || "").trim() ||
    "kinal";
  const seedFree =
    Boolean(existing?.querySelector("#piac_ingyen")?.checked) ||
    readField(form, "piac_ingyen") === "1" ||
    String(last.piac_ingyen || "") === "1";

  if (existing?.dataset.ready === "1" && existing.dataset.topSlug === topKey) {
    const titleEl = existing.querySelector("#piac_cim");
    if (titleEl && seedTitle && titleEl.value !== seedTitle) {
      titleEl.value = seedTitle;
      syncTitleToHidden(form);
    }
    const intentEl = existing.querySelector(`input[name="piac_intent"][value="${seedIntent}"]`);
    if (intentEl) intentEl.checked = true;
    const freeEl = existing.querySelector("#piac_ingyen");
    if (freeEl) freeEl.checked = seedFree;
    const pathEl = existing.querySelector("#piac_path");
    const currentPath = String(pathEl?.value || "").trim();
    const wantPath = path.filter(Boolean).join("/");
    if (wantPath && currentPath !== wantPath) {
      delete existing.dataset.ready;
    } else {
      existing._piacTops = tops;
      return existing;
    }
  }

  existing?.remove();

  const hasTop = Boolean(topKey);
  const root = document.createElement("div");
  root.id = "piac-fields";
  root.className = "piac-fields";
  root.setAttribute("data-piac-only", "1");
  root.innerHTML = `
    <div class="piac-fields__head" ${hasTop ? "" : "hidden"}>
      <h3 class="piac-fields__title">Alkategória</h3>
      <p class="piac-fields__hint">A fő kategóriát fent a „Kategória” mezőben választod — itt az alkategóriát.</p>
    </div>
    <p class="piac-fields__pick-top" ${hasTop ? "hidden" : ""}>Először válassz kategóriát fent (Állás, Divat, Otthon…).</p>
    <div class="piac-cat-menus" aria-label="Piactér alkategóriák" ${hasTop ? "" : "hidden"}>
      <div class="piac-cat-col" data-level="1" hidden></div>
      <div class="piac-cat-col" data-level="2" hidden></div>
    </div>
    <input type="hidden" id="piac_path" name="piac_path" value="" />
    <div class="piac-intent" role="group" aria-label="Szándék">
      <span class="piac-intent__label">Szándék <span class="req">*</span></span>
      <div class="piac-intent__opts">
        ${intents
          .map(
            (it) => `
          <label class="piac-intent__opt">
            <input type="radio" name="piac_intent" value="${it.slug}" ${
              seedIntent === it.slug ? "checked" : ""
            } />
            <span>${it.label}</span>
          </label>`
          )
          .join("")}
      </div>
    </div>
    <div class="piac-field">
      <label for="piac_cim">Hirdetés neve <span class="req">*</span></label>
      <input id="piac_cim" name="piac_cim" type="text" maxlength="70" minlength="12" autocomplete="off" placeholder="pl. iPhone 13, 128 GB, jó állapot" value="${String(seedTitle || "").replace(/"/g, "&quot;")}" />
      <p class="piac-field__hint">12–70 karakter</p>
    </div>
    <div class="piac-field piac-field--row">
      <label class="piac-free">
        <input type="checkbox" id="piac_ingyen" name="piac_ingyen" value="1" ${seedFree ? "checked" : ""} />
        <span>Ingyen elvihető</span>
      </label>
    </div>
  `;

  host.prepend(root);

  const col1 = root.querySelector('[data-level="1"]');
  const col2 = root.querySelector('[data-level="2"]');
  const status = document.createElement("p");
  status.className = "piac-fields__path";
  status.setAttribute("aria-live", "polite");
  root.querySelector(".piac-cat-menus")?.after(status);

  function paint() {
    const top = tops.find((t) => t.slug === path[0]) || null;
    const mid = top ? (top.children || []).find((c) => c.slug === path[1]) || null : null;
    const l2 = (top?.children || []).map((n) => ({ ...n, _short: n.label }));
    const l3 = nodeComplete(mid)
      ? []
      : (mid?.children || []).map((n) => ({ ...n, _short: n.label }));

    renderCol(col1, l2, path[1] || "", (item) => {
      path = [path[0], item.slug];
      paint();
    });
    renderCol(col2, l3, path[2] || "", (item) => {
      path = [path[0], path[1], item.slug];
      paint();
    });

    syncAlkategoria(form, path);
    const labels = [];
    if (top) labels.push(shortPiacTopLabel(top.slug) || top.label);
    if (mid) labels.push(mid.label);
    if (path[2]) {
      const leaf = l3.find((n) => n.slug === path[2]);
      if (leaf) labels.push(leaf.label);
    }
    status.textContent = labels.length ? labels.join(" › ") : "";
    status.hidden = !labels.length;
  }

  paint();
  syncTitleToHidden(form);

  const title = root.querySelector("#piac_cim");
  title?.addEventListener("input", () => syncTitleToHidden(form));
  title?.addEventListener("change", () => syncTitleToHidden(form));

  const free = root.querySelector("#piac_ingyen");
  free?.addEventListener("change", () => {
    const price = form.elements.namedItem("vetelar");
    const field = price instanceof RadioNodeList ? price[0] : price;
    if (!field) return;
    if (free.checked) {
      field.dataset.wasRequired = field.required ? "1" : "0";
      field.required = false;
      field.removeAttribute("required");
      field.value = "0";
    } else if (field.dataset.wasRequired === "1") {
      field.required = true;
      field.setAttribute("required", "");
      if (field.value === "0") field.value = "";
    }
  });
  if (seedFree) free?.dispatchEvent(new Event("change"));

  root.dataset.topSlug = topKey;
  root.dataset.ready = "1";
  root._piacTops = tops;
  return root;
}

export async function syncPiacFormVisibility(form) {
  if (!form) return;
  const isPiac = readVertical(form) === "piac";
  form.classList.toggle("ad-form--piac", isPiac);
  document.body.classList.toggle("ad-vertical-piac", isPiac);

  document.querySelectorAll("[data-step-indicator]").forEach((el) => {
    const n = Number(el.dataset.stepIndicator);
    const vehicleStep = n === 2 || n === 3;
    el.classList.toggle("ad-step-skip", isPiac && vehicleStep);
    if (isPiac && vehicleStep) el.setAttribute("aria-hidden", "true");
    else if (!form.classList.contains("ad-form--ingatlan")) el.removeAttribute("aria-hidden");
  });

  if (!isPiac) {
    removePiacFormFields(form);
    form.querySelectorAll(".ad-piac-orphan, .piac-hide-vehicle").forEach((el) => {
      el.classList.remove("ad-piac-orphan", "piac-hide-vehicle");
      if (!el.classList.contains("ad-layout-hidden") && !el.classList.contains("immo-hide-vehicle")) {
        el.hidden = false;
        el.removeAttribute("hidden");
        el.style.removeProperty("display");
      }
    });
    for (const name of ["gyartasi_ev", "gyartmany", "modell", "kivitel", "okmany_jelleg", "km", "uzemanyag"]) {
      const el = form.elements.namedItem(name);
      if (!el) continue;
      const field = el instanceof RadioNodeList ? el[0] : el;
      if (field?.dataset?.wasRequired === "1") {
        field.required = true;
        field.setAttribute("required", "");
      }
    }
    return;
  }

  const root = await ensurePiacFormFields(form);
  if (root) {
    root.hidden = false;
    root.removeAttribute("hidden");
    root.style.removeProperty("display");
  }

  form
    .querySelectorAll(
      ".field-row--vehicle-top, .field-row--vehicle-year, .field-row--vehicle-ident, .field-row--tipus-egyeb, .field-row--km, .field-row--tech-top, #electric-fields-card, .kisteher-only, #equipment-sections, #egyeb-info-sections"
    )
    .forEach((el) => {
      el.hidden = true;
      el.classList.add("piac-hide-vehicle");
      el.style.setProperty("display", "none", "important");
    });

  form.querySelectorAll(".step-panel[data-step='1'] .form-grid > .field-row").forEach((row) => {
    if (row.closest("#piac-fields")) return;
    row.hidden = true;
    row.classList.add("piac-hide-vehicle");
    row.style.setProperty("display", "none", "important");
  });

  form.querySelectorAll(".step-panel[data-step='2'], .step-panel[data-step='3']").forEach((panel) => {
    panel.querySelectorAll(".card").forEach((card) => {
      card.hidden = true;
      card.classList.add("piac-hide-vehicle");
      card.style.setProperty("display", "none", "important");
    });
  });

  for (const name of ["gyartasi_ev", "gyartmany", "modell", "kivitel", "okmany_jelleg", "km", "uzemanyag", "allapot"]) {
    const el = form.elements.namedItem(name);
    if (!el) continue;
    const field = el instanceof RadioNodeList ? el[0] : el;
    if (!field) continue;
    field.dataset.wasRequired = field.required ? "1" : "0";
    field.required = false;
    field.removeAttribute("required");
  }
}

export function readPiacFormValues(form) {
  const root = form?.querySelector("#piac-fields");
  if (!root) return {};
  syncTitleToHidden(form);
  const intent = root.querySelector('input[name="piac_intent"]:checked')?.value || "";
  const free = Boolean(root.querySelector("#piac_ingyen")?.checked);
  const path = String(root.querySelector("#piac_path")?.value || "").trim();
  const title = String(root.querySelector("#piac_cim")?.value || "").trim();
  return {
    piac_intent: intent,
    piac_path: path,
    piac_ingyen: free ? "1" : "",
    hirdetes_cime: title,
  };
}

export function validatePiacForm(form) {
  const vals = readPiacFormValues(form);
  const title = vals.hirdetes_cime || "";
  if (title.length < 12 || title.length > 70) {
    alert("A hirdetés neve 12–70 karakter legyen.");
    form.querySelector("#piac_cim")?.focus();
    return false;
  }
  const path = String(vals.piac_path || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const tops = form.querySelector("#piac-fields")?._piacTops || [];
  if (!path.length || (tops.length && !isCompletePath(tops, path))) {
    alert("Válassz teljes piactér kategóriát (fő + alkategória).");
    return false;
  }
  if (!vals.piac_intent) {
    alert("Válaszd ki: Kínál vagy Keres.");
    return false;
  }
  return true;
}
