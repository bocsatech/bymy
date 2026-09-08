import { HOME_CATEGORY_IDS, autoCategoryHref } from "./home-category-bar.js?v=autoCat2";

document.querySelectorAll(".hf-card--kategoria[data-auto-cat]").forEach((link) => {
  const cat = String(link.dataset.autoCat || "").trim();
  if (!HOME_CATEGORY_IDS.includes(cat)) return;
  link.href = autoCategoryHref(cat);
});
