/** Irányítószám → település autofill (minden űrlapon). */

const BOUND = "postalCityAutofillBound";

const POSTAL_SELECTOR = [
  "[data-postal-lookup]",
  'input[name="postalCode"]',
  'input[name="companyPostalCode"]',
  'input[name="iranyitoszam"]',
  'input[name="postal_code"]',
  'input[data-filter-key="iranyitoszam"]',
  'input[data-key="postalCode"]',
  'input[data-key="companyPostalCode"]',
].join(", ");

function digits4(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
}

function setValue(input, value) {
  if (!input || !("value" in input)) return;
  if (String(input.value) === String(value)) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function scopeRoot(postalInput) {
  return (
    postalInput.closest(
      ".settings-postal-row, .user-edit__card, .user-edit, .ad-location-fields, .field-stack--location, .ad-address-block, form, [data-user-edit], .home-filter-form, .auto-desk-filter"
    ) || postalInput.closest("section") || document
  );
}

function isCompanyPostal(postalInput) {
  const key = postalInput.getAttribute("data-key") || postalInput.getAttribute("name") || "";
  return (
    key === "companyPostalCode" ||
    postalInput.hasAttribute("data-company-postal") ||
    postalInput.hasAttribute("data-ad-postal") === false && key.includes("company")
  );
}

function findCityInput(postalInput) {
  const root = scopeRoot(postalInput);
  const key = postalInput.getAttribute("data-key") || postalInput.getAttribute("name") || "";

  if (key === "companyPostalCode" || postalInput.hasAttribute("data-company-postal")) {
    return (
      root.querySelector(
        'input[name="companyCity"], input[data-company-city], input[data-key="companyCity"]'
      ) || null
    );
  }

  if (key === "iranyitoszam" || postalInput.getAttribute("data-filter-key") === "iranyitoszam") {
    return (
      root.querySelector(
        'input[name="telepules"], input[data-filter-key="telepules"], input#telepules'
      ) || null
    );
  }

  return (
    root.querySelector(
      [
        'input[name="city"]',
        'input[name="telepules"]',
        'input[name="companyCity"]',
        "input[data-search-city]",
        "input[data-rec-city]",
        "input[data-company-city]",
        'input[data-filter-key="telepules"]',
        'input[data-key="city"]',
        'input[data-key="companyCity"]',
        'input[data-key="telepules"]',
        "input#telepules",
        "input#city",
      ].join(", ")
    ) || null
  );
}

function findMegyeInput(postalInput) {
  const root = scopeRoot(postalInput);
  return (
    root.querySelector(
      'input[name="megye"], input[data-filter-key="megye"], input[data-key="megye"], input#megye'
    ) || null
  );
}

async function lookupPostal(postal) {
  const params = new URLSearchParams({ postal_code: postal });
  const res = await fetch(`/api/postal-codes/lookup?${params}`, { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data;
}

/**
 * @param {ParentNode} [root]
 */
export function wirePostalCityAutofill(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll(POSTAL_SELECTOR).forEach((postalInput) => {
    if (!(postalInput instanceof HTMLInputElement)) return;
    if (postalInput.dataset[BOUND] === "1") return;
    postalInput.dataset[BOUND] = "1";

    let last = "";
    let busy = false;

    const run = async () => {
      const digits = digits4(postalInput.value);
      if (postalInput.value !== digits) postalInput.value = digits;
      if (digits.length !== 4) return;
      if (digits === last || busy) return;
      busy = true;
      try {
        const data = await lookupPostal(digits);
        last = digits;
        if (!data?.city) return;
        const cityInput = findCityInput(postalInput);
        if (cityInput) {
          delete cityInput.dataset.userEdited;
          setValue(cityInput, data.city);
        }
        const megyeInput = findMegyeInput(postalInput);
        if (megyeInput && data.megye) setValue(megyeInput, data.megye);
      } catch {
        last = digits;
      } finally {
        busy = false;
      }
    };

    postalInput.addEventListener("input", () => {
      void run();
    });
    postalInput.addEventListener("change", () => {
      void run();
    });
    postalInput.addEventListener("blur", () => {
      void run();
    });

    if (digits4(postalInput.value).length === 4) void run();
  });
}

export function startPostalCityAutofillObserver() {
  wirePostalCityAutofill(document);
  if (typeof MutationObserver === "undefined") return;
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(POSTAL_SELECTOR) || node.querySelector?.(POSTAL_SELECTOR)) {
          wirePostalCityAutofill(node);
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => startPostalCityAutofillObserver(), {
      once: true,
    });
  } else {
    startPostalCityAutofillObserver();
  }
}
