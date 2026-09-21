const COLS = 12;
const ROW_PX = 64;
const DROP_BUFFER = 2;
const DRAG_THRESHOLD_PX = 8;
const DEFAULT_STEP_NAMES = {
  1: "Alapadatok",
  2: "Műszaki adatok",
  3: "Extrák",
  4: "Képek",
  5: "Hirdetés",
};

const DESK_POSTING_ACCORDIONS = [
  { id: "alap", step: 1, label: "Alap adatok" },
  { id: "muszaki", step: 2, label: "Műszaki adatok" },
  { id: "extrak", step: 3, label: "Extrák" },
  { id: "hirdetes", step: 5, label: "Hirdetés" },
];
import {
  DESK_STEP2_PINNED_BLOCKS,
  applySyntheticStackRow,
  anchorCellsForBlock,
  collapsePinnedAnchorRows,
  deskPinnedGroupKeys,
  hideSyntheticAnchors,
  isDeskSyntheticFieldKey,
  minAnchorRow,
} from "./ad-form-desk-pinned-blocks.js?v=deskPinned1";

const PAIR_OF = {
  gyartasi_ev: "gyartasi_honap",
  forgalomba_helyezes_ev: "forgalomba_helyezes_honap",
  muszaki_ev: "muszaki_honap",
};

