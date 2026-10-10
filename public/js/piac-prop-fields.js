/**
 * Piactér Tulajdonságok — menüsiget + dobkerék sheet (Jófogás paramok).
 */

import { openPiacOptionSheet } from "./piac-category-drum.js?v=fd64be72f6";

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

function normOptionText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Mentett érték → katalógus opció (kis/nagybetű, elírás, régi címke). */
function matchSelectOption(options, selected = "") {
  const sel = String(selected || "").trim();
  const list = (options || []).map((o) => String(o));
  if (!sel) return { value: "", options: list };
  if (list.includes(sel)) return { value: sel, options: list };
  const ci = list.find((o) => o.toLowerCase() === sel.toLowerCase());
  if (ci) return { value: ci, options: list };
  const nsel = normOptionText(sel);
  const byNorm = list.find((o) => normOptionText(o) === nsel);
  if (byNorm) return { value: byNorm, options: list };
  const byPart = list.find((o) => {
    const no = normOptionText(o);
    return no && nsel && (no.includes(nsel) || nsel.includes(no));
  });
  if (byPart) return { value: byPart, options: list };
  const tokens =
    String(sel)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]{2,}/g) || [];
  if (tokens.length >= 2) {
    const byTokens = list.find((o) => {
      const no = normOptionText(o);
      return tokens.every((t) => no.includes(t));
    });
    if (byTokens) return { value: byTokens, options: list };
  }
  const range = sel.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    let best = null;
    let bestScore = -1;
    for (const o of list) {
      const om = o.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (!om) continue;
      const oa = Number(om[1]);
      const ob = Number(om[2]);
      const overlap = Math.max(0, Math.min(b, ob) - Math.max(a, oa));
      const score = overlap > 0 ? overlap : oa === a || ob === b ? 0.5 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (best && bestScore > 0) return { value: best, options: list };
  }
  /* Ne vesszen el: ideiglenes opció a mentett értékkel. */
  return { value: sel, options: [...list, sel] };
}

function optionHtml(options, selected = "") {
  const matched = matchSelectOption(options, selected);
  const sel = matched.value;
  return [
    `<option value="">«Válassz»</option>`,
    ...matched.options.map((opt) => {
      const v = String(opt);
      const picked = v === sel ? " selected" : "";
      return `<option value="${v.replace(/"/g, "&quot;")}"${picked}>${v}</option>`;
    }),
  ].join("");
}

function readDomPositionValue(root) {
  const pos = root?.querySelector?.("select[name^='piac_prop_position_']");
  return String(pos?.value || "").trim();
}

function firstLastPositionValue(last = {}) {
  const munkakor = String(last.allas_munkakor || "").trim();
  if (munkakor) return munkakor;
  for (const [k, v] of Object.entries(last || {})) {
    if (k.startsWith("piac_prop_position_") && String(v || "").trim()) return String(v).trim();
  }
  return "";
}

function prevValueForProp(last, key, root = null) {
  const direct = String(last[`piac_prop_${key}`] || last[key] || "").trim();
  if (direct) return direct;
  const aliases = {
    carrier_level: ["allas_tapasztalat"],
    jobtype: ["allas_foglalkoztatas"],
    education: ["allas_vegzettseg"],
    language: ["allas_nyelv"],
    job_country: ["allas_kulfoldi_orszag"],
  };
  for (const alt of aliases[key] || []) {
    const v = String(last[alt] || "").trim();
    if (v) return v;
  }
  if (isPositionParam(key)) {
    /* Más position_* select / kulcsváltás után is őrizze a munkakört. */
    const fromDom = readDomPositionValue(root);
    if (fromDom) return fromDom;
    return firstLastPositionValue(last);
  }
  return "";
}

