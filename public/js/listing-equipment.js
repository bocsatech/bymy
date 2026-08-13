import { escapeHtml } from "./listing-card.js";

const COLLAPSED_ITEMS = 12;

const CHECK_ICON = `<svg class="listing-equipment-check" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4.5 9.2 7.4 12.1 13.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildEquipmentItems(listing) {
  const form = listing?.form ?? {};
  const seen = new Set();
  const items = [];

  for (const item of form.felszereltseg ?? []) {
    const text = clean(item);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    items.push(text);
  }

  for (const cell of listing?.cells ?? []) {
    if (!cell.field_key?.startsWith("extra:")) continue;
    const text = clean(cell.label);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    items.push(text);
  }

  return items;
}

function chunkPairs(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null]);
  }
  return rows;
}

function renderItem(label) {
  if (!label) return `<div class="listing-equipment-item listing-equipment-item--empty"></div>`;
  return `
    <div class="listing-equipment-item">
      <span class="listing-equipment-label">${escapeHtml(label)}</span>
      ${CHECK_ICON}
    </div>
  `;
}

function renderRow(pair, index) {
  return `
    <div class="listing-equipment-row${index % 2 === 1 ? " listing-equipment-row--alt" : ""}">
      ${renderItem(pair[0])}
      ${renderItem(pair[1])}
    </div>
  `;
}

function renderGrid(rows) {
  return `<div class="listing-equipment-grid">${rows.map((pair, index) => renderRow(pair, index)).join("")}</div>`;
}

export function renderListingEquipment(container, listing) {
  if (!container) return;

  const items = buildEquipmentItems(listing);
  if (!items.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const allRows = chunkPairs(items);
  const needsToggle = items.length > COLLAPSED_ITEMS;
  const visibleRows = needsToggle ? chunkPairs(items.slice(0, COLLAPSED_ITEMS)) : allRows;
  const hiddenRows = needsToggle ? chunkPairs(items.slice(COLLAPSED_ITEMS)) : [];

  container.innerHTML = `
    <section class="listing-detail-section listing-equipment" aria-label="Felszereltség">
      <h3 class="listing-detail-section-title">Felszereltség</h3>
      ${renderGrid(visibleRows)}
      ${
        needsToggle
          ? `<div class="listing-equipment-more" hidden>${renderGrid(hiddenRows)}</div>
             <button type="button" class="listing-detail-toggle" data-equipment-toggle aria-expanded="false">Mutass többet</button>`
          : ""
      }
    </section>
  `;

  const toggle = container.querySelector("[data-equipment-toggle]");
  const more = container.querySelector(".listing-equipment-more");
  toggle?.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    more.hidden = expanded;
    toggle.textContent = expanded ? "Mutass többet" : "Kevesebb megjelenítése";
  });
}
