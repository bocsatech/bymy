/**
 * Korai kategóriaválasztó — ne várjon az app.js teljes betöltésére.
 */
import { initCategoryPicker } from "./category-picker.js?v=6fcf75f476";
import { getAuthUser, loginUrl } from "./site-auth.js?v=20aa3f41c9";

initCategoryPicker({
  requireLogin: async () => {
    const user = getAuthUser();
    if (user?.email) return true;
    window.location.href = loginUrl("/hirdetesfeladas.html?continue=1");
    return false;
  },
  onVehicleSelected: (selection) => {
    window.dispatchEvent(new CustomEvent("bymy-category-selected", { detail: selection }));
  },
});
