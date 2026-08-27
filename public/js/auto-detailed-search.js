/**
 * Részletes keresés — hero panel mount, olvasás, szűrés.
 */

import {
  DETAILED_SEARCH_SECTIONS,
  AKKU_SEARCH_SECTION_EMPTY,
} from "./auto-detailed-search-catalog.js?v=autoDesk7";

const FORM_FLAG_KEYS = new Set(["villamtoltes", "zold_rendszam"]);

/** Rövidítések / import badge aliasok (OR egyezés). */
const EXTRA_ALIASES = new Map([
  ["könnyűfém felni", ["alufelni", "aluminium felni", "könnyűfém"]],
  ["bluetooth-os kihangosító", ["bluetooth", "bt"]],
  ["tempomat", ["sebességtartó", "acc", "adaptív tempomat"]],
  ["tolatóradar", ["parkolóradar", "parkoló asszisztens", "parkassist"]],
  ["tolatókamera", ["tolató kamera", "hátsó kamera"]],
  ["360 fokos kamerarendszer", ["360 kamera", "360 fokos", "surround view"]],
  ["bőr belső", ["bőr", "bőrkárpit", "bőr ülés"]],
  ["LED fényszóró", ["led", "ledes"]],
  ["xenon fényszóró", ["xenon", "bixenon"]],
  ["GPS (navigáció)", ["navigáció", "navigacio", "navigation", "gps", "navi"]],
  ["Type2 töltőkábel", ["type2", "type 2 kábel"]],
  ["ABS (blokkolásgátló)", ["abs"]],
  ["ESP (menetstabilizátor)", ["esp", "menetstabilizátor"]],
  ["ISOFIX rendszer", ["isofix"]],
  ["indításgátló (immobiliser)", ["immobiliser", "indításgátló"]],
  ["nem dohányzó", ["nem dohanyzo", "dohányzásmentes"]],
  ["Villámtöltés", ["villámtöltés", "villamtoltes", "gyorstöltés"]],
  ["Zöld rendszám", ["zöld rendszám", "zold rendszam", "zöld"]],
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function normalizeForMatch(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inRange(value, min, max) {
  if (value == null) return min == null && max == null;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function listingHaystack(item) {
  const preview = item.preview ?? {};
  const form = item.form ?? {};
  const parts = [
    preview.title,
    preview.leiras,
    preview.specLine,
    form.leiras,
    ...(preview.badges ?? []),
    ...(form.felszereltseg ?? []),
  ];
  return normalizeForMatch(parts.filter(Boolean).join(" "));
}

function listingField(item, key) {
  const f = item.preview?.filter ?? {};
  const form = item.form ?? {};
  return form[key] ?? f[key] ?? null;
}

function listingNumber(item, key) {
  const raw = listingField(item, key);
  if (raw == null || raw === "") return null;
  return numOrNull(raw);
}

function needlesForExtra(label) {
  const base = normalizeForMatch(label);
  const needles = [base];
  for (const [canonical, aliases] of EXTRA_ALIASES) {
    if (normalizeForMatch(canonical) === base) {
      for (const alias of aliases) needles.push(normalizeForMatch(alias));
    }
  }
  const aliases = EXTRA_ALIASES.get(label);
  if (aliases) {
    for (const alias of aliases) needles.push(normalizeForMatch(alias));
  }
  return [...new Set(needles.filter(Boolean))];
}

function hayContainsExtra(hay, label) {
  return needlesForExtra(label).some((needle) => hay.includes(needle));
}

function equipmentListIncludes(item, label) {
  const form = item.form ?? {};
  const list = form.felszereltseg ?? [];
  const normLabel = normalizeForMatch(label);
  return list.some((entry) => {
    const normEntry = normalizeForMatch(entry);
    if (!normEntry) return false;
    if (normEntry === normLabel || normEntry.includes(normLabel) || normLabel.includes(normEntry)) {
      return true;
    }
    return needlesForExtra(label).some((needle) => normEntry.includes(needle));
  });
}

function matchesExtra(item, label) {
  if (equipmentListIncludes(item, label)) return true;
  const hay = listingHaystack(item);
  return hayContainsExtra(hay, label);
}

function matchesFormFlag(item, key, label) {
  const raw = listingField(item, key);
  if (raw === "1" || raw === 1 || raw === true || raw === "igen" || raw === "Igen") return true;
  return matchesExtra(item, label);
}

function matchesSelect(item, key, value) {
  const raw = listingField(item, key);
  if (raw == null || raw === "") {
    const hay = listingHaystack(item);
    const want = normalizeForMatch(value);
    return hay.includes(want);
  }
  const got = normalizeForMatch(raw);
  const want = normalizeForMatch(value);
  if (got === want) return true;
  if (want.includes("type 2") && got.includes("type 2")) return true;
  if (want === "egyeb" || want === "egyéb") return got.includes("egyeb") || got.includes("egyéb");
  return got.includes(want) || want.includes(got);
}

function renderRange(sectionId, range) {
  const tolKey = `${range.id}_tol`;
  const igKey = `${range.id}_ig`;
  const unit = range.unit ? `<span class="qs-detailed-range__unit">${escapeHtml(range.unit)}</span>` : "";
  return `
    <div class="qs-detailed-range">
      <span class="qs-detailed-range__label">${escapeHtml(range.label)}</span>
      <div class="qs-detailed-range__inputs">
        <label class="qs-detailed-range__field">
          <span class="visually-hidden">${escapeHtml(range.label)} -tól</span>
          <input type="number" class="home-qs-control qs-detailed-input" data-filter-key="${tolKey}" min="0" step="${range.step || "1"}" placeholder="-tól" inputmode="decimal" />
        </label>
        <span class="qs-detailed-range__sep" aria-hidden="true">–</span>
        <label class="qs-detailed-range__field">
          <span class="visually-hidden">${escapeHtml(range.label)} -ig</span>
          <input type="number" class="home-qs-control qs-detailed-input" data-filter-key="${igKey}" min="0" step="${range.step || "1"}" placeholder="-ig" inputmode="decimal" />
        </label>
        ${unit}
      </div>
    </div>`;
}

function renderSelect(select) {
  const options = select.options
    .map((opt) => {
      const label = opt === "" ? "Mindegy" : opt;
      return `<option value="${escapeHtml(opt)}">${escapeHtml(label)}</option>`;
    })
    .join("");
  return `
    <label class="qs-detailed-select">
      <span class="qs-detailed-select__label">${escapeHtml(select.label)}</span>
      <select class="home-qs-control qs-detailed-input" data-filter-key="${escapeHtml(select.id)}">${options}</select>
    </label>`;
}

function renderToggle(toggle) {
  const isFlag = FORM_FLAG_KEYS.has(toggle.id);
  const extraAttr = isFlag ? "" : ` data-extra="${escapeHtml(toggle.label)}"`;
  const filterAttr = isFlag ? ` data-filter-key="${toggle.id}"` : "";
  return `
    <label class="qs-ios-toggle">
      <span class="qs-ios-toggle__text">${escapeHtml(toggle.label)}</span>
      <input type="checkbox" role="switch"${filterAttr}${extraAttr} value="1" />
      <span class="qs-ios-toggle__track" aria-hidden="true"></span>
    </label>`;
}

function renderSection(section, openByDefault) {
  const body = [];
  for (const range of section.ranges ?? []) body.push(renderRange(section.id, range));
  for (const select of section.selects ?? []) body.push(renderSelect(select));
  if ((section.ranges?.length || section.selects?.length) && section.toggles?.length) {
    body.push('<div class="qs-detailed-toggles">');
  } else if (section.toggles?.length) {
    body.push('<div class="qs-detailed-toggles qs-detailed-toggles--only">');
  }
  for (const toggle of section.toggles ?? []) body.push(renderToggle(toggle));
  if (section.toggles?.length) body.push("</div>");

  return `
    <details class="qs-detailed-acc" data-detailed-section="${escapeHtml(section.id)}"${openByDefault ? " open" : ""}>
      <summary class="qs-detailed-acc__summary">${escapeHtml(section.title)}</summary>
      <div class="qs-detailed-acc__body">${body.join("")}</div>
    </details>`;
}

function bindExclusiveAccordions(host) {
  host.querySelectorAll(".qs-detailed-acc").forEach((acc) => {
    const summary = acc.querySelector(".qs-detailed-acc__summary");
    if (!summary) return;
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const willOpen = !acc.open;
      if (willOpen) {
        host.querySelectorAll(".qs-detailed-acc").forEach((other) => {
          if (other !== acc) other.open = false;
        });
      }
      acc.open = willOpen;
    });
  });
}

async function loadAkkuSearchSection() {
  try {
    const res = await fetch(`/api/level1/akku-search-menu?t=${Date.now()}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (data?.section?.id) {
      return { section: data.section, live: data.live === true, source: data.source || "api" };
    }
  } catch (error) {
    console.warn("Akkumulátor menü:", error);
  }
  return { section: { ...AKKU_SEARCH_SECTION_EMPTY }, live: false, source: "empty" };
}

function sectionFieldCount(section) {
  if (!section) return 0;
  return (section.ranges?.length || 0) + (section.selects?.length || 0) + (section.toggles?.length || 0);
}

function buildDetailedSections(akkuLoad) {
  const section = akkuLoad?.section;
  // Üres akku szekció ne jelenjen meg a keresőn (admin még nem kapcsolt be mezőt).
  if (section?.id && sectionFieldCount(section) > 0) return [section, ...DETAILED_SEARCH_SECTIONS];
  return [...DETAILED_SEARCH_SECTIONS];
}

export async function mountDetailedSearch(form = document.getElementById("home-qs-form"), { force = false } = {}) {
  const host = form?.querySelector("#qs-detailed-panel");
  if (!host) return null;
  if (!force && host.dataset.detailedMounted === "1") return host;

  const akkuLoad = await loadAkkuSearchSection();
  const sections = buildDetailedSections(akkuLoad);
  host.innerHTML = sections.map((s, index) => renderSection(s, index === 0)).join("");
  bindExclusiveAccordions(host);
  host.dataset.detailedMounted = "1";
  host.dataset.detailedLive = akkuLoad.live ? "1" : "0";
  host.dataset.detailedSource = akkuLoad.source || "";
  return host;
}

export function readDetailedSearchValues(form = document.getElementById("home-qs-form")) {
  const panel = form?.querySelector("#qs-detailed-panel");
  if (!panel) {
    return { ranges: {}, selects: {}, extras: [], flags: {} };
  }

  const ranges = {};
  const selects = {};
  const flags = {};
  const extras = [];

  panel.querySelectorAll("[data-filter-key]").forEach((el) => {
    const key = el.getAttribute("data-filter-key");
    if (!key) return;
    if (el.type === "checkbox") {
      if (!el.checked) return;
      flags[key] = true;
      return;
    }
    const raw = String(el.value ?? "").trim();
    if (!raw) return;
    if (key.endsWith("_tol") || key.endsWith("_ig")) {
      ranges[key] = numOrNull(raw);
    } else {
      selects[key] = raw;
    }
  });

  panel.querySelectorAll('input[type="checkbox"][data-extra]').forEach((el) => {
    if (!el.checked) return;
    const label = el.getAttribute("data-extra");
    if (label) extras.push(label);
  });

  return { ranges, selects, extras, flags };
}

export function resetDetailedSearch(form = document.getElementById("home-qs-form")) {
  const panel = form?.querySelector("#qs-detailed-panel");
  if (!panel) return;
  panel.querySelectorAll("input, select").forEach((el) => {
    if (el.type === "checkbox") el.checked = false;
    else el.value = "";
  });
}

export function hasActiveDetailedSearch(detailed) {
  if (!detailed) return false;
  const { ranges = {}, selects = {}, extras = [], flags = {} } = detailed;
  if (extras.length) return true;
  if (Object.keys(flags).length) return true;
  if (Object.values(selects).some((v) => v != null && v !== "")) return true;
  return Object.values(ranges).some((v) => v != null);
}

export function matchDetailedSearch(item, detailed) {
  if (!hasActiveDetailedSearch(detailed)) return true;

  const { ranges = {}, selects = {}, extras = [], flags = {} } = detailed;

  for (const [key, min] of Object.entries(ranges)) {
    if (!key.endsWith("_tol")) continue;
    const base = key.replace(/_tol$/, "");
    const max = ranges[`${base}_ig`] ?? null;
    if (min == null && max == null) continue;
    const listingVal = listingNumber(item, base);
    if (listingVal == null) return false;
    if (!inRange(listingVal, min, max)) return false;
  }

  for (const [key, max] of Object.entries(ranges)) {
    if (!key.endsWith("_ig")) continue;
    const base = key.replace(/_ig$/, "");
    if (`${base}_tol` in ranges) continue;
    if (max == null) continue;
    const listingVal = listingNumber(item, base);
    if (listingVal == null) return false;
    if (listingVal > max) return false;
  }

  for (const [key, value] of Object.entries(selects)) {
    if (value == null || value === "") continue;
    if (!matchesSelect(item, key, value)) return false;
  }

  for (const [key, enabled] of Object.entries(flags)) {
    if (!enabled) continue;
    const section = DETAILED_SEARCH_SECTIONS.find((s) => s.toggles?.some((t) => t.id === key));
    const toggle = section?.toggles?.find((t) => t.id === key);
    const label = toggle?.label ?? key;
    if (!matchesFormFlag(item, key, label)) return false;
  }

  for (const label of extras) {
    if (!matchesExtra(item, label)) return false;
  }

  return true;
}
