/** Főoldali banner hirdetési cellák (fejléc alatt, lista alatt). */

export function createHomeAdSlot(slotId) {
  const article = document.createElement("article");
  article.className = "home-ad-slot";
  article.dataset.adSlot = slotId;

  article.innerHTML = `
    <p class="home-ad-slot-label">Hirdetés</p>
    <div class="home-ad-slot-frame">
      <a class="home-ad-slot-link" data-ad-link href="#" hidden>
        <img class="home-ad-slot-image" data-ad-image alt="" width="728" height="90" />
      </a>
      <div class="home-ad-slot-placeholder" data-ad-placeholder>Hirdetési hely</div>
    </div>
  `;

  return article;
}

export function createHomeAdStrip(leftSlotId, rightSlotId, { bottom = false } = {}) {
  const strip = document.createElement("section");
  strip.className = bottom ? "home-ad-strip home-ad-strip--bottom" : "home-ad-strip";
  strip.setAttribute("aria-label", "Banner hirdetések");

  const inner = document.createElement("div");
  inner.className = "home-ad-strip-inner";
  inner.append(createHomeAdSlot(leftSlotId), createHomeAdSlot(rightSlotId));
  strip.append(inner);

  return strip;
}
