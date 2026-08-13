import { escapeHtml } from "./listing-card.js";

const COLLAPSED_ROWS = 8;

const ROW_DEFS = [
  { key: "allapot", label: "Jármű állapota", format: (f) => clean(f.allapot) },
  { key: "kivitel", label: "Kategória", format: (f) => clean(f.kivitel) },
  { key: "km", label: "Futásteljesítmény", format: (f) => formatKm(f.km) },
  { key: "hengerurtartalom", label: "Hengerűrtartalom", format: (f) => formatCcm(f.hengerurtartalom) },
  { key: "teljesitmeny", label: "Teljesítmény", format: (f) => formatPower(f) },
  { key: "uzemanyag", label: "Üzemanyag", format: (f) => clean(f.uzemanyag) },
  { key: "szemelyek", label: "Ülések száma", format: (f) => clean(f.szemelyek) },
  { key: "ajtok", label: "Ajtók száma", format: (f) => clean(f.ajtok) },
  { key: "sebessegvalto", label: "Sebességváltó", format: (f) => clean(f.sebessegvalto) },
  { key: "kornyezetvedelmi", label: "Környezetvédelmi osztály", format: (f) => clean(f.kornyezetvedelmi) },
  { key: "gyartasi_ev", label: "Első forgalomba helyezés", format: (f) => formatFirstRegistration(f) },
  { key: "tulajdonosok_szama", label: "Tulajdonosok száma", format: (f) => clean(f.tulajdonosok_szama) },
  { key: "muszaki_ev", label: "Műszaki vizsga (HU)", format: (f) => formatHu(f) },
  { key: "klima", label: "Klíma", format: (f) => clean(f.klima) },
  { key: "szin", label: "Szín", format: (f) => clean(f.szin) },
  { key: "karpit", label: "Belső kárpit", format: (f) => formatInterior(f) },
  { key: "hajtas", label: "Hajtás", format: (f) => clean(f.hajtas) },
  { key: "co2_kibocsatas", label: "CO₂-kibocsátás", format: (f) => clean(f.co2_kibocsatas) },
  { key: "fogyasztas_kombinalt", label: "Kombinált fogyasztás", format: (f) => clean(f.fogyasztas_kombinalt) },
  { key: "gyartmany", label: "Gyártmány", format: (f) => clean(f.gyartmany) },
  { key: "modell", label: "Modell", format: (f) => clean(f.modell) },
  { key: "tipus", label: "Típus", format: (f) => clean(f.tipus) },
  { key: "vetelar", label: "Vételár", format: (f) => formatPrice(f.vetelar || f.akcios_ar) },
  { key: "telepules", label: "Település", format: (f) => [clean(f.telepules), clean(f.megye)].filter(Boolean).join(", ") },
];

const USED_KEYS = new Set([
  ...ROW_DEFS.map((row) => row.key),
  "teljesitmeny_kw",
  "teljesitmeny_le",
  "gyartasi_honap",
  "muszaki_honap",
  "karpit1",
  "karpit2",
  "akcios_ar",
  "megye",
  "felszereltseg",
  "leiras",
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasValue(value) {
  const text = clean(value);
  return text.length > 0 && text !== "—";
}

function formatKm(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `${Number(digits).toLocaleString("hu-HU")} km`;
}

function formatCcm(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `${Number(digits).toLocaleString("hu-HU")} cm³`;
}

function formatPower(form) {
  const kw = clean(form?.teljesitmeny_kw);
  const le = clean(form?.teljesitmeny_le);
  if (kw && le) return `${kw} kW (${le} LE)`;
  if (kw) return `${kw} kW`;
  if (le) return `${le} LE`;
  return "";
}

function formatFirstRegistration(form) {
  const year = form?.forgalomba_helyezes_ev || form?.gyartasi_ev;
  const month = form?.forgalomba_helyezes_honap || form?.gyartasi_honap;
  if (year && month) return `${String(month).padStart(2, "0")}/${year}`;
  if (year) return String(year);
  return "";
}

function formatHu(form) {
  const year = form?.muszaki_ev;
  const month = form?.muszaki_honap;
  if (year && month) return `${String(month).padStart(2, "0")}/${year}`;
  if (year) return String(year);
  return "";
}

function formatInterior(form) {
  const parts = [clean(form?.karpit1), clean(form?.karpit2)].filter(Boolean);
  return parts.join(", ");
}

function formatPrice(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `${Number(digits).toLocaleString("hu-HU")} Ft`;
}

function formatCellValue(cell) {
  if (cell.field_key?.startsWith("extra:") || cell.field_key?.startsWith("info:")) {
    return "Igen";
  }
  return clean(cell.value);
}

function buildRowsFromForm(form) {
  const rows = [];
  for (const def of ROW_DEFS) {
    const value = def.format(form ?? {});
    if (hasValue(value)) {
      rows.push({ label: def.label, value });
    }
  }
  return rows;
}

function buildRowsFromRemainingCells(cells, form) {
  const rows = [];
  const formKeys = new Set(Object.keys(form ?? {}));

  for (const cell of cells ?? []) {
    const key = cell.field_key ?? "";
    if (USED_KEYS.has(key) || formKeys.has(key)) continue;
    if (key.startsWith("extra:") || key.startsWith("info:")) continue;

    const value = formatCellValue(cell);
    if (!hasValue(value)) continue;
    rows.push({ label: clean(cell.label) || key, value });
  }

  const infos = (cells ?? [])
    .filter((cell) => cell.field_key?.startsWith("info:"))
    .map((cell) => clean(cell.label))
    .filter(Boolean);
  if (infos.length) {
    rows.push({ label: "Egyéb információ", value: infos.join(", ") });
  }

  return rows;
}

function buildTechDataRows(listing) {
  const form = listing?.form ?? {};
  const seen = new Set();
  const rows = [];

  for (const row of [...buildRowsFromForm(form), ...buildRowsFromRemainingCells(listing?.cells, form)]) {
    const id = `${row.label}::${row.value}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push(row);
  }

  return rows;
}

function renderRow(row, index) {
  return `
    <div class="listing-tech-row${index % 2 === 1 ? " listing-tech-row--alt" : ""}">
      <span class="listing-tech-label">${escapeHtml(row.label)}</span>
      <span class="listing-tech-value">${escapeHtml(row.value)}</span>
    </div>
  `;
}

export function renderListingTechData(container, listing) {
  if (!container) return;

  const rows = buildTechDataRows(listing);
  if (!rows.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const needsToggle = rows.length > COLLAPSED_ROWS;
  const visibleRows = needsToggle ? rows.slice(0, COLLAPSED_ROWS) : rows;
  const hiddenRows = needsToggle ? rows.slice(COLLAPSED_ROWS) : [];

  container.innerHTML = `
    <section class="listing-tech-data" aria-label="Műszaki adatok">
      <h3 class="listing-tech-title">Műszaki adatok</h3>
      <div class="listing-tech-table">
        ${visibleRows.map((row, index) => renderRow(row, index)).join("")}
        <div class="listing-tech-more" hidden>
          ${hiddenRows.map((row, index) => renderRow(row, index + COLLAPSED_ROWS)).join("")}
        </div>
      </div>
      ${
        needsToggle
          ? `<button type="button" class="listing-detail-toggle" data-tech-toggle aria-expanded="false">Mutass többet</button>`
          : ""
      }
    </section>
  `;

  const toggle = container.querySelector("[data-tech-toggle]");
  const more = container.querySelector(".listing-tech-more");
  toggle?.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    more.hidden = expanded;
    toggle.textContent = expanded ? "Mutass többet" : "Kevesebb megjelenítése";
  });
}
