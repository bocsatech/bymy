/**
 * iOS Safari: ha egy input font-size < 16px, fókuszra zoomol + billentyűzet
 * → az oldal gyakran jobbra / oldalra csúszik. Ez a guard:
 * 1) minden kézzel kitöltendő mezőn legalább 16px-et kényszerít
 * 2) visualViewport / scrollLeft eltolást visszaállítja fókusz alatt
 * Nem csak km — minden #ad-form input/textarea (összes accordion/menü).
 */

const SKIP_TYPES = new Set(["checkbox", "radio", "file", "hidden", "button", "submit", "reset", "image"]);

function isGuardTarget(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = String(el.type || "text").toLowerCase();
  return !SKIP_TYPES.has(type);
}

export function lockAdFormPageX() {
  try {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    const y = window.scrollY || window.pageYOffset || 0;
    window.scrollTo({ left: 0, top: y, behavior: "auto" });
    const vv = window.visualViewport;
    if (vv && (vv.offsetLeft || vv.pageLeft)) {
      window.scrollTo({ left: 0, top: y, behavior: "auto" });
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    }
  } catch {
    /* ignore */
  }
}

function ensureMinFontSize(el) {
  try {
    const px = parseFloat(window.getComputedStyle(el).fontSize);
    if (!Number.isFinite(px) || px < 16) {
      el.style.setProperty("font-size", "16px", "important");
    }
  } catch {
    el.style.setProperty("font-size", "16px", "important");
  }
}

/**
 * @param {HTMLFormElement | null} form
 */
export function bindAdFormKeyboardGuard(form) {
  if (!form || form.dataset.keyboardGuard === "1") return;
  form.dataset.keyboardGuard = "1";

  let active = null;
  let raf = 0;

  const onViewportShift = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      lockAdFormPageX();
    });
  };

  const attachViewport = () => {
    window.visualViewport?.addEventListener("resize", onViewportShift, { passive: true });
    window.visualViewport?.addEventListener("scroll", onViewportShift, { passive: true });
    window.addEventListener("scroll", onViewportShift, { passive: true });
  };

  const detachViewport = () => {
    window.visualViewport?.removeEventListener("resize", onViewportShift);
    window.visualViewport?.removeEventListener("scroll", onViewportShift);
    window.removeEventListener("scroll", onViewportShift);
  };

  const onFocusIn = (ev) => {
    const el = ev.target;
    if (!isGuardTarget(el) || !form.contains(el)) return;
    active = el;
    ensureMinFontSize(el);
    document.documentElement.classList.add("ad-form-kb-open");
    document.body.classList.add("ad-form-kb-open");
    lockAdFormPageX();
    requestAnimationFrame(lockAdFormPageX);
    attachViewport();
  };

  const onFocusOut = (ev) => {
    const el = ev.target;
    if (!isGuardTarget(el)) return;
    /* relatedTarget még a formon belül lehet */
    const next = ev.relatedTarget;
    if (next && form.contains(next) && isGuardTarget(next)) {
      active = next;
      ensureMinFontSize(next);
      lockAdFormPageX();
      return;
    }
    active = null;
    lockAdFormPageX();
    requestAnimationFrame(() => {
      if (active) return;
      detachViewport();
      document.documentElement.classList.remove("ad-form-kb-open");
      document.body.classList.remove("ad-form-kb-open");
      lockAdFormPageX();
    });
  };

  const onInput = (ev) => {
    if (ev.target === active) lockAdFormPageX();
  };

  form.addEventListener("focusin", onFocusIn);
  form.addEventListener("focusout", onFocusOut);
  form.addEventListener("input", onInput);

  /* Már a DOM-ban lévő mezők: előzetes 16px, ne csak fókuszra */
  form.querySelectorAll("input, textarea").forEach((el) => {
    if (isGuardTarget(el)) ensureMinFontSize(el);
  });
}
