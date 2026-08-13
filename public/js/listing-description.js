import { escapeHtml } from "./listing-card.js";

const COLLAPSED_CHARS = 320;

function clean(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function formatDescriptionHtml(text) {
  const blocks = clean(text).split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return "";

      const bulletLines = lines.filter((line) => /^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line));
      if (bulletLines.length >= 2 && bulletLines.length === lines.length) {
        const items = lines
          .map((line) => line.replace(/^[-•*]\s+/, "").replace(/^\d+[.)]\s+/, ""))
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("");
        return `<ul class="listing-description-list">${items}</ul>`;
      }

      const inner = lines.map((line) => escapeHtml(line)).join("<br />");
      return `<p class="listing-description-paragraph">${inner}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function buildPreviewHtml(fullHtml, plainText) {
  if (plainText.length <= COLLAPSED_CHARS) return fullHtml;

  const preview = plainText.slice(0, COLLAPSED_CHARS).trim();
  const cut = preview.lastIndexOf(" ");
  const safePreview = cut > 200 ? preview.slice(0, cut) : preview;
  return `<p class="listing-description-paragraph">${escapeHtml(safePreview)}…</p>`;
}

export function renderListingDescription(container, listing) {
  if (!container) return;

  const text = clean(listing?.form?.leiras);
  if (!text) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const fullHtml = formatDescriptionHtml(text);
  const needsToggle = text.length > COLLAPSED_CHARS;
  const previewHtml = needsToggle ? buildPreviewHtml(fullHtml, text) : fullHtml;

  container.innerHTML = `
    <section class="listing-detail-section listing-description" aria-label="Hirdetés leírása">
      <h3 class="listing-detail-section-title">Hirdetés leírása a hirdető szerint</h3>
      <div class="listing-description-body">
        <div class="listing-description-preview">${previewHtml}</div>
        ${
          needsToggle
            ? `<div class="listing-description-full" hidden>${fullHtml}</div>`
            : ""
        }
      </div>
      ${
        needsToggle
          ? `<button type="button" class="listing-detail-toggle" data-description-toggle aria-expanded="false">Mutass többet</button>`
          : ""
      }
    </section>
  `;

  const toggle = container.querySelector("[data-description-toggle]");
  const preview = container.querySelector(".listing-description-preview");
  const full = container.querySelector(".listing-description-full");
  toggle?.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    preview.hidden = !expanded;
    full.hidden = expanded;
    toggle.textContent = expanded ? "Mutass többet" : "Kevesebb megjelenítése";
  });
}
