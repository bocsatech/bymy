/**
 * Piactér Tulajdonságok — kategóriánkénti legördülők (Jófogás paramok).
 */

let fieldsPromise = null;
let allasPromise = null;
/** @type {WeakMap<Element, Promise<Element|null>>} */
const syncInflight = new WeakMap();

function allPropRoots(form) {
  return [
    ...form.querySelectorAll("#piac-prop-fields, #piac-allas-fields, .piac-prop-fields, [data-piac-props]"),
  ];
}

/** Egyetlen Tulajdonságok blokk — a párhuzamos sync ne hozzon létre több példányt. */
function ensureSinglePropRoot(form) {
  const roots = allPropRoots(form);
  let root = roots[0] || null;
  for (let i = 1; i < roots.length; i += 1) roots[i].remove();
  if (!root) {
    root = document.createElement("section");
    root.id = "piac-prop-fields";
    root.className = "piac-allas-fields piac-prop-fields";
    root.setAttribute("data-piac-props", "1");
  }
  root.id = "piac-prop-fields";
  root.classList.add("piac-allas-fields", "piac-prop-fields");
  root.setAttribute("data-piac-props", "1");
  return root;
}

function removeAllPropRoots(form) {
  allPropRoots(form).forEach((el) => el.remove());
}

function loadPropFields() {
  if (!fieldsPromise) {
    fieldsPromise = fetch("/data/piac-prop-fields.json", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("piac-prop-fields");
        return res.json();
      })
      .catch(() => null);
  }
  return fieldsPromise;
}