function rememberPropValue(form, name, value) {
  if (!form || !name) return;
  const v = String(value || "").trim();
  if (!form._bymyLastFormData || typeof form._bymyLastFormData !== "object") {
    form._bymyLastFormData = {};
  }
  if (!v) return;
  form._bymyLastFormData[name] = v;
  if (/^piac_prop_position_/.test(name) || name === "allas_munkakor") {
    form._bymyLastFormData.allas_munkakor = v;
  }
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
  const domPosition = readDomPositionValue(root);
  for (const key of selectable) {
    const el = root.querySelector(`[name="piac_prop_${key}"]`);
    if (el?.type === "checkbox") continue;
    const fromEl = String(el?.value || "").trim();
    if (isPositionParam(key)) {
      prevValues[key] = fromEl || domPosition || prevValueForProp(last, key, root);
    } else {
      prevValues[key] = fromEl || prevValueForProp(last, key, root);
    }
  }
  const prevDocs = [...root.querySelectorAll('input[name="piac_prop_job_documents"]:checked')].map((el) => el.value);
  const lastDocs = String(last.piac_prop_job_documents || last.allas_dokumentumok || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const menuItems = [];
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
      menuItems.push({
        key: "job_documents",
        label: allas?.shared?.dokumentumok?.label || "Jelentkezéshez szükséges dokumentumok",
        required: true,
        multi: true,
        options: opts,
        value: checked,
      });
      continue;
    }

    let label = fieldDefs[key]?.label || key;
    let options = fieldDefs[key]?.options || [];
    let required = Boolean(fieldDefs[key]?.required);

    if (isPositionParam(key)) {
      label = "Munkakör megnevezése";
      options = allas ? resolveAllasMunkakorOptions(allas, sub) : ["Egyéb"];
      required = true;
      const wantPos = prevValues[key] || firstLastPositionValue(last);
      if (wantPos && !options.some((o) => String(o) === wantPos)) options = [...options, wantPos];
      if (wantPos) prevValues[key] = wantPos;
    }

    if (!options.length && fieldDefs[key]?.options?.length) {
      options = fieldDefs[key].options;
    }
    if (!options.length) continue;

    const matched = matchSelectOption(options, prevValues[key] || "");
    menuItems.push({
      key,
      label,
      required,
      multi: false,
      options: matched.options,
      value: matched.value || "",
    });
  }

  if (!menuItems.length) {
    removeAllPropRoots(form);
    return null;
  }

  root = ensureSinglePropRoot(form);
  placePropSection(form, root);

  const rowsHtml = menuItems
    .map((item) => {
      const name = item.multi ? "piac_prop_job_documents" : `piac_prop_${item.key}`;
      const reqMark = item.required ? ' <span class="req">*</span>' : "";
      const display = item.multi
        ? item.value?.length
          ? item.value.join(", ")
          : "Válassz…"
        : item.value || "Válassz…";
      const empty = item.multi ? !item.value?.length : !item.value;
      const hiddenSelect = item.multi
        ? item.options
            .map((opt) => {
              const on = (item.value || []).includes(opt) ? " checked" : "";
              return `<input type="checkbox" class="piac-prop-menu-check" name="piac_prop_job_documents" value="${String(opt).replace(/"/g, "&quot;")}"${on} tabindex="-1" />`;
            })
            .join("")
        : `<select id="piac_prop_${item.key}" name="${name}" class="piac-prop-menu-select" ${item.required ? "required" : ""} tabindex="-1" aria-hidden="true">
            ${optionHtml(item.options, item.value || "")}
          </select>`;
      return `
        <div class="piac-prop-menu-row" data-prop-key="${item.key}" data-prop-multi="${item.multi ? "1" : "0"}">
          <button type="button" class="piac-prop-menu-trigger" data-prop-trigger="${item.key}">
            <span class="piac-prop-menu-trigger__label">${item.label}${reqMark}</span>
            <span class="piac-prop-menu-trigger__value${empty ? " is-empty" : ""}">${String(display).replace(/</g, "&lt;")}</span>
            <span class="piac-prop-menu-trigger__chev" aria-hidden="true">›</span>
          </button>
          <div class="piac-prop-menu-hidden">${hiddenSelect}</div>
        </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="piac-allas-fields__head">
      <h4 class="piac-allas-fields__title">${data.sectionLabel || "Tulajdonságok"}</h4>
    </div>
    <div class="piac-prop-menu-island" role="group" aria-label="${data.sectionLabel || "Tulajdonságok"}">
      ${rowsHtml}
    </div>
    ${data.hint ? `<p class="piac-prop-fields__hint">${data.hint}</p>` : ""}
  `;

  const itemByKey = Object.fromEntries(menuItems.map((it) => [it.key, it]));

  function syncTriggerDisplay(key) {
    const row = root.querySelector(`[data-prop-key="${key}"]`);
    const valueEl = row?.querySelector(".piac-prop-menu-trigger__value");
    if (!row || !valueEl) return;
    const item = itemByKey[key];
    if (!item) return;
    if (item.multi) {
      const checked = [...row.querySelectorAll('input[name="piac_prop_job_documents"]:checked')].map((el) => el.value);
      valueEl.textContent = checked.length ? checked.join(", ") : "Válassz…";
      valueEl.classList.toggle("is-empty", !checked.length);
      return;
    }
    const sel = row.querySelector("select");
    const v = String(sel?.value || "").trim();
    valueEl.textContent = v || "Válassz…";
    valueEl.classList.toggle("is-empty", !v);
  }

  for (const key of selectable) {
    if (key === "job_documents") continue;
    const el = root.querySelector(`[name="piac_prop_${key}"]`);
    if (!el || el.tagName !== "SELECT") continue;
    const want = prevValues[key] || "";
    if (!want) continue;
    const matched = matchSelectOption(
      [...el.options].map((o) => o.value).filter(Boolean),
      want
    );
    if (matched.value && ![...el.options].some((o) => o.value === matched.value)) {
      const opt = document.createElement("option");
      opt.value = matched.value;
      opt.textContent = matched.value;
      el.appendChild(opt);
    }
    if (matched.value) {
      el.value = matched.value;
      rememberPropValue(form, el.name, matched.value);
    }
    syncTriggerDisplay(key);
  }
  syncTriggerDisplay("job_documents");

  root.querySelectorAll("select[name^='piac_prop_']").forEach((el) => {
    if (el.dataset.piacRememberBound === "1") return;
    el.dataset.piacRememberBound = "1";
    el.addEventListener("change", () => rememberPropValue(form, el.name, el.value));
  });

  root.querySelectorAll("[data-prop-trigger]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-prop-trigger") || "";
      const item = itemByKey[key];
      if (!item) return;
      const row = root.querySelector(`[data-prop-key="${key}"]`);
      if (item.multi) {
        const current = [...(row?.querySelectorAll('input[name="piac_prop_job_documents"]:checked') || [])].map(
          (el) => el.value
        );
        openPiacOptionSheet({
          title: item.label,
          multi: true,
          includeEmpty: false,
          items: item.options.map((o) => ({ value: o, label: o })),
          value: current,
          onDone: (picked) => {
            const set = new Set((picked || []).map(String));
            row?.querySelectorAll('input[name="piac_prop_job_documents"]').forEach((el) => {
              el.checked = set.has(el.value);
            });
            rememberPropValue(form, "piac_prop_job_documents", [...set].join("|"));
            syncTriggerDisplay(key);
          },
        });
        return;
      }
      const sel = row?.querySelector("select");
      openPiacOptionSheet({
        title: item.label,
        multi: false,
        includeEmpty: !item.required,
        emptyLabel: "«Válassz»",
        items: item.options.map((o) => ({ value: o, label: o })),
        value: String(sel?.value || item.value || ""),
        onDone: (picked) => {
          if (!sel) return;
          const want = String(picked || "").trim();
          if (want && ![...sel.options].some((o) => o.value === want)) {
            const opt = document.createElement("option");
            opt.value = want;
            opt.textContent = want;
            sel.appendChild(opt);
          }
          sel.value = want;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          rememberPropValue(form, sel.name, want);
          syncTriggerDisplay(key);
        },
      });
    });
  });

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

