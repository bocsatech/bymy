/**
 * Kapcsolós auto-bm panelek: bezárás panelen kívüli kattintásra / Escape-re.
 */

/**
 * @param {{
 *   panel: HTMLElement,
 *   roots?: Array<Element | null | undefined>,
 *   isOpen: () => boolean,
 *   close: () => void,
 * }} opts
 */
export function bindAutoBmDismiss(opts) {
  const { panel, roots = [], isOpen, close } = opts;

  function isInsideKeep(target) {
    if (!(target instanceof Node)) return false;
    if (panel.contains(target)) return true;
    for (const root of roots) {
      if (root && root.contains(target)) return true;
    }
    return false;
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!isOpen()) return;
      if (isInsideKeep(event.target)) return;
      close();
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!isOpen()) return;
    event.preventDefault();
    close();
  });
}

export function autoBmPanelIsOpen(panel) {
  return Boolean(panel && !panel.hidden && !panel.classList.contains("is-closed"));
}
