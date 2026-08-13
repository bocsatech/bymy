export const STEP_TITLES = {
  1: "Alapadatok",
  2: "Műszaki adatok",
  3: "Extrák",
  5: "Hirdetés",
};

export function groupCellsByStep(cells) {
  const groups = new Map();
  for (const cell of cells ?? []) {
    const step = cell.step ?? 1;
    if (!groups.has(step)) groups.set(step, []);
    groups.get(step).push(cell);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b);
}

export function formatCellValue(cell) {
  if (cell.field_key?.startsWith("extra:") || cell.field_key?.startsWith("info:")) {
    return "✓";
  }
  const raw = String(cell.value ?? "");
  if (cell.field_key === "leiras" || cell.field_key === "hirdetes_cime") {
    // Használtautó.hu / Belépés ne jelenjen meg (inline tokenek is)
    const lines = raw
      .replace(/\r\n/g, "\n")
      .split(/\n+/)
      .map((l) =>
        l
          .replace(/\s+/g, " ")
          .replace(/haszn[aá]ltaut[oó]\.?\s*hu/gi, " ")
          .replace(/\bhaszn[aá]ltaut[oó]\b/gi, " ")
          .replace(/\bbel[eé]p[eé]s\b/gi, " ")
          .replace(/\bregisztr[aá]ci[oó]\b/gi, " ")
          .replace(/\s{2,}/g, " ")
          .trim()
      )
      .filter(Boolean)
      .filter((l) => {
        const n = l
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!n) return false;
        const onlyChrome = n
          .replace(/hasznaltauto(\.hu)?/g, " ")
          .replace(/\bbelepes\b/g, " ")
          .replace(/\bregisztracio\b/g, " ")
          .replace(/[|·•\-–—./:!]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!onlyChrome) return false;
        if (n.includes("hasznaltauto") && n.length <= 64) return false;
        if (/\bbelepes\b/.test(n) && n.length <= 24) return false;
        return true;
      });
    return lines.join("\n");
  }
  return raw;
}

export function renderListingCells(container, cells) {
  if (!container) return;
  container.innerHTML = "";

  const groups = groupCellsByStep(cells);
  if (!groups.length) {
    container.innerHTML = '<p class="listings-empty">Nincs mentett cella adat.</p>';
    return;
  }

  for (const [step, stepCells] of groups) {
    const section = document.createElement("section");
    section.className = "import-cells-step";

    const title = document.createElement("h3");
    title.className = "import-cells-step-title";
    title.textContent = STEP_TITLES[step] ?? `Lépés ${step}`;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "import-cells-grid";

    for (const cell of stepCells) {
      const row = document.createElement("div");
      row.className = "import-cell-row";

      const label = document.createElement("div");
      label.className = "import-cell-label";
      label.textContent = cell.label;

      const value = document.createElement("div");
      value.className = "import-cell-value";
      value.textContent = formatCellValue(cell);

      row.append(label, value);
      grid.appendChild(row);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }
}
