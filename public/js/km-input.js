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
  });

  input.addEventListener("blur", sync);
  if (input.value) sync();
  return input;
}

export function setKmInputValue(input, value) {
  if (!input) return;
  const digits = parseKmDigits(value);
  input.dataset.kmDigits = digits;
  input.value = formatKmDigits(digits);
}
