/** Bocsatech — ingatlan kerék-séma drag-and-drop + osztott min–max csempék. */

import {
  WHEEL_COLS,
  isSpacer,
  createSpacerCell,
  normalizeIngatlanWheelSchema,
  INGATLAN_DUAL_RANGE_GROUPS,
  syncDualRangeCells,
  dualGroupForField,
} from "./ingatlan-wheel-schema.js?v=immoWheel21";

const COLS = WHEEL_COLS;
const ROW_PX = 72;
const DROP_BUFFER = 2;

export function mountIngatlanWheelBoard(root, schema, { onChange, readOnly = false, allowedFields = null } = {}) {
  if (!root) return { cells: [] };
  let cells = normalizeIngatlanWheelSchema(schema).cells.map((c) => ({ ...c }));

  function notify() {
    syncDualRangeCells(cells);
    onChange?.({ version: 1, cells: cells.map((c) => ({ ...c })) });
  }

  function visible(section) {
    return cells.filter(
      (c) =>
        !c.hidden &&
        (isSpacer(c) || !allowedFields || allowedFields.has(c.field_key)) &&
        (section === "more" ? c.section === "more" : c.section !== "more")
    );
  }

  function byKey(key) {
    return cells.find((c) => c.field_key === key);
  }

  function maxRow(section, { excludeKey = "" } = {}) {
    const rows = visible(section)
      .filter((c) => !excludeKey || c.field_key !== excludeKey)
      .map((c) => Number(c.row) || 1);
    if (!rows.length) return 0;
    return Math.max(...rows);
  }

  /** Max sor a húzott mező nélkül + 1 (legaljára), üres lyukak nélkül. */
  function clampRowInSection(section, row, excludeKeys = []) {
    const skip = new Set(excludeKeys.filter(Boolean));
    const occupied = visible(section)
      .filter((c) => !skip.has(c.field_key))
      .map((c) => Number(c.row) || 1);
    const floor = occupied.length ? Math.max(...occupied) : 0;
    return clamp(row, 1, floor + 1);
  }

  /** Üres (nem spacer) sorok összehúzása — meglévő mezők relatív sorrendje megmarad. */
  function compactSection(section) {
    const items = visible(section);
    if (!items.length) return;
    const used = [...new Set(items.map((c) => Number(c.row) || 1))].sort((a, b) => a - b);
    const remap = new Map(used.map((row, i) => [row, i + 1]));
    for (const cell of items) {
      const next = remap.get(Number(cell.row) || 1);
      if (next != null && next !== cell.row) cell.row = next;
    }
  }

  function boardAtPoint(clientX, clientY, ignoreEl, preferBoard) {
    const main = root.querySelector('.layout-board[data-board="main"]');
    const more = root.querySelector('.layout-board[data-board="more"]');

    /* Hiszterézis: ne ugráljon oda-vissza a két tábla között a határnál. */
    if (main && more) {
      const mainR = main.getBoundingClientRect();
      const moreR = more.getBoundingClientRect();
      const inX = (r) => clientX >= r.left && clientX <= r.right;
      const mid = (mainR.bottom + moreR.top) / 2;
      const preferMore = preferBoard?.getAttribute("data-board") === "more";
      const preferMain = preferBoard?.getAttribute("data-board") === "main";
      if (inX(moreR) && inX(mainR)) {
        if (preferMore && clientY >= mid - 28) return more;
        if (preferMain && clientY < mid + 28) return main;
        if (clientY >= mid) return more;
        if (clientY < mid) return main;
      }
      if (inX(moreR) && clientY >= moreR.top) return more;
      if (inX(mainR) && clientY >= mainR.top && clientY < moreR.top) return main;
    }

    const prev = ignoreEl?.style.pointerEvents;
    if (ignoreEl) ignoreEl.style.pointerEvents = "none";
    const under = document.elementFromPoint(clientX, clientY);
    if (ignoreEl) ignoreEl.style.pointerEvents = prev || "";
    const hit = under?.closest?.(".layout-board");
    if (hit && root.contains(hit)) return hit;

    return preferBoard || null;
  }

  function placeOnBoard(cell, board, clientX, clientY, grab) {
    const col = colFromEvent(board, clientX);
    const row = rowFromEvent(board, clientY);
    const section = board.getAttribute("data-board") === "more" ? "more" : "main";
    const prevSection = cell.section === "more" ? "more" : "main";
    const crossed = prevSection !== section;
    const exclude = [cell.field_key];

    cell.section = section;
    if (isSpacer(cell)) {
      cell.col = 1;
      cell.colSpan = COLS;
      cell.row = crossed
        ? maxRow(section, { excludeKey: cell.field_key }) + 1
        : clampRowInSection(
            section,
            grab ? row - (grab.row - grab.startRow) : row,
            exclude
          );
      return;
    }

    /* Másik táblára húzáskor: mindig a cél tábla legaljára — meglévő elrendezés érintetlen. */
    if (crossed) {
      cell.row = maxRow(section, { excludeKey: cell.field_key }) + 1;
      cell.col = 1;
      return;
    }

    if (grab) {
      cell.col = clamp(col - (grab.col - grab.startCol), 1, COLS - cell.colSpan + 1);
      cell.row = clampRowInSection(section, row - (grab.row - grab.startRow), exclude);
    } else {
      cell.col = clamp(col, 1, COLS - cell.colSpan + 1);
      cell.row = clampRowInSection(section, row, exclude);
    }
  }

  function placeDual(tol, ig, board, clientX, clientY, grab) {
    const col = colFromEvent(board, clientX);
    const row = rowFromEvent(board, clientY);
    const section = board.getAttribute("data-board") === "more" ? "more" : "main";
    const prevSection = tol.section === "more" ? "more" : "main";
    const crossed = prevSection !== section;
    const total = clamp(tol.colSpan + ig.colSpan, 2, COLS);
    const start = grab
      ? clamp(col - (grab.col - grab.startCol), 1, COLS - total + 1)
      : clamp(col, 1, COLS - total + 1);
    const left = Math.max(1, Math.floor(total / 2));
    const right = Math.max(1, total - left);
    const exclude = [tol.field_key, ig.field_key];
    tol.section = section;
    ig.section = section;
    if (crossed) {
      const bottom = maxRow(section, { excludeKey: tol.field_key }) + 1;
      tol.row = bottom;
      ig.row = bottom;
      tol.col = 1;
      tol.colSpan = left;
      ig.col = 1 + left;
      ig.colSpan = right;
      return;
    }
    const nextRow = clampRowInSection(
      section,
      grab ? row - (grab.row - grab.startRow) : row,
      exclude
    );
    tol.row = nextRow;
    ig.row = nextRow;
    tol.col = start;
    tol.colSpan = left;
    ig.col = start + left;
    ig.colSpan = right;
  }

  function tileStyle(cell) {
    const col = clamp(cell.col, 1, COLS);
    const span = clamp(cell.colSpan, 1, COLS - col + 1);
    const row = clamp(cell.row, 1, 80);
    return `grid-column:${col} / span ${span};grid-row:${row}`;
  }

  function dualStyle(tol, ig) {
    const col = Math.min(tol.col, ig.col);
    const end = Math.max(tol.col + tol.colSpan - 1, ig.col + ig.colSpan - 1);
    const span = clamp(end - col + 1, 1, COLS);
    const row = clamp(tol.row, 1, 80);
    return `grid-column:${col} / span ${span};grid-row:${row}`;
  }

  function displayItems(section) {
    const items = visible(section);
    const skip = new Set();
    const out = [];
    for (const cell of items) {
      if (skip.has(cell.field_key)) continue;
      const group = dualGroupForField(cell.field_key);
      if (group) {
        const tol = byKey(group.tolKey);
        const ig = byKey(group.igKey);
        const inSection =
          tol &&
          ig &&
          !tol.hidden &&
          !ig.hidden &&
          (section === "more" ? tol.section === "more" : tol.section !== "more") &&
          (section === "more" ? ig.section === "more" : ig.section !== "more");
        if (inSection) {
          skip.add(group.tolKey);
          skip.add(group.igKey);
          out.push({ kind: "dual", group, tol, ig });
          continue;
        }
      }
      out.push({ kind: "cell", cell });
    }
    return out;
  }

  function applyDualWidth(tol, ig, start, total) {
    const width = clamp(total, 2, COLS);
    let col = clamp(start, 1, COLS);
    if (col + width - 1 > COLS) col = Math.max(1, COLS - width + 1);
    const left = Math.max(1, Math.floor(width / 2));
    const right = Math.max(1, width - left);
    tol.col = col;
    tol.colSpan = left;
    ig.col = col + left;
    ig.colSpan = right;
    ig.row = tol.row;
  }

  function dualSpan(tol, ig) {
    return (
      Math.max(tol.col + tol.colSpan - 1, ig.col + ig.colSpan - 1) - Math.min(tol.col, ig.col) + 1
    );
  }

  function tileEditControls({ dual = false, spacer = false } = {}) {
    if (readOnly) return "";
    if (dual) {
      return `<span class="layout-width-btns" data-width-btns="1">
        <span class="layout-width-btn" data-width-delta="-1" title="Keskenyebb">−</span>
        <span class="layout-width-btn" data-width-delta="1" title="Szélesebb">+</span>
        <span class="layout-width-btn layout-width-btn--full" data-width-full="1" title="Teljes szélesség (12/12)">12</span>
      </span>
      <span class="layout-order-btns" data-order-btns="1">
        <button type="button" class="layout-width-btn" data-order-delta="-1" title="Fel" aria-label="Mező feljebb">↑</button>
        <button type="button" class="layout-width-btn" data-order-delta="1" title="Le" aria-label="Mező lejjebb">↓</button>
      </span>
      <span class="layout-del" data-del="1" title="Törlés">×</span>
      <span class="layout-resize" data-resize="1" title="Húzd jobbra/balra · Dupla katt: 12/12"></span>`;
    }
    return `${
      spacer
        ? ""
        : `<span class="layout-width-btns" data-width-btns="1">
        <span class="layout-width-btn" data-width-delta="-1" title="Keskenyebb">−</span>
        <span class="layout-width-btn" data-width-delta="1" title="Szélesebb">+</span>
        <span class="layout-width-btn layout-width-btn--full" data-width-full="1" title="Teljes szélesség (12/12)">12</span>
      </span>`
    }
      <span class="layout-order-btns" data-order-btns="1">
        <button type="button" class="layout-width-btn" data-order-delta="-1" title="Fel" aria-label="Mező feljebb">↑</button>
        <button type="button" class="layout-width-btn" data-order-delta="1" title="Le" aria-label="Mező lejjebb">↓</button>
      </span>
      <span class="layout-del" data-del="1" title="Törlés">×</span>
      ${spacer ? "" : `<span class="layout-resize" data-resize="1" title="Húzd jobbra/balra · Dupla katt: 12/12"></span>`}`;
  }

  function tileHtml(item) {
    const ro = readOnly ? " layout-tile--readonly" : "";
    if (item.kind === "dual") {
      const { group, tol, ig } = item;
      const span = dualSpan(tol, ig);
      return `<div class="layout-tile layout-tile--dual${ro}" data-dual="${escapeAttr(group.id)}" data-field="${escapeAttr(group.tolKey)}" style="${dualStyle(tol, ig)}"${readOnly ? "" : ' role="button" tabindex="0"'}>
      <span class="layout-tile-label">${escapeHtml(group.adminLabel || group.title)}</span>
      <span class="layout-tile-meta">osztott kerék · ${span}/12 · search</span>
      <span class="layout-tile-dual-parts"><span>min</span><span aria-hidden="true">–</span><span>max</span></span>
      ${tileEditControls({ dual: true })}
    </div>`;
    }
    const cell = item.cell;
    const spacer = isSpacer(cell);
    return `<div class="layout-tile ${spacer ? "layout-tile--spacer" : ""}${ro}" data-field="${escapeAttr(cell.field_key)}" style="${tileStyle(cell)}"${readOnly ? "" : ' role="button" tabindex="0"'}>
      <span class="layout-tile-label">${escapeHtml(cell.label || cell.field_key)}</span>
      <span class="layout-tile-meta">${spacer ? "üres" : `${cell.colSpan}/12`}${
      cell.surfaces ? ` · ${cell.surfaces.join("+")}` : ""
    }</span>
      ${tileEditControls({ spacer })}
    </div>`;
  }

  function trashHtml() {
    if (readOnly) return "";
    const hidden = cells.filter(
      (c) => c.hidden && !isSpacer(c) && (!allowedFields || allowedFields.has(c.field_key))
    );
    const skip = new Set();
    const items = [];
    for (const c of hidden) {
      if (skip.has(c.field_key)) continue;
      const group = dualGroupForField(c.field_key);
      if (group) {
        const tol = byKey(group.tolKey);
        const ig = byKey(group.igKey);
        if (tol?.hidden && ig?.hidden) {
          skip.add(group.tolKey);
          skip.add(group.igKey);
          items.push(
            `<button type="button" class="layout-trash-item" data-restore-dual="${escapeAttr(group.id)}">${escapeHtml(
              group.adminLabel || group.title
            )} <span>vissza</span></button>`
          );
          continue;
        }
      }
      items.push(
        `<button type="button" class="layout-trash-item" data-restore="${escapeAttr(c.field_key)}">${escapeHtml(
          c.label
        )} <span>vissza</span></button>`
      );
    }
    return `<section class="layout-trash">
      <h3>Törölt mezők</h3>
      <p class="layout-trash-hint">${
        items.length ? "Kattints a visszaállításhoz." : "Itt jelennek meg a törölt cellák."
      }</p>
      <div class="layout-trash-list">${items.join("")}</div>
    </section>`;
  }

  function sectionHtml(section, title) {
    const items = displayItems(section);
    const rows = Math.max(3, maxRow(section));
    return `<section class="layout-step" data-section="${section}">
      <div class="layout-step-head">
        <h3>${escapeHtml(title)}</h3>
        ${readOnly ? "" : `<button type="button" class="btn ghost" data-insert-row="${section}">Üres sor beszúrása</button>`}
      </div>
      <div class="layout-board" data-board="${section}" style="grid-template-rows: repeat(${rows}, ${ROW_PX}px)">${items
      .map(tileHtml)
      .join("")}</div>
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
    return { rect, padX, padY, colStride, rowStride: ROW_PX + gapY };
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

  function paintDual(tile, tol, ig) {
    tile.setAttribute("style", dualStyle(tol, ig));
    const meta = tile.querySelector(".layout-tile-meta");
    if (meta) {
      const span =
        Math.max(tol.col + tol.colSpan - 1, ig.col + ig.colSpan - 1) - Math.min(tol.col, ig.col) + 1;
      meta.textContent = `osztott kerék · ${span}/12 · search`;
    }
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

  function hidePairOrCell(fieldKey) {
    const group = dualGroupForField(fieldKey);
    if (group) {
      const tol = byKey(group.tolKey);
      const ig = byKey(group.igKey);
      if (tol) tol.hidden = true;
      if (ig) ig.hidden = true;
      return;
    }
    const cell = byKey(fieldKey);
    if (!cell) return;
    if (isSpacer(cell)) {
      cells = cells.filter((c) => c.field_key !== cell.field_key);
    } else {
      cell.hidden = true;
    }

    function moveItem(item, direction) {
      const section = item.kind === "dual" ? item.tol.section : item.cell.section;
      const items = displayItems(section);
      const index = items.findIndex((entry) =>
        item.kind === "dual"
          ? entry.kind === "dual" && entry.group.id === item.group.id
          : entry.kind === "cell" && entry.cell.field_key === item.cell.field_key
      );
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return false;
      const rowOf = (entry) => Number(entry.kind === "dual" ? entry.tol.row : entry.cell.row) || 1;
      const currentRow = rowOf(item);
      const targetRow = rowOf(items[target]);
      const setRow = (entry, row) => {
        if (entry.kind === "dual") {
          entry.tol.row = row;
          entry.ig.row = row;
        } else {
          entry.cell.row = row;
        }
      };
      setRow(item, targetRow);
      setRow(items[target], currentRow);
      compactSection(section);
      return true;
    }
  }

  function bind() {
    root.querySelectorAll("[data-insert-row]").forEach((btn) => {
      btn.addEventListener("click", () => insertEmptyRow(btn.getAttribute("data-insert-row")));
    });

    root.querySelectorAll(".layout-tile").forEach((tile) => {
      tile.addEventListener("pointerdown", (event) => {
        const dualId = tile.getAttribute("data-dual");
        const group = dualId ? INGATLAN_DUAL_RANGE_GROUPS.find((g) => g.id === dualId) : null;
        const tol = group ? byKey(group.tolKey) : null;
        const ig = group ? byKey(group.igKey) : null;

        const orderBtn = event.target.closest("[data-order-delta]");
        if (orderBtn) {
          event.preventDefault();
          event.stopPropagation();
          const item = group
            ? { kind: "dual", group, tol, ig }
            : { kind: "cell", cell: byKey(tile.getAttribute("data-field")) };
          if (moveItem(item, Number(orderBtn.getAttribute("data-order-delta")) || 0)) {
            notify();
            mount();
          }
          return;
        }

        if (event.target.closest("[data-del]")) {
          event.preventDefault();
          event.stopPropagation();
          if (group) hidePairOrCell(group.tolKey);
          else hidePairOrCell(tile.getAttribute("data-field"));
          notify();
          mount();
          return;
        }

        // Szélesség gombok: azonnal alkalmaz (ne preventDefault + külön click, touchön elhal)
        const widthBtn = event.target.closest("[data-width-delta], [data-width-full]");
        if (widthBtn || event.target.closest("[data-width-btns]")) {
          event.preventDefault();
          event.stopPropagation();
          if (!widthBtn) return;
          if (group && tol && ig) {
            const start = Math.min(tol.col, ig.col);
            const current = dualSpan(tol, ig);
            if (widthBtn.hasAttribute("data-width-full")) {
              applyDualWidth(tol, ig, 1, COLS);
            } else {
              const delta = Number(widthBtn.getAttribute("data-width-delta")) || 0;
              applyDualWidth(tol, ig, start, current + delta);
            }
          } else {
            const cell = byKey(tile.getAttribute("data-field"));
            if (!cell || isSpacer(cell)) return;
            if (widthBtn.hasAttribute("data-width-full")) {
              cell.col = 1;
              cell.colSpan = COLS;
            } else {
              const delta = Number(widthBtn.getAttribute("data-width-delta")) || 0;
              let span = clamp(cell.colSpan + delta, 1, COLS);
              let col = cell.col;
              if (col + span - 1 > COLS) col = Math.max(1, COLS - span + 1);
              cell.col = col;
              cell.colSpan = span;
            }
          }
          notify();
          mount();
          return;
        }

        let board = tile.closest(".layout-board");
        const cell = group ? tol : byKey(tile.getAttribute("data-field"));
        if (!cell || !board) return;
        const resize = event.target.closest("[data-resize]");
        event.preventDefault();
        tile.setPointerCapture(event.pointerId);
        tile.classList.add("dragging");
        /* Mindkét tábla nőjön, hogy a Fő→További húzás ne akadjon el. */
        root.querySelectorAll(".layout-board").forEach((b) => setBoardHeight(b, { buffer: DROP_BUFFER }));
        const grab = {
          startCol: group ? Math.min(tol.col, ig.col) : cell.col,
          startRow: cell.row,
          col: colFromEvent(board, event.clientX),
          row: rowFromEvent(board, event.clientY),
          // Resize: pixel-delta, hogy vissza is lehessen szélesíteni (ne ragadjon a bal szélhez)
          resizeOriginStart: group ? Math.min(tol.col, ig.col) : cell.col,
          resizeOriginTotal: group ? tol.colSpan + ig.colSpan : cell.colSpan,
          resizeOriginX: event.clientX,
        };
        let ended = false;

        const move = (ev) => {
          if (ended) return;
          let justCrossed = false;
          if (!resize) {
            const nextBoard = boardAtPoint(ev.clientX, ev.clientY, tile, board);
            root
              .querySelectorAll(".layout-board")
              .forEach((el) => el.classList.toggle("is-drop", el === nextBoard));
            if (nextBoard && nextBoard !== board) {
              if (group && tol && ig) placeDual(tol, ig, nextBoard, ev.clientX, ev.clientY);
              else placeOnBoard(cell, nextBoard, ev.clientX, ev.clientY);
              if (group) paintDual(tile, tol, ig);
              else paint(tile, cell);
              nextBoard.appendChild(tile);
              board = nextBoard;
              setBoardHeight(board, { buffer: DROP_BUFFER });
              grab.startCol = group ? Math.min(tol.col, ig.col) : cell.col;
              grab.startRow = cell.row;
              grab.col = colFromEvent(board, ev.clientX);
              grab.row = rowFromEvent(board, ev.clientY);
              justCrossed = true;
            }
          }
          if (!board) return;
          if (resize) {
            const m = boardMetrics(board);
            const deltaCols = Math.round((ev.clientX - grab.resizeOriginX) / m.colStride);
            const edge = colFromEvent(board, ev.clientX);
            if (group && tol && ig) {
              let total = clamp(grab.resizeOriginTotal + deltaCols, 2, COLS);
              let start = grab.resizeOriginStart;
              // Jobbra a rács végéig → teljes 12/12
              if (deltaCols > 0 && edge >= COLS) {
                total = COLS;
                start = 1;
              }
              applyDualWidth(tol, ig, start, total);
              paintDual(tile, tol, ig);
            } else if (!isSpacer(cell)) {
              let span = clamp(grab.resizeOriginTotal + deltaCols, 1, COLS);
              let col = grab.resizeOriginStart;
              if (deltaCols > 0 && edge >= COLS) {
                span = COLS;
                col = 1;
              } else if (col + span - 1 > COLS) {
                col = Math.max(1, COLS - span + 1);
              }
              cell.col = col;
              cell.colSpan = span;
              paint(tile, cell);
            }
          } else if (!justCrossed) {
            if (group && tol && ig) {
              placeDual(tol, ig, board, ev.clientX, ev.clientY, grab);
              paintDual(tile, tol, ig);
            } else {
              placeOnBoard(cell, board, ev.clientX, ev.clientY, grab);
              paint(tile, cell);
            }
          }
          setBoardHeight(board, { buffer: DROP_BUFFER });
        };

        const end = () => {
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
          tile.removeEventListener("pointerup", end);
          tile.removeEventListener("pointercancel", end);
          tile.removeEventListener("lostpointercapture", end);
          compactSection("main");
          compactSection("more");
          notify();
          mount();
        };
        tile.addEventListener("pointermove", move);
        tile.addEventListener("pointerup", end);
        tile.addEventListener("pointercancel", end);
        tile.addEventListener("lostpointercapture", end);
      });

      // − / + / 12 szélesség gombok
      tile.querySelectorAll("[data-width-delta], [data-width-full]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const dualId = tile.getAttribute("data-dual");
          const group = dualId ? INGATLAN_DUAL_RANGE_GROUPS.find((g) => g.id === dualId) : null;
          const tol = group ? byKey(group.tolKey) : null;
          const ig = group ? byKey(group.igKey) : null;
          if (group && tol && ig) {
            const start = Math.min(tol.col, ig.col);
            const current = dualSpan(tol, ig);
            if (btn.hasAttribute("data-width-full")) {
              applyDualWidth(tol, ig, 1, COLS);
            } else {
              const delta = Number(btn.getAttribute("data-width-delta")) || 0;
              applyDualWidth(tol, ig, start, current + delta);
            }
          } else {
            const cell = byKey(tile.getAttribute("data-field"));
            if (!cell || isSpacer(cell)) return;
            if (btn.hasAttribute("data-width-full")) {
              cell.col = 1;
              cell.colSpan = COLS;
            } else {
              const delta = Number(btn.getAttribute("data-width-delta")) || 0;
              let span = clamp(cell.colSpan + delta, 1, COLS);
              let col = cell.col;
              if (col + span - 1 > COLS) col = Math.max(1, COLS - span + 1);
              cell.col = col;
              cell.colSpan = span;
            }
          }
          notify();
          mount();
        });
      });

      // Dupla kattintás a resize fogón → teljes szélesség (12/12)
      const resizeHandle = tile.querySelector("[data-resize]");
      if (resizeHandle) {
        resizeHandle.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const dualId = tile.getAttribute("data-dual");
          const group = dualId ? INGATLAN_DUAL_RANGE_GROUPS.find((g) => g.id === dualId) : null;
          const tol = group ? byKey(group.tolKey) : null;
          const ig = group ? byKey(group.igKey) : null;
          if (group && tol && ig) {
            applyDualWidth(tol, ig, 1, COLS);
          } else {
            const cell = byKey(tile.getAttribute("data-field"));
            if (!cell || isSpacer(cell)) return;
            cell.col = 1;
            cell.colSpan = COLS;
          }
          notify();
          mount();
        });
      }
    });

    root.querySelectorAll("[data-restore]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cell = byKey(btn.getAttribute("data-restore"));
        if (!cell) return;
        cell.hidden = false;
        const group = dualGroupForField(cell.field_key);
        if (group) {
          const other = byKey(group.tolKey === cell.field_key ? group.igKey : group.tolKey);
          if (other) other.hidden = false;
        }
        const section = cell.section === "more" ? "more" : "main";
        const row = maxRow(section) + 1;
        cell.row = row;
        if (group) {
          const other = byKey(group.tolKey === cell.field_key ? group.igKey : group.tolKey);
          if (other) other.row = row;
        }
        notify();
        mount();
      });
    });

    root.querySelectorAll("[data-restore-dual]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = INGATLAN_DUAL_RANGE_GROUPS.find(
          (g) => g.id === btn.getAttribute("data-restore-dual")
        );
        if (!group) return;
        const tol = byKey(group.tolKey);
        const ig = byKey(group.igKey);
        if (!tol || !ig) return;
        tol.hidden = false;
        ig.hidden = false;
        const section = tol.section === "more" ? "more" : "main";
        const row = maxRow(section) + 1;
        tol.section = section;
        ig.section = section;
        tol.row = row;
        ig.row = row;
        tol.col = 1;
        tol.colSpan = 6;
        ig.col = 7;
        ig.colSpan = 6;
        notify();
        mount();
      });
    });
  }

  function mount() {
    root.innerHTML = `${sectionHtml("main", "Fő szűrők (kereső / feladás)")}${sectionHtml(
      "more",
      "További feltételek"
    )}${trashHtml()}`;
    root.classList.toggle("layout-root--readonly", Boolean(readOnly));
    if (!readOnly) bind();
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
