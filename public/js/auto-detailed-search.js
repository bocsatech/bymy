
import {
  DETAILED_SEARCH_SECTIONS,
  AKKU_SEARCH_SECTION_EMPTY,
} from "./auto-detailed-search-catalog.js?v=d5317952ac";

const FORM_FLAG_KEYS = new Set(["villamtoltes", "zold_rendszam"]);

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
  if (Array.isArray(value)) {
    if (!value.length) return true;
    return value.some((v) => matchesSelect(item, key, v));
  }
  const raw = listingField(item, key);
  if (raw == null || raw === "") {
    const hay = listingHaystack(item);
    const want = normalizeForMatch(value);
    return hay.includes(want);
  }
  const got = normalizeForMatch(raw);
  const want = normalizeForMatch(value);
  if (got === want) return true;
  if (want.includes("type 1") && (got.includes("type 1") || got.includes("j1772"))) return true;
  if (want.includes("type 2") && (got.includes("type 2") || got.includes("mennekes"))) return true;
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
  const multiToggleIds = new Set(["ac_tolto_csatlakozas", "tolto_csatlakozas"]);
  if (multiToggleIds.has(select.id)) {
    const opts = (select.options || []).filter((opt) => opt !== "");
    const rows = opts
      .map(
        (opt) => `
      <label class="qs-ios-toggle qs-detailed-multi-toggle">
        <span class="qs-ios-toggle__text">${escapeHtml(opt)}</span>
        <input type="checkbox" data-multi-filter-key="${escapeHtml(select.id)}" value="${escapeHtml(opt)}" />
        <span class="qs-ios-toggle__track" aria-hidden="true"></span>
      </label>`
      )
      .join("");
    return `
    <div class="qs-detailed-select qs-detailed-select--multi" data-multi-select="${escapeHtml(select.id)}">
      <span class="qs-detailed-select__label">${escapeHtml(select.label)}</span>
      <input type="hidden" data-filter-key="${escapeHtml(select.id)}" value="" />
      <div class="qs-detailed-toggles qs-detailed-toggles--inline">${rows}</div>
    </div>`;
  }

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

function renderHiddenExtraToggle(toggle) {
  const isFlag = FORM_FLAG_KEYS.has(toggle.id);
  const extraAttr = isFlag ? "" : ` data-extra="${escapeHtml(toggle.label)}"`;
  const filterAttr = isFlag ? ` data-filter-key="${toggle.id}"` : "";
  return `<input type="checkbox" hidden${filterAttr}${extraAttr} value="1" data-toggle-id="${escapeHtml(toggle.id)}" />`;
}

function isToggleOnlySection(section) {
  return (
    !(section.ranges?.length) &&
    !(section.selects?.length) &&
    (section.toggles?.length || 0) > 0
  );
}

