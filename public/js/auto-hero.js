const hero = document.querySelector("[data-auto-search-hero]");

if (hero) {
  const bodyTypeButtons = [...hero.querySelectorAll("[data-body-type]")];

  const selectBodyType = (button) => {
    const value = button.dataset.bodyType ?? "";
    const typeSelect = document.getElementById("qs-tipus");

    bodyTypeButtons.forEach((item) => {
      const isActive = item === button && !item.classList.contains("is-active");
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });

    const activeButton = bodyTypeButtons.find((item) => item.classList.contains("is-active"));
    if (!typeSelect) return;

    if (!activeButton) {
      typeSelect.value = "";
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const normalizedTarget = value.toLocaleLowerCase("hu-HU");
    const matchingOption = [...typeSelect.options].find((option) => {
      const normalizedText = option.textContent.trim().toLocaleLowerCase("hu-HU");
      return normalizedText.includes(normalizedTarget);
    });

    if (matchingOption) {
      typeSelect.value = matchingOption.value;
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  bodyTypeButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      selectBodyType(button);
    });
  });

  hero.querySelector("#home-qs-form")?.addEventListener("reset", () => {
    bodyTypeButtons.forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
  });
}
