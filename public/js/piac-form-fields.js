/**
 * Piactér feladás: mentett kategóriafa — ikonsor + alkategória lista (ref. Jófogás).
 */
import {
  syncPiacPropFields,
  readPiacPropValues,
  validatePiacPropForm,
} from "./piac-prop-fields.js?v=c01ab6ddfc";

let catalogPromise = null;

const PIAC_TOP_LABELS = {
  allas: "Állásajánlatok, álláskeresés",
  "otthon-haztartas": "Otthon, háztartás",
  "muszaki-elektronika": "Műszaki cikkek, elektronika",
  "szabadido-sport": "Szabadidő, sport",
  "divat-ruhazat": "Divat, ruházat",
  "uzlet-szolgaltatas": "Üzlet, szolgáltatás",
  "baba-mama": "Baba-mama",
};

const PIAC_TOP_SHORT = {
  allas: "Állás",
  "otthon-haztartas": "Otthon, háztartás",
  "muszaki-elektronika": "Műszaki, elektronika",
  "szabadido-sport": "Szabadidő, sport",
  "divat-ruhazat": "Divat, ruházat",
  "uzlet-szolgaltatas": "Üzlet, szolgáltatás",
  "baba-mama": "Baba-mama",
};

/** Fő kategória ikonok — kép vagy SVG a lekerekített képboxba. */
const PIAC_TOP_ICONS = {
  allas:
    '<img class="piac-top-icon__img" src="/images/categories/piac-allas.png" alt="" width="48" height="44" decoding="async" />',
  "otthon-haztartas":
    '<img class="piac-top-icon__img" src="/images/categories/piac-otthon.png" alt="" width="48" height="44" decoding="async" />',
  "muszaki-elektronika":
    '<img class="piac-top-icon__img" src="/images/categories/piac-muszaki.png" alt="" width="48" height="44" decoding="async" />',
  "szabadido-sport":
    '<img class="piac-top-icon__img" src="/images/categories/piac-sport.png" alt="" width="48" height="44" decoding="async" />',
  "divat-ruhazat":
    '<img class="piac-top-icon__img" src="/images/categories/piac-divat.png" alt="" width="48" height="44" decoding="async" />',
  "uzlet-szolgaltatas":
    '<img class="piac-top-icon__img" src="/images/categories/piac-uzlet.png" alt="" width="48" height="44" decoding="async" />',
  "baba-mama":
    '<img class="piac-top-icon__img" src="/images/categories/piac-baba.png" alt="" width="48" height="44" decoding="async" />',
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
  if (PIAC_TOP_SHORT[key]) return PIAC_TOP_SHORT[key];
  if (PIAC_TOP_LABELS[key]) return PIAC_TOP_SHORT[key] || PIAC_TOP_LABELS[key];
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
  return (
    String(path || "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)[0] || ""
  );
}

function removePiacFormFields(form) {
  form?.querySelector("#piac-fields")?.remove();
  form
    ?.querySelectorAll("#piac-allas-fields, #piac-prop-fields, .piac-prop-fields, [data-piac-props]")
    .forEach((el) => el.remove());
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

function setHidden(form, name, value) {
  const el = form.elements.namedItem(name);
  const field = el instanceof RadioNodeList ? el[0] : el;
  if (field) field.value = value;
}

function syncAlkategoria(form, pathSlugs) {
  const top = pathSlugs[0] || "";
  const leaf = pathSlugs.filter(Boolean).at(-1) || "";
  setHidden(form, "hirdetes_vertical", "piac");
  setHidden(form, "hirdetes_alkategoria", leaf || top);
  setHidden(form, "jarmu_kategoria", leaf || top);
  const pathEl = form.querySelector("#piac_path");
  if (pathEl) pathEl.value = pathSlugs.filter(Boolean).join("/");

  const label = shortPiacTopLabel(top) || "Piactér";
  try {
    window.__bymyCategoryPicker?.syncWizardContext?.({
      vertical: "piac",
      subtype: top,
      label,
    });
  } catch {
    /* ignore */
  }
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

function resolvePathFromPreset(tops, presetSub, storedPath) {
  const fromStored = String(storedPath || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  /* Mentett path mindig elsőbbséget kap — üres katalógus / race esetén se vesszen el. */
  if (fromStored.length) {
    if (!tops?.length || tops.some((t) => t.slug === fromStored[0])) {
      return fromStored.slice(0, 3);
    }
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

function renderButtonList(host, items, selectedSlug, onPick) {
  if (!host) return;
  host.innerHTML = "";
  host.hidden = !items.length;
  if (!items.length) return;
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "piac-sub-btn" + (item.slug === selectedSlug ? " is-active" : "");
    btn.setAttribute("aria-pressed", item.slug === selectedSlug ? "true" : "false");
    btn.textContent = item.label;
    btn.addEventListener("click", () => onPick(item));
    host.appendChild(btn);
  }
}

function renderTopIcons(row, tops, selectedSlug, onPick) {
  if (!row) return;
  row.innerHTML = "";
  for (const item of tops) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "piac-top-icon" + (item.slug === selectedSlug ? " is-active" : "");
    btn.setAttribute("aria-pressed", item.slug === selectedSlug ? "true" : "false");
    btn.dataset.slug = item.slug;
    btn.title = item.label;
    btn.innerHTML = `
      <span class="piac-top-icon__box" aria-hidden="true">${PIAC_TOP_ICONS[item.slug] || ""}</span>
      <span class="piac-top-icon__label">${item._short || shortPiacTopLabel(item.slug)}</span>
    `;
    btn.addEventListener("click", () => onPick(item));
    row.appendChild(btn);
  }
}

function placePiacRoot(form, root) {
  if (!form || !root) return false;
  root.classList.remove("piac-fields--desk-top");
  const deskWide =
    document.body.classList.contains("ad-form-desk-active") &&
    window.matchMedia("(min-width: 901px)").matches;
  if (deskWide) {
    const shell = form.querySelector("#ad-form-desk-shell");
    if (shell) {
      if (root.parentElement !== shell || shell.firstElementChild !== root) {
        shell.insertBefore(root, shell.firstChild);
      }
      return true;
    }
  }
  const panel = form.querySelector('.step-panel[data-step="1"]');
  if (!panel) return false;
  if (root.parentElement !== panel || panel.firstElementChild !== root) {
    panel.insertBefore(root, panel.firstChild);
  }
  return true;
}

export async function ensurePiacFormFields(form) {
  if (!form) return null;
  const panel = form.querySelector('.step-panel[data-step="1"]');
  if (!panel) return null;

  const catalog = await loadCatalog();
  const tops = (catalog.categories || []).map((node) => ({
    ...node,
    label: PIAC_TOP_LABELS[node.slug] || node.label,
    _short: shortPiacTopLabel(node.slug),
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

  if (
    existing?.dataset.ready === "1" &&
    existing.dataset.catalogV === String(catalog.version || "2") &&
    existing.querySelector(".piac-intent-toggle")
  ) {
    placePiacRoot(form, existing);
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
    if (wantPath && currentPath !== wantPath && typeof existing._piacRepaint === "function") {
      existing._piacRepaint(path);
    } else if (!wantPath && typeof existing._piacRepaint === "function" && !currentPath) {
      existing._piacRepaint(path);
    }
    existing._piacTops = tops;
    void syncPiacPropFields(form);
    return existing;
  }

  existing?.remove();

  const root = document.createElement("div");
  root.id = "piac-fields";
  root.className = "piac-fields";
  root.setAttribute("data-piac-only", "1");
  root.innerHTML = `
    <div class="piac-fields__head">
      <h3 class="piac-fields__title">Kategória</h3>
      <div class="piac-intent-toggle" role="group" aria-label="Kínál vagy keres">
        ${intents
          .map(
            (it) =>
              `<button type="button" class="piac-intent-toggle__btn${
                seedIntent === it.slug ? " is-active" : ""
              }" data-piac-intent="${it.slug}">${it.label}</button>`
          )
          .join("")}
      </div>
    </div>
    <div class="piac-top-icons" role="listbox" aria-label="Fő kategóriák"></div>
    <div class="piac-drill" aria-label="Alkategóriák">
      <div class="piac-sub-col" data-level="1" hidden></div>
      <div class="piac-sub-col" data-level="2" hidden></div>
    </div>
    <p class="piac-fields__path" aria-live="polite"></p>
    <input type="hidden" id="piac_path" name="piac_path" value="" />
    <div class="piac-intent-radios" hidden aria-hidden="true">
      ${intents
        .map(
          (it) =>
            `<label><input type="radio" name="piac_intent" value="${it.slug}" ${
              seedIntent === it.slug ? "checked" : ""
            } />${it.label}</label>`
        )
        .join("")}
    </div>
    <div class="piac-fields__title-row">
      <div class="piac-field piac-field--title">
        <label for="piac_cim">Hirdetés neve <span class="req">*</span></label>
        <input id="piac_cim" name="piac_cim" type="text" maxlength="70" minlength="12" autocomplete="off" placeholder="pl. iPhone 13, 128 GB, jó állapot" value="${String(seedTitle || "").replace(/"/g, "&quot;")}" />
        <p class="piac-field__hint">12–70 karakter</p>
      </div>
      <div class="piac-field piac-field--free">
        <label class="piac-free">
          <input type="checkbox" id="piac_ingyen" name="piac_ingyen" value="1" ${seedFree ? "checked" : ""} />
          <span>Ingyen elvihető</span>
        </label>
      </div>
    </div>
  `;

  placePiacRoot(form, root);

  const topRow = root.querySelector(".piac-top-icons");
  const col1 = root.querySelector('[data-level="1"]');
  const col2 = root.querySelector('[data-level="2"]');
  const status = root.querySelector(".piac-fields__path");
  const intentToggle = root.querySelector(".piac-intent-toggle");

  function syncIntentToggle() {
    const current =
      root.querySelector('input[name="piac_intent"]:checked')?.value || seedIntent || "kinal";
    intentToggle?.querySelectorAll("[data-piac-intent]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-piac-intent") === current);
    });
  }

  intentToggle?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-piac-intent]");
    if (!btn || !intentToggle.contains(btn)) return;
    const slug = btn.getAttribute("data-piac-intent") || "";
    const radio = root.querySelector(`input[name="piac_intent"][value="${slug}"]`);
    if (radio) radio.checked = true;
    syncIntentToggle();
    paint();
  });

  function paint() {
    const top = tops.find((t) => t.slug === path[0]) || null;
    const mid = top ? (top.children || []).find((c) => c.slug === path[1]) || null : null;
    const l2 = (top?.children || []).map((n) => ({ slug: n.slug, label: n.label, node: n }));
    const l3 = nodeComplete(mid)
      ? []
      : (mid?.children || []).map((n) => ({ slug: n.slug, label: n.label }));

    renderTopIcons(topRow, tops, path[0] || "", (item) => {
      path = [item.slug];
      paint();
    });
    renderButtonList(col1, l2, path[1] || "", (item) => {
      path = [path[0], item.slug];
      paint();
    });
    renderButtonList(col2, l3, path[2] || "", (item) => {
      path = [path[0], path[1], item.slug];
      paint();
    });

    syncAlkategoria(form, path);
    syncIntentToggle();
    void syncPiacPropFields(form);

    const labels = [];
    const intentVal = root.querySelector('input[name="piac_intent"]:checked')?.value || "";
    const intentLabel = intents.find((i) => i.slug === intentVal)?.label || "";
    if (intentLabel) labels.push(intentLabel);
    if (top) labels.push(top.label);
    if (mid) labels.push(mid.label);
    if (path[2]) {
      const leaf = l3.find((n) => n.slug === path[2]);
      if (leaf) labels.push(leaf.label);
    }
    if (status) {
      status.textContent = labels.length > 1 || path[0] ? labels.join(" › ") : "Válassz kategóriát a menüből.";
      status.classList.toggle("is-empty", !path[0]);
    }
  }

  root._piacRepaint = (nextPath) => {
    path = Array.isArray(nextPath) ? nextPath.slice(0, 3) : path;
    paint();
  };

  paint();
  syncTitleToHidden(form);

  const title = root.querySelector("#piac_cim");
  title?.addEventListener("input", () => syncTitleToHidden(form));
  title?.addEventListener("change", () => syncTitleToHidden(form));

  const free = root.querySelector("#piac_ingyen");
  free?.addEventListener("change", (event) => {
    const price = form.elements.namedItem("vetelar");
    const field = price instanceof RadioNodeList ? price[0] : price;
    if (!field) return;
    if (free.checked) {
      field.dataset.wasRequired = field.required ? "1" : "0";
      field.required = false;
      field.removeAttribute("required");
      const digits = String(field.dataset.kmDigits || field.value || "").replace(/\D/g, "");
      if (digits && digits !== "0") field.dataset.piacPriceBeforeFree = digits;
      /* Programozott seed ne törölje a már begépelt árat. */
      if (event.isTrusted || !digits || digits === "0") {
        field.value = "0";
        if (field.dataset) field.dataset.kmDigits = "0";
      }
    } else {
      if (field.dataset.wasRequired === "1") {
        field.required = true;
        field.setAttribute("required", "");
      }
      const restore = String(field.dataset.piacPriceBeforeFree || "").replace(/\D/g, "");
      if (field.value === "0" || String(field.value || "").trim() === "") {
        field.value = restore || "";
        if (field.dataset) field.dataset.kmDigits = restore || "";
      }
    }
  });
  if (seedFree) free?.dispatchEvent(new Event("change"));

  root.dataset.catalogV = String(catalog.version || "2");
  root.dataset.ready = "1";
  root._piacTops = tops;
  return root;
}

export async function syncPiacFormVisibility(form) {
  if (!form) return;
  const isPiac = readVertical(form) === "piac";
  form.classList.toggle("ad-form--piac", isPiac);
  document.body.classList.toggle("ad-vertical-piac", isPiac);

  const wheel = document.getElementById("wizard-category-wheel-wrap");
  if (wheel) {
    if (isPiac) {
      wheel.hidden = true;
      wheel.setAttribute("hidden", "");
    } else {
      wheel.hidden = false;
      wheel.removeAttribute("hidden");
    }
  }

  document.querySelectorAll("[data-step-indicator]").forEach((el) => {
    const n = Number(el.dataset.stepIndicator);
    const vehicleStep = n === 2 || n === 3;
    el.classList.toggle("ad-step-skip", isPiac && vehicleStep);
    if (isPiac && vehicleStep) el.setAttribute("aria-hidden", "true");
    else if (!form.classList.contains("ad-form--ingatlan")) el.removeAttribute("aria-hidden");
  });

  const leiras = form.querySelector("#leiras");
  if (leiras) {
    if (!leiras.dataset.placeholderAuto) {
      leiras.dataset.placeholderAuto = leiras.getAttribute("placeholder") || "";
    }
    if (isPiac) {
      leiras.setAttribute(
        "placeholder",
        "Írj pár mondatot a hirdetésről — a gomb emberszerű szöveget készít belőle."
      );
    } else if (leiras.dataset.placeholderAuto) {
      leiras.setAttribute("placeholder", leiras.dataset.placeholderAuto);
    }
  }

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
    const priceLabel = form.querySelector('label[for="vetelar"]');
    if (priceLabel?.dataset?.piacLabelSaved) {
      priceLabel.innerHTML = priceLabel.dataset.piacLabelSaved;
      delete priceLabel.dataset.piacLabelSaved;
    }
    const vetelar = form.elements.namedItem("vetelar");
    const vetelarField = vetelar instanceof RadioNodeList ? vetelar[0] : vetelar;
    if (vetelarField && vetelarField.getAttribute("placeholder") === "pl. 15 000") {
      vetelarField.setAttribute("placeholder", "pl. 3 700 000");
    }
    return;
  }

  const root = await ensurePiacFormFields(form);
  if (root) {
    root.hidden = false;
    root.removeAttribute("hidden");
    root.style.removeProperty("display");
    placePiacRoot(form, root);
    void syncPiacPropFields(form);
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

  /* Autó-specifikus mezők (Bérelhető, forgalomba helyezés…) — piactéren ne látszódjanak. */
  for (const name of [
    "berelheto",
    "forgalomba_helyezes_ar",
    "forgalomba_helyezes_ev",
    "forgalomba_helyezes_honap",
    "vetelar_eur",
    "akcios_ar",
  ]) {
    const el = form.elements.namedItem(name);
    const field = el instanceof RadioNodeList ? el[0] : el;
    const wrap =
      field?.closest?.(
        ".labeled-field, .field-row, .field-stack, .ad-form-field, .ad-layout-item, [data-desk-field], label"
      ) || field?.closest?.("label");
    if (wrap) {
      wrap.hidden = true;
      wrap.classList.add("piac-hide-vehicle");
      wrap.style.setProperty("display", "none", "important");
    }
  }

  /* Vételár: piactéren sima Ft szövegmező — nincs autó-piaci sáv / EUR. */
  const priceHint = document.getElementById("price-market-hint");
  if (priceHint) {
    priceHint.hidden = true;
    priceHint.setAttribute("hidden", "");
    priceHint.removeAttribute("data-opinion");
  }
  const vetelar = form.elements.namedItem("vetelar");
  const vetelarField = vetelar instanceof RadioNodeList ? vetelar[0] : vetelar;
  if (vetelarField) {
    vetelarField.setAttribute("autocomplete", "off");
    vetelarField.setAttribute("inputmode", "numeric");
    vetelarField.setAttribute("placeholder", "pl. 15 000");
    vetelarField.disabled = false;
    vetelarField.removeAttribute("disabled");
    const priceLabel = form.querySelector('label[for="vetelar"]');
    if (priceLabel && !priceLabel.dataset.piacLabelSaved) {
      priceLabel.dataset.piacLabelSaved = priceLabel.innerHTML;
      priceLabel.innerHTML = 'Ár: <span class="req">*</span>';
    }
    if (vetelarField.dataset.piacRememberBound !== "1") {
      vetelarField.dataset.piacRememberBound = "1";
      const rememberPrice = () => {
        const digits = String(vetelarField.dataset.kmDigits || vetelarField.value || "").replace(/\D/g, "");
        if (!digits || digits === "0") return;
        if (!form._bymyLastFormData || typeof form._bymyLastFormData !== "object") {
          form._bymyLastFormData = {};
        }
        form._bymyLastFormData.vetelar = digits;
      };
      vetelarField.addEventListener("input", rememberPrice);
      vetelarField.addEventListener("change", rememberPrice);
      vetelarField.addEventListener("blur", rememberPrice);
    }
    /* Layout / hide ne vegye ki a FormData-ból. */
    const priceWrap =
      vetelarField.closest(".labeled-field, .ad-layout-item, .suffix-field")?.closest(".card") ||
      vetelarField.closest(".card");
    if (priceWrap) {
      priceWrap.hidden = false;
      priceWrap.removeAttribute("hidden");
      priceWrap.classList.remove("piac-hide-vehicle", "ad-layout-hidden", "ad-immo-orphan");
      priceWrap.style.removeProperty("display");
    }
  }

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
    ...readPiacPropValues(form),
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
    alert("Válassz kategóriát a menüből (fő + alkategória).");
    form.querySelector("#piac-fields")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    return false;
  }
  if (!vals.piac_intent) {
    alert("Válaszd ki: Kínál vagy Keres.");
    return false;
  }
  if (!validatePiacPropForm(form)) return false;
  return true;
}