export function mountLayoutBoard(root, layout, { onChange, stepNames, deskPosting = false } = {}) {
  if (!root) return { cells: layout?.cells || [] };
  const STEP_NAMES = { ...DEFAULT_STEP_NAMES, ...(stepNames || {}) };
  const cells = Array.isArray(layout?.cells) ? layout.cells : [];
  const byKey = new Map(cells.map((cell) => [cell.field_key, cell]));
  const skip = new Set([
    "hirdetes_cime",
    "hirdetes_vertical",
    "hirdetes_alkategoria",
    "jarmu_kategoria",
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
    "akcios_ar",
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

  function isStackBoard(board) {
    return board?.dataset?.deskStack === "1";
  }

  function stackItems(step, { excludeKey = "" } = {}) {
    return editable()
      .filter((cell) => !cell.hidden && Number(cell.step) === step && cell.field_key !== excludeKey)
      .sort(
        (a, b) =>
          (Number(a.row) || 1) - (Number(b.row) || 1) ||
          (Number(a.col) || 1) - (Number(b.col) || 1) ||
          (Number(a.order) || 0) - (Number(b.order) || 0)
      );
  }

  function syntheticStackCells(step) {
    const out = [];
    for (const block of DESK_STEP2_PINNED_BLOCKS) {
      const anchors = anchorCellsForBlock(byKey, block, step);
      if (!anchors.length) continue;
      const row = minAnchorRow(anchors) ?? 1;
      out.push({
        field_key: block.syntheticKey,
        label: block.label,
        step,
        row,
        col: 1,
        colSpan: 12,
        order: row,
        hidden: false,
        __synthetic: true,
      });
    }
    return out;
  }

  function stackDisplayItems(step) {
    if (!deskPosting || step !== 2) return stackItems(step);
    const grouped = deskPinnedGroupKeys();
    const regular = stackItems(step).filter((cell) => !grouped.has(cell.field_key));
    const synthetics = syntheticStackCells(step);
    return [...regular, ...synthetics].sort(
      (a, b) =>
        (Number(a.row) || 1) - (Number(b.row) || 1) ||
        (Number(a.col) || 1) - (Number(b.col) || 1) ||
        (Number(a.order) || 0) - (Number(b.order) || 0) ||
        String(a.field_key).localeCompare(String(b.field_key))
    );
  }

  function normalizeStackStep(step) {
    if (deskPosting && step === 2) collapsePinnedAnchorRows(byKey, step);
    const items = stackDisplayItems(step);
    let changed = false;
    items.forEach((cell, index) => {
      const row = index + 1;
      if (cell.__synthetic) {
        for (const block of DESK_STEP2_PINNED_BLOCKS) {
          if (block.syntheticKey !== cell.field_key) continue;
          const anchors = anchorCellsForBlock(byKey, block, step);
          for (const anchor of anchors) {
            if (anchor.row !== row || anchor.col !== 1 || anchor.colSpan !== 12) {
              anchor.row = row;
              anchor.col = 1;
              anchor.colSpan = 12;
              anchor.order = row;
              changed = true;
            }
          }
        }
        return;
      }
      if (cell.row !== row || cell.col !== 1 || cell.colSpan !== 12) {
        cell.row = row;
        cell.col = 1;
        cell.colSpan = 12;
        cell.order = row;
        syncPair(cell);
        changed = true;
      }
    });
    return changed;
  }

  function ensureDeskStackCells() {
    if (!deskPosting) return;
    for (const step of [1, 2, 3, 5]) normalizeStackStep(step);
  }

  function tileHtml(cell, { stack = false } = {}) {
    const style = stack ? "" : tileStyle(cell);
    const meta = stack ? `#${cell.row} · lépés ${cell.step}` : `${cell.colSpan}/12 · lépés ${cell.step}`;
    return `<button type="button" class="layout-tile${stack ? " layout-tile--desk-stack" : ""}" data-field="${escapeAttr(cell.field_key)}"${style ? ` style="${style}"` : ""}>
      <span class="layout-tile-label">${escapeHtml(cell.label)}</span>
      <span class="layout-tile-meta">${meta}</span>
      <span class="layout-tile-steps" data-step-btns="1">
        <span class="layout-step-btn" data-step-delta="-1" title="Előző lépés">↑</span>
        <span class="layout-step-btn" data-step-delta="1" title="Következő lépés">↓</span>
      </span>
      <span class="layout-del" data-del="1" title="Törlés">×</span>
      ${stack ? "" : '<span class="layout-resize" data-resize="1"></span>'}
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

  function stepBoardHtml(step) {
    const items = editable().filter((cell) => !cell.hidden && Number(cell.step) === step);
    const maxRow = Math.max(3, ...items.map((cell) => Number(cell.row) || 1));
    const tiles = items.map((cell) => tileHtml(cell)).join("");
    return `<section class="layout-step" data-step="${step}">
      <div class="layout-board" data-board="${step}" style="grid-template-rows: repeat(${maxRow}, ${ROW_PX}px)">${tiles}</div>
    </section>`;
  }

  function deskStackBoardHtml(step) {
    const items = stackDisplayItems(step);
    const tiles = items.map((cell) => tileHtml(cell, { stack: true })).join("");
    return `<section class="layout-step" data-step="${step}">
      <div class="layout-board layout-board--desk-stack" data-board="${step}" data-desk-stack="1">${tiles}</div>
    </section>`;
  }

  function flatStepBoardHtml(step) {
    const items = editable().filter((cell) => !cell.hidden && Number(cell.step) === step);
    const maxRow = Math.max(3, ...items.map((cell) => Number(cell.row) || 1));
    const tiles = items.map(tileHtml).join("");
    return `<section class="layout-step" data-step="${step}">
      <h3>Lépés ${step} — ${STEP_NAMES[step]}</h3>
      <div class="layout-board" data-board="${step}" style="grid-template-rows: repeat(${maxRow}, ${ROW_PX}px)">${tiles}</div>
    </section>`;
  }

  function boardsHtml() {
    return [1, 2, 3, 4, 5].map((step) => flatStepBoardHtml(step)).join("");
  }

  function deskBoardsHtml() {
    const accHtml = DESK_POSTING_ACCORDIONS.map(
      ({ id, step, label }) => `
      <div class="layout-desk-acc" data-desk-acc="${id}">
        <button type="button" class="layout-desk-acc__head" data-desk-acc-toggle aria-expanded="false">
          <span>${escapeHtml(label)}</span>
          <span class="layout-desk-acc__chev" aria-hidden="true">▼</span>
        </button>
        <div class="layout-desk-acc__body">${deskStackBoardHtml(step)}</div>
      </div>`
    ).join("");
    return `
      <div class="layout-desk-editor">
        <div class="layout-desk-shell">${accHtml}</div>
        <div class="layout-desk-center">
          <p class="layout-desk-center-label">Képek és leírás — live desk középső oszlop</p>
          ${stepBoardHtml(4)}
        </div>
        <aside class="layout-desk-tips" aria-hidden="true">
          <p class="layout-desk-tips-label">Tippek (live jobb oszlop)</p>
          <p class="layout-desk-tips-hint">A feladási űrlapon itt jelennek meg a súgó szövegek. Ez csak vizuális váz — a mezők bal accordionban és középen szerkeszthetők.</p>
        </aside>
      </div>`;
  }

  function bindDeskAccordions() {
    if (!deskPosting) return;
    root.querySelectorAll("[data-desk-acc-toggle]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const acc = btn.closest("[data-desk-acc]");
        if (!acc) return;
        const wasOpen = acc.classList.contains("is-open");
        root.querySelectorAll(".layout-desk-acc[data-desk-acc]").forEach((el) => {
          const on = !wasOpen && el === acc;
          el.classList.toggle("is-open", on);
          el.querySelector("[data-desk-acc-toggle]")?.setAttribute("aria-expanded", on ? "true" : "false");
        });
      });
    });
  }

  function reorderStackDom(board, draggingTile, clientY) {
    const tiles = [...board.querySelectorAll(".layout-tile")].filter((tile) => tile !== draggingTile);
    let inserted = false;
    for (const tile of tiles) {
      const rect = tile.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        board.insertBefore(draggingTile, tile);
        inserted = true;
        break;
      }
    }
    if (!inserted) board.appendChild(draggingTile);
  }

  function syncStackFromDom(board) {
    const step = Number(board.getAttribute("data-board"));
    [...board.querySelectorAll(".layout-tile")].forEach((tile, index) => {
      const key = tile.getAttribute("data-field");
      const row = index + 1;
      if (isDeskSyntheticFieldKey(key)) {
        applySyntheticStackRow(byKey, key, row, step);
        return;
      }
      const cell = byKey.get(key);
      if (!cell) return;
      cell.step = step;
      cell.row = row;
      cell.col = 1;
      cell.colSpan = 12;
      cell.order = row;
      syncPair(cell);
    });
  }

  function paint(tile, cell) {
    const board = tile.closest(".layout-board");
    if (isStackBoard(board)) {
      tile.removeAttribute("style");
      const meta = tile.querySelector(".layout-tile-meta");
      if (meta) meta.textContent = `#${cell.row} · lépés ${cell.step}`;
      return;
    }
    tile.setAttribute("style", tileStyle(cell));
    const meta = tile.querySelector(".layout-tile-meta");
    if (meta) meta.textContent = `${cell.colSpan}/12 · lépés ${cell.step}`;
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
    const maxAllowed = maxRowOn(Number(board.getAttribute("data-board"))) + DROP_BUFFER;
    return clamp(Math.floor(y / m.rowStride) + 1, 1, Math.max(1, maxAllowed));
  }

  function maxRowOnStep(step, { excludeKey = "" } = {}) {
    const rows = editable()
      .filter((cell) => !cell.hidden && Number(cell.step) === step && cell.field_key !== excludeKey)
      .map((cell) => Number(cell.row) || 1);
    return rows.length ? Math.max(...rows) : 0;
  }

  function maxRowOn(step) {
    return Math.max(1, maxRowOnStep(step));
  }

  function boardAtPoint(clientX, clientY, preferBoard) {
    const boards = [...root.querySelectorAll(".layout-board")].sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
    );
    if (!boards.length) return preferBoard || null;

    const bands = boards.map((board) => {
      const step = board.closest(".layout-step");
      const r = (step || board).getBoundingClientRect();
      return { board, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });

    const inX = bands.filter((b) => clientX >= b.left - 24 && clientX <= b.right + 24);
    const pool = inX.length ? inX : bands;

    for (const b of pool) {
      if (clientY >= b.top && clientY <= b.bottom) return b.board;
    }

    for (let i = 0; i < pool.length - 1; i += 1) {
      const a = pool[i];
      const b = pool[i + 1];
      if (clientY < a.bottom || clientY > b.top) continue;
      const mid = (a.bottom + b.top) / 2;
      if (preferBoard === b.board && clientY >= mid - 48) return b.board;
      if (preferBoard === a.board && clientY < mid + 48) return a.board;
      return clientY >= mid ? b.board : a.board;
    }

    if (clientY < pool[0].top) return pool[0].board;
    return pool[pool.length - 1].board;
  }

  function compactStep(step) {
    const items = editable().filter((cell) => !cell.hidden && Number(cell.step) === step);
    if (!items.length) return false;
    const used = [...new Set(items.map((cell) => Number(cell.row) || 1))].sort((a, b) => a - b);
    const remap = new Map(used.map((row, index) => [row, index + 1]));
    let changed = false;
    for (const cell of items) {
      const next = remap.get(Number(cell.row) || 1);
      if (next == null || next === cell.row) continue;
      cell.row = next;
      cell.order = (cell.row - 1) * COLS + cell.col;
      syncPair(cell);
      changed = true;
    }
    return changed;
  }

  function setBoardHeight(board, { buffer = 0 } = {}) {
    const step = Number(board.getAttribute("data-board"));
    const rows = Math.max(3, maxRowOn(step) + buffer);
    board.style.gridTemplateRows = `repeat(${rows}, ${ROW_PX}px)`;
  }

  function assignToBoard(cell, board, clientX, clientY, { grab = null, crossed = false } = {}) {
    const toStep = Number(board.getAttribute("data-board"));
    const fromStep = Number(cell.step);
    const didCross = crossed || fromStep !== toStep;

    if (didCross) {
      cell.step = toStep;
      cell.row = maxRowOnStep(toStep, { excludeKey: cell.field_key }) + 1;
      cell.col = 1;
      if (deskPosting && [1, 2, 3, 5].includes(toStep)) {
        cell.colSpan = 12;
        cell.order = cell.row;
      } else {
        cell.order = (cell.row - 1) * COLS + cell.col;
      }
      syncPair(cell);
      return;
    }

    const col = colFromEvent(board, clientX);
    const row = rowFromEvent(board, clientY);
    if (grab) {
      cell.col = clamp(col - (grab.col - grab.startCol), 1, COLS - cell.colSpan + 1);
      cell.row = clamp(row - (grab.row - grab.startRow), 1, 80);
    } else {
      cell.col = clamp(col, 1, COLS - cell.colSpan + 1);
      cell.row = row;
    }
    cell.step = toStep;
    cell.order = (cell.row - 1) * COLS + cell.col;
    syncPair(cell);
  }

  function bindTiles() {
    root.querySelectorAll(".layout-tile").forEach((tile) => {
      tile.addEventListener("pointerdown", (event) => {
        if (event.target.closest("[data-del]")) {
          event.preventDefault();
          event.stopPropagation();
          const key = tile.getAttribute("data-field");
          if (isDeskSyntheticFieldKey(key)) {
            hideSyntheticAnchors(byKey, key);
            notify();
            mount();
            return;
          }
          const cell = byKey.get(key);
          if (!cell) return;
          cell.hidden = true;
          syncPair(cell);
          notify();
          mount();
          return;
        }
        if (event.target.closest("[data-step-btns]")) {
          event.preventDefault();
          event.stopPropagation();
          const btn = event.target.closest("[data-step-delta]");
          const stepKey = tile.getAttribute("data-field");
          let cell = byKey.get(stepKey);
          if (!cell && isDeskSyntheticFieldKey(stepKey)) {
            cell = stackDisplayItems(Number(tile.closest(".layout-board")?.getAttribute("data-board"))).find(
              (c) => c.field_key === stepKey
            );
          }
          if (!btn || !cell) return;
          const fromStep = Number(cell.step);
          if (cell.__synthetic) {
            const next = clamp(fromStep + Number(btn.getAttribute("data-step-delta")), 1, 5);
            if (next === fromStep) return;
            applySyntheticStackRow(byKey, stepKey, maxRowOnStep(next, { excludeKey: stepKey }) + 1, next);
            if (deskPosting && [1, 2, 3, 5].includes(fromStep)) normalizeStackStep(fromStep);
            if (deskPosting && [1, 2, 3, 5].includes(next)) normalizeStackStep(next);
            notify();
            mount();
            return;
          }
          const next = clamp(fromStep + Number(btn.getAttribute("data-step-delta")), 1, 5);
          if (next === fromStep) return;
          cell.step = next;
          cell.row = maxRowOnStep(next, { excludeKey: cell.field_key }) + 1;
          cell.col = 1;
          if (deskPosting && [1, 2, 3, 5].includes(next)) {
            cell.colSpan = 12;
            cell.order = cell.row;
          } else {
            cell.order = (cell.row - 1) * COLS + cell.col;
          }
          syncPair(cell);
          if (deskPosting && ([1, 2, 3, 5].includes(fromStep) || [1, 2, 3, 5].includes(next))) {
            normalizeStackStep(fromStep);
            normalizeStackStep(next);
          } else {
            compactStep(fromStep);
            compactStep(next);
          }
          notify();
          mount();
          return;
        }

        const fieldKey = tile.getAttribute("data-field");
        let cell = byKey.get(fieldKey);
        if (isDeskSyntheticFieldKey(fieldKey)) {
          cell = stackDisplayItems(Number(tile.closest(".layout-board")?.getAttribute("data-board"))).find(
            (c) => c.field_key === fieldKey
          );
        }
        let board = tile.closest(".layout-board");
        if (!cell || !board) return;
        const stackBoard = isStackBoard(board);
        const resize = !stackBoard && Boolean(event.target.closest("[data-resize]"));
        const fromStep = Number(cell.step);
        const originCol = cell.col;
        const originRow = cell.row;
        const originSpan = cell.colSpan;
        const originStep = cell.step;
        const originOrder = cell.order;
        event.preventDefault();
        tile.setPointerCapture(event.pointerId);
        tile.classList.add("dragging");

        const grab = {
          startCol: cell.col,
          startRow: cell.row,
          col: colFromEvent(board, event.clientX),
          row: rowFromEvent(board, event.clientY),
          resizeOriginCol: cell.col,
          resizeOriginSpan: cell.colSpan,
          resizeOriginX: event.clientX,
        };

        let lastX = event.clientX;
        let lastY = event.clientY;
        let ended = false;
        let dragArmed = resize; // szélesség húzásnál azonnal aktív
        let boardsExpanded = false;

        const armDrag = () => {
          if (dragArmed) return;
          dragArmed = true;
          if (!boardsExpanded) {
            root.querySelectorAll(".layout-board").forEach((b) => setBoardHeight(b, { buffer: DROP_BUFFER }));
            boardsExpanded = true;
          }
        };

        const move = (ev) => {
          if (ended) return;
          lastX = ev.clientX;
          lastY = ev.clientY;

          if (!dragArmed) {
            const dist = Math.hypot(ev.clientX - event.clientX, ev.clientY - event.clientY);
            if (dist < DRAG_THRESHOLD_PX) return;
            armDrag();
          }

          if (resize) {
            const m = boardMetrics(board);
            const deltaCols = Math.round((ev.clientX - grab.resizeOriginX) / m.colStride);
            let span = clamp(grab.resizeOriginSpan + deltaCols, 1, COLS);
            let col = grab.resizeOriginCol;
            const edge = colFromEvent(board, ev.clientX);
            if (deltaCols > 0 && edge >= COLS) {
              span = COLS;
              col = 1;
            } else if (col + span - 1 > COLS) {
              col = Math.max(1, COLS - span + 1);
            }
            cell.col = col;
            cell.colSpan = span;
            cell.order = (cell.row - 1) * COLS + cell.col;
            syncPair(cell);
            paint(tile, cell);
            return;
          }

          const nextBoard = boardAtPoint(ev.clientX, ev.clientY, board);
          root.querySelectorAll(".layout-board").forEach((el) => el.classList.toggle("is-drop", el === nextBoard));
          if (!nextBoard) return;

          if (isStackBoard(nextBoard)) {
            if (nextBoard !== board) {
              nextBoard.appendChild(tile);
              board = nextBoard;
            }
            reorderStackDom(board, tile, ev.clientY);
            return;
          }

          if (stackBoard && nextBoard !== board) {
            assignToBoard(cell, nextBoard, ev.clientX, ev.clientY, { crossed: true });
            paint(tile, cell);
            nextBoard.appendChild(tile);
            board = nextBoard;
            setBoardHeight(board, { buffer: DROP_BUFFER });
            grab.startCol = cell.col;
            grab.startRow = cell.row;
            grab.col = colFromEvent(board, ev.clientX);
            grab.row = rowFromEvent(board, ev.clientY);
            return;
          }

          if (nextBoard !== board) {
            assignToBoard(cell, nextBoard, ev.clientX, ev.clientY, { crossed: true });
            paint(tile, cell);
            nextBoard.appendChild(tile);
            board = nextBoard;
            setBoardHeight(board, { buffer: DROP_BUFFER });
            grab.startCol = cell.col;
            grab.startRow = cell.row;
            grab.col = colFromEvent(board, ev.clientX);
            grab.row = rowFromEvent(board, ev.clientY);
            return;
          }

          assignToBoard(cell, board, ev.clientX, ev.clientY, { grab });
          paint(tile, cell);
          setBoardHeight(board, { buffer: DROP_BUFFER });
        };

        const up = () => {
          if (ended) return;
          ended = true;
          tile.classList.remove("dragging");
          root.querySelectorAll(".layout-board").forEach((el) => el.classList.remove("is-drop"));
          try {
            tile.releasePointerCapture(event.pointerId);
          } catch {
          }
          tile.removeEventListener("pointermove", move);
          tile.removeEventListener("pointerup", up);
          tile.removeEventListener("pointercancel", up);

          if (!dragArmed) {
            cell.col = originCol;
            cell.row = originRow;
            cell.colSpan = originSpan;
            cell.step = originStep;
            cell.order = originOrder;
            syncPair(cell);
            notify();
            mount();
            return;
          }

          const dropBoard = boardAtPoint(lastX, lastY, board) || board;
          if (!resize) {
            if (isStackBoard(dropBoard)) {
              if (dropBoard !== board) dropBoard.appendChild(tile);
              reorderStackDom(dropBoard, tile, lastY);
              syncStackFromDom(dropBoard);
              if (fromStep !== Number(dropBoard.getAttribute("data-board"))) {
                normalizeStackStep(fromStep);
              }
            } else if (dropBoard !== board) {
              assignToBoard(cell, dropBoard, lastX, lastY, { crossed: true });
            } else if (!stackBoard) {
              assignToBoard(cell, dropBoard, lastX, lastY, { grab });
            }
          }

          if (isStackBoard(dropBoard)) {
            normalizeStackStep(Number(dropBoard.getAttribute("data-board")));
          } else {
            compactStep(fromStep);
            compactStep(Number(cell.step));
          }
          notify();
          mount();
        };

        tile.addEventListener("pointermove", move);
        tile.addEventListener("pointerup", up);
        tile.addEventListener("pointercancel", up);
      });
    });

    root.querySelectorAll("[data-restore]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cell = byKey.get(btn.getAttribute("data-restore"));
        if (!cell) return;
        cell.hidden = false;
        if (![1, 2, 3, 4, 5].includes(Number(cell.step))) cell.step = 1;
        const step = Number(cell.step);
        cell.row = maxRowOn(step) + 1;
        cell.col = 1;
        if (deskPosting && [1, 2, 3, 5].includes(step)) {
          cell.colSpan = 12;
          cell.order = cell.row;
        } else {
          cell.order = (cell.row - 1) * COLS + cell.col;
        }
        syncPair(cell);
        if (deskPosting && [1, 2, 3, 5].includes(step)) normalizeStackStep(step);
        else compactStep(step);
        notify();
        mount();
      });
    });
  }

  function mount() {
    if (deskPosting) ensureDeskStackCells();
    root.innerHTML = `${deskPosting ? deskBoardsHtml() : boardsHtml()}${trashHtml()}`;
    bindDeskAccordions();
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
