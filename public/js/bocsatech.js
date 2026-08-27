import { mountLayoutBoard } from "./bocsatech-layout.js?v=stepDrag4";
import { mountIngatlanWheelBoard } from "./bocsatech-ingatlan-wheels.js?v=readOnly1";
import {
  isIngatlanWheelAdminCategory,
  normalizeIngatlanWheelVariant,
} from "./ingatlan-wheel-schema.js?v=immoWheel21";

const app = document.getElementById("app");

const LAYOUT_NAV = [
  {
    group: "Autók",
    items: [
      { id: "szemelyauto", label: "Személyautó feladás" },
      { id: "szemelyauto-search", label: "Személyautó kereső" },
      { id: "teherauto-search", label: "Teherautó kereső" },
      { id: "leasing", label: "Leasing autók" },
      { id: "berauto", label: "Bérautók" },
      { id: "lakokocsi", label: "Bérelhető lakókocsi" },
      { id: "kisteher", label: "Teherautó 3,5-ig" },
      { id: "teherauto", label: "Teherautó 3,5-től" },
    ],
  },
  {
    group: "Ingatlanok",
    items: [
      { id: "ingatlan", label: "Kiado ingatlan" },
      { id: "elado-ingatlan", label: "elado ingatlan" },
      { id: "airbnb", label: "Airbnb" },
    ],
  },
];

const LAYOUT_CATEGORIES = [
  { id: "szemelyauto", label: "Személyautó" },
  { id: "leasing", label: "Leasing autók" },
  { id: "berauto", label: "Bérautók" },
  { id: "lakokocsi", label: "Bérelhető lakókocsi" },
  { id: "kisteher", label: "Teherautó 3,5-ig" },
  { id: "teherauto", label: "Teherautó 3,5-től" },
  { id: "ingatlan", label: "Ingatlan" },
];

const AUTO_LAYOUT_ITEMS = LAYOUT_NAV[0].items;
const IMMO_LAYOUT_ITEMS = LAYOUT_NAV[1].items;

const ADMIN_SECTIONS = [
  {
    id: "users",
    label: "1. Felhasználók",
    defaultTab: "users:private",
    tabs: [
      { id: "users:private", label: "Privát fiókok" },
      { id: "users:business", label: "Céges fiókok" },
      { id: "users:visitors", label: "Látogatók" },
    ],
  },
  {
    id: "auto",
    label: "2. Autóhirdetések",
    defaultTab: "auto:listings",
    tabs: [
      { id: "auto:listings", label: "Hirdetések" },
      { id: "auto:kivitel", label: "Kivitel menü" },
      { id: "auto:akku", label: "Akkumulátor és hatótáv" },
      ...AUTO_LAYOUT_ITEMS.map((item) => ({
        id: layoutTabId(item).replace(/^layout:/, "auto:layout:"),
        label: item.label,
      })),
    ],
  },
  {
    id: "ingatlan",
    label: "3. Ingatlanhirdetések",
    defaultTab: "ingatlan:listings",
    tabs: [
      { id: "ingatlan:listings", label: "Hirdetések" },
      { id: "ingatlan:preview", label: "Megjelenés (nézet)" },
      ...IMMO_LAYOUT_ITEMS.map((item) => ({
        id: layoutTabId(item).replace(/^layout:/, "ingatlan:layout:"),
        label: `${item.label} — szerkesztő`,
      })),
    ],
  },
  {
    id: "home",
    label: "4. Főoldal",
    defaultTab: "home:promo",
    tabs: [{ id: "home:promo", label: "Promo képek" }],
  },
  {
    id: "mobilweb",
    label: "5. Mobilweb",
    defaultTab: "mobilweb:menu",
    tabs: [{ id: "mobilweb:menu", label: "Menü elrendezés" }],
  },
];

let admin = null;
let tab = "users:private";
let layoutCategory = "szemelyauto";
let layoutIntent = "";
let lastUsername = "";
let otpUser = "";
let otpEmailMasked = "";
let err = "";
let info = "";
let users = [];
let listings = [];
let visitors = {
  online: 0,
  daily: { hits: 0, unique: 0 },
  weekly: { hits: 0, unique: 0 },
  monthly: { hits: 0, unique: 0 },
  devices: [],
  onlineWindowMinutes: 5,
  warning: "",
};
let layout = { cells: [], category: "szemelyauto" };
let wheelSchema = { version: 1, cells: [] };
let hubPromo = { images: [], max: 8, size: { width: 1400, height: 840 }, count: 0 };
let searchCylinderMenu = { version: 1, items: [] };
let searchCylinderImagePresets = [];
let kivitelMenu = { version: 1, items: [] };
let akkuSearchMenu = { version: 1, title: "Akkumulátor és hatótáv adatok", items: [], live: false };
let editingUser = null;
let selectedVisitorId = "";
let visitorHits = [];
let blockedIps = [];

let devOtpCode = "";

function parseTab(value = tab) {
  const raw = String(value || "users:private");
  const i = raw.indexOf(":");
  if (i < 0) return { section: raw, sub: "" };
  return { section: raw.slice(0, i), sub: raw.slice(i + 1) };
}

function isLayoutTab(value = tab) {
  const { sub } = parseTab(value);
  return sub.startsWith("layout:");
}

function isPreviewTab(value = tab) {
  return parseTab(value).sub === "preview";
}

function layoutCategoryFromTab(value = tab) {
  if (!isLayoutTab(value)) return layoutCategory;
  const { sub } = parseTab(value);
  const raw = sub.slice("layout:".length) || "szemelyauto";
  const [cat] = raw.split(":");
  return cat || "szemelyauto";
}

function layoutIntentFromTab(value = tab) {
  if (!isLayoutTab(value)) return layoutIntent;
  const { sub } = parseTab(value);
  const raw = sub.slice("layout:".length) || "";
  const parts = raw.split(":");
  return parts[1] || "";
}

function layoutTabId(item) {
  return item.intent ? `layout:${item.id}:${item.intent}` : `layout:${item.id}`;
}

function immoWheelApiUrl(variant) {
  const v = encodeURIComponent(normalizeIngatlanWheelVariant(variant));
  return `/api/level1/ingatlan-wheel-schema?variant=${v}`;
}

function categoryLabel(id) {
  for (const group of LAYOUT_NAV) {
    const hit = group.items.find((c) => c.id === id);
    if (hit) return hit.label;
  }
  return LAYOUT_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function isSearchLayoutCat(id) {
  return id === "szemelyauto-search" || id === "teherauto-search";
}

function otpSentMessage(data) {
  const to = data.emailMasked ? ` (${data.emailMasked})` : "";
  if (data.devCode) {
    devOtpCode = String(data.devCode).trim();
    return (
      `Belépési kód (másold be alább): ${data.devCode}. ` +
      `Email most nem megy ki — állítsd be a Vercel-en: SMTP_USER, SMTP_PASS.`
    );
  }
  devOtpCode = "";
  return `A kódot elküldtük emailben${to}. Nézd a spam mappát is.`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Hiba");
    error.code = data.code;
    throw error;
  }
  return data;
}

function h(html) {
  app.innerHTML = html;
  app.querySelectorAll("[data-act]").forEach((el) => {
    const isFile = el.tagName === "INPUT" && el.type === "file";
    const isText =
      el.tagName === "INPUT" && (el.type === "text" || el.type === "" || !el.type);
    const evt =
      el.tagName === "FORM"
        ? "submit"
        : el.tagName === "SELECT" || isFile || (el.tagName === "INPUT" && el.type === "checkbox")
          ? "change"
          : isText
            ? "change"
            : "click";
    el.addEventListener(evt, (event) => {
      if (el.tagName === "FORM") event.preventDefault();
      const act = el.getAttribute("data-act");
      if (typeof actions[act] === "function") actions[act](event, el);
    });
  });
}

