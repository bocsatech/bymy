/**
 * Piactér Állás — Tulajdonságok mezők (Jófogás-szerű legördülők).
 */

let fieldsPromise = null;

function loadFields() {
  if (!fieldsPromise) {
    fieldsPromise = fetch("/data/piac-allas-fields.json", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("piac-allas-fields");
        return res.json();
      })
      .catch(() => null);
  }
  return fieldsPromise;
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

function readPathTop(form) {
  const path = String(form?.querySelector?.("#piac_path")?.value || "").trim();
  return path.split("/").map((s) => s.trim()).filter(Boolean)[0] || "";
}

function readPathSub(form) {
  const path = String(form?.querySelector?.("#piac_path")?.value || "").trim();
  return path.split("/").map((s) => s.trim()).filter(Boolean)[1] || "";
}

function placeAllasSection(form, root) {
  if (!form || !root) return;
  /* Képfeltöltés szekció felett (step 4 / desk photo stage). */
  const photosCard =
    form.querySelector('.step-panel[data-step="4"] .card--photos') ||
    form.querySelector(".card--photos");
  const photoPanel =
    photosCard?.closest(".step-panel") ||
    form.querySelector('.step-panel[data-step="4"]') ||
    form.querySelector("#ad-photo-desk-stage");
  if (photosCard && photosCard.parentElement) {
    if (root.nextElementSibling !== photosCard) {
      photosCard.insertAdjacentElement("beforebegin", root);
    }
    return;
  }
  if (photoPanel) {
    if (root.parentElement !== photoPanel) {
      photoPanel.insertBefore(root, photoPanel.firstChild);
    }
    return;
  }
  const host = form.querySelector("#piac-fields");
  if (host && host.nextElementSibling !== root) {
    host.insertAdjacentElement("afterend", root);
  }
}

export async function syncPiacAllasFields(form) {
  if (!form) return null;
  const host = form.querySelector("#piac-fields");
  if (!host) return null;

  const top = readPathTop(form);
  let root = form.querySelector("#piac-allas-fields");
  if (top !== "allas") {
    root?.remove();
    return null;
  }

  const data = await loadFields();
  if (!data) return null;

  const sub = readPathSub(form);
  const munkakorOpts = data.munkakorByCategory?.[sub] || ["Egyéb"];
  const shared = data.shared || {};

  if (!root) {
    root = document.createElement("section");
    root.id = "piac-allas-fields";
    root.className = "piac-allas-fields";
    root.setAttribute("data-piac-allas", "1");
    root.setAttribute("aria-label", data.sectionLabel || "Tulajdonságok");
  }
  placeAllasSection(form, root);

  const last = form._bymyLastFormData && typeof form._bymyLastFormData === "object" ? form._bymyLastFormData : {};
  const lastDocs = String(last.allas_dokumentumok || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const prev = {
    munkakor: root.querySelector("#allas_munkakor")?.value || String(last.allas_munkakor || ""),
    tapasztalat: root.querySelector("#allas_tapasztalat")?.value || String(last.allas_tapasztalat || ""),
    vegzettseg: root.querySelector("#allas_vegzettseg")?.value || String(last.allas_vegzettseg || ""),
    nyelv: root.querySelector("#allas_nyelv")?.value || String(last.allas_nyelv || ""),
    foglalkoztatas: root.querySelector("#allas_foglalkoztatas")?.value || String(last.allas_foglalkoztatas || ""),
    orszag: root.querySelector("#allas_kulfoldi_orszag")?.value || String(last.allas_kulfoldi_orszag || ""),
    docs: (() => {
      const checked = [...root.querySelectorAll('input[name="allas_dokumentumok"]:checked')].map((el) => el.value);
      return checked.length ? checked : lastDocs;
    })(),
  };

  root.innerHTML = `
    <div class="piac-allas-fields__head">
      <h4 class="piac-allas-fields__title">${data.sectionLabel || "Tulajdonságok"}</h4>
    </div>
    <div class="piac-allas-grid">
      <label class="piac-allas-field">
        <span>Munkakör megnevezése <span class="req">*</span></span>
        <select id="allas_munkakor" name="allas_munkakor" required>
          ${optionHtml(munkakorOpts, prev.munkakor)}
        </select>
      </label>
      <label class="piac-allas-field">
        <span>${shared.nyelv?.label || "Szükséges nyelvtudás"} <span class="req">*</span></span>
        <select id="allas_nyelv" name="allas_nyelv" required>
          ${optionHtml(shared.nyelv?.options || [], prev.nyelv)}
        </select>
      </label>
      <label class="piac-allas-field">
        <span>${shared.tapasztalat?.label || "Tapasztalat"} <span class="req">*</span></span>
        <select id="allas_tapasztalat" name="allas_tapasztalat" required>
          ${optionHtml(shared.tapasztalat?.options || [], prev.tapasztalat)}
        </select>
      </label>
      <label class="piac-allas-field">
        <span>${shared.foglalkoztatas?.label || "Foglalkoztatás jellege"} <span class="req">*</span></span>
        <select id="allas_foglalkoztatas" name="allas_foglalkoztatas" required>
          ${optionHtml(shared.foglalkoztatas?.options || [], prev.foglalkoztatas)}
        </select>
      </label>
      <label class="piac-allas-field">
        <span>${shared.vegzettseg?.label || "Elvárt végzettség"} <span class="req">*</span></span>
        <select id="allas_vegzettseg" name="allas_vegzettseg" required>
          ${optionHtml(shared.vegzettseg?.options || [], prev.vegzettseg)}
        </select>
      </label>
      <label class="piac-allas-field">
        <span>${shared.kulfoldi_orszag?.label || "Külföldi munka esetén ország"}</span>
        <select id="allas_kulfoldi_orszag" name="allas_kulfoldi_orszag">
          ${optionHtml(shared.kulfoldi_orszag?.options || [], prev.orszag)}
        </select>
      </label>
      <fieldset class="piac-allas-field piac-allas-field--docs">
        <legend>${shared.dokumentumok?.label || "Jelentkezéshez szükséges dokumentumok"} <span class="req">*</span></legend>
        <div class="piac-allas-checks">
          ${(shared.dokumentumok?.options || [])
            .map((opt) => {
              const id = `allas_doc_${slugify(opt)}`;
              const checked = prev.docs.includes(opt) ? " checked" : "";
              return `<label class="piac-allas-check" for="${id}">
                <input type="checkbox" id="${id}" name="allas_dokumentumok" value="${opt.replace(/"/g, "&quot;")}"${checked} />
                <span>${opt}</span>
              </label>`;
            })
            .join("")}
        </div>
      </fieldset>
    </div>
  `;

  root.dataset.category = sub;
  root.dataset.ready = "1";
  return root;
}

