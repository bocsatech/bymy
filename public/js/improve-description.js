/**
 * Hirdetésfeladás — AI leírásjavítás gomb.
 */
import { getAuthUser } from "./site-auth.js?v=avatarSync1";

function collectFormSnapshot(form) {
  const data = {};
  if (!form) return data;
  const fd = new FormData(form);
  for (const [key, value] of fd.entries()) {
    if (key === "leiras" || key === "telefon" || key === "email") continue;
    if (data[key] != null) {
      data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    } else {
      data[key] = value;
    }
  }
  const extras = [];
  form.querySelectorAll('[name="felszereltseg"]:checked, [name="felszereltseg[]"]:checked').forEach((el) => {
    const v = String(el.value || el.getAttribute("data-label") || "").trim();
    if (v) extras.push(v);
  });
  if (extras.length) data.felszereltseg = extras;
  return data;
}

export function initImproveDescription(form) {
  const root = form || document.getElementById("ad-form");
  if (!root || root.dataset.improveDescBound === "1") return;
  root.dataset.improveDescBound = "1";

  const ta = root.querySelector("#leiras, textarea[name=leiras]");
  const btn = root.querySelector("[data-improve-description]");
  const status = root.querySelector("[data-improve-description-status]");
  if (!ta || !btn) return;

  btn.addEventListener("click", async () => {
    if (!getAuthUser()) {
      window.location.href = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    const draft = String(ta.value || "").trim();
    btn.disabled = true;
    if (status) {
      status.hidden = false;
      status.textContent = "Szöveg készítése…";
      status.classList.remove("is-error");
    }
    try {
      const response = await fetch("/api/listings/improve-description", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          form: collectFormSnapshot(root),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "A javítás sikertelen.");
      }
      const text = String(data.text || "").trim();
      if (!text) throw new Error("Üres választ kaptunk.");
      ta.value = text;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      if (status) {
        status.textContent = "Kész — ellenőrizd, és ha kell, javítsd.";
        status.classList.remove("is-error");
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message ?? "Hiba történt.";
        status.classList.add("is-error");
      }
    } finally {
      btn.disabled = false;
    }
  });
}
