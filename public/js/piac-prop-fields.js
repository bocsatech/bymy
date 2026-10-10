/**
 * Piactér Tulajdonságok — kategóriánkénti legördülők (Jófogás paramok).
 */

let fieldsPromise = null;
let allasPromise = null;

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
  return String(form?.querySelector?.("#piac_path")?.value || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolvePropKeys(data, pathParts) {
  if (!data || !pathParts.length) return [];
  const byPath = data.byPath || {};
  for (let i = pathParts.length; i >= 1; i -= 1) {
    const key = pathParts.slice(0, i).join("/");
    if (byPath[key]?.length) return byPath[key];
  }
  const leaf = pathParts[pathParts.length - 1];
  return data.byLeaf?.[leaf] || [];
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
    if (root.nextElementSibling !== photosCard) photosCard.insertAdjacentElement("beforebegin", root);
    return;
  }
  if (photoPanel) {
    if (root.parentElement !== photoPanel) photoPanel.insertBefore(root, photoPanel.firstChild);
    return;
  }
  const host = form.querySelector("#piac-fields");
  if (host && host.nextElementSibling !== root) host.insertAdjacentElement("afterend", root);
}

function isPositionParam(name) {
  return /^position_/.test(name);
}

export async function syncPiacPropFields(form) {
  if (!form) return null;
  const host = form.querySelector("#piac-fields");
  if (!host) return null;

  const pathParts = readPathParts(form);
  const top = pathParts[0] || "";
  let root = form.querySelector("#piac-allas-fields") || form.querySelector("#piac-prop-fields");

  if (!top) {
    root?.remove();
    return null;
  }

  const data = await loadPropFields();
  if (!data) return null;

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
    root?.remove();
    return null;
  }

  if (!root) {
    root = document.createElement("section");
    root.id = "piac-prop-fields";
    root.className = "piac-allas-fields piac-prop-fields";
    root.setAttribute("data-piac-props", "1");
  }
  root.id = "piac-prop-fields";
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
      options = allas.munkakorByCategory?.[sub] || ["Egyéb"];
      required = true;
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
    root.remove();
    return null;
  }

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