function summaryTextForChecks(checksHost) {
  const labels = [...(checksHost?.querySelectorAll('input[type="checkbox"]:checked') || [])]
    .map((el) => el.getAttribute("data-extra") || el.getAttribute("data-filter-key") || "")
    .filter(Boolean);
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.length} kiválasztva`;
}

function syncSheetFieldSummary(field) {
  const summary = field?.querySelector("[data-detailed-summary]");
  const checks = field?.querySelector("[data-detailed-checks]");
  const trigger = field?.querySelector("[data-detailed-trigger]");
  const title = field?.querySelector(".qs-detailed-extra-pill__title")?.textContent?.trim() || "";
  if (!summary || !checks) return;
  const text = summaryTextForChecks(checks);
  summary.textContent = text;
  summary.hidden = !text;
  field.classList.toggle("has-value", Boolean(text));
  trigger?.setAttribute("aria-label", text ? `${title}: ${text}` : title);
}

function renderToggleSheetField(section) {
  const checks = (section.toggles || []).map(renderHiddenExtraToggle).join("");
  return `
    <div class="qs-detailed-extra-pill" data-detailed-section="${escapeHtml(section.id)}" data-detailed-extra="1" data-detailed-sheet="1">
      <button type="button" class="qs-detailed-extra-pill__head" data-detailed-trigger aria-haspopup="dialog" aria-label="${escapeHtml(section.title)}">
        <span class="qs-detailed-extra-pill__title">${escapeHtml(section.title)}</span>
        <span class="qs-detailed-extra-pill__sum" data-detailed-summary hidden></span>
        <span class="qs-detailed-extra-pill__chev" aria-hidden="true">▾</span>
      </button>
      <div class="qs-detailed-extra-pill__checks" data-detailed-checks hidden>${checks}</div>
    </div>`;
}

function renderSection(section, openByDefault) {
  if (isToggleOnlySection(section)) {
    return renderToggleSheetField(section);
  }

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
        closeAllExtraPills(host);
      }
      acc.open = willOpen;
      if (!willOpen) return;
      const pinSummaryTop = () => {
        summary.scrollIntoView({ block: "start", behavior: "auto", inline: "nearest" });
      };
      requestAnimationFrame(() => {
        pinSummaryTop();
        requestAnimationFrame(pinSummaryTop);
      });
    });
  });
}

function closeAllExtraPills(host) {
  host.querySelectorAll("[data-detailed-extra]").forEach((pill) => {
    pill.classList.remove("is-open");
    const trigger = pill.querySelector("[data-detailed-trigger]");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

async function openDetailedToggleSheet(field) {
  const trigger = field.querySelector("[data-detailed-trigger]");
  const checks = field.querySelector("[data-detailed-checks]");
  if (!trigger || !checks) return;

  const inputs = [...checks.querySelectorAll('input[type="checkbox"]')];
  const items = inputs
    .map((el) => {
      const label = el.getAttribute("data-extra") || el.getAttribute("data-filter-key") || "";
      const value = el.getAttribute("data-toggle-id") || label;
      return { value, label };
    })
    .filter((row) => row.value && row.label);

  const initialSelected = inputs
    .filter((el) => el.checked)
    .map((el) => el.getAttribute("data-toggle-id") || el.getAttribute("data-extra") || "")
    .filter(Boolean);

  const title =
    field.querySelector(".qs-detailed-extra-pill__title")?.textContent?.trim() ||
    trigger.getAttribute("aria-label") ||
    "Extrák";

  const { openStandaloneSwitchSheet } = await import("./auto-drum-sheet.js?v=sheetLeft1");
  openStandaloneSwitchSheet({
    trigger,
    title,
    emptyLabel: "Mindegy",
    items,
    initialSelected,
    onDone: (list) => {
      const selected = new Set((list || []).map(String).filter(Boolean));
      inputs.forEach((el) => {
        const id = el.getAttribute("data-toggle-id") || el.getAttribute("data-extra") || "";
        el.checked = selected.has(id);
      });
      syncSheetFieldSummary(field);
    },
  });
}

function bindDetailedExtraPills(host) {
  host.querySelectorAll("[data-detailed-extra]").forEach((pill) => {
    syncSheetFieldSummary(pill);
    const trigger = pill.querySelector("[data-detailed-trigger]");
    if (!trigger || trigger.dataset.extraBound === "1") return;
    trigger.dataset.extraBound = "1";
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      host.querySelectorAll(".qs-detailed-acc").forEach((acc) => {
        acc.open = false;
      });
      closeAllExtraPills(host);
      void openDetailedToggleSheet(pill);
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
  if (section?.id && sectionFieldCount(section) > 0) return [section, ...DETAILED_SEARCH_SECTIONS];
  return [...DETAILED_SEARCH_SECTIONS];
}

export async function mountDetailedSearch(form = document.getElementById("home-qs-form"), { force = false } = {}) {
  const host = form?.querySelector("#qs-detailed-panel");
  if (!host) return null;
  if (!force && host.dataset.detailedMounted === "1") return host;

  const akkuLoad = await loadAkkuSearchSection();
  const sections = buildDetailedSections(akkuLoad);
  host.innerHTML = sections.map((s, index) => renderSection(s, index === 0 && !isToggleOnlySection(s))).join("");
  bindExclusiveAccordions(host);
  bindDetailedExtraPills(host);
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

  panel.querySelectorAll("[data-multi-select]").forEach((wrap) => {
    const key = wrap.getAttribute("data-multi-select");
    if (!key) return;
    const values = [...wrap.querySelectorAll(`input[type="checkbox"][data-multi-filter-key="${key}"]:checked`)].map(
      (el) => String(el.value || "").trim()
    ).filter(Boolean);
    const hidden = wrap.querySelector(`input[type="hidden"][data-filter-key="${key}"]`);
    if (hidden) hidden.value = values.length ? JSON.stringify(values) : "";
    if (values.length) selects[key] = values;
  });

  panel.querySelectorAll("[data-filter-key]").forEach((el) => {
    const key = el.getAttribute("data-filter-key");
    if (!key) return;
    if (selects[key] != null) return; // multi már feldolgozva
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
  panel.querySelectorAll("[data-detailed-extra]").forEach((field) => syncSheetFieldSummary(field));
}

export function hasActiveDetailedSearch(detailed) {
  if (!detailed) return false;
  const { ranges = {}, selects = {}, extras = [], flags = {} } = detailed;
  if (extras.length) return true;
  if (Object.keys(flags).length) return true;
  if (Object.values(selects).some((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== "";
  })) return true;
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