function loadAllasExtras() {
  if (!allasPromise) {
    allasPromise = fetch("/data/piac-allas-fields.json", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return allasPromise;
}

function slugify(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function optionHtml(options, selected = "") {
  const sel = String(selected || "");
  return [
    `<option value="">«Válassz»</option>`,
    ...options.map((opt) => {
      const v = String(opt);
      const picked = v === sel ? " selected" : "";
      return `<option value="${v.replace(/"/g, "&quot;")}"${picked}>${v}</option>`;
    }),
  ].join("");
}

function readPathParts(form) {
  const fromEl = String(form?.querySelector?.("#piac_path")?.value || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEl.length) return fromEl;
  const last = form?._bymyLastFormData && typeof form._bymyLastFormData === "object" ? form._bymyLastFormData : {};
  return String(last.piac_path || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultAllasPropKeys(data) {
  const byPath = data?.byPath || {};
  const hit = Object.entries(byPath).find(([key, keys]) => key.startsWith("allas/") && Array.isArray(keys) && keys.length);
  if (hit) return [...hit[1]];
  return [
    "carrier_level",
    "jobtype",
    "education",
    "job_documents",
    "language",
    "position_generic",
  ];
}

function resolvePropKeys(data, pathParts) {
  if (!data || !pathParts.length) return [];
  const byPath = data.byPath || {};
  for (let i = pathParts.length; i >= 1; i -= 1) {
    const key = pathParts.slice(0, i).join("/");
    if (byPath[key]?.length) return byPath[key];
  }
  const leaf = pathParts[pathParts.length - 1];
  if (data.byLeaf?.[leaf]?.length) return data.byLeaf[leaf];
  /* Állás: ismeretlen / elavult alkategória út esetén is mutassuk a közös mezőket. */
  if (pathParts[0] === "allas") return defaultAllasPropKeys(data);
  return [];
}

function resolveAllasMunkakorOptions(allas, sub) {
  const map = allas?.munkakorByCategory || {};
  if (map[sub]?.length) return map[sub];
  const needle = String(sub || "").toLowerCase();
  if (needle) {
    const fuzzy = Object.entries(map).find(([key]) => key.includes(needle) || needle.includes(key));
    if (fuzzy?.[1]?.length) return fuzzy[1];
  }
  if (map["it-telekommunikacio"]?.length && /it|program|szoftver|tech/i.test(needle)) {
    return map["it-telekommunikacio"];
  }
  return ["Egyéb"];
}

function isPiacDeskWide() {
  return (
    typeof document !== "undefined" &&
    document.body.classList.contains("ad-form-desk-active") &&
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 901px)").matches
  );
}

function placePropSection(form, root) {
  if (!form || !root) return;
  const photosCard =
    form.querySelector('.step-panel[data-step="4"] .card--photos') || form.querySelector(".card--photos");
  const photoPanel =
    photosCard?.closest(".step-panel") ||
    form.querySelector('.step-panel[data-step="4"]') ||
    form.querySelector("#ad-photo-desk-stage");
  if (photosCard?.parentElement) {
    /* Desk: képek fent a kategória mellett; Tulajdonságok a képek alá. */
    if (isPiacDeskWide()) {
      if (root.previousElementSibling !== photosCard) photosCard.insertAdjacentElement("afterend", root);
      return;
    }
    if (root.nextElementSibling !== photosCard) photosCard.insertAdjacentElement("beforebegin", root);
    return;
  }
  if (photoPanel) {
    if (isPiacDeskWide()) {
      const photos = photoPanel.querySelector(".card--photos");
      if (photos && root.previousElementSibling !== photos) photos.insertAdjacentElement("afterend", root);
      else if (!photos && root.parentElement !== photoPanel) photoPanel.appendChild(root);
      return;
    }
    if (root.parentElement !== photoPanel) photoPanel.insertBefore(root, photoPanel.firstChild);
    return;
  }
  const host = form.querySelector("#piac-fields");
  if (host && host.nextElementSibling !== root) host.insertAdjacentElement("afterend", root);
}

function isPositionParam(name) {
  return /^position_/.test(name);
}

async function syncPiacPropFieldsOnce(form) {
  const host = form.querySelector("#piac-fields");
  if (!host) {
    removeAllPropRoots(form);
    return null;
  }

  const pathParts = readPathParts(form);
  const top = pathParts[0] || "";
  /* Root azonnal, await előtt — így a párhuzamos hívások ugyanazt találják. */
  let root = ensureSinglePropRoot(form);
  placePropSection(form, root);

  if (!top) {
    removeAllPropRoots(form);
    return null;
  }

  const data = await loadPropFields();
  if (!data) {
    removeAllPropRoots(form);
    return null;
  }

  root = ensureSinglePropRoot(form);
  placePropSection(form, root);

  const propKeys = resolvePropKeys(data, pathParts);
  const fieldDefs = data.fields || {};
  const allas = top === "allas" ? await loadAllasExtras() : null;
  const sub = pathParts[1] || "";

  const selectable = propKeys.filter((key) => {
    if (isPositionParam(key)) return true;
    if (key === "job_documents") return true;
    return Boolean(fieldDefs[key]?.options?.length);
  });

  if (!selectable.length && !(allas && top === "allas")) {
    removeAllPropRoots(form);
    return null;
  }

  root = ensureSinglePropRoot(form);
  root.setAttribute("aria-label", data.sectionLabel || "Tulajdonságok");
  placePropSection(form, root);

  const last = form._bymyLastFormData && typeof form._bymyLastFormData === "object" ? form._bymyLastFormData : {};
  const prevValues = {};
  for (const key of selectable) {
    const el = root.querySelector(`[name="piac_prop_${key}"]`);
    if (el?.type === "checkbox") continue;
    prevValues[key] = el?.value || String(last[`piac_prop_${key}`] || last[key] || "");
  }
  const prevDocs = [...root.querySelectorAll('input[name="piac_prop_job_documents"]:checked')].map((el) => el.value);
  const lastDocs = String(last.piac_prop_job_documents || last.allas_dokumentumok || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const rows = [];
  for (const key of selectable) {
    if (key === "job_documents") {
      const opts = allas?.shared?.dokumentumok?.options || [
        "önéletrajz",
        "fényképes önéletrajz",
        "motivációs levél",
        "szakképesítést igazoló dokumentum",
        "nem szükséges",
      ];
      const checked = prevDocs.length ? prevDocs : lastDocs;
      rows.push(`
        <fieldset class="piac-allas-field piac-allas-field--docs">
          <legend>${allas?.shared?.dokumentumok?.label || "Jelentkezéshez szükséges dokumentumok"} <span class="req">*</span></legend>
          <div class="piac-allas-checks">
            ${opts
              .map((opt) => {
                const id = `piac_doc_${slugify(opt)}`;
                const on = checked.includes(opt) ? " checked" : "";
                return `<label class="piac-allas-check" for="${id}">
                  <input type="checkbox" id="${id}" name="piac_prop_job_documents" value="${String(opt).replace(/"/g, "&quot;")}"${on} />
                  <span>${opt}</span>
                </label>`;
              })
              .join("")}
          </div>
        </fieldset>`);
      continue;
    }

    let label = fieldDefs[key]?.label || key;
    let options = fieldDefs[key]?.options || [];
    let required = Boolean(fieldDefs[key]?.required);

    if (isPositionParam(key) && allas) {
      label = "Munkakör megnevezése";
      options = resolveAllasMunkakorOptions(allas, sub);
      required = true;
    }

    if (!options.length && fieldDefs[key]?.options?.length) {
      options = fieldDefs[key].options;
    }
    if (!options.length) continue;

    const reqMark = required ? ' <span class="req">*</span>' : "";
    rows.push(`
      <label class="piac-allas-field">
        <span>${label}${reqMark}</span>
        <select id="piac_prop_${key}" name="piac_prop_${key}" ${required ? "required" : ""}>
          ${optionHtml(options, prevValues[key] || "")}
        </select>
      </label>`);
  }

  if (!rows.length) {
    removeAllPropRoots(form);
    return null;
  }

  root = ensureSinglePropRoot(form);
  placePropSection(form, root);
  root.innerHTML = `
    <div class="piac-allas-fields__head">
      <h4 class="piac-allas-fields__title">${data.sectionLabel || "Tulajdonságok"}</h4>
    </div>
    <div class="piac-allas-grid">${rows.join("")}</div>
    ${data.hint ? `<p class="piac-prop-fields__hint">${data.hint}</p>` : ""}
  `;
  root.dataset.path = pathParts.join("/");
  root.dataset.ready = "1";
  return root;
}

export function syncPiacPropFields(form) {
  if (!form) return Promise.resolve(null);
  const prev = syncInflight.get(form);
  /* Sorba állítva: a gyors paint() hívások ne hozzanak létre 12 külön blokkot. */
  const run = (prev || Promise.resolve())
    .catch(() => null)
    .then(() => syncPiacPropFieldsOnce(form))
    .finally(() => {
      if (syncInflight.get(form) === run) syncInflight.delete(form);
    });
  syncInflight.set(form, run);
  return run;
}

/** @deprecated use syncPiacPropFields */
export const syncPiacAllasFields = syncPiacPropFields;

export function readPiacPropValues(form) {
  const root = form?.querySelector("#piac-prop-fields") || form?.querySelector("#piac-allas-fields");
  if (!root) return {};
  const out = {};
  root.querySelectorAll("select[name^='piac_prop_']").forEach((el) => {
    out[el.name] = el.value || "";
  });
  const docs = [...root.querySelectorAll('input[name="piac_prop_job_documents"]:checked')].map((el) => el.value);
  if (docs.length) out.piac_prop_job_documents = docs.join("|");

  /* Back-compat állás keys */
  const pathTop = readPathParts(form)[0];
  if (pathTop === "allas") {
    const pos = root.querySelector("select[name^='piac_prop_position_']");
    out.allas_munkakor = pos?.value || "";
    out.allas_tapasztalat = out.piac_prop_carrier_level || "";
    out.allas_vegzettseg = out.piac_prop_education || "";
    out.allas_nyelv = out.piac_prop_language || "";
    out.allas_foglalkoztatas = out.piac_prop_jobtype || "";
    out.allas_kulfoldi_orszag = out.piac_prop_job_country || "";
    out.allas_dokumentumok = out.piac_prop_job_documents || "";
  }
  return out;
}

/** @deprecated */
export const readPiacAllasValues = readPiacPropValues;

export function validatePiacPropForm(form) {
  const root = form?.querySelector("#piac-prop-fields") || form?.querySelector("#piac-allas-fields");
  if (!root) return true;
  for (const sel of root.querySelectorAll("select[required]")) {
    if (!String(sel.value || "").trim()) {
      const label = sel.closest("label")?.querySelector("span")?.textContent?.replace(/\*/g, "").trim() || "mező";
      alert(`Válaszd ki: ${label}.`);
      sel.focus();
      return false;
    }
  }
  const docs = root.querySelectorAll('input[name="piac_prop_job_documents"]');
  if (docs.length) {
    const any = [...docs].some((el) => el.checked);
    if (!any) {
      alert("Jelöld meg a jelentkezéshez szükséges dokumentumokat.");
      root.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      return false;
    }
  }
  return true;
}

/** @deprecated */
export const validatePiacAllasForm = validatePiacPropForm;
