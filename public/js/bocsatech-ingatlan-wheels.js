/** Bocsatech — ingatlan kerék-séma drag-and-drop + üres sor. */

import {
  WHEEL_COLS,
  isSpacer,
  createSpacerCell,
  normalizeIngatlanWheelSchema,
} from "./ingatlan-wheel-schema.js?v=immoWheel4";

const COLS = WHEEL_COLS;
const ROW_PX = 56;
const DROP_BUFFER = 2;

export function mountIngatlanWheelBoard(root, schema, { onChange } = {}) {
  if (!root) return { cells: [] };
  let cells = normalizeIngatlanWheelSchema(schema).cells.map((c) => ({ ...c }));

  function notify() {
    onChange?.({ version: 1, cells: cells.map((c) => ({ ...c })) });
  }

  function visible(section) {
    return cells.filter((c) => !c.hidden && (section === "more" ? c.section === "more" : c.section !== "more"));
  }

  function byKey(key) {
    return cells.find((c) => c.field_key === key);
  }

  function maxRow(section) {
    const rows = visible(section).map((c) => Number(c.row) || 1);
    return Math.max(1, ...rows, 1);
  }

  function tileStyle(cell) {
    const col = clamp(cell.col, 1, COLS);
    const span = clamp(cell.colSpan, 1, COLS - col + 1);
    const row = clamp(cell.row, 1, 80);
    return `grid-column:${col} / span ${span};grid-row:${row}`;
  }

  function tileHtml(cell) {
    const spacer = isSpacer(cell);
    return `<button type="button" class="layout-tile ${spacer ? "layout-tile--spacer" : ""}" data-field="${escapeAttr(cell.field_key)}" style="${tileStyle(cell)}">
      <span class="layout-tile-label">${escapeHtml(cell.label || cell.field_key)}</span>
      <span class="layout-tile-meta">${spacer ? "üres" : `${cell.colSpan}/12`}${cell.surfaces ? ` · ${cell.surfaces.join("+")}` : ""}</span>
      <span class="layout-del" data-del="1" title="Törlés">×</span>
      ${spacer ? "" : `<span class="layout-resize" data-resize="1"></span>`}
    </button>`;
  }

  function trashHtml() {
    const hidden = cells.filter((c) => c.hidden && !isSpacer(c));
    const items = hidden
      .map(
        (c) =>
          `<button type="button" class="layout-trash-item" data-restore="${escapeAttr(c.field_key)}">${escapeHtml(c.label)} <span>vissza</span></button>`
      )
      .join("");
    return `<section class="layout-trash">
      <h3>Törölt mezők</h3>
      <p class="layout-trash-hint">${hidden.length ? "Kattints a visszaállításhoz." : "Itt jelennek meg a törölt cellák."}</p>
      <div class="layout-trash-list">${items}</div>
    </section>`;
  }

  function sectionHtml(section, title) {
    const items = visible(section);
    const rows = Math.max(3, maxRow(section));
    return `<section class="layout-step" data-section="${section}">
      <div class="layout-step-head">
        <h3>${escapeHtml(title)}</h3>
        <button type="button" class="btn ghost" data-insert-row="${section}">Üres sor beszúrása</button>
      </div>
      <div class="layout-board" data-board="${section}" style="grid-template-rows: repeat(${rows}, ${ROW_PX}px)">${items.map(tileHtml).join("")}</div>
    </section>`;
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
    const section = board.getAttribute("data-board");
    const maxAllowed = maxRow(section) + DROP_BUFFER;
    return clamp(Math.floor(y / m.rowStride) + 1, 1, Math.max(1, maxAllowed));
  }

  function setBoardHeight(board, { buffer = 0 } = {}) {
    const section = board.getAttribute("data-board");
    const rows = Math.max(3, maxRow(section) + buffer);
    board.style.gridTemplateRows = `repeat(${rows}, ${ROW_PX}px)`;
  }

  function placeOnBoard(cell, board, clientX, clientY, grab) {
    const col = colFromEvent(board, clientX);
    const row = rowFromEvent(board, clientY);
    const section = board.getAttribute("data-board") === "more" ? "more" : "main";
    cell.section = section;
    if (isSpacer(cell)) {
      cell.col = 1;
      cell.colSpan = COLS;
      cell.row = grab ? clamp(row - (grab.row - grab.startRow), 1, 80) : row;
      return;
    }
    if (grab) {
      cell.col = clamp(col - (grab.col - grab.startCol), 1, COLS - cell.colSpan + 1);
      cell.row = clamp(row - (grab.row - grab.startRow), 1, 80);
    } else {
      cell.col = clamp(col, 1, COLS - cell.colSpan + 1);
      cell.row = row;
    }
  }

  function insertEmptyRow(section) {
    const at = maxRow(section) + 1;
    for (const cell of cells) {
      if (cell.hidden) continue;
      if ((section === "more" ? cell.section === "more" : cell.section !== "more") && cell.row >= at) {
        cell.row += 1;
      }
    }
    cells.push(createSpacerCell(section, at));
    notify();
    mount();
  }

  function paint(tile, cell) {
    tile.setAttribute("style", tileStyle(cell));
    const meta = tile.querySelector(".layout-tile-meta");
    if (meta) {
      meta.textContent = isSpacer(cell)
        ? "üres"
        : `${cell.colSpan}/12${cell.surfaces ? ` · ${cell.surfaces.join("+")}` : ""}`;
    }
  }

  function bind() {
    root.querySelectorAll("[data-insert-row]").forEach((btn) => {
      btn.addEventListener("click", () => insertEmptyRow(btn.getAttribute("data-insert-row")));
    });

    root.querySelectorAll(".layout-tile").forEach((tile) => {
      tile.addEventListener("pointerdown", (event) => {
        if (event.target.closest("[data-del]")) {
          event.preventDefault();
          event.stopPropagation();
          const cell = byKey(tile.getAttribute("data-field"));
          if (!cell) return;
          if (isSpacer(cell)) {
            cells = cells.filter((c) => c.field_key !== cell.field_key);
          } else {
            cell.hidden = true;
          }
          notify();
          mount();
          return;
        }
        const cell = byKey(tile.getAttribute("data-field"));
        let board = tile.closest(".layout-board");
        if (!cell || !board) return;
        const resize = event.target.closest("[data-resize]");
        event.preventDefault();
        tile.setPointerCapture(event.pointerId);
        tile.classList.add("dragging");
        setBoardHeight(board, { buffer: DROP_BUFFER });
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
              setBoardHeight(board, { buffer: DROP_BUFFER });
              grab.startCol = cell.col;
              grab.startRow = cell.row;
              grab.col = colFromEvent(board, ev.clientX);
              grab.row = rowFromEvent(board, ev.clientY);
            }
          }
          if (!board) return;
          if (resize && !isSpacer(cell)) {
            const edge = colFromEvent(board, ev.clientX);
            cell.colSpan = clamp(edge - cell.col + 1, 1, COLS - cell.col + 1);
          } else {
            placeOnBoard(cell, board, ev.clientX, ev.clientY, grab);
          }
          setBoardHeight(board, { buffer: DROP_BUFFER });
          paint(tile, cell);
        };
        const up = () => {
          tile.classList.remove("dragging");
          root.querySelectorAll(".layout-board").forEach((el) => el.classList.remove("is-drop"));
          try {
            tile.releasePointerCapture(event.pointerId);
          } catch {
            /* */
          }
          tile.removeEventListener("pointermove", move);
          tile.removeEventListener("pointerup", up);
          notify();
          mount();
        };
        tile.addEventListener("pointermove", move);
        tile.addEventListener("pointerup", up);
      });
    });

    root.querySelectorAll("[data-restore]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cell = byKey(btn.getAttribute("data-restore"));
        if (!cell) return;
        cell.hidden = false;
        const section = cell.section === "more" ? "more" : "main";
        cell.row = maxRow(section) + 1;
        notify();
        mount();
      });
    });
  }

  function mount() {
    root.innerHTML = `${sectionHtml("main", "Fő szűrők (kereső / feladás)")}${sectionHtml("more", "További feltételek")}${trashHtml()}`;
    bind();
  }

  mount();
  return {
    get cells() {
      return cells;
    },
  };
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
