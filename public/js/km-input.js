export function parseKmDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatKmDigits(value) {
  const digits = parseKmDigits(value);
  if (!digits) return "";
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("hu-HU");
}

export function initKmInput(input) {
  if (!input || input.dataset.kmFmt === "1") return input;
  input.dataset.kmFmt = "1";
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  if (!input.placeholder) input.placeholder = "pl. 125 000";

  const lockPageX = () => {
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      window.scrollTo({ left: 0, top: window.scrollY || window.pageYOffset || 0, behavior: "auto" });
      /* Billentyűzet / iOS zoom után a visualViewport offset is nullázandó. */
      if (window.visualViewport && window.visualViewport.offsetLeft) {
        window.scrollTo(window.visualViewport.offsetLeft, window.scrollY || 0);
        document.documentElement.scrollLeft = 0;
        document.body.scrollLeft = 0;
      }
    } catch {
      /* ignore */
    }
  };

  const onViewportShift = () => lockPageX();

  const sync = () => {
    const digits = parseKmDigits(input.value);
    input.dataset.kmDigits = digits;
    const formatted = formatKmDigits(digits);
    if (formatted !== input.value) input.value = formatted;
  };

  input.addEventListener("input", () => {
    const digits = parseKmDigits(input.value);
    input.dataset.kmDigits = digits;
    if (!digits) {
      input.value = "";
      return;
    }
    if (document.activeElement === input && digits.length <= 3) {
      input.value = digits;
      return;
    }
    const formatted = formatKmDigits(digits);
    if (input.value !== formatted) input.value = formatted;
    lockPageX();
  });

  input.addEventListener("focus", () => {
    lockPageX();
    requestAnimationFrame(lockPageX);
    window.visualViewport?.addEventListener("resize", onViewportShift);
    window.visualViewport?.addEventListener("scroll", onViewportShift);
  });
  input.addEventListener("blur", () => {
    sync();
    lockPageX();
    requestAnimationFrame(lockPageX);
    window.visualViewport?.removeEventListener("resize", onViewportShift);
    window.visualViewport?.removeEventListener("scroll", onViewportShift);
  });
  if (input.value) sync();
  return input;
}

export function setKmInputValue(input, value) {
  if (!input) return;
  const digits = parseKmDigits(value);
  input.dataset.kmDigits = digits;
  input.value = formatKmDigits(digits);
}
