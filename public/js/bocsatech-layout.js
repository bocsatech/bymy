const COLS = 12;
const ROW_PX = 64;
const STEP_NAMES = {
  1: "Alapadatok",
  2: "Műszaki adatok",
  3: "Extrák",
  4: "Képek",
  5: "Hirdetés",
};
const PAIR_OF = {
  gyartasi_ev: "gyartasi_honap",
  forgalomba_helyezes_ev: "forgalomba_helyezes_honap",
  muszaki_ev: "muszaki_honap",
};

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
    "egyeb_modell",
    "video_url",
    "forras_url",
    "hasznaltauto_hirdetes_id",
  ]);

  function editable() {
    return cells.filter((cell) => !skip.has(cell.field_key) && cell.step !== 9);
  }

  function notify() {
    onChange?.(cells);
  }

  function syncPair(cell) {
    const otherKey = PAIR_OF[cell.field_key];
    const other = otherKey && byKey.get(otherKey);
    if (!other) return;
    other.step = cell.step;
    other.row = cell.row;
    other.col = cell.col;
    other.colSpan = cell.colSpan;
    other.hidden = cell.hidden;
    other.order = cell.order;
  }

  function tileHtml(cell) {
    return `<button type="button" class="layout-tile" data-field="${escapeAttr(cell.field_key)}" style="${tileStyle(cell)}">
      <span class="layout-tile-label">${escapeHtml(cell.label)}</span>
      <span class="layout-tile-meta">${cell.colSpan}/12</span>
      <span class="layout-del" data-del="1" title="Törlés">×</span>
      <span class="layout-resize" data-resize="1"></span>
    </button>`;
  }

  function trashHtml() {
    const hidden = editable().filter((cell) => cell.hidden);
    const items = hidden
      .map(
        (cell) => `<button type="button" class="layout-trash-item" data-restore="${escapeAttr(cell.field_key)}">
          ${escapeHtml(cell.label)} <span>vissza</span>
        </button>`
      )
      .join("");
    return `<section class="layout-trash">
      <h3>Törölt mezők</h3>
      <p class="layout-trash-hint">${hidden.length ? "Kattints a visszaállításhoz." : "Itt jelennek meg a törölt cellák."}</p>
      <div class="layout-trash-list">${items}</div>
    </section>`;
  }

  function boardsHtml() {
    return [1, 2, 3, 4, 5]
      .map((step) => {
        const items = editable().filter((cell) => !cell.hidden && Number(cell.step) === step);
        const maxRow = Math.max(3, ...items.map((cell) => Number(cell.row) || 1));
        const tiles = items.map(tileHtml).join("");
        return `<section class="layout-step" data-step="${step}">
          <h3>Lépés ${step} — ${STEP_NAMES[step]}</h3>
          <div class="layout-board" data-board="${step}" style="grid-template-rows: repeat(${maxRow + 2}, ${ROW_PX}px)">${tiles}</div>
        </section>`;
      })
      .join("");
  }

  function paint(tile, cell) {
    tile.setAttribute("style", tileStyle(cell));
    const meta = tile.querySelector(".layout-tile-meta");
    if (meta) meta.textContent = `${cell.colSpan}/12`;
  }

  function boardMetrics(board) {
    const rect = board.getBoundingClientRect();
    const styles = getComputedStyle(board);
    const padX = parseFloat(styles.paddingLeft) || 0;
    const padY = parseFloat(styles.paddingTop) || 0;
    const gapX = parseFloat(styles.columnGap) || parseFloat(styles.gap) || 0;
    const gapY = parseFloat(styles.rowGap) || parseFloat(styles.gap) || 0;
    const innerW = Math.max(0, rect.width - padX - (parseFloat(styles.paddingRight) || 0));
    const colStride = (innerW - gapX * (COLS - 1)) / COLS + gapX;
    return { rect, padX, padY, gapX, gapY, colStride, rowStride: ROW_PX + gapY };
  }

  function colFromEvent(board, clientX) {
    const m = boardMetrics(board);
    const x = clientX - m.rect.left - m.padX;
    return clamp(Math.floor(x / m.colStride) + 1, 1, COLS);
  }

  function rowFromEvent(board, clientY) {
    const m = boardMetrics(board);
    const y = clientY - m.rect.top - m.padY;
    return clamp(Math.floor(y / m.rowStride) + 1, 1, 80);
  }

  function maxRowOn(step) {
    const rows = editable()
      .filter((cell) => !cell.hidden && Number(cell.step) === step)
      .map((cell) => Number(cell.row) || 1);
    return Math.max(3, ...rows);
  }

  function growBoard(board) {
    const step = Number(board.getAttribute("data-board"));
    board.style.gridTemplateRows = `repeat(${maxRowOn(step) + 2}, ${ROW_PX}px)`;
  }

  function placeOnBoard(cell, board, clientX, clientY, grab) {
    const col = colFromEvent(board, clientX);
    const row = rowFromEvent(board, clientY);
    if (grab) {
      cell.col = clamp(col - (grab.col - grab.startCol), 1, COLS - cell.colSpan + 1);
      cell.row = clamp(row - (grab.row - grab.startRow), 1, 80);
    } else {
      cell.col = clamp(col, 1, COLS - cell.colSpan + 1);
      cell.row = row;
    }
    cell.step = Number(board.getAttribute("data-board"));
    cell.order = (cell.row - 1) * COLS + cell.col;
    syncPair(cell);
  }

  function bindTiles() {
    root.querySelectorAll(".layout-tile").forEach((tile) => {
      tile.addEventListener("pointerdown", (event) => {
        if (event.target.closest("[data-del]")) {
          event.preventDefault();
          event.stopPropagation();
          const cell = byKey.get(tile.getAttribute("data-field"));
          if (!cell) return;
          cell.hidden = true;
          syncPair(cell);
          notify();
          mount();
          return;
        }
        const cell = byKey.get(tile.getAttribute("data-field"));
        let board = tile.closest(".layout-board");
        if (!cell || !board) return;
        const originStep = Number(cell.step);
        const resize = event.target.closest("[data-resize]");
        event.preventDefault();
        tile.setPointerCapture(event.pointerId);
        tile.classList.add("dragging");
        const grab = {
          startCol: cell.col,
          startRow: cell.row,
          col: colFromEvent(board, event.clientX),
          row: rowFromEvent(board, event.clientY),
        };

        const move = (ev) => {
          if (!resize) {
            tile.style.pointerEvents = "none";
            const under = document.elementFromPoint(ev.clientX, ev.clientY);
            tile.style.pointerEvents = "";
            const nextBoard = under?.closest?.(".layout-board");
            root.querySelectorAll(".layout-board").forEach((el) => el.classList.toggle("is-drop", el === nextBoard));
            if (nextBoard && nextBoard !== board) {
              placeOnBoard(cell, nextBoard, ev.clientX, ev.clientY);
              paint(tile, cell);
              nextBoard.appendChild(tile);
              board = nextBoard;
              grab.startCol = cell.col;
              grab.startRow = cell.row;
              grab.col = colFromEvent(board, ev.clientX);
              grab.row = rowFromEvent(board, ev.clientY);
            }
          }
          if (!board) return;
          if (resize) {
            const edge = colFromEvent(board, ev.clientX);
            cell.colSpan = clamp(edge - cell.col + 1, 1, COLS - cell.col + 1);
            cell.order = (cell.row - 1) * COLS + cell.col;
            syncPair(cell);
          } else {
            placeOnBoard(cell, board, ev.clientX, ev.clientY, grab);
          }
          growBoard(board);
          paint(tile, cell);
        };
        const up = () => {
          tile.classList.remove("dragging");
          root.querySelectorAll(".layout-board").forEach((el) => el.classList.remove("is-drop"));
          try {
            tile.releasePointerCapture(event.pointerId);
          } catch {
            /* already released */
          }
          tile.removeEventListener("pointermove", move);
          tile.removeEventListener("pointerup", up);
          notify();
          if (Number(cell.step) !== originStep) mount();
        };
        tile.addEventListener("pointermove", move);
        tile.addEventListener("pointerup", up);
      });
    });

    root.querySelectorAll("[data-restore]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cell = byKey.get(btn.getAttribute("data-restore"));
        if (!cell) return;
        cell.hidden = false;
        if (![1, 2, 3, 4, 5].includes(Number(cell.step))) cell.step = 1;
        syncPair(cell);
        notify();
        mount();
      });
    });
  }

  function mount() {
    root.innerHTML = `${boardsHtml()}${trashHtml()}`;
    bindTiles();
  }

  mount();
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
