const STATUS_BADGES = {
  mentett: { label: "MENTETT", mod: "mentett" },
  feladott: { label: "FELADOTT", mod: "feladott" },
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripInlineChrome(line) {
  return String(line ?? "")
    .replace(/haszn[aá]ltaut[oó]\.?\s*hu/gi, " ")
    .replace(/\bhaszn[aá]ltaut[oó]\b/gi, " ")
    .replace(/\bbel[eé]p[eé]s\b/gi, " ")
    .replace(/\bregisztr[aá]ci[oó]\b/gi, " ")
    .replace(/\badd\s*el\s*autod(\.hu)?\b/gi, " ")
    .replace(/[|·•]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|·•\-–—]+|[\s|·•\-–—]+$/g, "")
    .trim();
}

function isSiteChromeLine(line) {
  const n = String(line ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return true;
  const onlyChrome = n
    .replace(/hasznaltauto(\.hu)?/g, " ")
    .replace(/\bbelepes\b/g, " ")
    .replace(/\bregisztracio\b/g, " ")
    .replace(/\badd el autod(\.hu)?\b/g, " ")
    .replace(/[|·•\-–—./:!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!onlyChrome) return true;
  if (n.includes("hasznaltauto") && n.length <= 64) return true;
  if (/\bbelepes\b/.test(n) && n.length <= 24) return true;
  if (/^belepes([.!|]*)?$/.test(n)) return true;
  if (/^regisztracio([.!|]*)?$/.test(n)) return true;
  if (/^add el autod(\.hu)?$/.test(n)) return true;
  return false;
}

/** Megjelenítéshez: „Eladó …” prefix nélkül + Használtautó.hu / Belépés nélkül */
export function formatListingDisplayTitle(value) {
  const lines = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => stripInlineChrome(line.replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .filter((line) => !isSiteChromeLine(line));
  let text = lines.join(" ").replace(/\s+/g, " ").trim().replace(/^eladó\s+/i, "");
  if (!text || isSiteChromeLine(text)) return "";
  return text;
}

/** Leírás: site chrome sorok / tokenek nélkül */
export function sanitizeListingDescription(value) {
  const lines = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => stripInlineChrome(line.replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .filter((line) => !isSiteChromeLine(line));
  const text = lines.join("\n").trim();
  if (!text || isSiteChromeLine(text.replace(/\n+/g, " "))) return "";
  return text;
}

function formatSpecLine(preview) {
  const spec = preview.specLine ?? "";
  const km = preview.km ?? "";
  if (!km || !spec.includes(km)) {
    return escapeHtml(spec);
  }
  const parts = spec.split(km);
  return parts.map((part, index) => {
    const chunk = escapeHtml(part);
    if (index === parts.length - 1) return chunk;
    return `${chunk}<span class="ha-card-km">${escapeHtml(km)}</span>`;
  }).join("");
}

function renderBadges(preview, status) {
  const statusInfo = STATUS_BADGES[status] ?? STATUS_BADGES.mentett;
  const parts = [
    `<span class="ha-badge ha-badge--status ha-badge--${statusInfo.mod}">${escapeHtml(statusInfo.label)}</span>`,
  ];

  const features = preview.badges ?? [];
  const statusLabel = statusInfo.label;
  for (const badge of features) {
    if (badge === statusLabel) continue;
    parts.push(`<span class="ha-badge ha-badge--feature">${escapeHtml(badge)}</span>`);
  }
  return parts.join("");
}

export function createListingCard(item, { selected = false, formatDate = (v) => v } = {}) {
  const preview = item.preview ?? {};
  const card = document.createElement("button");
  card.type = "button";
  card.className = "ha-card listings-ha-card";
  if (selected) card.classList.add("ha-card--selected");
  card.dataset.listingId = String(item.id);

  const title = formatListingDisplayTitle(
    preview.title || item.hirdetes_cime || `Hirdetés #${item.id}`
  ) || `Hirdetés #${item.id}`;
  const price = preview.price || "—";
  const code = preview.hirdeteskod;
  const location = preview.location;
  const desc = sanitizeListingDescription(preview.leiras || "");
  const updated = formatDate(item.updated_at);
  const imageUrl = preview.imageUrl || item.fo_kep || "";
  const photoInner = imageUrl
    ? `<img class="ha-card-photo-img" src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : `<div class="ha-card-photo-empty" aria-hidden="true">
          <span class="ha-card-photo-icon" aria-hidden="true">
            <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4.5h3l1.5-2h7l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="11" cy="10" r="3.2" stroke="currentColor" stroke-width="1.4"/>
            </svg>
          </span>
        </div>`;

  card.innerHTML = `
    <header class="ha-card-head">
      <h2 class="ha-card-title">${escapeHtml(title.toUpperCase())}</h2>
      <div class="ha-card-price">${escapeHtml(price)}</div>
    </header>
    <div class="ha-card-badges">${renderBadges(preview, item.status || "mentett")}</div>
    <div class="ha-card-body">
      <div class="ha-card-photo">${photoInner}</div>
      <div class="ha-card-main">
        ${preview.specLine ? `<p class="ha-card-spec">${formatSpecLine(preview)}</p>` : ""}
        ${desc ? `<p class="ha-card-desc">${escapeHtml(desc)}</p>` : ""}
        ${code ? `<p class="ha-card-code">(Hirdetéskód: ${escapeHtml(code)})</p>` : ""}
        ${location ? `<p class="ha-card-location"><span class="ha-card-pin" aria-hidden="true"></span>${escapeHtml(location)}</p>` : ""}
      </div>
      <div class="ha-card-dealer">
        <div class="ha-card-dealer-logo" aria-hidden="true">AUTOSWEB</div>
      </div>
    </div>
    <footer class="ha-card-foot">
      <span class="ha-card-foot-left">Autosweb · ${escapeHtml(updated)} · ${item.cell_count ?? 0} cella</span>
      <span class="ha-card-foot-mark" aria-hidden="true">K</span>
    </footer>
  `;

  return card;
}
