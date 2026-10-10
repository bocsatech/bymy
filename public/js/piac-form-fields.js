/**
 * Piactér feladás: személyautó-szerű wizard héj, piactér kategóriamenükkel.
 */
let catalogPromise = null;

function readVertical(form) {
  const el = form?.elements?.namedItem("hirdetes_vertical");
  const raw = el instanceof RadioNodeList ? el[0]?.value : el?.value;
  return String(raw ?? "")
    .trim()
    .toLowerCase();
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

function removePiacFormFields(form) {
  form?.querySelector("#piac-fields")?.remove();
}

function shortTopLabel(label) {
  const s = String(label || "").trim();
  if (s.startsWith("Állás")) return "Állás";
  if (s.startsWith("Otthon")) return "Otthon, háztartás";
  if (s.startsWith("Műszaki")) return "Műszaki, elektronika";
  if (s.startsWith("Szabadidő")) return "Szabadidő, sport";
  if (s.startsWith("Divat")) return "Divat, ruházat";
  if (s.startsWith("Üzlet")) return "Üzlet, szolgáltatás";
  if (s.startsWith("Baba")) return "Baba-mama";
  return s;
}

function findNode(nodes, slug) {
  for (const node of nodes || []) {
    if (node.slug === slug) return node;
    const hit = findNode(node.children, slug);
    if (hit) return hit;
  }
  return null;
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

function renderCol(col, items, selectedSlug, onPick) {
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

export async function ensurePiacFormFields(form) {
  if (!form) return null;
  const existing = form.querySelector("#piac-fields");
  if (existing?.dataset.ready === "1") return existing;

  const host =
    form.querySelector('.step-panel[data-step="1"] .card > .card-body') ||
    form.querySelector('.step-panel[data-step="1"]');
  if (!host) return null;

  existing?.remove();
  const catalog = await loadCatalog();
  const tops = (catalog.categories || []).map((node) => ({
    ...node,
    _short: shortTopLabel(node.label),
  }));
  const intents = catalog.listing?.intent || [
    { slug: "kinal", label: "Kínál" },
    { slug: "keres", label: "Keres" },
  ];

  const presetSub = String(form.elements.namedItem("hirdetes_alkategoria")?.value || "").trim();
  let path = [];
  if (presetSub && tops.some((t) => t.slug === presetSub)) {
    path = [presetSub];
  } else if (presetSub) {
    for (const top of tops) {
      const hit = findNode(top.children, presetSub);
      if (hit) {
        path = [top.slug, presetSub];
        const mid = (top.children || []).find((c) => c.slug === presetSub || findNode(c.children, presetSub));
        if (mid && mid.slug !== presetSub) path = [top.slug, mid.slug, presetSub];
        else if (mid) path = [top.slug, mid.slug];
        break;
      }
      for (const mid of top.children || []) {
        if ((mid.children || []).some((leaf) => leaf.slug === presetSub)) {
          path = [top.slug, mid.slug, presetSub];
          break;
        }
      }
      if (path.length) break;
    }
  }

  const root = document.createElement("div");
  root.id = "piac-fields";
  root.className = "piac-fields";
  root.setAttribute("data-piac-only", "1");
  root.innerHTML = `
    <div class="piac-fields__head">
      <h3 class="piac-fields__title">Kategória</h3>
      <p class="piac-fields__hint">Válassz fő- és alkategóriát a piactéren.</p>
    </div>
    <div class="piac-cat-menus" aria-label="Piactér kategóriák">
      <div class="piac-cat-col" data-level="0"></div>
      <div class="piac-cat-col" data-level="1" hidden></div>
      <div class="piac-cat-col" data-level="2" hidden></div>
    </div>
    <input type="hidden" id="piac_path" name="piac_path" value="" />
    <div class="piac-intent" role="group" aria-label="Szándék">
      <span class="piac-intent__label">Szándék <span class="req">*</span></span>
      <div class="piac-intent__opts">
        ${intents
          .map(
            (it, i) => `
          <label class="piac-intent__opt">
            <input type="radio" name="piac_intent" value="${it.slug}" ${i === 0 ? "checked" : ""} />
            <span>${it.label}</span>
          </label>`
          )
          .join("")}
      </div>
    </div>
    <div class="piac-field">
      <label for="piac_cim">Hirdetés neve <span class="req">*</span></label>
      <input id="piac_cim" name="piac_cim" type="text" maxlength="70" minlength="12" autocomplete="off" placeholder="pl. iPhone 13, 128 GB, jó állapot" />
      <p class="piac-field__hint">12–70 karakter</p>
    </div>
    <div class="piac-field piac-field--row">
      <label class="piac-free">
        <input type="checkbox" id="piac_ingyen" name="piac_ingyen" value="1" />
        <span>Ingyen elvihető</span>
      </label>
    </div>
  `;

  host.prepend(root);

  const col0 = root.querySelector('[data-level="0"]');
  const col1 = root.querySelector('[data-level="1"]');
  const col2 = root.querySelector('[data-level="2"]');

  function paint() {
    const top = tops.find((t) => t.slug === path[0]) || null;
    const mid = top ? (top.children || []).find((c) => c.slug === path[1]) || null : null;
    const l2 = top ? top.children || [] : [];
    const l3 = mid ? mid.children || [] : [];

    renderCol(col0, tops, path[0] || "", (item) => {
      path = [item.slug];
      paint();
    });
    renderCol(col1, l2, path[1] || "", (item) => {
      path = [path[0], item.slug];
      paint();
    });
    renderCol(col2, l3, path[2] || "", (item) => {
      path = [path[0], path[1], item.slug];
      paint();
    });

    syncAlkategoria(form, path);
  }

  paint();

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

  root.dataset.ready = "1";
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
  if (!vals.piac_path) {
    alert("Válassz piactér kategóriát.");
    return false;
  }
  if (!vals.piac_intent) {
    alert("Válaszd ki: Kínál vagy Keres.");
    return false;
  }
  return true;
}
