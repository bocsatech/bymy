import { escapeHtml } from "./listing-card.js";

const PLACEHOLDER_SLIDE_COUNT = 7;

const SPEC_ICONS = {
  km: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h2.5l1.1-2h8.8l1.1 2H19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 12v5M16 12v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  power: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M12 9v3.5l2.4 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  fuel: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 5h7.5v14H6a1.3 1.3 0 0 1-1.3-1.3V6.3A1.3 1.3 0 0 1 6 5Z" stroke="currentColor" stroke-width="1.6"/><path d="M13.5 8.5h2.4L20 12.5v7h-6.5V8.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  transmission: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="4" width="8" height="8" rx="1.3" stroke="currentColor" stroke-width="1.6"/><path d="M12 12v3.2M9.2 18.5h5.6M12 15.2v3.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  registration: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="6" width="14" height="13" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 4.5v2.5M15.5 4.5v2.5M5 10h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  owners: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="9" r="3.5" stroke="currentColor" stroke-width="1.6"/><path d="M6 20c0-3.3 2.7-5.8 6-5.8s6 2.5 6 5.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};

const ICON_CAMERA = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.2 4.8h1.4l.8-1.4h4.8l.8 1.4H12a1.2 1.2 0 0 1 1.2 1.2v4.8a1.2 1.2 0 0 1-1.2 1.2H2.2a1.2 1.2 0 0 1-1.2-1.2V6a1.2 1.2 0 0 1 1.2-1.2Z" stroke="currentColor" stroke-width="1.1"/><circle cx="7" cy="8.4" r="2.1" stroke="currentColor" stroke-width="1.1"/></svg>`;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildBrandModelType(form) {
  const parts = [clean(form?.gyartmany), clean(form?.modell), clean(form?.tipus)].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

function formatKm(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  return `${Number(digits).toLocaleString("hu-HU")} km`;
}

function formatPower(form) {
  const kw = clean(form?.teljesitmeny_kw);
  const le = clean(form?.teljesitmeny_le);
  if (kw && le) return `${kw} kW (${le} LE)`;
  if (kw) return `${kw} kW`;
  if (le) return `${le} LE`;
  return "—";
}

function formatTransmission(value) {
  const raw = clean(value);
  if (!raw) return "—";
  if (/automata|fokozatmentes|cvt/i.test(raw)) return "Automata";
  if (/manu/i.test(raw)) return "Manuális";
  return raw;
}

function formatRegistration(form) {
  const year = form?.gyartasi_ev;
  const month = form?.gyartasi_honap;
  if (year && month) return `${String(month).padStart(2, "0")}/${year}`;
  if (year) return String(year);
  return "—";
}

function renderSpecItem(key, label, value) {
  return `
    <div class="listing-detail-spec">
      <span class="listing-detail-spec-icon">${SPEC_ICONS[key]}</span>
      <div class="listing-detail-spec-copy">
        <span class="listing-detail-spec-label">${escapeHtml(label)}</span>
        <strong class="listing-detail-spec-value">${escapeHtml(value)}</strong>
      </div>
    </div>
  `;
}

function buildSlides() {
  return Array.from({ length: PLACEHOLDER_SLIDE_COUNT }, (_, index) => ({
    placeholder: true,
    variant: index,
  }));
}

function renderStageSlide(slide) {
  return `<div class="listing-detail-gallery-placeholder listing-detail-gallery-placeholder--v${slide.variant % 4}" aria-hidden="true"></div>`;
}

export function renderListingDetailShowcase(container, listing) {
  if (!container) return;

  const form = listing?.form ?? {};
  const heading = buildBrandModelType(form);
  const slides = buildSlides();

  const thumbsHtml = slides
    .map(
      (slide, index) => `
        <button type="button" class="listing-detail-gallery-thumb${index === 0 ? " is-active" : ""}" data-gallery-index="${index}" aria-label="${index + 1}. kép">
          <span class="listing-detail-gallery-thumb-ph listing-detail-gallery-thumb-ph--v${slide.variant % 4}" aria-hidden="true"></span>
        </button>
      `
    )
    .join("");

  container.innerHTML = `
    <article class="listing-detail-showcase">
      <h3 class="listing-detail-showcase-heading">${escapeHtml(heading)}</h3>

      <section class="listing-detail-gallery" data-gallery>
        <div class="listing-detail-gallery-main">
          <div class="listing-detail-gallery-stage" data-gallery-stage>${renderStageSlide(slides[0])}</div>
          <span class="listing-detail-gallery-counter" data-gallery-counter>${ICON_CAMERA}<span>1/${slides.length}</span></span>
          <button type="button" class="listing-detail-gallery-nav listing-detail-gallery-nav--prev" data-gallery-prev aria-label="Előző kép">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.5 5 7.5 10l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="listing-detail-gallery-nav listing-detail-gallery-nav--next" data-gallery-next aria-label="Következő kép">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7.5 5 12.5 10l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="listing-detail-gallery-actions">
            <button type="button" class="listing-detail-gallery-action" data-gallery-all>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="4.8" height="4.8" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="8.7" y="1.5" width="4.8" height="4.8" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="1.5" y="8.7" width="4.8" height="4.8" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="8.7" y="8.7" width="4.8" height="4.8" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>
              Összes kép
            </button>
            <button type="button" class="listing-detail-gallery-action" data-gallery-zoom>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="3.8" stroke="currentColor" stroke-width="1.2"/><path d="M9.2 9.2 13 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              Nagyítás
            </button>
          </div>
        </div>
        <div class="listing-detail-gallery-thumbs" data-gallery-thumbs>${thumbsHtml}</div>
      </section>

      <section class="listing-detail-specs" aria-label="Fő adatok">
        ${renderSpecItem("km", "Futásteljesítmény", formatKm(form.km))}
        ${renderSpecItem("power", "Teljesítmény", formatPower(form))}
        ${renderSpecItem("fuel", "Üzemanyag", clean(form.uzemanyag) || "—")}
        ${renderSpecItem("transmission", "Sebességváltó", formatTransmission(form.sebessegvalto))}
        ${renderSpecItem("registration", "Évjárat", formatRegistration(form))}
        ${renderSpecItem("owners", "Tulajdonosok száma", clean(form.tulajdonosok_szama) || "—")}
      </section>
    </article>
  `;

  initListingDetailGallery(container, slides);
}

function initListingDetailGallery(root, slides) {
  const stage = root.querySelector("[data-gallery-stage]");
  const counter = root.querySelector("[data-gallery-counter] span");
  const prevBtn = root.querySelector("[data-gallery-prev]");
  const nextBtn = root.querySelector("[data-gallery-next]");
  const thumbs = [...root.querySelectorAll("[data-gallery-index]")];
  const thumbsWrap = root.querySelector("[data-gallery-thumbs]");
  let index = 0;

  const renderSlide = () => {
    stage.innerHTML = renderStageSlide(slides[index]);
    counter.textContent = `${index + 1}/${slides.length}`;
    thumbs.forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-active", thumbIndex === index);
    });
  };

  const show = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    renderSlide();
  };

  prevBtn?.addEventListener("click", () => show(index - 1));
  nextBtn?.addEventListener("click", () => show(index + 1));
  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => show(Number(thumb.dataset.galleryIndex)));
  });
  root.querySelector("[data-gallery-all]")?.addEventListener("click", () => {
    thumbsWrap?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  renderSlide();
}
