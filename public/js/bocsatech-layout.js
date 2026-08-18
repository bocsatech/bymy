const COLS = 12;
const ROW_PX = 64;

export function mountLayoutBoard(root, layout, { onChange } = {}) {
  if (!root) return { cells: layout?.cells || [] };
  const cells = Array.isArray(layout?.cells) ? layout.cells : [];
  const byKey = new Map(cells.map((cell) => [cell.field_key, cell]));
  const skip = new Set([
    "hirdetes_cime",
    "hirdetes_vertical",
    "hirdetes_alkategoria",
    "fotok",
    "owner_user_id",
    "views_web",
    "views_app",
    "telefon1_orszag",
    "telefon1_korzet",
    "telefon1_szam",
    "telefon2_orszag",
    "telefon2_korzet",
    "telefon2_szam",
    "telefon3_orszag",
    "telefon3_korzet",
    "telefon3_szam",
    "beszelt_nyelvek",
    "gyartasi_honap",
    "forgalomba_helyezes_honap",
    "muszaki_honap",
    "video_url",
    "forras_url",
    "hasznaltauto_hirdetes_id",
  ]);
  const visible = cells.filter((cell) => !skip.has(cell.field_key) && cell.step !== 4 && cell.step !== 9);
  const steps = [...new Set(visible.map((cell) => cell.step))].sort((a, b) => a - b);
  const names = { 1: "Alapadatok", 2: "Műszaki", 3: "Extrák", 5: "Hirdetés" };

  root.innerHTML = steps
    .map((step) => {
      const items = visible.filter((cell) => cell.step === step);
      const maxRow = Math.max(4, ...items.map((cell) => Number(cell.row) || 1));
      const tiles = items
        .map(
          (cell) => `<button type="button" class="layout-tile" data-field="${escapeAttr(cell.field_key)}" style="${tileStyle(cell)}">
            <span class="layout-tile-label">${escapeHtml(cell.label)}</span>
            <span class="layout-tile-meta">${cell.colSpan}/12</span>
            <span class="layout-resize" data-resize="1"></span>
          </button>`
        )
        .join("");
      return `<section class="layout-step" data-step="${step}">
        <h3>Lépés ${step} — ${names[step] || ""}</h3>
        <div class="layout-board" data-board="${step}" style="grid-template-rows: repeat(${maxRow + 2}, ${ROW_PX}px)">${tiles}</div>
      </section>`;
    })
    .join("");

  function cellOf(field) {
    return byKey.get(field);
  }

  function paint(tile, cell) {
    tile.setAttribute("style", tileStyle(cell));
    const meta = tile.querySelector(".layout-tile-meta");
    if (meta) meta.textContent = `${cell.colSpan}/12`;
  }

  function growBoard(board, row) {
    const need = Math.max(4, row + 2);
    board.style.gridTemplateRows = `repeat(${need}, ${ROW_PX}px)`;
  }

  function colFromEvent(board, clientX) {
    const rect = board.getBoundingClientRect();
    const x = clientX - rect.left;
    return clamp(Math.floor((x / rect.width) * COLS) + 1, 1, COLS);
  }

  function rowFromEvent(board, clientY) {
    const rect = board.getBoundingClientRect();
    const y = clientY - rect.top;
    return clamp(Math.floor(y / ROW_PX) + 1, 1, 80);
  }

  root.querySelectorAll(".layout-tile").forEach((tile) => {
    tile.addEventListener("pointerdown", (event) => {
      const cell = cellOf(tile.getAttribute("data-field"));
      const board = tile.closest(".layout-board");
      if (!cell || !board) return;
      const resize = event.target.closest("[data-resize]");
      event.preventDefault();
      tile.setPointerCapture(event.pointerId);
      tile.classList.add("dragging");
      const startCol = cell.col;
      const grabCol = colFromEvent(board, event.clientX);

      const move = (ev) => {
        if (resize) {
          const edge = colFromEvent(board, ev.clientX);
          cell.colSpan = clamp(edge - cell.col + 1, 1, COLS - cell.col + 1);
        } else {
          const col = colFromEvent(board, ev.clientX);
          const row = rowFromEvent(board, ev.clientY);
          const nextCol = clamp(col - (grabCol - startCol), 1, COLS - cell.colSpan + 1);
          cell.col = nextCol;
          cell.row = row;
          growBoard(board, row);
        }
        cell.order = (cell.row - 1) * COLS + cell.col;
        paint(tile, cell);
      };
      const up = () => {
        tile.classList.remove("dragging");
        tile.releasePointerCapture(event.pointerId);
        tile.removeEventListener("pointermove", move);
        tile.removeEventListener("pointerup", up);
        onChange?.(cells);
      };
      tile.addEventListener("pointermove", move);
      tile.addEventListener("pointerup", up);
    });
  });

  return { cells };
}

function tileStyle(cell) {
  const col = clamp(cell.col, 1, COLS);
  const span = clamp(cell.colSpan, 1, COLS - col + 1);
  const row = clamp(cell.row, 1, 80);
  return `grid-column:${col} / span ${span};grid-row:${row}`;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