function pickLastPropBag(last = {}) {
  const out = {};
  for (const [k, v] of Object.entries(last || {})) {
    if (!(/^piac_prop_/.test(k) || /^allas_/.test(k))) continue;
    const val = String(v ?? "").trim();
    if (val) out[k] = val;
  }
  return out;
}

export function readPiacPropValues(form) {
  const last = form?._bymyLastFormData && typeof form._bymyLastFormData === "object" ? form._bymyLastFormData : {};
  const root = form?.querySelector("#piac-prop-fields") || form?.querySelector("#piac-allas-fields");
  if (!root) return pickLastPropBag(last);

  const out = {};
  root.querySelectorAll("select[name^='piac_prop_']").forEach((el) => {
    const v = String(el.value || "").trim();
    if (v) {
      out[el.name] = v;
      return;
    }
    /* Üres select ne törölje a mentett munkakört / propsot mentéskor. */
    const fallback = String(last[el.name] || "").trim();
    if (fallback) {
      out[el.name] = fallback;
      return;
    }
    if (/^piac_prop_position_/.test(el.name)) {
      const anyPos = firstLastPositionValue(last);
      if (anyPos) out[el.name] = anyPos;
    }
  });
  const docs = [...root.querySelectorAll('input[name="piac_prop_job_documents"]:checked')].map((el) => el.value);
  if (docs.length) out.piac_prop_job_documents = docs.join("|");
  else if (last.piac_prop_job_documents) out.piac_prop_job_documents = last.piac_prop_job_documents;

  /* Back-compat állás keys */
  const pathTop = readPathParts(form)[0];
  if (pathTop === "allas") {
    const pos = root.querySelector("select[name^='piac_prop_position_']");
    const posVal =
      String(pos?.value || "").trim() ||
      (pos?.name ? String(out[pos.name] || "").trim() : "") ||
      firstLastPositionValue(last);
    if (pos?.name && posVal) out[pos.name] = posVal;
    out.allas_munkakor = posVal;
    out.allas_tapasztalat = out.piac_prop_carrier_level || last.allas_tapasztalat || "";
    out.allas_vegzettseg = out.piac_prop_education || last.allas_vegzettseg || "";
    out.allas_nyelv = out.piac_prop_language || last.allas_nyelv || "";
    out.allas_foglalkoztatas = out.piac_prop_jobtype || last.allas_foglalkoztatas || "";
    out.allas_kulfoldi_orszag = out.piac_prop_job_country || last.allas_kulfoldi_orszag || "";
    out.allas_dokumentumok = out.piac_prop_job_documents || last.allas_dokumentumok || "";
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
      const label =
        sel.closest(".piac-prop-menu-row")?.querySelector(".piac-prop-menu-trigger__label")?.textContent?.replace(/\*/g, "").trim() ||
        sel.closest("label")?.querySelector("span")?.textContent?.replace(/\*/g, "").trim() ||
        "mező";
      alert(`Válaszd ki: ${label}.`);
      sel.closest(".piac-prop-menu-row")?.querySelector("[data-prop-trigger]")?.focus();
      return false;
    }
  }
  const docs = root.querySelectorAll('input[name="piac_prop_job_documents"]');
  if (docs.length) {
    const any = [...docs].some((el) => el.checked);
    if (!any) {
      alert("Jelöld meg a jelentkezéshez szükséges dokumentumokat.");
      root.querySelector('[data-prop-key="job_documents"] [data-prop-trigger]')?.focus();
      root.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      return false;
    }
  }
  return true;
}

/** @deprecated */
export const validatePiacAllasForm = validatePiacPropForm;
