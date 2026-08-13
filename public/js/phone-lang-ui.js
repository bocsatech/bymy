/** Telefonszám + beszélt nyelvek UI (hirdetésfeladás). */

export const PHONE_COUNTRIES = [
  { value: "+36", label: "(H) 36" },
  { value: "+43", label: "(A) 43" },
  { value: "+49", label: "(D) 49" },
  { value: "+421", label: "(SK) 421" },
  { value: "+40", label: "(RO) 40" },
  { value: "+385", label: "(HR) 385" },
  { value: "+386", label: "(SI) 386" },
  { value: "+420", label: "(CZ) 420" },
  { value: "+48", label: "(PL) 48" },
  { value: "+381", label: "(RS) 381" },
  { value: "+380", label: "(UA) 380" },
  { value: "+39", label: "(I) 39" },
  { value: "+33", label: "(F) 33" },
  { value: "+44", label: "(GB) 44" },
  { value: "+41", label: "(CH) 41" },
  { value: "+31", label: "(NL) 31" },
  { value: "+32", label: "(B) 32" },
];

export const PHONE_LANGUAGES = [
  "Magyar",
  "Angol",
  "Deutsch (D)",
  "Français",
  "Italiano",
  "Español",
  "Română",
  "Slovenčina",
  "Hrvatski",
  "Srpski",
  "Čeština",
  "Polski",
  "Українська",
  "Русский",
];

function fillCountrySelect(select, preferred = "+36") {
  if (!select || select.tagName !== "SELECT") return;
  const current = select.value || preferred;
  select.innerHTML = "";
  for (const item of PHONE_COUNTRIES) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  if (current && ![...select.options].some((o) => o.value === current)) {
    const option = document.createElement("option");
    option.value = current;
    option.textContent = current;
    select.appendChild(option);
  }
  select.value = current || "+36";
}

function fillLanguageSelect(select, { emptyLabel = "", defaultValue = "" } = {}) {
  if (!select || select.tagName !== "SELECT") return;
  const current = select.value || defaultValue;
  select.innerHTML = "";
  if (emptyLabel !== null) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel || "Válasszon!";
    select.appendChild(empty);
  }
  for (const lang of PHONE_LANGUAGES) {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    select.appendChild(option);
  }
  if (current && ![...select.options].some((o) => o.value === current)) {
    const option = document.createElement("option");
    option.value = current;
    option.textContent = current;
    select.appendChild(option);
  }
  select.value = current;
}

function syncBeszeltNyelvek(form) {
  const hidden = form?.elements?.namedItem("beszelt_nyelvek");
  if (!(hidden instanceof HTMLInputElement)) return;
  const values = [...form.querySelectorAll("[data-phone-lang]")]
    .map((el) => String(el.value || "").trim())
    .filter(Boolean);
  const unique = [...new Set(values)];
  hidden.value = unique.join(", ") || "Magyar";
}

/**
 * @param {HTMLFormElement | null} form
 */
export function initPhoneLanguages(form) {
  if (!form) return { syncLanguages: () => {} };

  const root = form.querySelector(".phone-lang-grid");
  if (!root) return { syncLanguages: () => {} };

  root.querySelectorAll("select.phone-country").forEach((select) => {
    fillCountrySelect(select, "+36");
  });

  root.querySelectorAll("select[data-phone-lang]").forEach((select) => {
    const isPrimary = /_nyelv1$/.test(select.name || "");
    fillLanguageSelect(select, {
      emptyLabel: isPrimary ? null : "Válasszon!",
      defaultValue: isPrimary ? "Magyar" : "",
    });
  });

  const sync = () => syncBeszeltNyelvek(form);
  root.addEventListener("change", sync);
  sync();

  return { syncLanguages: sync };
}
