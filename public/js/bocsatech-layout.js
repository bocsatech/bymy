const COLS = 12;
const ROW_PX = 64;
const DROP_BUFFER = 2;
/** Ennyi pixel alatt kattintásnak számít (nem mozgatás). */
const DRAG_THRESHOLD_PX = 8;
const DEFAULT_STEP_NAMES = {
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

export function mountLayoutBoard(root, layout, { onChange, stepNames } = {}) {
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

  function tileHtml(cell) {
    return `<button type="button" class="layout-tile" data-field="${escapeAttr(cell.field_key)}" style="${tileStyle(cell)}">
      <span class="layout-tile-label">${escapeHtml(cell.label)}</span>
      <span class="layout-tile-meta">${cell.colSpan}/12 · lépés ${cell.step}</span>
      <span class="layout-tile-steps" data-step-btns="1">
        <span class="layout-step-btn" data-step-delta="-1" title="Előző lépés">↑</span>
        <span class="layout-step-btn" data-step-delta="1" title="Következő lépés">↓</span>
      </span>
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
          <div class="layout-board" data-board="${step}" style="grid-template-rows: repeat(${maxRow}, ${ROW_PX}px)">${tiles}</div>
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

  /** Lépés-sávok Y szerint — fejléc és rés is a cél lépéshez tartozik. */
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

  /** Üres sorok kiszűrése: a használt sorok egymás alá csúsznak. */
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
      cell.order = (cell.row - 1) * COLS + cell.col;
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
          const cell = byKey.get(tile.getAttribute("data-field"));
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
          const cell = byKey.get(tile.getAttribute("data-field"));
          if (!btn || !cell) return;
          const fromStep = Number(cell.step);
          const next = clamp(fromStep + Number(btn.getAttribute("data-step-delta")), 1, 5);
          if (next === fromStep) return;
          cell.step = next;
          cell.row = maxRowOnStep(next, { excludeKey: cell.field_key }) + 1;
          cell.col = 1;
          cell.order = (cell.row - 1) * COLS + cell.col;
          syncPair(cell);
          compactStep(fromStep);
          compactStep(next);
          notify();
          mount();
          return;
        }

        const cell = byKey.get(tile.getAttribute("data-field"));
        let board = tile.closest(".layout-board");
        if (!cell || !board) return;
        const resize = Boolean(event.target.closest("[data-resize]"));
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
          // Resize: pixel-delta, hogy visszafele is lehessen keskenyíteni/szélesíteni
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
            /* */
          }
          tile.removeEventListener("pointermove", move);
          tile.removeEventListener("pointerup", up);
          tile.removeEventListener("pointercancel", up);

          // Puszta kattintás: ne mozduljon el a cella (ne jöjjön plusz sor)
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

          if (!resize) {
            const dropBoard = boardAtPoint(lastX, lastY, board) || board;
            if (dropBoard !== board) {
              assignToBoard(cell, dropBoard, lastX, lastY, { crossed: true });
            } else {
              assignToBoard(cell, dropBoard, lastX, lastY, { grab });
            }
          }

          compactStep(fromStep);
          compactStep(Number(cell.step));
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
        cell.order = (cell.row - 1) * COLS + cell.col;
        syncPair(cell);
        compactStep(step);
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