export function readPiacAllasValues(form) {
  const root = form?.querySelector("#piac-allas-fields");
  if (!root) return {};
  const docs = [...root.querySelectorAll('input[name="allas_dokumentumok"]:checked')].map((el) => el.value);
  return {
    allas_munkakor: root.querySelector("#allas_munkakor")?.value || "",
    allas_tapasztalat: root.querySelector("#allas_tapasztalat")?.value || "",
    allas_vegzettseg: root.querySelector("#allas_vegzettseg")?.value || "",
    allas_nyelv: root.querySelector("#allas_nyelv")?.value || "",
    allas_foglalkoztatas: root.querySelector("#allas_foglalkoztatas")?.value || "",
    allas_kulfoldi_orszag: root.querySelector("#allas_kulfoldi_orszag")?.value || "",
    allas_dokumentumok: docs.join("|"),
  };
}

export function validatePiacAllasForm(form) {
  if (readPathTop(form) !== "allas") return true;
  const root = form.querySelector("#piac-allas-fields");
  if (!root) return true;
  const vals = readPiacAllasValues(form);
  const need = [
    ["allas_munkakor", "Munkakör megnevezése"],
    ["allas_tapasztalat", "Tapasztalat"],
    ["allas_vegzettseg", "Elvárt végzettség"],
    ["allas_nyelv", "Szükséges nyelvtudás"],
    ["allas_foglalkoztatas", "Foglalkoztatás jellege"],
  ];
  for (const [key, label] of need) {
    if (!String(vals[key] || "").trim()) {
      alert(`Válaszd ki: ${label}.`);
      root.querySelector(`#${key}`)?.focus();
      return false;
    }
  }
  if (!String(vals.allas_dokumentumok || "").trim()) {
    alert("Jelöld meg a jelentkezéshez szükséges dokumentumokat.");
    root.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    return false;
  }
  return true;
}
