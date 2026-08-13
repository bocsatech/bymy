const QUICK_PRESET_IDS = ["under10m", "lowKm", "hybridEv", "fresh", "firstCar"];

export function filterByQuickPreset(items, presetId) {
  if (!presetId) return items;

  switch (presetId) {
    case "under10m":
      return items.filter((item) => (item.preview?.priceNum ?? Infinity) <= 10_000_000);
    case "lowKm":
      return items.filter((item) => (item.preview?.kmNum ?? Infinity) <= 100_000);
    case "hybridEv":
      return items.filter((item) => {
        const fuel = item.preview?.filter?.uzemanyag ?? "";
        return (
          fuel === "Elektromos" ||
          (/elektromos/i.test(fuel) && fuel !== "Elektromos") ||
          /hibrid/i.test(fuel)
        );
      });
    case "fresh": {
      const cutoff = Date.now() - 30 * 86400000;
      return items.filter((item) => {
        if (item.updated_at) {
          return new Date(item.updated_at).getTime() >= cutoff;
        }
        return item.status === "feladott";
      });
    }
    case "firstCar":
      return items.filter((item) => {
        const price = item.preview?.priceNum ?? Infinity;
        const year = item.preview?.filter?.gyartasi_ev ?? 0;
        return price <= 5_000_000 && year >= 2012;
      });
    default:
      return items;
  }
}

export function initHomeQuickFilters({ onChange, getForm }) {
  const buttons = document.querySelectorAll("[data-quick-preset]");
  if (!buttons.length) return () => null;

  let activePreset = null;

  const syncButtons = () => {
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.quickPreset === activePreset);
    });
  };

  const setPreset = (presetId) => {
    activePreset = activePreset === presetId ? null : presetId;
    const form = getForm?.();
    if (form && activePreset) {
      form.reset();
      form.querySelector("#filter-uzemanyag-quick").value = "";
      form.querySelectorAll("[data-fuel-quick]").forEach((btn) => btn.classList.remove("is-active"));
    }
    syncButtons();
    onChange(activePreset);
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => setPreset(button.dataset.quickPreset));
  });

  return {
    getPreset: () => activePreset,
    clear: () => {
      activePreset = null;
      syncButtons();
    },
    syncButtons,
  };
}

export { QUICK_PRESET_IDS };