const actions = {
  async login(event) {
    err = "";
    info = "";
    const form = event.target;
    lastUsername = String(form.username.value || "").trim();
    try {
      const data = await api("/api/level1/login", {
        method: "POST",
        body: JSON.stringify({
          username: lastUsername,
          password: form.password.value,
        }),
      });
      // IDEIGLENES localhost: localadmin 2FA nélkül
      if (data.skipOtp && data.admin) {
        admin = data.admin;
        otpUser = "";
        otpEmailMasked = "";
        info = "";
        await loadTab();
        render();
        return;
      }
      otpUser = data.username;
      otpEmailMasked = data.emailMasked || "";
      info = otpSentMessage(data);
      render();
    } catch (error) {
      if (error.code === "LOCKED") {
        const user = String(lastUsername || "bocsatechadmin").trim().toLowerCase();
        err =
          "Zárolva (3 hibás próbálkozás). Írd be pontosan a Vercel LEVEL1_BOOTSTRAP_PASSWORD jelszót — az feloldja.\n\n" +
          "Deploy / oldal újratöltés után is feloldódik. Kézi feloldás Supabase SQL:\n" +
          `UPDATE level1_admins SET locked = false, failed_attempts = 0, updated_at = now() WHERE username = '${user}';`;
      } else {
        err = error.message;
      }
      render();
    }
  },
  async resendOtp() {
    err = "";
    info = "";
    try {
      const data = await api("/api/level1/resend-otp", {
        method: "POST",
        body: JSON.stringify({ username: otpUser }),
      });
      otpEmailMasked = data.emailMasked || otpEmailMasked;
      info = otpSentMessage(data);
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async otp(event) {
    err = "";
    try {
      const data = await api("/api/level1/otp", {
        method: "POST",
        body: JSON.stringify({ username: otpUser, code: event.target.code.value }),
      });
      admin = data.admin;
      otpUser = "";
      otpEmailMasked = "";
      devOtpCode = "";
      await loadTab();
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async logout() {
    await api("/api/level1/logout", { method: "POST" });
    admin = null;
    otpUser = "";
    otpEmailMasked = "";
    render();
  },
  async delUserListing(_, el) {
    const id = el.getAttribute("data-id");
    if (!confirm(`Törlöd a #${id} hirdetést?`)) return;
    try {
      await api(`/api/level1/listings/${id}`, { method: "DELETE" });
      if (editingUser?.id) {
        const data = await api(`/api/level1/users/${editingUser.id}`);
        editingUser = data.user;
      }
      await loadTab();
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async toggleUserActive(_, el) {
    const id = el.getAttribute("data-id");
    const active = el.getAttribute("data-active") === "1";
    try {
      await api(`/api/level1/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ emailVerified: !active }),
      });
      await loadTab();
      if (editingUser?.id === Number(id)) {
        const data = await api(`/api/level1/users/${id}`);
        editingUser = data.user;
      }
      info = active ? "Felhasználó deaktiválva." : "Felhasználó aktiválva.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async blockVisitorIp(_, el) {
    const ip = el.getAttribute("data-ip");
    if (!ip || !confirm(`Blokkolod az IP-t? ${ip}`)) return;
    err = "";
    try {
      const data = await api("/api/level1/visitors/block", {
        method: "POST",
        body: JSON.stringify({ ip }),
      });
      blockedIps = data.blockedIps || [];
      info = `Blokkolva: ${ip}`;
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async unblockVisitorIp(_, el) {
    const ip = el.getAttribute("data-ip");
    if (!ip) return;
    err = "";
    try {
      const data = await api("/api/level1/visitors/unblock", {
        method: "POST",
        body: JSON.stringify({ ip }),
      });
      blockedIps = data.blockedIps || [];
      info = `Feloldva: ${ip}`;
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  setSection(_, el) {
    tab = el.getAttribute("data-tab") || "users:private";
    err = "";
    info = "";
    editingUser = null;
    loadTab().then(render);
  },
  setTab(_, el) {
    tab = el.getAttribute("data-tab") || tab;
    if (isLayoutTab(tab)) {
      layoutCategory = layoutCategoryFromTab(tab);
      layoutIntent = layoutIntentFromTab(tab);
    }
    err = "";
    info = "";
    editingUser = null;
    loadTab().then(render);
  },
  async refreshVisitors() {
    err = "";
    info = "";
    try {
      visitors = await api("/api/level1/visitors");
      blockedIps = visitors.blockedIps || blockedIps;
      info = "Látogatóadatok frissítve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async initVisitorSchema() {
    err = "";
    info = "";
    try {
      const data = await api("/api/level1/visitors/init", { method: "POST" });
      visitors = data.stats || (await api("/api/level1/visitors"));
      info = "Látogató táblák létrehozva.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async showVisitorHits(_, el) {
    const id = el.getAttribute("data-id");
    err = "";
    info = "";
    if (selectedVisitorId === id) {
      selectedVisitorId = "";
      visitorHits = [];
      render();
      return;
    }
    selectedVisitorId = id;
    try {
      const data = await api(`/api/level1/visitors/${id}/hits`);
      visitorHits = data.hits || [];
      render();
    } catch (error) {
      err = error.message;
      visitorHits = [];
      render();
    }
  },
  async delUser(_, el) {
    const id = el.getAttribute("data-id");
    if (!confirm(`Törlöd a #${id} usert?`)) return;
    try {
      await api(`/api/level1/users/${id}`, { method: "DELETE" });
      await loadTab();
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async editUser(_, el) {
    err = "";
    info = "";
    const id = el.getAttribute("data-id");
    try {
      const data = await api(`/api/level1/users/${id}`);
      editingUser = data.user;
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  cancelEditUser() {
    editingUser = null;
    err = "";
    render();
  },
  async saveUser() {
    err = "";
    info = "";
    if (!editingUser?.id) return;
    try {
      const email = String(app.querySelector("#edit-email")?.value ?? "").trim();
      const displayName = String(app.querySelector("#edit-displayName")?.value ?? "").trim();
      const emailVerified = Boolean(app.querySelector("#edit-emailVerified")?.checked);
      const profileJson = { ...(editingUser.profileJson ?? {}) };
      app.querySelectorAll(".edit-profile-field").forEach((el) => {
        const key = el.getAttribute("data-key");
        if (key) profileJson[key] = el.value;
      });
      const data = await api(`/api/level1/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ email, displayName, emailVerified, profileJson }),
      });
      editingUser = data.user;
      await loadTab();
      info = "User mentve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async setStatus(_, el) {
    const id = el.getAttribute("data-id");
    await api(`/api/level1/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: el.value }),
    });
  },
  async setUserListingStatus(_, el) {
    const id = el.getAttribute("data-id");
    await api(`/api/level1/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: el.value }),
    });
    if (editingUser?.id) {
      const listing = (editingUser.listings || []).find((l) => String(l.id) === String(id));
      if (listing) listing.status = el.value;
    }
  },
  async delListing(_, el) {
    const id = el.getAttribute("data-id");
    if (!confirm(`Törlöd a #${id} hirdetést?`)) return;
    await api(`/api/level1/listings/${id}`, { method: "DELETE" });
    await loadTab();
    render();
  },
  async saveLayout() {
    err = "";
    info = "";
    try {
      const cat = layoutCategoryFromTab();
      if (isIngatlanWheelAdminCategory(cat)) {
        const data = await api("/api/level1/ingatlan-wheel-schema", {
          method: "PUT",
          body: JSON.stringify({ schema: wheelSchema, variant: cat }),
        });
        wheelSchema = data.schema || wheelSchema;
        info =
          `${categoryLabel(cat)} kerék-séma mentve. Kereső és feladás hard refresh (Cmd+Shift+R) után frissül. A Kiado ingatlan elrendezése csak a saját gombjánál változik.`;
        render();
        return;
      }
      const data = await api("/api/level1/form-layout", {
        method: "PUT",
        body: JSON.stringify({ category: cat, layout }),
      });
      layout = data.layout || layout;
      layoutCategory = data.category || cat;
      const isSearch = isSearchLayoutCat(cat);
      info = isSearch
          ? `${categoryLabel(cat)} elrendezés mentve. A kereső oldalon hard refresh (Cmd+Shift+R) után frissül.`
          : `Elrendezés mentve (${categoryLabel(layoutCategory)}). A hirdetésfeladáson hard refresh (Cmd+Shift+R) után látszik.`;
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async hubPromoDelete(_, el) {
    const imageId = el.getAttribute("data-image-id");
    if (!confirm("Törlöd ezt a képet a főoldalról?")) return;
    err = "";
    info = "";
    try {
      hubPromo = await api("/api/level1/hub-promo/image", {
        method: "DELETE",
        body: JSON.stringify({ id: imageId }),
      });
      info = "Kép törölve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async hubPromoSaveLink(_, el) {
    const imageId = el.getAttribute("data-image-id");
    const card = el.closest(".hub-promo-admin__card");
    const href = String(card?.querySelector("[data-href]")?.value ?? "").trim();
    const alt = String(card?.querySelector("[data-alt]")?.value ?? "").trim();
    err = "";
    info = "";
    try {
      hubPromo = await api("/api/level1/hub-promo/image", {
        method: "PATCH",
        body: JSON.stringify({ id: imageId, href, alt }),
      });
      info = "Link mentve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async hubPromoUpload(_, el) {
    const file = el.files?.[0];
    if (!file) return;
    err = "";
    info = "";
    try {
      const href = String(app.querySelector("#hub-promo-new-href")?.value ?? "").trim();
      const alt = String(app.querySelector("#hub-promo-new-alt")?.value ?? "").trim();
      const image = await resizePromoToTarget(file);
      hubPromo = await api("/api/level1/hub-promo/upload", {
        method: "POST",
        body: JSON.stringify({ image, href, alt }),
      });
      info = "Kép feltöltve (1400×840-re igazítva).";
      el.value = "";
      const hrefInput = app.querySelector("#hub-promo-new-href");
      const altInput = app.querySelector("#hub-promo-new-alt");
      if (hrefInput) hrefInput.value = "";
      if (altInput) altInput.value = "";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  cylMenuMove(_, el) {
    const items = actions.readCylinderMenuFromDom();
    const id = el.getAttribute("data-id");
    const dir = Number(el.getAttribute("data-dir") || 0);
    const idx = items.findIndex((item) => item.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const tmp = items[idx];
    items[idx] = items[next];
    items[next] = tmp;
    searchCylinderMenu = { ...searchCylinderMenu, items };
    render();
  },
  cylMenuToggle(_event, el) {
    const card = el?.closest(".cyl-admin-card");
    if (card) card.classList.toggle("is-off", !el.checked);
    searchCylinderMenu = { ...searchCylinderMenu, items: actions.readCylinderMenuFromDom() };
  },
  readCylinderMenuFromDom() {
    const items = [];
    app.querySelectorAll(".cyl-admin-card[data-id]").forEach((card) => {
      const id = card.getAttribute("data-id");
      const prev = (searchCylinderMenu.items || []).find((item) => item.id === id) || {};
      items.push({
        id,
        label: String(card.querySelector("[data-field=label]")?.value ?? prev.label ?? "").trim(),
        group: String(card.querySelector("[data-field=group]")?.value ?? prev.group ?? "").trim(),
        href: String(card.querySelector("[data-field=href]")?.value ?? prev.href ?? "").trim(),
        image: String(card.querySelector("[data-field=image]")?.value ?? prev.image ?? "").trim(),
        enabled: Boolean(card.querySelector("[data-field=enabled]")?.checked),
      });
    });
    return items.length ? items : [...(searchCylinderMenu.items || [])];
  },
  async saveCylinderMenu() {
    err = "";
    info = "";
    try {
      const items = actions.readCylinderMenuFromDom();
      const data = await api("/api/level1/search-cylinder", {
        method: "PUT",
        body: JSON.stringify({ menu: { version: 1, items } }),
      });
      searchCylinderMenu = data.menu || { version: 1, items: data.items || items };
      searchCylinderImagePresets = data.imagePresets || searchCylinderImagePresets;
      info = "Menü elrendezés mentve. A Keresés oldalon hard refresh kell.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async resetCylinderMenu() {
    if (!confirm("Visszaállítod az alapértelmezett menüsorrendet és címkéket?")) return;
    err = "";
    info = "";
    try {
      const data = await api("/api/level1/search-cylinder", {
        method: "PUT",
        body: JSON.stringify({ menu: { version: 1, items: [] } }),
      });
      searchCylinderMenu = data.menu || { version: 1, items: data.items || [] };
      searchCylinderImagePresets = data.imagePresets || searchCylinderImagePresets;
      info = "Alapértelmezett menü visszaállítva.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  kivitelMenuMove(_, el) {
    const items = actions.readKivitelMenuFromDom();
    const id = el.getAttribute("data-id");
    const dir = Number(el.getAttribute("data-dir") || 0);
    const idx = items.findIndex((item) => item.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const tmp = items[idx];
    items[idx] = items[next];
    items[next] = tmp;
    kivitelMenu = { ...kivitelMenu, items };
    render();
  },
  kivitelMenuToggle(_event, el) {
    const card = el?.closest(".kivitel-admin-card");
    if (card) card.classList.toggle("is-off", !el.checked);
    kivitelMenu = { ...kivitelMenu, items: actions.readKivitelMenuFromDom() };
  },
  readKivitelMenuFromDom() {
    const items = [];
    app.querySelectorAll(".kivitel-admin-card[data-id]").forEach((card) => {
      const id = card.getAttribute("data-id");
      const prev = (kivitelMenu.items || []).find((item) => item.id === id) || {};
      items.push({
        id,
        label: String(card.querySelector("[data-field=label]")?.value ?? prev.label ?? "").trim(),
        enabled: Boolean(card.querySelector("[data-field=enabled]")?.checked),
      });
    });
    return items.length ? items : [...(kivitelMenu.items || [])];
  },
  async saveKivitelMenu() {
    err = "";
    info = "";
    try {
      const items = actions.readKivitelMenuFromDom();
      const data = await api("/api/level1/kivitel-menu", {
        method: "PUT",
        body: JSON.stringify({ menu: { version: 1, items } }),
      });
      kivitelMenu = data.menu || { version: 1, items: data.items || items };
      info = "Kivitel menü mentve. Az autó oldalon hard refresh kell.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async resetKivitelMenu() {
    if (!confirm("Visszaállítod az alapértelmezett Kivitel listát?")) return;
    err = "";
    info = "";
    try {
      const data = await api("/api/level1/kivitel-menu", {
        method: "PUT",
        body: JSON.stringify({ menu: { version: 1, items: [] } }),
      });
      kivitelMenu = data.menu || { version: 1, items: data.items || [] };
      info = "Alapértelmezett Kivitel lista visszaállítva.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  akkuKindLabel(kind) {
    if (kind === "range") return "Tól–ig";
    if (kind === "select") return "Választó";
    if (kind === "toggle") return "Kapcsoló";
    return kind || "—";
  },
  akkuMenuMove(_, el) {
    const items = actions.readAkkuMenuFromDom();
    const id = el.getAttribute("data-id");
    const dir = Number(el.getAttribute("data-dir"));
    const idx = items.findIndex((item) => item.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= items.length) return;
    const tmp = items[idx];
    items[idx] = items[next];
    items[next] = tmp;
    const title = String(app.querySelector("[data-field=akku-title]")?.value ?? akkuSearchMenu.title ?? "").trim();
    akkuSearchMenu = { ...akkuSearchMenu, title, items };
    render();
    void actions.saveAkkuSearchMenu({ silent: true });
  },
  akkuMenuToggle(_event, el) {
    const card = el?.closest(".akku-admin-card");
    if (card) card.classList.toggle("is-off", !el.checked);
    const items = actions.readAkkuMenuFromDom();
    const title = String(app.querySelector("[data-field=akku-title]")?.value ?? akkuSearchMenu.title ?? "").trim();
    akkuSearchMenu = { ...akkuSearchMenu, title, items };
    void actions.saveAkkuSearchMenu({ silent: true });
  },
  akkuTitleSave() {
    void actions.saveAkkuSearchMenu({ silent: true });
  },
  akkuLabelSave() {
    void actions.saveAkkuSearchMenu({ silent: true });
  },
  readAkkuMenuFromDom() {
    const items = [];
    app.querySelectorAll(".akku-admin-card[data-id]").forEach((card) => {
      const id = card.getAttribute("data-id");
      const prev = (akkuSearchMenu.items || []).find((item) => item.id === id) || {};
      items.push({
        id,
        kind: prev.kind,
        label: String(card.querySelector("[data-field=label]")?.value ?? prev.label ?? "").trim(),
        enabled: Boolean(card.querySelector("[data-field=enabled]")?.checked),
        ...(prev.unit != null ? { unit: prev.unit } : {}),
        ...(prev.step != null ? { step: prev.step } : {}),
        ...(prev.options ? { options: prev.options } : {}),
      });
    });
    return items.length ? items : [...(akkuSearchMenu.items || [])];
  },
  async saveAkkuSearchMenu(opts = {}) {
    const silent = opts?.silent === true;
    err = "";
    if (!silent) info = "Mentés…";
    try {
      const items = actions.readAkkuMenuFromDom();
      const title = String(app.querySelector("[data-field=akku-title]")?.value ?? akkuSearchMenu.title ?? "").trim();
      const data = await api("/api/level1/akku-search-menu", {
        method: "PUT",
        body: JSON.stringify({ menu: { version: 1, title, items } }),
      });
      const check = await fetch(`/api/level1/akku-search-menu?t=${Date.now()}`, {
        credentials: "same-origin",
        cache: "no-store",
      }).then((r) => r.json());
      const live = data.live === true || check.live === true;
      akkuSearchMenu = {
        ...(data.menu || { version: 1, title, items: data.items || items }),
        live,
      };
      if (!live) {
        throw new Error("Mentés után az élő API még mindig üres. Próbáld újra, vagy nézd a hálózati hibát.");
      }
      info = `Mentve. Cím: „${akkuSearchMenu.title}”. Bekapcsolt mezők a keresőn: ${(check.section?.ranges?.length || 0) + (check.section?.selects?.length || 0) + (check.section?.toggles?.length || 0)}. Autó oldal: Több szűrő → Részletes keresés.`;
      if (!silent) render();
      else {
        const hint = app.querySelector(".layout-cat-title")?.closest("div,section") || app;
        const ok = app.querySelector("p.ok");
        if (ok) ok.textContent = info;
      }
    } catch (error) {
      err = error.message;
      info = "";
      render();
    }
  },
  async resetAkkuSearchMenu() {
    if (!confirm("Minden mezőt kikapcsolsz? A keresőn eltűnik az Akkumulátor szekció.")) return;
    err = "";
    info = "";
    try {
      const data = await api("/api/level1/akku-search-menu", {
        method: "PUT",
        body: JSON.stringify({ menu: { version: 1, items: [] } }),
      });
      akkuSearchMenu = { ...(data.menu || { version: 1, items: data.items || [] }), live: data.live === true };
      info = "Minden mező kikapcsolva — a keresőn nincs Akkumulátor szekció.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("A fájl olvasása sikertelen."));
    reader.readAsDataURL(file);
  });
}

const PROMO_W = 1400;
const PROMO_H = 840;

/** Cover crop → 1400×840 JPEG (rossz méretű képet is igazít). */
async function resizePromoToTarget(file) {
  if (typeof createImageBitmap !== "function") {
    return fileToDataUrl(file);
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = PROMO_W;
    canvas.height = PROMO_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fileToDataUrl(file);
    const scale = Math.max(PROMO_W / bitmap.width, PROMO_H / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, PROMO_W, PROMO_H);
    ctx.drawImage(bitmap, (PROMO_W - w) / 2, (PROMO_H - h) / 2, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    bitmap.close?.();
  }
}

async function loadTab() {
  if (!admin) return;
  const { section, sub } = parseTab();
  if (section === "users") {
    if (sub === "visitors") {
      visitors = await api("/api/level1/visitors");
      blockedIps = visitors.blockedIps || [];
    } else if (sub === "private" || sub === "business") {
      users = (await api("/api/level1/users")).users;
    }
  }
  if (section === "auto" && sub === "listings") {
    const data = await api("/api/level1/listings");
    listings = (data.listings || []).filter((l) => {
      const v = String(l.vertical || "").toLowerCase();
      return v !== "ingatlan";
    });
  }
  if (section === "auto" && sub === "kivitel") {
    const data = await api("/api/level1/kivitel-menu/admin");
    kivitelMenu = data.menu || { version: 1, items: data.items || [] };
  }
  if (section === "auto" && sub === "akku") {
    const data = await api("/api/level1/akku-search-menu/admin");
    akkuSearchMenu = {
      ...(data.menu || { version: 1, items: data.items || [] }),
      live: data.live === true,
      source: data.source || null,
      updatedAt: data.menu?.updatedAt || null,
    };
  }
  if (section === "ingatlan" && sub === "listings") {
    listings = (await api("/api/level1/listings?vertical=ingatlan")).listings;
  }
  if (section === "ingatlan" && sub === "preview") {
    layoutCategory = "ingatlan";
    const data = await api(immoWheelApiUrl("ingatlan"));
    wheelSchema = data.schema || { version: 1, cells: [] };
  }
  if (section === "home" && sub === "promo") {
    hubPromo = await api("/api/level1/hub-promo");
  }
  if (section === "mobilweb" && sub === "menu") {
    const data = await api("/api/level1/search-cylinder/admin");
    searchCylinderMenu = data.menu || { version: 1, items: data.items || [] };
    searchCylinderImagePresets = data.imagePresets || [];
  }
  if (isLayoutTab()) {
    layoutCategory = layoutCategoryFromTab();
    layoutIntent = layoutIntentFromTab();
    if (isIngatlanWheelAdminCategory(layoutCategory)) {
      const data = await api(immoWheelApiUrl(layoutCategory));
      wheelSchema = data.schema || { version: 1, cells: [] };
    } else {
      const data = await api(`/api/level1/form-layout?category=${encodeURIComponent(layoutCategory)}`);
      layout = data.layout;
    }
  }
}

function loginView() {
  if (otpUser) {
    return `
      <div class="wrap">
        <h1>Bocsatech</h1>
        <p class="sub">Második tényező: email kód${otpEmailMasked ? ` → ${esc(otpEmailMasked)}` : ""}</p>
        <form class="card" data-act="otp" style="max-width:420px">
          <label>6 jegyű kód</label>
          <input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" value="${esc(devOtpCode)}" required autofocus />
          <p class="ok">${esc(info)}</p>
          <p class="err">${esc(err)}</p>
          <div class="row" style="margin-top:1rem">
            <button class="btn" type="submit">Belépés</button>
            <button class="btn ghost" type="button" data-act="resendOtp">Kód újraküldése</button>
          </div>
        </form>
      </div>`;
  }
  return `
    <div class="wrap">
      <h1>Bocsatech</h1>
      <p class="sub">Admin belépés — jelszó + email kód. 3 hiba után a felhasználónév zárolva.<br><small>Localhost (IDEIGLENES): <code>localadmin</code> / <code>localadmin</code> — 2FA nélkül.</small></p>
      <form class="card" data-act="login" style="max-width:420px">
        <label>Felhasználónév</label>
        <input name="username" autocomplete="username" value="${esc(lastUsername)}" required />
        <label>Jelszó</label>
        <input name="password" type="password" autocomplete="current-password" required />
        <p class="err">${esc(err)}</p>
        <div class="row" style="margin-top:1rem">
          <button class="btn" type="submit">Belépés</button>
        </div>
      </form>
    </div>`;
}

function fmtWhen(value) {
  if (!value) return "—";
  const s = String(value).replace("T", " ").slice(0, 19);
  return s || "—";
}

function visitorsView() {
  const d = visitors?.daily || {};
  const w = visitors?.weekly || {};
  const m = visitors?.monthly || {};
  const devices = visitors?.devices || [];
  const blocked = blockedIps || visitors?.blockedIps || [];
  const blockedSet = new Set(blocked);
  const rows = devices
    .map(
      (dev) => `<tr class="${selectedVisitorId === dev.id ? "row-selected" : ""}${blockedSet.has(dev.ip) ? " row-blocked" : ""}">
        <td>${esc(dev.ip)}${blockedSet.has(dev.ip) ? ' <span class="badge warn">blokk</span>' : ""}</td>
        <td>${esc(dev.deviceName)}</td>
        <td>${esc(dev.deviceType)}</td>
        <td>${esc(dev.browser)}</td>
        <td>${esc(dev.os)}</td>
        <td>${esc(dev.screen)}${dev.viewport ? `<br><small>${esc(dev.viewport)}</small>` : ""}</td>
        <td>${esc(dev.language)}</td>
        <td>${esc(dev.timezone)}</td>
        <td>${dev.userId ? `#${dev.userId}` : "—"}</td>
        <td title="${esc(dev.lastPath)}">${esc((dev.lastPath || "").slice(0, 40))}${(dev.lastPath || "").length > 40 ? "…" : ""}</td>
        <td>${dev.hitCount ?? 0}</td>
        <td>${esc(fmtWhen(dev.firstSeenAt))}</td>
        <td>${esc(fmtWhen(dev.lastSeenAt))}</td>
        <td class="ua-cell" title="${esc(dev.userAgent)}">${esc((dev.userAgent || "").slice(0, 48))}${(dev.userAgent || "").length > 48 ? "…" : ""}</td>
        <td class="row-actions">
          <button class="btn ghost" type="button" data-act="showVisitorHits" data-id="${esc(dev.id)}">${selectedVisitorId === dev.id ? "Bezár" : "Oldalak"}</button>
          ${
            blockedSet.has(dev.ip)
              ? `<button class="btn ghost" type="button" data-act="unblockVisitorIp" data-ip="${esc(dev.ip)}">IP felold</button>`
              : `<button class="btn danger" type="button" data-act="blockVisitorIp" data-ip="${esc(dev.ip)}">IP blokkol</button>`
          }
        </td>
      </tr>`
    )
    .join("");
  const hitRows = visitorHits
    .map(
      (hit) => `<tr>
        <td>${esc(fmtWhen(hit.createdAt))}</td>
        <td>${esc(hit.path)}</td>
        <td>${esc(hit.pageTitle)}</td>
        <td>${esc(hit.viewport)}</td>
        <td>${hit.pixelRatio ?? "—"}</td>
        <td>${esc(hit.platform)}</td>
        <td>${esc(hit.connectionType)}</td>
        <td>${hit.userId ? `#${hit.userId}` : "—"}</td>
        <td title="${esc(hit.referrer)}">${esc((hit.referrer || "").slice(0, 40))}${(hit.referrer || "").length > 40 ? "…" : ""}</td>
      </tr>`
    )
    .join("");
  const hitsPanel =
    selectedVisitorId && visitorHits.length
      ? `<h3 class="admin-section-title" style="margin-top:1.25rem">Oldalmegtekintések — ${esc(selectedVisitorId.slice(0, 8))}…</h3>
      <div class="table-scroll">
        <table class="table-dense">
          <thead><tr>
            <th>Idő</th><th>Útvonal</th><th>Cím</th><th>Viewport</th><th>DPR</th><th>Platform</th><th>Hálózat</th><th>User</th><th>Honnan</th>
          </tr></thead>
          <tbody>${hitRows}</tbody>
        </table>
      </div>`
      : selectedVisitorId
        ? `<p class="hint" style="margin-top:1rem">Ehhez az eszközhöz még nincs oldalmegtekintés.</p>`
        : "";
  return `
    <div class="admin-visitors">
      ${visitors?.warning ? `<p class="err">Figyelem: ${esc(visitors.warning)}</p>` : ""}
      <p class="hint">„Jelenleg” = az elmúlt ${visitors?.onlineWindowMinutes || 5} percben aktív eszközök. Kattints az „Oldalak” gombra az egyes eszközök megtekintési listájához.</p>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Jelenleg</div><div class="stat-value">${visitors?.online ?? 0}</div><div class="stat-sub">aktív eszköz</div></div>
        <div class="stat-card"><div class="stat-label">Naponta</div><div class="stat-value">${d.unique ?? 0}</div><div class="stat-sub">${d.hits ?? 0} megtekintés</div></div>
        <div class="stat-card"><div class="stat-label">Hetente</div><div class="stat-value">${w.unique ?? 0}</div><div class="stat-sub">${w.hits ?? 0} megtekintés</div></div>
        <div class="stat-card"><div class="stat-label">Havonta</div><div class="stat-value">${m.unique ?? 0}</div><div class="stat-sub">${m.hits ?? 0} megtekintés</div></div>
      </div>
      <div class="row" style="margin:0.75rem 0 1rem">
        <button class="btn ghost" type="button" data-act="refreshVisitors">Frissítés</button>
        ${visitors?.schemaMissing ? `<button class="btn" type="button" data-act="initVisitorSchema">Séma telepítése</button>` : ""}
      </div>
      <h3 class="admin-section-title">Látogatott gépek / eszközök</h3>
      <div class="table-scroll">
        <table class="table-dense">
          <thead>
            <tr>
              <th>IP</th><th>Gép / eszköz</th><th>Típus</th><th>Böngésző</th><th>OS</th>
              <th>Képernyő</th><th>Nyelv</th><th>Időzóna</th><th>User</th><th>Utolsó oldal</th><th>Találatok</th>
              <th>Első</th><th>Utolsó</th><th>User-Agent</th><th></th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="15">Még nincs látogatóadat. Nyiss meg egy oldalt a weben, majd frissíts.</td></tr>`}</tbody>
        </table>
      </div>
      ${hitsPanel}
      ${
        blocked.length
          ? `<h3 class="admin-section-title" style="margin-top:1.25rem">Blokkolt IP címek</h3><p class="hint">${blocked.map((ip) => esc(ip)).join(", ")}</p>`
          : ""
      }
    </div>`;
}

function usersView(kind = "private") {
  const filtered = users.filter((u) => (u.accountType || "private") === kind);
  const rows = filtered
    .map(
      (u) => `<tr>
        <td>${u.id}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.displayName || "")}</td>
        <td>${u.emailVerified ? '<span class="badge ok">aktív</span>' : '<span class="badge warn">inaktív</span>'}</td>
        <td>${esc(fmtWhen(u.createdAt))}</td>
        <td>${esc(fmtWhen(u.lastLoginAt))}</td>
        <td>${u.listingCount ?? 0}</td>
        <td class="row-actions">
          <button class="btn" data-act="editUser" data-id="${u.id}">Kezelés</button>
          <button class="btn ghost" type="button" data-act="toggleUserActive" data-id="${u.id}" data-active="${u.emailVerified ? "1" : "0"}">${u.emailVerified ? "Deaktivál" : "Aktivál"}</button>
          <button class="btn danger" data-act="delUser" data-id="${u.id}">Törlés</button>
        </td>
      </tr>`
    )
    .join("");
  const editor = editingUser ? userEditView() : "";
  const messages = `
    ${info ? `<p class="ok">${esc(info)}</p>` : ""}
    ${err ? `<p class="err">${esc(err)}</p>` : ""}
  `;
  const title = kind === "business" ? "Céges fiókok" : "Privát fiókok";
  return `
    <div class="users-edit">
      ${messages}
      <p class="hint"><strong>${title}</strong> — hirdetések, profil szerkesztés, aktiválás/deaktiválás, törlés.</p>
      <div class="table-scroll">
        <table class="table-dense"><thead><tr>
          <th>#</th><th>Email</th><th>Név</th><th>Státusz</th>
          <th>Regisztráció</th><th>Utoljára belépett</th><th>Hirdetések</th><th></th>
        </tr></thead><tbody>${rows || `<tr><td colspan="8">Nincs ${kind === "business" ? "céges" : "privát"} user.</td></tr>`}</tbody></table>
      </div>
      ${editor}
    </div>`;
}

function profileFields(profile) {
  const labels = {
    accountType: "Fiók típus",
    firstName: "Keresztnév",
    lastName: "Vezetéknév",
    street: "Utca, házszám",
    postalCode: "Irányítószám",
    city: "Város",
    country: "Ország",
    phone: "Telefon",
    company: "Cégnév",
    companyTaxId: "Adószám",
    companyStreet: "Cég — utca, házszám",
    companyPostalCode: "Cég — irányítószám",
    companyCity: "Cég — település",
    companyCountry: "Cég — ország",
    companyAddress: "Cég cím (összesített)",
    companyPhone: "Cég telefon",
    companyPhone2: "Cég telefon 2",
    companyEmail: "Cég email",
    companyEmail2: "Cég email 2",
    salespersonName: "Kapcsolattartó",
    salespersonName2: "Kapcsolattartó 2",
  };
  const keys = Object.keys(labels);
  const extra = Object.keys(profile).filter((k) => !keys.includes(k) && k !== "avatarDataUrl" && k !== "pageLayout");
  return [...keys, ...extra].map((key) => {
    const label = labels[key] || key;
    const value = profile[key] ?? "";
    return { key, label, value };
  });
}

function userEditView() {
  const profile = editingUser.profileJson ?? {};
  const fields = profileFields(profile);
  const fieldRows = fields
    .map(
      (f) => `
      <label>
        <div>${esc(f.label)} <small style="color:var(--muted)">(${esc(f.key)})</small></div>
        ${
          f.key === "accountType"
            ? `<select class="edit-profile-field" data-key="accountType">
                <option value="private" ${String(f.value) === "private" ? "selected" : ""}>magán</option>
                <option value="business" ${String(f.value) === "business" ? "selected" : ""}>céges</option>
              </select>`
            : `<input class="edit-profile-field" data-key="${esc(f.key)}" type="text" value="${esc(String(f.value))}" />`
        }
      </label>`
    )
    .join("");

  return `
    <div class="user-edit">
      <h2>Felhasználó kezelése (#${esc(editingUser.id)})</h2>
      <p class="hint">Regisztráció: ${esc(fmtWhen(editingUser.createdAt))} · Utoljára belépett: ${esc(fmtWhen(editingUser.lastLoginAt))} · Hirdetések: ${editingUser.listingCount ?? (editingUser.listings || []).length}</p>
      <label>
        <div>Email</div>
        <input id="edit-email" type="email" value="${esc(editingUser.email || "")}" />
      </label>

      <label>
        <div>Megjelenített név</div>
        <input id="edit-displayName" type="text" value="${esc(editingUser.displayName || "")}" />
      </label>

      <label style="display:flex; align-items:center; gap:0.5rem">
        <input id="edit-emailVerified" type="checkbox" ${editingUser.emailVerified ? "checked" : ""} />
        <span>Email aktivált</span>
      </label>

      <h3 style="margin:1.25rem 0 0.5rem; font-size:0.95rem; color:var(--muted)">Profil mezők</h3>
      ${fieldRows}

      <h3 style="margin:1.25rem 0 0.5rem; font-size:0.95rem; color:var(--muted)">Hirdetései</h3>
      <div class="table-scroll">
        <table class="table-dense">
          <thead><tr><th>#</th><th>Cím</th><th>Státusz</th><th>Frissítve</th><th></th></tr></thead>
          <tbody>
            ${(editingUser.listings || [])
              .map(
                (l) => `<tr>
                  <td>${l.id}</td>
                  <td>${esc(l.title || "")}</td>
                  <td>
                    <select data-act="setUserListingStatus" data-id="${l.id}">
                      ${["mentett", "feladott", "inaktiv"]
                        .map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`)
                        .join("")}
                    </select>
                  </td>
                  <td>${esc(fmtWhen(l.updatedAt))}</td>
                  <td class="row-actions">
                    <a href="/hirdetes.html?id=${l.id}" target="_blank" rel="noreferrer">nyit</a>
                    <a href="/hirdetesfeladas.html?id=${l.id}" target="_blank" rel="noreferrer">szerk.</a>
                    <button class="btn danger" type="button" data-act="delUserListing" data-id="${l.id}">Törlés</button>
                  </td>
                </tr>`
              )
              .join("") || `<tr><td colspan="5">Nincs hirdetése.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="row" style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1.25rem">
        <button class="btn" type="button" data-act="saveUser">Mentés</button>
        <button class="btn ghost" type="button" data-act="toggleUserActive" data-id="${editingUser.id}" data-active="${editingUser.emailVerified ? "1" : "0"}">${editingUser.emailVerified ? "Deaktivál" : "Aktivál"}</button>
        <button class="btn" type="button" data-act="cancelEditUser">Mégse</button>
      </div>
    </div>`;
}

function listingCategoryLabel(l) {
  const sub = String(l.subtype || l.hirdetes_alkategoria || "").toLowerCase();
  if (sub) return categoryLabel(sub) || sub;
  const v = String(l.vertical || "").toLowerCase();
  if (v === "ingatlan") return "Ingatlan";
  if (v === "teher") return "Teherautó";
  return "Személyautó";
}

function listingsView({ title = "Hirdetések", emptyHint = "Nincs hirdetés." } = {}) {
  const groups = new Map();
  for (const l of listings) {
    const key = listingCategoryLabel(l);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const sections = [...groups.entries()]
    .map(([cat, items]) => {
      const rows = items
        .map(
          (l) => `<tr>
        <td>${l.imageUrl ? `<img class="thumb" src="${esc(l.imageUrl)}" alt="" />` : ""}</td>
        <td>${l.id}</td>
        <td>${esc(l.title || "")}</td>
        <td>${esc(l.gyartmany || "")} ${esc(l.tipus || "")}</td>
        <td>${l.ownerUserId ? `#${l.ownerUserId}` : "—"}</td>
        <td>
          <select data-act="setStatus" data-id="${l.id}">
            ${["mentett", "feladott", "inaktiv"]
              .map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </td>
        <td><a href="/hirdetes.html?id=${l.id}" target="_blank" rel="noreferrer">nyit</a></td>
        <td class="row-actions">
          <a href="/hirdetesfeladas.html?id=${l.id}" target="_blank" rel="noreferrer">szerk.</a>
          <button class="btn danger" data-act="delListing" data-id="${l.id}">Törlés</button>
        </td>
      </tr>`
        )
        .join("");
      return `<section class="admin-list-group"><h3 class="admin-section-title">${esc(cat)} <small>(${items.length})</small></h3>
        <div class="table-scroll"><table class="table-dense"><thead><tr><th></th><th>#</th><th>Cím</th><th>Részlet</th><th>Tulaj</th><th>Státusz</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    })
    .join("");
  return `
    ${info ? `<p class="ok">${esc(info)}</p>` : ""}
    ${err ? `<p class="err">${esc(err)}</p>` : ""}
    <p class="hint"><strong>${esc(title)}</strong> — kategóriánként, státusz módosítás és törlés.</p>
    ${sections || `<p class="hint">${esc(emptyHint)}</p>`}`;
}

function ingatlanPreviewView() {
  return `
    <h2 class="layout-cat-title">Ingatlan megjelenés — csak nézet</h2>
    <p class="hint">Ez a jelenlegi kereső/feladás felület (Kiado ingatlan). Itt nem szerkeszthető — a szerkesztő a „— szerkesztő” füleken van.</p>
    <div id="layout-root" class="layout-root--readonly"></div>`;
}

function hubPromoView() {
  const images = hubPromo?.images || [];
  const max = hubPromo?.max || 8;
  const count = images.length;
  const canAdd = count < max;
  const cards = images
    .map((img) => {
      return `<div class="hub-promo-admin__card">
        <div class="hub-promo-admin__thumb">
          <img src="${esc(img.url)}" alt="" />
          ${img.stock ? '<span class="badge">alap</span>' : ""}
        </div>
        <label>
          <div>Link (üres = csak reklám)</div>
          <input type="text" data-href placeholder="/ingatlan.html vagy https://…" value="${esc(img.href || "")}" />
        </label>
        <label>
          <div>Alt szöveg</div>
          <input type="text" data-alt value="${esc(img.alt || "")}" />
        </label>
        <div class="row-actions">
          <button type="button" class="btn ghost" data-act="hubPromoSaveLink" data-image-id="${esc(img.id)}">Link mentése</button>
          <button type="button" class="btn danger" data-act="hubPromoDelete" data-image-id="${esc(img.id)}">Törlés</button>
        </div>
      </div>`;
    })
    .join("");

  return `
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <p class="hint"><strong>Főoldal promo sáv</strong> — max ${max} kép (${count}/${max}). Méret: <strong>1400×840</strong> (5∶3). Rossz méretű feltöltés automatikusan igazítódik. Link opcionális.</p>
    <div class="hub-promo-admin__grid">${cards || "<p class=\"hint\">Nincs kép — tölts fel egyet.</p>"}</div>
    ${
      canAdd
        ? `<section class="hub-promo-admin__upload-box">
      <h3 class="admin-section-title">Új kép hozzáadása</h3>
      <label>
        <div>Link (opcionális)</div>
        <input id="hub-promo-new-href" type="text" placeholder="üres = csak reklám" />
      </label>
      <label>
        <div>Alt szöveg (opcionális)</div>
        <input id="hub-promo-new-alt" type="text" placeholder="Promo" />
      </label>
      <label class="btn ghost hub-promo-admin__upload">Kép kiválasztása (JPG/PNG/WebP)
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-act="hubPromoUpload" />
      </label>
    </section>`
        : `<p class="hint">Elérted a maximumot (${max}). Törölj egy képet, ha újat akarsz feltölteni.</p>`
    }`;
}

function imagePresetOptions(current) {
  const cur = String(current || "").split("?")[0];
  const presets = searchCylinderImagePresets.length
    ? searchCylinderImagePresets
    : [cur].filter(Boolean);
  const opts = presets.map((src) => {
    const value = src.includes("?") ? src : `${src}?v=cyl1`;
    const selected = cur && src.split("?")[0] === cur ? " selected" : "";
    return `<option value="${esc(value)}"${selected}>${esc(src.split("/").pop() || src)}</option>`;
  });
  if (current && !presets.some((src) => src.split("?")[0] === cur)) {
    opts.unshift(`<option value="${esc(current)}" selected>${esc(current)}</option>`);
  }
  return opts.join("");
}

function searchCylinderMenuView() {
  const items = searchCylinderMenu?.items || [];
  const cards = items
    .map((item, index) => {
      return `<article class="cyl-admin-card ${item.enabled === false ? "is-off" : ""}" data-id="${esc(item.id)}">
        <div class="cyl-admin-card__order">
          <span class="cyl-admin-card__idx">${index + 1}</span>
          <button type="button" class="btn ghost" data-act="cylMenuMove" data-id="${esc(item.id)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="btn ghost" data-act="cylMenuMove" data-id="${esc(item.id)}" data-dir="1" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
        </div>
        <div class="cyl-admin-card__thumb">
          <img src="${esc(item.image)}" alt="" />
        </div>
        <div class="cyl-admin-card__fields">
          <label>
            <div>Címke</div>
            <input type="text" data-field="label" value="${esc(item.label || "")}" maxlength="80" />
          </label>
          <label>
            <div>Csoport</div>
            <input type="text" data-field="group" value="${esc(item.group || "")}" maxlength="40" />
          </label>
          <label>
            <div>Link</div>
            <input type="text" data-field="href" value="${esc(item.href || "")}" />
          </label>
          <label>
            <div>Kép</div>
            <select data-field="image">${imagePresetOptions(item.image)}</select>
          </label>
          <label class="cyl-admin-card__toggle">
            <input type="checkbox" data-field="enabled" data-act="cylMenuToggle" data-id="${esc(item.id)}" ${item.enabled === false ? "" : "checked"} />
            Látható a keresés hengeren
          </label>
        </div>
      </article>`;
    })
    .join("");

  return `
    <h2 class="layout-cat-title">Keresés — menü elrendezés</h2>
    <p class="hint">A mobil <strong>Keresés</strong> oldal hengerének sorrendje, címkéi, képei és linkjei. A ↑↓ gombokkal rendezd. Kikapcsolt elem nem jelenik meg a hengeren.</p>
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <div class="cyl-admin-list">${cards || '<p class="hint">Nincs menüelem.</p>'}</div>
    <div class="row" style="margin-top:1rem;gap:0.65rem;flex-wrap:wrap">
      <button class="btn" type="button" data-act="saveCylinderMenu">Menü mentése</button>
      <button class="btn ghost" type="button" data-act="resetCylinderMenu">Alapértelmezés</button>
    </div>`;
}

function akkuSearchMenuView() {
  const items = akkuSearchMenu?.items || [];
  const cards = items
    .map((item, index) => {
      return `<article class="kivitel-admin-card akku-admin-card ${item.enabled === true ? "" : "is-off"}" data-id="${esc(item.id)}">
        <div class="kivitel-admin-card__order">
          <span class="kivitel-admin-card__idx">${index + 1}</span>
          <button type="button" class="btn ghost" data-act="akkuMenuMove" data-id="${esc(item.id)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="btn ghost" data-act="akkuMenuMove" data-id="${esc(item.id)}" data-dir="1" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
        </div>
        <div class="kivitel-admin-card__fields">
          <label>
            <div>Típus</div>
            <input type="text" value="${esc(actions.akkuKindLabel(item.kind))}" readonly />
          </label>
          <label>
            <div>Címke</div>
            <input type="text" data-field="label" data-act="akkuLabelSave" value="${esc(item.label || "")}" maxlength="80" />
          </label>
          <label class="kivitel-admin-card__toggle">
            <input type="checkbox" data-field="enabled" data-act="akkuMenuToggle" data-id="${esc(item.id)}" ${item.enabled === true ? "checked" : ""} />
            Látható a Részletes keresés „Akkumulátor és hatótáv adatok” szekciójában
          </label>
        </div>
      </article>`;
    })
    .join("");

  return `
    <h2 class="layout-cat-title">Akkumulátor és hatótáv adatok</h2>
    <p class="hint"><strong>Csak itt</strong> állítható a webes <strong>Részletes keresés → Akkumulátor és hatótáv adatok</strong> szekció. A Személyautó kereső elrendezés ezt <strong>nem</strong> módosítja. Kapcsold be a mezőket, amiket látni szeretnél; alapból minden ki van kapcsolva (a keresőn üres / nem jelenik meg).${akkuSearchMenu?.live ? ` <strong>Élő mentés${akkuSearchMenu.updatedAt ? ` · ${esc(akkuSearchMenu.updatedAt)}` : ""}.</strong>` : " <strong class=\"err\">Még nincs mentés — a keresőn nincs akku szekció.</strong>"}</p>
    <label class="kivitel-admin-card__fields" style="display:block;margin-bottom:0.75rem;max-width:28rem">
      <div>Szekció címe</div>
      <input type="text" data-field="akku-title" data-act="akkuTitleSave" value="${esc(akkuSearchMenu?.title || "Akkumulátor és hatótáv adatok")}" maxlength="80" />
    </label>
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <div class="kivitel-admin-list">${cards || '<p class="hint">Nincs menüelem.</p>'}</div>
    <div class="row" style="margin-top:1rem;gap:0.65rem;flex-wrap:wrap">
      <button class="btn" type="button" data-act="saveAkkuSearchMenu">Menü mentése</button>
      <button class="btn ghost" type="button" data-act="resetAkkuSearchMenu">Minden kikapcsolva (alap)</button>
    </div>`;
}

function kivitelMenuView() {
  const items = kivitelMenu?.items || [];
  const cards = items
    .map((item, index) => {
      return `<article class="kivitel-admin-card ${item.enabled === false ? "is-off" : ""}" data-id="${esc(item.id)}">
        <div class="kivitel-admin-card__order">
          <span class="kivitel-admin-card__idx">${index + 1}</span>
          <button type="button" class="btn ghost" data-act="kivitelMenuMove" data-id="${esc(item.id)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="btn ghost" data-act="kivitelMenuMove" data-id="${esc(item.id)}" data-dir="1" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
        </div>
        <div class="kivitel-admin-card__fields">
          <label>
            <div>Címke</div>
            <input type="text" data-field="label" value="${esc(item.label || "")}" maxlength="80" />
          </label>
          <label class="kivitel-admin-card__toggle">
            <input type="checkbox" data-field="enabled" data-act="kivitelMenuToggle" data-id="${esc(item.id)}" ${item.enabled === false ? "" : "checked"} />
            Látható az autó oldal Kivitel menüjében
          </label>
        </div>
      </article>`;
    })
    .join("");

  return `
    <h2 class="layout-cat-title">Kivitel menü</h2>
    <p class="hint">Az autó oldal <strong>Kivitel</strong> almenüje (minden járműkategóriában). Sorrend, címke és láthatóság. Kikapcsolt elem nem jelenik meg a menüben.</p>
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <div class="kivitel-admin-list">${cards || '<p class="hint">Nincs menüelem.</p>'}</div>
    <div class="row" style="margin-top:1rem;gap:0.65rem;flex-wrap:wrap">
      <button class="btn" type="button" data-act="saveKivitelMenu">Menü mentése</button>
      <button class="btn ghost" type="button" data-act="resetKivitelMenu">Alapértelmezés</button>
    </div>`;
}

function layoutView() {
  const cat = layoutCategoryFromTab();
  const label = categoryLabel(cat);
  const isImmo = isIngatlanWheelAdminCategory(cat);
  const isSearch = isSearchLayoutCat(cat);
  const sharedHint = isImmo
    ? cat === "ingatlan"
      ? "Közös kerék-séma a keresőre és a feladásra (Kiado ingatlan — master). Ár / Alapterület / Emelet: osztott min–max csempe. Mentés csak ezt a gombot érinti."
      : "Ugyanaz a kerék-séma, mint a Kiado ingatlannál (első betöltéskor másolat). Szerkesztés és mentés csak erre a gombra vonatkozik — a Kiado ingatlan elrendezése nem változik."
    : isSearch
      ? cat === "teherauto-search"
        ? "Teherautó gyorskereső + Több szűrő mezői (3,5 t-ig és 3,5 t-tól közös nézet). 1. lépés = hero gyorskereső, 2–5. lépés = bővített szűrők. Mentés után a teherautó oldalon hard refresh kell."
        : "Személyautó gyorskereső + Több szűrő mezői. 1. lépés = hero gyorskereső, 2–5. lépés = bővített szűrők. Ugyanaz a mezőkatalógus, mint a feladásnál. Mentés után az autó oldalon hard refresh kell."
      : "Csak ennek a kategóriának a mezői. Húzd a cellát a lapon belül vagy másik lépésre. Mentés után a hirdetésfeladáson hard refresh kell.";
  const titleSuffix = isImmo ? "kerék-séma" : isSearch ? "kereső mezők" : "feladási mezők";
  return `
    <h2 class="layout-cat-title">${esc(label)} — ${titleSuffix}</h2>
    <p class="hint">${esc(sharedHint)}</p>
    <div id="layout-root"></div>
    <p class="ok">${info}</p>
    <p class="err">${err}</p>
    <div class="row" style="margin-top:1rem"><button class="btn" type="button" data-act="saveLayout">Elrendezés mentése</button></div>`;
}

function shellBody() {
  const { section, sub } = parseTab();
  if (section === "users") {
    if (sub === "visitors") return visitorsView();
    if (sub === "business") return usersView("business");
    return usersView("private");
  }
  if (section === "auto") {
    if (sub === "listings") {
      return listingsView({ title: "Autóhirdetések", emptyHint: "Nincs autó/teher hirdetés." });
    }
    if (sub === "kivitel") return kivitelMenuView();
    if (sub === "akku") return akkuSearchMenuView();
    return layoutView();
  }
  if (section === "ingatlan") {
    if (sub === "listings") {
      return listingsView({ title: "Ingatlanhirdetések", emptyHint: "Nincs ingatlan hirdetés." });
    }
    if (sub === "preview") return ingatlanPreviewView();
    return layoutView();
  }
  if (section === "home") return hubPromoView();
  if (section === "mobilweb") return searchCylinderMenuView();
  return usersView("private");
}

function shell() {
  const { section } = parseTab();
  const currentSection = ADMIN_SECTIONS.find((s) => s.id === section) || ADMIN_SECTIONS[0];
  const sectionNav = ADMIN_SECTIONS.map(
    (s) =>
      `<button type="button" class="section-tab ${s.id === currentSection.id ? "on" : ""}" data-act="setSection" data-tab="${esc(s.defaultTab)}">${esc(s.label)}</button>`
  ).join("");
  const subNav = currentSection.tabs
    .map(
      (t) =>
        `<button type="button" class="tab ${tab === t.id ? "on" : ""}" data-act="setTab" data-tab="${esc(t.id)}">${esc(t.label)}</button>`
    )
    .join("");
  const wide =
    section === "users" ||
    section === "home" ||
    section === "mobilweb" ||
    isLayoutTab() ||
    isPreviewTab() ||
    tab.endsWith(":listings") ||
    tab === "auto:kivitel";
  return `
    <div class="wrap ${wide ? "wrap--wide" : ""}">
      <div class="top">
        <div>
          <h1>Bocsatech</h1>
          <p class="sub">${esc(admin.username)} · ${esc(admin.email)}</p>
        </div>
        <button class="btn ghost" data-act="logout">Kilépés</button>
      </div>
      <div class="admin-sections">${sectionNav}</div>
      <div class="tabs tabs--sub">${subNav}</div>
      <div class="card">${shellBody()}</div>
    </div>`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function render() {
  h(admin ? shell() : loginView());
  if (!admin) return;
  if (isLayoutTab()) {
    const root = document.getElementById("layout-root");
    if (isIngatlanWheelAdminCategory(layoutCategoryFromTab())) {
      mountIngatlanWheelBoard(root, wheelSchema, {
        onChange(schema) {
          wheelSchema = schema;
        },
      });
    } else {
      mountLayoutBoard(root, layout, {
        onChange(cells) {
          layout = { ...layout, cells, category: layoutCategoryFromTab() };
        },
      });
    }
    return;
  }
  if (isPreviewTab()) {
    const root = document.getElementById("layout-root");
    if (root) {
      mountIngatlanWheelBoard(root, wheelSchema, {
        readOnly: true,
        onChange() {},
      });
    }
  }
}

const me = await api("/api/level1/me").catch(() => ({ admin: null }));
admin = me.admin;
if (admin) await loadTab();
render();
