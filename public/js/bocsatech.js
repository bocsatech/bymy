import { mountLayoutBoard } from "./bocsatech-layout.js?v=deskFuelPrev5";
import {
  DESK_FUEL_PREVIEW_PROFILES,
  deskFuelPreviewFromLayoutIntent,
} from "./ad-form-layout-fuel-preview.js?v=deskFuelPrev5";
import { mountIngatlanWheelBoard } from "./bocsatech-ingatlan-wheels.js?v=immoUiParity1";
import {
  isIngatlanWheelAdminCategory,
  normalizeIngatlanWheelVariant,
  INGATLAN_TIPUS_LAYOUTS,
} from "./ingatlan-wheel-schema.js?v=immoUiParity1";
import { INGATLAN_LAKAS_TIPUS, fieldKeysVisibleForTipus } from "./ingatlan-fields.js?v=immoUiParity1";

const app = document.getElementById("app");

function isLiveAdminHost() {
  const h = String(location.hostname || "").toLowerCase();
  return h.includes("vercel.app") || h === "bymy.hu" || h.endsWith(".bymy.hu");
}

function showBootPlaceholder(message = "Betöltés…") {
  if (!app) return;
  app.innerHTML = `<div class="wrap"><h1>Bocsatech</h1><p class="hint">${esc(message)}</p></div>`;
}

if (!app) {
  throw new Error("Hiányzik a #app elem a Bocsatech.html-ben.");
}

async function fetchJsonWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store", signal: ctrl.signal });
    return { res, data: await res.json().catch(() => ({})) };
  } finally {
    clearTimeout(timer);
  }
}

const LAYOUT_NAV = [
  {
    group: "Autók",
    items: [
      { id: "szemelyauto", label: "Normál autó feladás" },
      { id: "szemelyauto", label: "Elektromos autó feladás", intent: "fuel-electric" },
      { id: "szemelyauto", label: "Hibrid autó feladás", intent: "fuel-hybrid" },
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
      { id: "elado-ingatlan", label: "Eladó" },
      { id: "ingatlan", label: "Kiadó" },
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
      { id: "auto:desk-guide", label: "Feladás képek" },
      { id: "auto:kivitel", label: "Kivitel menü" },
      { id: "auto:akku", label: "Akkumulátor kereső" },
      ...AUTO_LAYOUT_ITEMS.map((item) => ({
        id: layoutTabId(item).replace(/^layout:/, "auto:layout:"),
        label: item.label,
      })),
    ],
  },
  {
    id: "ingatlan",
    label: "3. Ingatlanhirdetések",
    defaultTab: "ingatlan:layout:ingatlan",
    tabs: [
      { id: "ingatlan:layout:elado-ingatlan", label: "Eladó — szerkesztő" },
      ...INGATLAN_TIPUS_LAYOUTS.map((type) => ({
        id: `ingatlan:layout:${type}`,
        label: `${INGATLAN_LAKAS_TIPUS.find((item) => item.value === type)?.label || type} — szerkesztő`,
      })),
      { id: "ingatlan:layout:ingatlan", label: "Kiadó — szerkesztő" },
      { id: "ingatlan:layout:airbnb", label: "Airbnb — szerkesztő" },
      { id: "ingatlan:layout:ingatlan:wizard", label: "Feladási lépések — szerkesztő" },
      { id: "ingatlan:tipus-mezok", label: "Típus → mezők" },
      { id: "ingatlan:partnerek", label: "Ingatlanos partnerek" },
      { id: "ingatlan:listings", label: "Hirdetések" },
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
  {
    id: "pages",
    label: "6. Oldalak",
    defaultTab: "pages:hub",
    tabs: [
      { id: "pages:hub", label: "Kezdőlap" },
      { id: "pages:auto", label: "Autó" },
      { id: "pages:teherauto", label: "Teherautó" },
      { id: "pages:ingatlan", label: "Ingatlan" },
      { id: "pages:ajanlasok", label: "Ajánlások" },
      { id: "pages:kereses", label: "Keresés" },
      { id: "pages:hirdetesfeladas", label: "Hirdetésfeladás" },
      { id: "pages:uzenetek", label: "Üzenetek" },
      { id: "pages:fiok", label: "Fiók / Beállítások" },
      { id: "pages:listings", label: "Listings" },
    ],
  },
  {
    id: "backup",
    label: "7. Mentés",
    defaultTab: "backup:restore",
    tabs: [{ id: "backup:restore", label: "Visszaállítás" }],
  },
];

const PAGE_ADMIN_GUIDES = {
  hub: {
    title: "Kezdőlap",
    href: "/",
    blocksPage: "hub",
    blurb: "Oldalsáv videók + középső HTML. Promo képek külön fülön.",
    jumps: [{ tab: "home:promo", label: "Promo képek szerkesztése" }],
  },
  auto: {
    title: "Autó oldal",
    href: "/auto.html",
    blocksPage: "auto",
    blurb: "Oldalsáv tartalom. Kereső / Kivitel / Akkumulátor a 2. szekcióban.",
    jumps: [
      { tab: "auto:layout:szemelyauto-search", label: "Személyautó kereső" },
      { tab: "auto:kivitel", label: "Kivitel menü" },
      { tab: "auto:akku", label: "Akkumulátor kereső" },
      { tab: "auto:listings", label: "Autóhirdetések" },
    ],
  },
  teherauto: {
    title: "Teherautó oldal",
    href: "/teherauto.html",
    blocksPage: "teherauto",
    blurb: "Oldalsáv tartalom. Kereső / feladás elrendezések a 2. szekcióban.",
    jumps: [
      { tab: "auto:layout:teherauto-search", label: "Teherautó kereső" },
      { tab: "auto:layout:kisteher", label: "Feladás · 3,5-ig" },
      { tab: "auto:layout:teherauto", label: "Feladás · 3,5-től" },
      { tab: "auto:listings", label: "Autó/teher hirdetések" },
    ],
  },
  ingatlan: {
    title: "Ingatlan oldal",
    href: "/ingatlan.html",
    blocksPage: "ingatlan",
    blurb: "Oldalsáv tartalom. Kerék-sémák a 3. szekcióban.",
    jumps: [
      { tab: "ingatlan:layout:elado-ingatlan", label: "Eladó szerkesztő" },
      { tab: "ingatlan:layout:ingatlan", label: "Kiadó szerkesztő" },
      { tab: "ingatlan:layout:airbnb", label: "Airbnb szerkesztő" },
      { tab: "ingatlan:tipus-mezok", label: "Típus → mezők" },
      { tab: "ingatlan:listings", label: "Ingatlanhirdetések" },
    ],
  },
  ajanlasok: {
    title: "Ajánlások",
    href: "/ajanlasok.html",
    blocksPage: "ajanlasok",
    blurb: "Oldalsáv tartalom az ajánló oldalon.",
    jumps: [],
  },
  kereses: {
    title: "Keresés (mobil cylinder)",
    href: "/kereses.html",
    blocksPage: "kereses",
    blurb: "Oldalsáv + mobil cylinder menü.",
    jumps: [{ tab: "mobilweb:menu", label: "Menü elrendezés" }],
  },
  hirdetesfeladas: {
    title: "Hirdetésfeladás",
    href: "/hirdetesfeladas.html",
    blocksPage: "hirdetesfeladas",
    blurb: "Oldalsáv tippek. Űrlap-elrendezések a 2–3. szekcióban.",
    jumps: [
      { tab: "auto:layout:szemelyauto", label: "Személyautó feladás" },
      { tab: "ingatlan:layout:elado-ingatlan", label: "Ingatlan kerék (eladó)" },
      { tab: "ingatlan:layout:ingatlan", label: "Ingatlan kerék (kiadó)" },
      { tab: "ingatlan:layout:airbnb", label: "Ingatlan kerék (Airbnb)" },
      { tab: "ingatlan:layout:ingatlan:wizard", label: "Ingatlan feladási lépések" },
      { tab: "ingatlan:tipus-mezok", label: "Típus → mezők" },
    ],
  },
  uzenetek: {
    title: "Üzenetek",
    href: "/uzenetek.html",
    blocksPage: "uzenetek",
    blurb: "Oldalsáv tartalom. Nincs külön layout-szerkesztő.",
    jumps: [],
  },
  fiok: {
    title: "Fiók / Beállítások",
    href: "/beallitasok.html",
    blocksPage: "beallitasok",
    blurb: "Oldalsáv a Beállítások oldalon. Felhasználók a 1. szekcióban.",
    jumps: [
      { tab: "users:private", label: "Privát fiókok" },
      { tab: "users:business", label: "Céges fiókok" },
    ],
  },
  listings: {
    title: "Listings",
    href: "/listings.html",
    blocksPage: "listings",
    blurb: "Oldalsáv a listázó oldalon.",
    jumps: [
      { tab: "auto:listings", label: "Autóhirdetések" },
      { tab: "ingatlan:listings", label: "Ingatlanhirdetések" },
    ],
  },
};

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
/** Admin desk elrendezés: normál / elektromos / hibrid mező-előnézet (ugyanaz a mentett layout). */
let deskFuelPreviewProfile = "combustion";
let wheelSchema = { version: 1, cells: [] };
let hubPromo = { images: [], max: 8, size: { width: 1400, height: 840 }, count: 0 };
let adFormDeskGuide = { images: [], slots: {} };
let searchCylinderMenu = { version: 1, items: [] };
let searchCylinderImagePresets = [];
let kivitelMenu = { version: 1, items: [] };
let tipusFieldsConfig = { version: 1, by_tipus: {}, catalog: [], parents: [], core: [] };
let tipusFieldsActive = "lakas";
let akkuSearchMenu = { version: 1, title: "Akkumulátor és hatótáv adatok", items: [], live: false };
let sitePageBlocks = {
  page: "hub",
  left: { title: "", videos: ["", "", ""] },
  right: { title: "", videos: ["", "", ""] },
  center: null,
};
let editingUser = null;
let usersSearchQuery = "";
let usersStatusFilter = "all";
let partnerProfiles = [];
let selectedVisitorId = "";
let selectedVisitorIp = "";
let visitorHits = [];
let visitorHitsSource = "hits"; // hits | sessions
let blockedIps = [];
let visitorsSearchQuery = "";
let visitorsStatusFilter = "all"; // all | blocked (online moved to time range)
let visitorsTimeRange = "all"; // all | online | today | yesterday | week | lastweek | month | custom
let visitorsCustomFrom = "";
let visitorsCustomTo = "";
let visitorsSortKey = "lastSeen"; // lastSeen | hits | ip | firstSeen
let visitorsSortDir = "desc"; // asc | desc
let visitorHitsSortDir = "desc";
let visitorsExpandedIps = {};
let backupList = { backups: [], categories: [], dir: "", keepDays: 30 };
let backupSelectedId = "";
let backupCategory = "all";
let backupUserEmail = "";
let backupListingId = "";
let backupPreview = null;
let backupBusy = false;
let backupForceFeladott = true;
let devOtpCode = "";
let deployBackend = null;

function pageBlocksKey(pageKey) {
  const guide = PAGE_ADMIN_GUIDES[pageKey] || PAGE_ADMIN_GUIDES.hub;
  return guide.blocksPage || pageKey || "hub";
}

function emptySideBlocks(title = "Videók") {
  return { title, videos: ["", "", ""] };
}

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

function isIngatlanWizardLayoutTab(value = tab) {
  return (
    layoutCategoryFromTab(value) === "ingatlan" &&
    layoutIntentFromTab(value) === "wizard"
  );
}

function isIngatlanWheelLayoutTab(value = tab) {
  return (
    isLayoutTab(value) &&
    isIngatlanWheelAdminCategory(layoutCategoryFromTab(value)) &&
    !isIngatlanWizardLayoutTab(value)
  );
}

function layoutTabId(item) {
  return item.intent ? `layout:${item.id}:${item.intent}` : `layout:${item.id}`;
}

function immoWheelApiUrl(variant) {
  const v = encodeURIComponent(normalizeIngatlanWheelVariant(variant));
  return `/api/level1/ingatlan-wheel-schema?variant=${v}`;
}

function layoutNavItemForTab(value = tab) {
  if (!isLayoutTab(value)) return null;
  const raw = parseTab(value).sub.slice("layout:".length) || "szemelyauto";
  for (const group of LAYOUT_NAV) {
    for (const item of group.items) {
      const path = item.intent ? `${item.id}:${item.intent}` : item.id;
      if (raw === path) return item;
    }
  }
  return null;
}

function syncDeskFuelPreviewFromTab(value = tab) {
  if (layoutCategoryFromTab(value) !== DESK_POSTING_LAYOUT_MASTER) return;
  deskFuelPreviewProfile = deskFuelPreviewFromLayoutIntent(layoutIntentFromTab(value));
}

function categoryLabel(id) {
  for (const group of LAYOUT_NAV) {
    const hit = group.items.find((c) => c.id === id && !c.intent);
    if (hit) return hit.label;
  }
  const type = INGATLAN_LAKAS_TIPUS.find((item) => item.value === id);
  if (type) return `Ingatlan · ${type.label}`;
  return LAYOUT_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function isSearchLayoutCat(id) {
  return id === "szemelyauto-search" || id === "teherauto-search";
}

const DESK_POSTING_LAYOUT_MASTER = "szemelyauto";
const DESK_POSTING_LAYOUT_ALIASES = new Set(["leasing", "berauto", "lakokocsi", "kisteher", "teherauto"]);

function isVehiclePostingLayoutCat(id) {
  return id === DESK_POSTING_LAYOUT_MASTER || DESK_POSTING_LAYOUT_ALIASES.has(id);
}

function isDeskPostingLayoutAlias(id) {
  return DESK_POSTING_LAYOUT_ALIASES.has(id);
}

function vehiclePostingPreviewHref(id) {
  const vertical = id === "kisteher" || id === "teherauto" ? "teher" : "auto";
  return `/hirdetesfeladas.html?vertical=${encodeURIComponent(vertical)}&subtype=${encodeURIComponent(id)}&start=1`;
}

function otpSentMessage(data) {
  const to = data.emailMasked ? ` (${data.emailMasked})` : "";
  if (data.devCode) {
    devOtpCode = String(data.devCode).trim();
    return (
      `Belépési kód (másold be alább): ${data.devCode}. ` +
      `Email most nem megy ki — állítsd be az SMTP-t (SMTP_USER, SMTP_PASS).`
    );
  }
  devOtpCode = "";
  if (data.smtpRequired) {
    return `Az email kód nem küldhető ki — nincs SMTP beállítás a szerveren. Kérd a rendszergazdát (SMTP_USER / SMTP_PASS).`;
  }
  if (data.otpSent === false) {
    const detail = data.smtpWarning
      ? String(data.smtpWarning)
      : "ismeretlen SMTP hiba";
    const host = String(location.hostname || "").toLowerCase();
    const vercelHint =
      host.includes("vercel.app") || host.endsWith(".bymy.hu")
        ? " Vercelen: scripts/sync-vercel-mail-relay.mjs (SMTP relay az éles S1-ről) vagy mac/vercel-smtp-env.command. Ideiglenesen: bymy.hu/Bocsatech.html."
        : " A Gmail küldő fiók app jelszavát ellenőrizd (~/.autosweb/smtp.json).";
    return `Az email kód nem ment ki${to}: ${detail}.${vercelHint}`;
  }
  if (data.otpSent !== true) {
    return `Az email küldés állapota ismeretlen${to}. Próbáld újra, vagy kérj új kódot.`;
  }
  return `A kódot elküldtük emailben${to}. Nézd a spam mappát is (iCloud: Junk is).`;
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
      el.tagName === "INPUT" &&
      (el.type === "text" ||
        el.type === "search" ||
        el.type === "email" ||
        el.type === "number" ||
        el.type === "" ||
        !el.type);
    const liveInput = isText && el.hasAttribute("data-live");
    const evt =
      el.tagName === "FORM"
        ? "submit"
        : el.tagName === "SELECT" || isFile || (el.tagName === "INPUT" && el.type === "checkbox")
          ? "change"
          : liveInput
            ? "input"
            : isText
              ? "change"
              : "click";
    el.addEventListener(evt, (event) => {
      if (el.tagName === "FORM") event.preventDefault();
      const act = el.getAttribute("data-act");
      if (typeof actions[act] === "function") actions[act](event, el);
    });
  });
  import("./postal-city-autofill.js?v=postalFill1")
    .then((m) => m.wirePostalCityAutofill(app))
    .catch(() => {});
}

const actions = {
  async login(event) {
    err = "";
    info = "";
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const prevLabel = submitBtn?.textContent || "Belépés";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Belépés…";
    }
    lastUsername = String(form.username.value || "").trim();
    try {
      const data = await api("/api/level1/login", {
        method: "POST",
        body: JSON.stringify({
          username: lastUsername,
          password: form.password.value,
        }),
        signal: AbortSignal.timeout(25_000),
      });
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
      } else if (error.name === "TimeoutError" || error.name === "AbortError") {
        err = "A szerver nem válaszolt időben. Hard refresh (Cmd+Shift+R), majd próbáld újra.";
      } else {
        err = error.message;
      }
      render();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = prevLabel;
      }
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
  async createUser(event) {
    err = "";
    info = "";
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const accountType = tab === "users:business" ? "business" : "private";
      const data = await api("/api/level1/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.value,
          displayName: form.displayName.value,
          password: form.password.value,
          accountType,
          listingTitle: form.listingTitle?.value,
          listingTelepules: form.listingTelepules?.value,
          listingGyartmany: form.listingGyartmany?.value,
          listingModell: form.listingModell?.value,
          listingPrice: form.listingPrice?.value,
          listingVertical: "auto",
        }),
      });
      users = (await api("/api/level1/users")).users;
      const listingNote = data.listing?.id ? ` · hirdetés #${data.listing.id}` : "";
      info = `Fiók létrehozva: ${data.user?.email || ""} (azonnal aktív)${listingNote}. Belépés: email vagy a @ előtti név + jelszó.`;
      form.reset();
      render();
    } catch (error) {
      err = error.message;
      render();
    } finally {
      if (submitBtn) submitBtn.disabled = false;
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
  usersSearch(_, el) {
    usersSearchQuery = String(el?.value || "");
    const caret = typeof el?.selectionStart === "number" ? el.selectionStart : null;
    render();
    const next = app.querySelector('[data-act="usersSearch"]');
    if (next) {
      next.focus();
      if (caret != null && typeof next.setSelectionRange === "function") {
        try {
          next.setSelectionRange(caret, caret);
        } catch {
          /* search inputs may not support setSelectionRange in every browser */
        }
      }
    }
  },
  usersStatusFilter(_, el) {
    const next = String(el?.getAttribute("data-filter") || "all");
    usersStatusFilter = next === "active" || next === "inactive" ? next : "all";
    render();
  },
  visitorsSearch(_, el) {
    visitorsSearchQuery = String(el?.value || "");
    const caret = typeof el?.selectionStart === "number" ? el.selectionStart : null;
    render();
    const next = app.querySelector('[data-act="visitorsSearch"]');
    if (next) {
      next.focus();
      if (caret != null && typeof next.setSelectionRange === "function") {
        try {
          next.setSelectionRange(caret, caret);
        } catch {
          /* ignore */
        }
      }
    }
  },
  visitorsStatusFilter(_, el) {
    const next = String(el?.getAttribute("data-filter") || "all");
    visitorsStatusFilter = next === "blocked" ? "blocked" : "all";
    render();
  },
  visitorsTimeRange(_, el) {
    const next = String(el?.getAttribute("data-range") || "all");
    const allowed = new Set(["all", "online", "today", "yesterday", "week", "lastweek", "month", "custom"]);
    visitorsTimeRange = allowed.has(next) ? next : "all";
    selectedVisitorIp = "";
    selectedVisitorId = "";
    visitorHits = [];
    loadVisitors()
      .then(() => {
        info = "";
        render();
      })
      .catch((error) => {
        err = error.message || "Látogatók betöltése sikertelen.";
        render();
      });
  },
  visitorsCustomFrom(_, el) {
    visitorsCustomFrom = String(el?.value || "");
  },
  visitorsCustomTo(_, el) {
    visitorsCustomTo = String(el?.value || "");
  },
  applyVisitorsCustomRange() {
    visitorsTimeRange = "custom";
    selectedVisitorIp = "";
    selectedVisitorId = "";
    visitorHits = [];
    loadVisitors()
      .then(() => {
        info = "Egyedi intervallum alkalmazva.";
        render();
      })
      .catch((error) => {
        err = error.message || "Látogatók betöltése sikertelen.";
        render();
      });
  },
  toggleVisitorIpGroup(event, el) {
    event?.stopPropagation?.();
    const ip = el.getAttribute("data-ip");
    if (!ip) return;
    visitorsExpandedIps = { ...visitorsExpandedIps, [ip]: !visitorsExpandedIps[ip] };
    render();
  },
  visitorsSort(_, el) {
    const key = String(el?.getAttribute("data-sort") || "lastSeen");
    const allowed = new Set(["lastSeen", "hits", "ip", "firstSeen"]);
    if (!allowed.has(key)) return;
    if (visitorsSortKey === key) {
      visitorsSortDir = visitorsSortDir === "asc" ? "desc" : "asc";
    } else {
      visitorsSortKey = key;
      visitorsSortDir = key === "ip" ? "asc" : "desc";
    }
    render();
  },
  visitorHitsSort() {
    visitorHitsSortDir = visitorHitsSortDir === "asc" ? "desc" : "asc";
    render();
  },
  async selectVisitorIp(_, el) {
    const ip = el.getAttribute("data-ip");
    if (!ip) return;
    err = "";
    info = "";
    if (selectedVisitorIp === ip && !selectedVisitorId) {
      selectedVisitorIp = "";
      visitorHits = [];
      visitorHitsSource = "hits";
      render();
      return;
    }
    selectedVisitorIp = ip;
    selectedVisitorId = "";
    try {
      const qs = visitorsQueryString({ ip });
      const data = await api(`/api/level1/visitors/ip-hits?${qs}`);
      visitorHits = data.hits || [];
      visitorHitsSource = data.source === "sessions" ? "sessions" : "hits";
      render();
    } catch (error) {
      err = error.message;
      visitorHits = [];
      visitorHitsSource = "hits";
      render();
    }
  },
  async selectVisitor(_, el) {
    const id = el.getAttribute("data-id");
    if (!id) return;
    return actions.showVisitorHits(_, el);
  },
  async reviewPartner(_, el) {
    const id = el.getAttribute("data-id");
    const status = el.getAttribute("data-status");
    const labels = { approved: "jóváhagyod", rejected: "elutasítod", pending: "visszateszed függőbe" };
    if (!id || !status || !confirm(`Biztosan ${labels[status] || "módosítod"} ezt a partnerprofilt?`)) return;
    err = "";
    info = "";
    try {
      await api(`/api/level1/partner-profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      partnerProfiles = (await api("/api/level1/partner-profiles")).partners || [];
      info = status === "approved" ? "Partner jóváhagyva és ellenőrzöttként megjelölve." : status === "rejected" ? "Partnerkérelem elutasítva." : "Partnerprofil függő állapotba került.";
    } catch (error) {
      err = error.message;
    }
    render();
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
    loadTab()
      .then(render)
      .catch((error) => {
        err = error.message || "Betöltés sikertelen.";
        render();
      });
  },
  setTab(_, el) {
    tab = el.getAttribute("data-tab") || tab;
    if (isLayoutTab(tab)) {
      layoutCategory = layoutCategoryFromTab(tab);
      layoutIntent = layoutIntentFromTab(tab);
      syncDeskFuelPreviewFromTab(tab);
    }
    err = "";
    info = "";
    editingUser = null;
    loadTab()
      .then(render)
      .catch((error) => {
        err = error.message || "Betöltés sikertelen.";
        render();
      });
  },
  async refreshVisitors() {
    err = "";
    info = "";
    try {
      await loadVisitors();
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
      await loadVisitors();
      if (data?.stats) visitors = { ...visitors, ...data.stats, blockedIps: visitors.blockedIps };
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
      selectedVisitorIp = "";
      visitorHits = [];
      render();
      return;
    }
    selectedVisitorId = id;
    const device = (visitors?.devices || []).find((d) => d.id === id);
    selectedVisitorIp = device?.ip || selectedVisitorIp;
    try {
      const qs = new URLSearchParams();
      if (visitorsTimeRange && visitorsTimeRange !== "all") qs.set("range", visitorsTimeRange);
      if (visitorsTimeRange === "custom") {
        if (visitorsCustomFrom) qs.set("from", visitorsCustomFrom);
        if (visitorsCustomTo) qs.set("to", visitorsCustomTo);
      }
      const suffix = qs.toString() ? `?${qs}` : "";
      // still use visitor hits endpoint; range filtering on IP panel is preferred
      const data = await api(`/api/level1/visitors/${id}/hits${suffix}`);
      visitorHits = data.hits || [];
      render();
    } catch (error) {
      // fallback without range query if server ignores unknown params
      try {
        const data = await api(`/api/level1/visitors/${id}/hits`);
        visitorHits = data.hits || [];
        render();
      } catch (error2) {
        err = error2.message || error.message;
        visitorHits = [];
        render();
      }
    }
  },
  async delUser(_, el) {
    const id = el.getAttribute("data-id");
    if (!confirm(`Törlöd a #${id} usert? A hirdetései is törlődnek.`)) return;
    try {
      const data = await api(`/api/level1/users/${id}`, { method: "DELETE" });
      const n = Number(data?.deletedListings) || 0;
      info = n > 0 ? `Felhasználó törölve (${n} hirdetés is).` : "Felhasználó törölve.";
      err = "";
      editingUser = null;
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
    if (!id) return;
    const prevLabel = el.textContent;
    el.disabled = true;
    if (prevLabel) el.textContent = "Betöltés…";
    try {
      const data = await api(`/api/level1/users/${id}`);
      editingUser = data.user;
      render();
      requestAnimationFrame(() => {
        app.querySelector(".user-edit")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      err = error.message || "A felhasználó betöltése sikertelen.";
      render();
    } finally {
      el.disabled = false;
      if (prevLabel) el.textContent = prevLabel;
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
        if (!key) return;
        const raw = String(el.value ?? "").trim();
        if (key === "companyActivities" || (raw.startsWith("[") && raw.endsWith("]"))) {
          try {
            profileJson[key] = JSON.parse(raw);
            return;
          } catch {
            profileJson[key] = raw;
            return;
          }
        }
        profileJson[key] = el.value;
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
  backupSelect(_, el) {
    backupSelectedId = String(el.value || "");
    backupPreview = null;
    info = "";
    err = "";
    render();
  },
  readBackupFilters() {
    const root = app;
    backupCategory = String(root.querySelector("[data-backup-category]")?.value || "all");
    backupUserEmail = String(root.querySelector("[data-backup-user-email]")?.value || "").trim();
    backupListingId = String(root.querySelector("[data-backup-listing-id-filter]")?.value || "").trim();
  },
  backupFilterChange() {
    actions.readBackupFilters();
    backupPreview = null;
    info = "";
    err = "";
    render();
  },
  async backupReload() {
    err = "";
    info = "";
    try {
      await loadTab();
      info = "Mentéslista frissítve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async backupCreate() {
    err = "";
    info = "";
    backupBusy = true;
    render();
    try {
      const data = await api("/api/level1/backups", { method: "POST", body: "{}" });
      backupSelectedId = data.backup?.id || backupSelectedId;
      backupPreview = null;
      await loadTab();
      info = `Mentés kész: ${data.backup?.id || "ok"} (${data.backup?.counts?.listings ?? "?"} hirdetés).`;
    } catch (error) {
      err = error.message;
    } finally {
      backupBusy = false;
      render();
    }
  },
  async backupPreview() {
    err = "";
    info = "";
    actions.readBackupFilters();
    if (!backupSelectedId) {
      err = "Válassz mentést.";
      render();
      return;
    }
    backupBusy = true;
    render();
    try {
      backupPreview = await api(`/api/level1/backups/${encodeURIComponent(backupSelectedId)}/preview`, {
        method: "POST",
        body: JSON.stringify({
          category: backupCategory,
          userEmail: backupUserEmail || null,
          listingId: backupListingId || null,
        }),
      });
      info = `${backupPreview.matchCount} hirdetés az előnézetben.`;
    } catch (error) {
      err = error.message;
      backupPreview = null;
    } finally {
      backupBusy = false;
      render();
    }
  },
  backupSelectAll() {
    app.querySelectorAll("input[data-backup-listing-id]").forEach((el) => {
      el.checked = true;
    });
  },
  backupSelectNone() {
    app.querySelectorAll("input[data-backup-listing-id]").forEach((el) => {
      el.checked = false;
    });
  },
  backupListingCheck(_, el) {
    if (!el?.checked) return;
    const id = String(el.getAttribute("data-backup-listing-id") || "").trim();
    const email = String(el.getAttribute("data-backup-owner-email") || "").trim();
    const category = String(el.getAttribute("data-backup-category") || "all").trim() || "all";
    backupListingId = id;
    backupUserEmail = email;
    backupCategory = category;
    const catEl = app.querySelector("[data-backup-category]");
    const emailEl = app.querySelector("[data-backup-user-email]");
    const idEl = app.querySelector("[data-backup-listing-id-filter]");
    if (catEl) catEl.value = backupCategory;
    if (emailEl) emailEl.value = backupUserEmail;
    if (idEl) idEl.value = backupListingId;
  },
  backupForceFeladottChange(_, el) {
    backupForceFeladott = Boolean(el?.checked);
  },
  async backupRestore() {
    err = "";
    info = "";
    actions.readBackupFilters();
    backupForceFeladott = Boolean(app.querySelector("[data-backup-force-feladott]")?.checked);
    if (!backupSelectedId) {
      err = "Válassz mentést.";
      render();
      return;
    }
    const checked = [...app.querySelectorAll("[data-backup-listing-id]:checked")]
      .map((el) => Number(el.getAttribute("data-backup-listing-id")))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!checked.length) {
      err = "Jelölj ki legalább egy hirdetést.";
      render();
      return;
    }
    const asPublic = backupForceFeladott ? " feladott (nyilvános) státusszal" : "";
    if (!confirm(`Visszaállítasz ${checked.length} hirdetést a mentésből${asPublic}?`)) return;
    backupBusy = true;
    render();
    try {
      const data = await api(`/api/level1/backups/${encodeURIComponent(backupSelectedId)}/restore`, {
        method: "POST",
        body: JSON.stringify({
          listingIds: checked,
          forceStatus: backupForceFeladott ? "feladott" : null,
        }),
      });
      const statusBits = Object.entries(data.statuses || {})
        .map(([k, n]) => `${n} ${k}`)
        .join(", ");
      info = `Visszaállítva: ${data.restoredCount} hirdetés (${statusBits || "ok"}) · ID: ${(data.restoredIds || []).join(", ")}.`;
      try {
        backupPreview = await api(`/api/level1/backups/${encodeURIComponent(backupSelectedId)}/preview`, {
          method: "POST",
          body: JSON.stringify({
            category: backupCategory,
            userEmail: backupUserEmail || null,
            listingId: backupListingId || null,
          }),
        });
      } catch {
      }
    } catch (error) {
      err = error.message;
    } finally {
      backupBusy = false;
      render();
    }
  },
  setDeskFuelPreview(_event, el) {
    const next = el?.getAttribute?.("data-fuel-preview");
    if (!next || !["combustion", "electric", "hybrid"].includes(next)) return;
    if (deskFuelPreviewProfile === next) return;
    deskFuelPreviewProfile = next;
    render();
  },
  async saveLayout() {
    err = "";
    info = "";
    try {
      const cat = layoutCategoryFromTab();
      if (isDeskPostingLayoutAlias(cat)) {
        throw new Error(
          "Ennek a kategóriának az elrendezése a Személyautó feladás masterből jön. Szerkeszd ott."
        );
      }
      if (isIngatlanWheelLayoutTab()) {
        const data = await api("/api/level1/ingatlan-wheel-schema", {
          method: "PUT",
          body: JSON.stringify({ schema: wheelSchema, variant: cat }),
        });
        wheelSchema = data.schema || wheelSchema;
        info =
          `${categoryLabel(cat)} kerék-séma mentve. Hard refresh (Cmd+Shift+R) az élő oldalon. ` +
          (isLiveAdminHost() || deployBackend?.backend === "supabase"
            ? "Éles mentés — minden látogatónál megjelenik."
            : "Lokális mentés — csak ezen a gépen.");
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
          ? `${categoryLabel(cat)} elrendezés mentve. Hard refresh (Cmd+Shift+R) az élő oldalon. ${
              isLiveAdminHost() || deployBackend?.backend === "supabase" ? "Éles mentés." : "Lokális mentés."
            }`
          : `Elrendezés mentve (${categoryLabel(layoutCategory)}). Hard refresh a hirdetésfeladáson. ${
              isLiveAdminHost() || deployBackend?.backend === "supabase" ? "Éles mentés." : "Lokális mentés."
            }`;
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
  async deskGuideDelete(_, el) {
    const slot = el.getAttribute("data-slot");
    if (!slot || !confirm(`Törlöd a(z) „${slot}” szekció képét?`)) return;
    err = "";
    info = "";
    try {
      adFormDeskGuide = await api("/api/level1/ad-form-desk-guide/image", {
        method: "DELETE",
        body: JSON.stringify({ slot }),
      });
      info = "Kép törölve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async deskGuideSaveAlt(_, el) {
    const slot = el.getAttribute("data-slot");
    const card = el.closest(".hub-promo-admin__card");
    const alt = String(card?.querySelector("[data-alt]")?.value ?? "").trim();
    err = "";
    info = "";
    try {
      adFormDeskGuide = await api("/api/level1/ad-form-desk-guide/image", {
        method: "PATCH",
        body: JSON.stringify({ slot, alt }),
      });
      info = "Alt szöveg mentve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async deskGuideUpload(_, el) {
    const file = el.files?.[0];
    const slot = el.getAttribute("data-slot");
    if (!file || !slot) return;
    err = "";
    info = "";
    try {
      const alt = String(
        el.closest(".hub-promo-admin__card")?.querySelector("[data-alt]")?.value ?? ""
      ).trim();
      const image = await fileToDataUrl(file);
      adFormDeskGuide = await api("/api/level1/ad-form-desk-guide/upload", {
        method: "POST",
        body: JSON.stringify({ slot, image, alt }),
      });
      info = "Kép feltöltve.";
      el.value = "";
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
  tipusFieldsSelect(_, el) {
    actions.readTipusFieldsFromDom();
    tipusFieldsActive = el.getAttribute("data-tipus") || tipusFieldsActive;
    render();
  },
  readTipusFieldsFromDom() {
    const active = tipusFieldsActive;
    if (!active) return;
    const egyebAll = Boolean(app.querySelector("[data-field=egyeb-all]")?.checked);
    if (active === "egyeb" && egyebAll) {
      tipusFieldsConfig = {
        ...tipusFieldsConfig,
        by_tipus: { ...(tipusFieldsConfig.by_tipus || {}), egyeb: null },
      };
      return;
    }
    const keys = [];
    app.querySelectorAll("[data-tipus-field]:checked").forEach((input) => {
      const key = input.getAttribute("data-tipus-field");
      if (key) keys.push(key);
    });
    tipusFieldsConfig = {
      ...tipusFieldsConfig,
      by_tipus: { ...(tipusFieldsConfig.by_tipus || {}), [active]: keys },
    };
  },
  async saveTipusFields() {
    err = "";
    info = "";
    try {
      actions.readTipusFieldsFromDom();
      const data = await api("/api/level1/ingatlan-tipus-fields", {
        method: "PUT",
        body: JSON.stringify({
          config: {
            version: 1,
            by_tipus: tipusFieldsConfig.by_tipus || {},
          },
        }),
      });
      tipusFieldsConfig = data.config || tipusFieldsConfig;
      info = "Típus → mezők mentve. Az ingatlan oldalon hard refresh kell.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async resetTipusFields() {
    if (!confirm("Visszaállítod a kódbeli alapértelmezett típus→mező listákat?")) return;
    err = "";
    info = "";
    try {
      const data = await api("/api/level1/ingatlan-tipus-fields", {
        method: "PUT",
        body: JSON.stringify({ config: { version: 1, by_tipus: {} } }),
      });
      tipusFieldsConfig = data.config || tipusFieldsConfig;
      tipusFieldsActive = tipusFieldsConfig.parents?.[0]?.value || "lakas";
      info = "Alapértelmezett típus→mező listák visszaállítva.";
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
  readSitePageBlocksFromDom() {
    const leftVideos = [0, 1, 2].map((i) =>
      String(app.querySelector(`[data-side=left][data-video-index="${i}"]`)?.value ?? "").trim()
    );
    const rightVideos = [0, 1, 2].map((i) =>
      String(app.querySelector(`[data-side=right][data-video-index="${i}"]`)?.value ?? "").trim()
    );
    const left = {
      title: String(app.querySelector("[data-side-title=left]")?.value ?? sitePageBlocks.left?.title ?? "").trim(),
      videos: leftVideos,
    };
    const right = {
      title: String(app.querySelector("[data-side-title=right]")?.value ?? sitePageBlocks.right?.title ?? "").trim(),
      videos: rightVideos,
    };
    const payload = { left, right };
    if (sitePageBlocks.center || app.querySelector("[data-center-title]")) {
      payload.center = {
        title: String(app.querySelector("[data-center-title]")?.value ?? sitePageBlocks.center?.title ?? "").trim(),
        html: String(app.querySelector("[data-center-html]")?.value ?? sitePageBlocks.center?.html ?? "").trim(),
      };
    }
    return payload;
  },
  async saveSitePageBlocks() {
    err = "";
    info = "";
    try {
      const { sub } = parseTab();
      const page = pageBlocksKey(sub);
      const payload = actions.readSitePageBlocksFromDom();
      const data = await api("/api/site-blocks", {
        method: "PUT",
        body: JSON.stringify({ page, ...payload }),
      });
      const saved = data.pages?.[page] || payload;
      sitePageBlocks = { page, ...saved };
      info = `Oldalsáv mentve (${page}). Az élő oldalon hard refresh (Cmd+Shift+R) után látszik.`;
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

function visitorsQueryString(extra = {}) {
  const qs = new URLSearchParams();
  if (visitorsTimeRange && visitorsTimeRange !== "all") qs.set("range", visitorsTimeRange);
  if (visitorsTimeRange === "custom") {
    if (visitorsCustomFrom) qs.set("from", visitorsCustomFrom);
    if (visitorsCustomTo) qs.set("to", visitorsCustomTo);
  } else if (visitors?.range?.from && visitorsTimeRange !== "online") {
    /* server resolves named ranges */
  }
  if (extra.ip) qs.set("ip", extra.ip);
  if (visitorsTimeRange && visitorsTimeRange !== "all") {
    // for ip-hits also pass range
  }
  return qs.toString();
}

async function loadVisitors() {
  const qs = visitorsQueryString();
  visitors = await api(`/api/level1/visitors${qs ? `?${qs}` : ""}`);
  blockedIps = visitors.blockedIps || blockedIps;
}

async function loadTab() {
  if (!admin) return;
  const { section, sub } = parseTab();
  if (section === "users") {
    if (sub === "visitors") {
      await loadVisitors();
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
      updatedAt: data.updatedAt || data.menu?.updatedAt,
    };
  }
  if (section === "ingatlan" && sub === "listings") {
    listings = (await api("/api/level1/listings?vertical=ingatlan")).listings;
  }
  if (section === "ingatlan" && sub === "tipus-mezok") {
    const data = await api("/api/level1/ingatlan-tipus-fields/admin");
    tipusFieldsConfig = data.config || { version: 1, by_tipus: {}, catalog: [], parents: [], core: [] };
    const parents = tipusFieldsConfig.parents || [];
    if (!parents.some((p) => p.value === tipusFieldsActive)) {
      tipusFieldsActive = parents[0]?.value || "lakas";
    }
  }
  if (section === "ingatlan" && sub === "partnerek") {
    partnerProfiles = (await api("/api/level1/partner-profiles")).partners || [];
  }
  if (section === "ingatlan" && sub === "preview") {
    layoutCategory = "ingatlan";
    const data = await api(immoWheelApiUrl("ingatlan"));
    wheelSchema = data.schema || { version: 1, cells: [] };
  }
  if (section === "auto" && sub === "desk-guide") {
    adFormDeskGuide = await api("/api/level1/ad-form-desk-guide");
  }
  if (section === "home" && sub === "promo") {
    hubPromo = await api("/api/level1/hub-promo");
  }
  if (section === "mobilweb" && sub === "menu") {
    const data = await api("/api/level1/search-cylinder/admin");
    searchCylinderMenu = data.menu || { version: 1, items: data.items || [] };
    searchCylinderImagePresets = data.imagePresets || [];
  }
  if (section === "pages") {
    const page = pageBlocksKey(sub);
    const data = await api(`/api/site-blocks?page=${encodeURIComponent(page)}`);
    sitePageBlocks = {
      page: data.page || page,
      left: data.left || emptySideBlocks(),
      right: data.right || emptySideBlocks(),
      center: data.center ?? null,
    };
  }
  if (section === "backup") {
    backupList = await api("/api/level1/backups");
    if (!backupSelectedId && backupList.backups?.[0]?.id) {
      backupSelectedId = backupList.backups[0].id;
    }
    if (backupSelectedId && !backupList.backups?.some((b) => b.id === backupSelectedId)) {
      backupSelectedId = backupList.backups?.[0]?.id || "";
      backupPreview = null;
    }
  }
  if (isLayoutTab()) {
    layoutCategory = layoutCategoryFromTab();
    layoutIntent = layoutIntentFromTab();
    syncDeskFuelPreviewFromTab();
    if (isIngatlanWheelLayoutTab()) {
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
  const liveHost = isLiveAdminHost();
  return `
    <div class="wrap">
      <h1>Bocsatech</h1>
      <p class="sub">Admin belépés — jelszó + email kód. 3 hiba után a felhasználónév zárolva.${
        liveHost
          ? ""
          : `<br><small>Localhost (IDEIGLENES): <code>localadmin</code> / <code>localadmin</code> — 2FA nélkül.</small>`
      }</p>
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

function isVisitorOnline(dev) {
  const mins = Number(visitors?.onlineWindowMinutes) || 5;
  const raw = String(dev?.lastSeenAt || "").trim();
  if (!raw) return false;
  const t = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= mins * 60 * 1000;
}

function visitorAvatarLabel(dev) {
  const name = String(dev?.deviceName || "").trim();
  if (name) return name.slice(0, 2).toUpperCase();
  const browser = String(dev?.browser || "").trim();
  if (browser) return browser.slice(0, 2).toUpperCase();
  const ip = String(dev?.ip || "").trim();
  return ip ? ip.slice(-2) : "?";
}

function visitorSortArrow(key) {
  if (visitorsSortKey !== key) return "";
  return visitorsSortDir === "asc" ? " ↑" : " ↓";
}

function devicePeriodHits(dev) {
  return Number(dev?.periodHitCount ?? dev?.hitCount) || 0;
}

function groupVisitorsByIp(devices) {
  const map = new Map();
  for (const dev of devices) {
    const ip = String(dev.ip || "").trim() || "(ismeretlen)";
    if (!map.has(ip)) map.set(ip, []);
    map.get(ip).push(dev);
  }
  return [...map.entries()].map(([ip, list]) => {
    const sortedDevices = [...list].sort((a, b) =>
      String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""))
    );
    const hits = sortedDevices.reduce((s, d) => s + devicePeriodHits(d), 0);
    const lastSeen = sortedDevices.map((d) => d.lastSeenAt).filter(Boolean).sort().at(-1) || "";
    const firstSeen = sortedDevices.map((d) => d.firstSeenAt).filter(Boolean).sort()[0] || "";
    const online = sortedDevices.some(isVisitorOnline);
    const labels = [...new Set(sortedDevices.map((d) => d.deviceName || d.browser || d.os).filter(Boolean))];
    return {
      ip,
      devices: sortedDevices,
      hits,
      lastSeen,
      firstSeen,
      online,
      primary: sortedDevices[0],
      labels,
    };
  });
}

function visitorsView() {
  const d = visitors?.daily || {};
  const w = visitors?.weekly || {};
  const m = visitors?.monthly || {};
  const period = visitors?.period || {};
  const devices = visitors?.devices || [];
  const blocked = blockedIps || visitors?.blockedIps || [];
  const blockedSet = new Set(blocked);
  const q = visitorsSearchQuery.trim().toLowerCase();

  const filtered = devices.filter((dev) => {
    const blockedIp = blockedSet.has(dev.ip);
    if (visitorsStatusFilter === "blocked" && !blockedIp) return false;
    if (!q) return true;
    const hay = [
      dev.ip,
      dev.deviceName,
      dev.deviceLabel,
      dev.browser,
      dev.os,
      dev.deviceType,
      dev.lastPath,
      dev.userId != null ? `#${dev.userId}` : "",
      blockedIp ? "blokk" : "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  let groups = groupVisitorsByIp(filtered);
  const dirMul = visitorsSortDir === "asc" ? 1 : -1;
  groups = [...groups].sort((a, b) => {
    let cmp = 0;
    if (visitorsSortKey === "hits") cmp = a.hits - b.hits;
    else if (visitorsSortKey === "ip") cmp = String(a.ip).localeCompare(String(b.ip), "hu", { numeric: true });
    else if (visitorsSortKey === "firstSeen") cmp = String(a.firstSeen || "").localeCompare(String(b.firstSeen || ""));
    else cmp = String(a.lastSeen || "").localeCompare(String(b.lastSeen || ""));
    if (cmp === 0) cmp = String(a.ip).localeCompare(String(b.ip));
    return cmp * dirMul;
  });

  const selectedGroup = groups.find((g) => g.ip === selectedVisitorIp);
  const selectedDevice =
    (selectedVisitorId && filtered.find((dev) => dev.id === selectedVisitorId)) ||
    (selectedVisitorId && devices.find((dev) => dev.id === selectedVisitorId)) ||
    null;

  const hitsSorted = [...visitorHits].sort((a, b) => {
    const cmp = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    return visitorHitsSortDir === "asc" ? cmp : -cmp;
  });

  const listRows = groups
    .map((group) => {
      const blockedIp = blockedSet.has(group.ip);
      const selectedCls = selectedVisitorIp === group.ip ? " is-selected" : "";
      const expanded = Boolean(visitorsExpandedIps[group.ip]) || selectedVisitorIp === group.ip;
      const status = blockedIp
        ? `<span class="visitors-badge is-block">blokk</span>`
        : group.online
          ? `<span class="visitors-badge is-on">online</span>`
          : `<span class="visitors-badge is-off">idle</span>`;
      const whoSub =
        group.devices.length > 1
          ? `${group.devices.length} eszköz · ${group.labels.slice(0, 3).join(", ")}${group.labels.length > 3 ? "…" : ""}`
          : [group.primary?.deviceName || group.primary?.deviceType, group.primary?.browser, group.primary?.os]
              .filter(Boolean)
              .join(" · ") || "—";
      const geoLine = group.primary?.geoLabel
        ? `<div class="visitors-row__geo">${esc(group.primary.geoLabel)}</div>`
        : group.devices.map((d) => d.geoLabel).find(Boolean)
          ? `<div class="visitors-row__geo">${esc(group.devices.map((d) => d.geoLabel).find(Boolean))}</div>`
          : "";
      const childRows =
        expanded && group.devices.length > 1
          ? group.devices
              .map((dev) => {
                const childSel = selectedVisitorId === dev.id ? " is-selected" : "";
                const childSub = [dev.deviceName || dev.deviceType, dev.browser, dev.os].filter(Boolean).join(" · ") || "—";
                return `<article class="visitors-row visitors-row--child${childSel}" data-act="selectVisitor" data-id="${esc(dev.id)}" role="button" tabindex="0">
                  <div class="visitors-row__avatar visitors-row__avatar--sm" aria-hidden="true">${esc(visitorAvatarLabel(dev))}</div>
                  <div class="visitors-row__who">
                    <div class="visitors-row__ip">${esc(childSub)}${dev.userId ? ` <span class="visitors-row__uid">#${esc(dev.userId)}</span>` : ""}</div>
                    <div class="visitors-row__sub">${esc(fmtWhen(dev.lastSeenAt))}</div>
                  </div>
                  <span class="visitors-row__hits" title="Időszak találatok">${devicePeriodHits(dev)}</span>
                </article>`;
              })
              .join("")
          : "";
      const expandBtn =
        group.devices.length > 1
          ? `<button type="button" class="visitors-expand" data-act="toggleVisitorIpGroup" data-ip="${esc(group.ip)}" title="Eszközök">${expanded ? "▾" : "▸"} ${group.devices.length}</button>`
          : "";
      return `<div class="visitors-group">
        <article class="visitors-row${selectedCls}" data-act="selectVisitorIp" data-ip="${esc(group.ip)}" role="button" tabindex="0">
          <div class="visitors-row__avatar" aria-hidden="true">${esc(visitorAvatarLabel(group.primary))}</div>
          <div class="visitors-row__who">
            <div class="visitors-row__ip">${esc(group.ip)} ${expandBtn}</div>
            <div class="visitors-row__sub">${esc(whoSub)}</div>
            ${geoLine}
          </div>
          ${status}
          <span class="visitors-row__hits" title="Időszak találatok">${group.hits}</span>
        </article>
        ${childRows}
      </div>`;
    })
    .join("");

  const hitItems = hitsSorted
    .map(
      (hit) => `<div class="visitors-hit">
        <span class="visitors-hit__path" title="${esc(hit.pageTitle || hit.path)}">${esc(hit.path || "—")}${hit.kind === "session" ? ' <em class="visitors-hit__tag">session</em>' : ""}</span>
        <span class="visitors-hit__time">${esc(fmtWhen(hit.createdAt))}</span>
      </div>`
    )
    .join("");

  const hitsHint =
    visitorHitsSource === "sessions"
      ? `<p class="visitors-detail__hint">Részletes oldallista eddig hiányzott (naplóhiba). Mostantól újra gyűlik. Alább a session utolsó oldalai / aktivitás.</p>`
      : "";
  const hitsEmpty = `<p class="visitors-detail__empty">Nincs rögzített aktivitás ehhez az IP-hez ebben az időszakban.</p>`;

  const detailLabel = selectedDevice
    ? `${selectedDevice.ip || "—"} · ${selectedDevice.deviceName || selectedDevice.browser || "eszköz"}`
    : selectedVisitorIp || "";

  let detailBody = `<p class="visitors-detail__empty">Válassz egy IP-t a listából — megjelennek az oldalmegtekintések az adott időszakban.</p>`;
  if (selectedVisitorIp || selectedVisitorId) {
    const blockIp = selectedDevice?.ip || selectedVisitorIp;
    const blockBtn =
      blockIp && blockIp !== "(ismeretlen)"
        ? blockedSet.has(blockIp)
          ? `<button class="users-card__btn" type="button" data-act="unblockVisitorIp" data-ip="${esc(blockIp)}">IP felold</button>`
          : `<button class="users-card__btn users-card__btn--danger" type="button" data-act="blockVisitorIp" data-ip="${esc(blockIp)}">IP blokkol</button>`
        : "";
    const metaSource = selectedDevice || selectedGroup?.primary;
    detailBody = `
      <div class="visitors-detail__head">
        <h4>Oldalak — ${esc(detailLabel)}</h4>
        <button type="button" class="visitors-sort-btn" data-act="visitorHitsSort">
          Idő${visitorHitsSortDir === "asc" ? " ↑" : " ↓"}
        </button>
      </div>
      <div class="visitors-detail__meta">
        <span>Eszközök: ${selectedGroup?.devices?.length || (selectedDevice ? 1 : 0)}</span>
        <span>${esc((selectedDevice || selectedGroup?.primary)?.geoLabel || "hely: —")}</span>
        <span>Első: ${esc(fmtWhen(selectedGroup?.firstSeen || metaSource?.firstSeenAt))}</span>
        <span>Utolsó: ${esc(fmtWhen(selectedGroup?.lastSeen || metaSource?.lastSeenAt))}</span>
      </div>
      <div class="visitors-hits">
        ${hitsHint}
        ${hitItems || hitsEmpty}
      </div>
      <div class="visitors-detail__actions">
        <button class="users-card__btn users-card__btn--primary" type="button" data-act="refreshVisitors">Frissítés</button>
        ${blockBtn}
        <button class="users-card__btn" type="button" data-act="selectVisitorIp" data-ip="${esc(selectedVisitorIp || blockIp || "")}">Bezár</button>
      </div>`;
  }

  const timeChips = [
    ["all", "Összes"],
    ["online", "Jelenleg"],
    ["today", "Ma"],
    ["yesterday", "Tegnap"],
    ["week", "Héten"],
    ["lastweek", "Előző héten"],
    ["month", "Ebben a hónapban"],
    ["custom", "Intervallum"],
  ]
    .map(
      ([key, label]) =>
        `<button type="button" class="users-cards-chip ${visitorsTimeRange === key ? "on" : ""}" data-act="visitorsTimeRange" data-range="${key}">${label}</button>`
    )
    .join("");

  const customBox =
    visitorsTimeRange === "custom"
      ? `<div class="visitors-custom-range">
          <label>Tól<input type="datetime-local" data-act="visitorsCustomFrom" data-live value="${esc(visitorsCustomFrom)}" /></label>
          <label>Ig<input type="datetime-local" data-act="visitorsCustomTo" data-live value="${esc(visitorsCustomTo)}" /></label>
          <button type="button" class="users-card__btn users-card__btn--primary" data-act="applyVisitorsCustomRange">Szűrés</button>
        </div>`
      : "";

  const rangeLabel = visitors?.range?.label || "Összes";
  const periodHits = period.hits ?? 0;
  const periodUnique = period.unique ?? groups.length;

  return `
    <div class="users-cards-wrap visitors-wrap">
      ${visitors?.warning ? `<p class="err">Figyelem: ${esc(visitors.warning)}</p>` : ""}
      ${info ? `<p class="ok">${esc(info)}</p>` : ""}
      ${err ? `<p class="err">${esc(err)}</p>` : ""}
      <div class="users-cards-head">
        <h2 class="users-cards-title">Látogatók</h2>
        <div class="users-cards-toolbar">
          <label class="users-cards-search">
            <span class="users-cards-search__ico" aria-hidden="true">⌕</span>
            <input type="search" data-act="visitorsSearch" data-live placeholder="Keresés IP / eszköz / oldal…" value="${esc(visitorsSearchQuery)}" />
          </label>
          <div class="users-cards-filters" role="group" aria-label="Státusz">
            <button type="button" class="users-cards-chip ${visitorsStatusFilter === "all" ? "on" : ""}" data-act="visitorsStatusFilter" data-filter="all">Mind</button>
            <button type="button" class="users-cards-chip ${visitorsStatusFilter === "blocked" ? "on" : ""}" data-act="visitorsStatusFilter" data-filter="blocked">Blokkolt</button>
          </div>
        </div>
        <div class="users-cards-filters visitors-time-filters" role="group" aria-label="Forgalom időszak">
          ${timeChips}
        </div>
        ${customBox}
        <div class="visitors-sortbar" role="group" aria-label="Rendezés">
          <span class="visitors-sortbar__label">Rendezés:</span>
          <button type="button" class="visitors-sort-btn ${visitorsSortKey === "lastSeen" ? "on" : ""}" data-act="visitorsSort" data-sort="lastSeen">Utolsó${visitorSortArrow("lastSeen")}</button>
          <button type="button" class="visitors-sort-btn ${visitorsSortKey === "hits" ? "on" : ""}" data-act="visitorsSort" data-sort="hits">Találat${visitorSortArrow("hits")}</button>
          <button type="button" class="visitors-sort-btn ${visitorsSortKey === "ip" ? "on" : ""}" data-act="visitorsSort" data-sort="ip">IP${visitorSortArrow("ip")}</button>
          <button type="button" class="visitors-sort-btn ${visitorsSortKey === "firstSeen" ? "on" : ""}" data-act="visitorsSort" data-sort="firstSeen">Első${visitorSortArrow("firstSeen")}</button>
          <button type="button" class="users-card__btn" data-act="refreshVisitors" style="margin-left:auto">Frissítés</button>
          ${visitors?.schemaMissing ? `<button type="button" class="users-card__btn users-card__btn--primary" data-act="initVisitorSchema">Séma telepítése</button>` : ""}
        </div>
      </div>
      <div class="visitors-stats">
        <div class="visitors-stat"><div class="l">Időszak</div><div class="v" style="font-size:1rem">${esc(rangeLabel)}</div><div class="s">${periodUnique} · ${periodHits} találat</div></div>
        <div class="visitors-stat"><div class="l">Jelenleg</div><div class="v">${visitors?.online ?? 0}</div><div class="s">aktív · ${visitors?.onlineWindowMinutes || 15} perc</div></div>
        <div class="visitors-stat"><div class="l">Ma</div><div class="v">${d.unique ?? 0}</div><div class="s">${d.hits ?? 0} megtekintés</div></div>
        <div class="visitors-stat"><div class="l">Hét / hó</div><div class="v">${w.unique ?? 0}</div><div class="s">hó: ${m.unique ?? 0} unique</div></div>
      </div>
      <div class="visitors-split">
        <div class="visitors-list">
          ${listRows || `<p class="users-cards-empty">Nincs forgalom${q || visitorsStatusFilter !== "all" || visitorsTimeRange !== "all" ? " a szűrővel" : ""}.</p>`}
        </div>
        <aside class="visitors-detail">${detailBody}</aside>
      </div>
      ${
        blocked.length
          ? `<p class="visitors-blocked-note"><strong>Blokkolt IP:</strong> ${blocked.map((ip) => esc(ip)).join(", ")}</p>`
          : ""
      }
    </div>`;
}


function userInitials(user) {
  const name = String(user?.displayName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const email = String(user?.email || "").trim();
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

function usersView(kind = "private") {
  const filtered = users.filter((u) => (u.accountType || "private") === kind);
  const q = usersSearchQuery.trim().toLowerCase();
  const visible = filtered.filter((u) => {
    if (usersStatusFilter === "active" && !u.emailVerified) return false;
    if (usersStatusFilter === "inactive" && u.emailVerified) return false;
    if (!q) return true;
    const hay = `${u.email || ""} ${u.displayName || ""}`.toLowerCase();
    return hay.includes(q);
  });
  const cards = visible
    .map((u) => {
      const active = Boolean(u.emailVerified);
      const ads = Number(u.listingCount ?? 0) || 0;
      return `<article class="users-card">
        <div class="users-card__main">
          <div class="users-card__avatar" aria-hidden="true">${esc(userInitials(u))}</div>
          <div class="users-card__who">
            <div class="users-card__email">${esc(u.email)}</div>
            <div class="users-card__name">${esc(u.displayName || "—")}</div>
          </div>
          <span class="users-card__status ${active ? "is-on" : "is-off"}">${active ? "aktív" : "inaktív"}</span>
          <div class="users-card__meta">
            <span>Reg: ${esc(fmtWhen(u.createdAt))}</span>
            <span>Ut: ${esc(fmtWhen(u.lastLoginAt))}</span>
          </div>
          <span class="users-card__ads" title="Hirdetések">${ads}</span>
        </div>
        <div class="users-card__actions">
          <button class="users-card__btn users-card__btn--primary" type="button" data-act="editUser" data-id="${u.id}">Kezelés</button>
          <button class="users-card__btn" type="button" data-act="toggleUserActive" data-id="${u.id}" data-active="${active ? "1" : "0"}">${active ? "Deaktivál" : "Aktivál"}</button>
          <button class="users-card__btn" type="button" data-act="delUser" data-id="${u.id}">Törlés</button>
        </div>
      </article>`;
    })
    .join("");
  const editor = editingUser ? userEditView() : "";
  const messages = `
    ${info ? `<p class="ok">${esc(info)}</p>` : ""}
    ${err ? `<p class="err">${esc(err)}</p>` : ""}
  `;
  const title = kind === "business" ? "Céges fiókok" : "Privát fiókok";
  const emptyLabel = kind === "business" ? "céges" : "privát";
  const createForm = `
    <form class="users-create" data-act="createUser">
      <h3 class="users-create__title">Új ${emptyLabel} fiók (teszt)</h3>
      <p class="users-create__hint">Azonnal aktív. Ha csak nevet adsz (pl. <code>teszt01</code>), email: <code>teszt01@test.bymy.hu</code>. Jelszó min. 12 karakter. Település megadásával feladott teszt-hirdetés is készül (térkép).</p>
      <div class="users-create__grid">
        <label>Felhasználónév / email<input name="email" required placeholder="teszt01 vagy teszt01@test.bymy.hu" autocomplete="off" /></label>
        <label>Megjelenített név<input name="displayName" placeholder="Teszt Elek" maxlength="40" /></label>
        <label>Jelszó (min. 12)<input name="password" type="password" required minlength="12" placeholder="tesztjelszo12" autocomplete="new-password" /></label>
        <label>Hirdetés címe<input name="listingTitle" placeholder="BMW 320d teszt" /></label>
        <label>Település (térkép)<input name="listingTelepules" placeholder="Budapest" /></label>
        <label>Gyártmány<input name="listingGyartmany" placeholder="BMW" /></label>
        <label>Modell<input name="listingModell" placeholder="320d" /></label>
        <label>Ár<input name="listingPrice" placeholder="4 900 000 Ft" /></label>
      </div>
      <button type="submit" class="users-card__btn users-card__btn--primary">Fiók létrehozása</button>
    </form>`;
  return `
    <div class="users-edit">
      ${messages}
      ${createForm}
      <div class="users-cards-wrap">
        <div class="users-cards-head">
          <h2 class="users-cards-title">${esc(title)}</h2>
          <div class="users-cards-toolbar">
            <label class="users-cards-search">
              <span class="users-cards-search__ico" aria-hidden="true">⌕</span>
              <input type="search" data-act="usersSearch" data-live placeholder="Keresés…" value="${esc(usersSearchQuery)}" />
            </label>
            <div class="users-cards-filters" role="group" aria-label="Státusz szűrő">
              <button type="button" class="users-cards-chip ${usersStatusFilter === "all" ? "on" : ""}" data-act="usersStatusFilter" data-filter="all">Összes</button>
              <button type="button" class="users-cards-chip ${usersStatusFilter === "active" ? "on" : ""}" data-act="usersStatusFilter" data-filter="active">Aktív</button>
              <button type="button" class="users-cards-chip ${usersStatusFilter === "inactive" ? "on" : ""}" data-act="usersStatusFilter" data-filter="inactive">Inaktív</button>
            </div>
          </div>
        </div>
        <div class="users-cards-list">
          ${cards || `<p class="users-cards-empty">Nincs ${emptyLabel} user${q || usersStatusFilter !== "all" ? " a szűrővel" : ""}.</p>`}
        </div>
      </div>
      ${editor}
    </div>`;
}

const PROFILE_FIELD_SKIP = new Set([
  "avatarDataUrl",
  "companyLogoDataUrl",
  "pageLayout",
]);

function shouldSkipProfileField(key, value) {
  if (PROFILE_FIELD_SKIP.has(key)) return true;
  if (/dataurl|base64|logo/i.test(key) && typeof value === "string" && value.length > 500) return true;
  return false;
}

function formatProfileFieldValue(value) {
  if (value == null) return "";
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
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
    companyActivities: "Cég tevékenysége",
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
  const extra = Object.keys(profile).filter(
    (k) => !keys.includes(k) && !shouldSkipProfileField(k, profile[k])
  );
  return [...keys, ...extra]
    .filter((key) => !shouldSkipProfileField(key, profile[key]))
    .map((key) => {
      const label = labels[key] || key;
      const value = formatProfileFieldValue(profile[key]);
      return { key, label, value };
    });
}

function userEditView() {
  const profile = editingUser.profileJson ?? {};
  const fields = profileFields(profile);
  const profileFieldSize = (key) => {
    if (
      /postal|zip|salutation|tax|adó|radius|km$/i.test(key) ||
      ["postalCode", "companyPostalCode", "companyTaxId", "searchRadiusKm", "recommendationsRadiusKm", "salutation"].includes(key)
    ) {
      return "sm";
    }
    if (
      /phone|telefon|country|ország|city|város|település|firstName|lastName|accountType/i.test(key) ||
      [
        "phone",
        "companyPhone",
        "companyPhone2",
        "country",
        "companyCountry",
        "city",
        "companyCity",
        "firstName",
        "lastName",
        "accountType",
        "salespersonName",
        "salespersonName2",
      ].includes(key)
    ) {
      return "md";
    }
    if (
      ["companyAddress", "street", "companyStreet", "companyEmail", "companyEmail2", "companyActivities", "company", "email"].includes(key) ||
      /address|street|email|activities|cégnév|company$/i.test(key)
    ) {
      return "wide";
    }
    return "md";
  };
  const fieldRows = fields
    .map((f) => {
      const size = profileFieldSize(f.key);
      return `
      <label class="user-edit__field user-edit__field--${size}">
        <span class="user-edit__label">${esc(f.label)}</span>
        ${
          f.key === "accountType"
            ? `<select class="edit-profile-field" data-key="accountType">
                <option value="private" ${String(f.value) === "private" ? "selected" : ""}>magán</option>
                <option value="business" ${String(f.value) === "business" ? "selected" : ""}>céges</option>
              </select>`
            : `<input class="edit-profile-field" data-key="${esc(f.key)}" type="text" value="${esc(f.value)}" />`
        }
      </label>`;
    })
    .join("");

  const ads = Number(editingUser.listingCount ?? (editingUser.listings || []).length) || 0;
  const active = Boolean(editingUser.emailVerified);
  const listingRows = (editingUser.listings || [])
    .map(
      (l) => `<article class="user-edit__listing">
        <div class="user-edit__listing-main">
          <span class="user-edit__listing-id">#${l.id}</span>
          <div class="user-edit__listing-who">
            <div class="user-edit__listing-title">${esc(l.title || "—")}</div>
            <div class="user-edit__listing-meta">${esc(fmtWhen(l.updatedAt))}</div>
          </div>
          <label class="user-edit__listing-status">
            <select data-act="setUserListingStatus" data-id="${l.id}">
              ${["mentett", "feladott", "inaktiv"]
                .map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </label>
        </div>
        <div class="user-edit__listing-actions">
          <a class="users-card__btn" href="/hirdetes.html?id=${l.id}" target="_blank" rel="noreferrer">Nyit</a>
          <a class="users-card__btn" href="/hirdetesfeladas.html?id=${l.id}" target="_blank" rel="noreferrer">Szerk.</a>
          <button class="users-card__btn users-card__btn--danger" type="button" data-act="delUserListing" data-id="${l.id}">Törlés</button>
        </div>
      </article>`
    )
    .join("");

  return `
    <div class="user-edit users-cards-wrap">
      <div class="user-edit__head">
        <div class="user-edit__head-main">
          <div class="users-card__avatar" aria-hidden="true">${esc(userInitials(editingUser))}</div>
          <div>
            <h2 class="users-cards-title">Felhasználó kezelése <span class="user-edit__id">#${esc(editingUser.id)}</span></h2>
            <p class="user-edit__meta">
              <span>Reg: ${esc(fmtWhen(editingUser.createdAt))}</span>
              <span>Ut: ${esc(fmtWhen(editingUser.lastLoginAt))}</span>
            </p>
          </div>
        </div>
        <div class="user-edit__head-badges">
          <span class="users-card__status ${active ? "is-on" : "is-off"}">${active ? "aktív" : "inaktív"}</span>
          <span class="users-card__ads" title="Hirdetések">${ads}</span>
        </div>
      </div>

      <section class="user-edit__card">
        <h3 class="user-edit__section-title">Fiók</h3>
        <div class="user-edit__core">
          <label class="user-edit__field user-edit__field--wide">
            <span class="user-edit__label">Email</span>
            <input id="edit-email" type="email" value="${esc(editingUser.email || "")}" />
          </label>
          <label class="user-edit__field">
            <span class="user-edit__label">Megjelenített név</span>
            <input id="edit-displayName" type="text" value="${esc(editingUser.displayName || "")}" />
          </label>
          <label class="user-edit__field user-edit__field--check">
            <input id="edit-emailVerified" type="checkbox" ${editingUser.emailVerified ? "checked" : ""} />
            <span>Email aktivált</span>
          </label>
        </div>
      </section>

      <section class="user-edit__card">
        <h3 class="user-edit__section-title">Profil mezők</h3>
        <div class="user-edit__profile-fields">${fieldRows || `<p class="users-cards-empty">Nincs profilmező.</p>`}</div>
      </section>

      <section class="user-edit__card">
        <h3 class="user-edit__section-title">Hirdetései <small>(${ads})</small></h3>
        <div class="user-edit__listings">
          ${listingRows || `<p class="users-cards-empty">Nincs hirdetése.</p>`}
        </div>
      </section>

      <div class="user-edit__actions">
        <button class="users-card__btn users-card__btn--primary" type="button" data-act="saveUser">Mentés</button>
        <button class="users-card__btn" type="button" data-act="toggleUserActive" data-id="${editingUser.id}" data-active="${editingUser.emailVerified ? "1" : "0"}">${editingUser.emailVerified ? "Deaktivál" : "Aktivál"}</button>
        <button class="users-card__btn" type="button" data-act="cancelEditUser">Mégse</button>
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

function listingOwnerHtml(l) {
  const email = l.ownerEmail || (l.ownerUserId ? `#${l.ownerUserId}` : "");
  if (!email) return "—";
  const type = String(l.ownerAccountType || "").toLowerCase();
  const isBusiness = type === "business";
  const isPrivate = type === "private" || (!type && Boolean(email));
  const badge = isBusiness
    ? `<span class="badge account-business">céges</span>`
    : isPrivate
      ? `<span class="badge account-private">magán</span>`
      : "";
  return `<span class="owner-cell"><span class="owner-cell__email">${esc(email)}</span>${badge}</span>`;
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
        <td>${listingOwnerHtml(l)}</td>
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
    <h2 class="layout-cat-title">Ingatlan megjelenés</h2>
    <p class="hint">A mezők elrendezését a <strong>szerkesztő</strong> füleken lehet húzni és menteni.</p>
    <div class="row" style="gap:0.65rem;flex-wrap:wrap;margin-top:0.75rem">
      <button type="button" class="btn" data-act="setTab" data-tab="ingatlan:layout:elado-ingatlan">Eladó szerkesztő</button>
      <button type="button" class="btn ghost" data-act="setTab" data-tab="ingatlan:layout:ingatlan">Kiadó szerkesztő</button>
      <button type="button" class="btn ghost" data-act="setTab" data-tab="ingatlan:layout:airbnb">Airbnb szerkesztő</button>
    </div>`;
}

function adFormDeskGuideView() {
  const images = adFormDeskGuide?.images || [];
  const cards = images
    .map((item) => {
      const hasImage = Boolean(String(item.url || "").trim());
      return `<div class="hub-promo-admin__card">
        <h3 class="admin-section-title">${esc(item.label || item.slot)}</h3>
        <div class="hub-promo-admin__thumb ad-desk-guide-admin__thumb">
          ${
            hasImage
              ? `<img src="${esc(item.url)}" alt="" />`
              : `<div class="ad-desk-guide-admin__placeholder">1300×492 px · nincs kép</div>`
          }
        </div>
        <label>
          <div>Alt szöveg</div>
          <input type="text" data-alt value="${esc(item.alt || item.label || "")}" />
        </label>
        <div class="row-actions">
          ${
            hasImage
              ? `<button type="button" class="btn ghost" data-act="deskGuideSaveAlt" data-slot="${esc(item.slot)}">Alt mentése</button>
          <button type="button" class="btn danger" data-act="deskGuideDelete" data-slot="${esc(item.slot)}">Törlés</button>`
              : ""
          }
          <label class="btn ghost hub-promo-admin__upload">${hasImage ? "Csere" : "Feltöltés"} (JPG/PNG/WebP)
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-act="deskGuideUpload" data-slot="${esc(item.slot)}" />
          </label>
        </div>
      </div>`;
    })
    .join("");

  return `
    <h2 class="layout-cat-title">Személyautó hirdetésfeladás — középső képek</h2>
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <p class="hint"><strong>5 szekció, 1 kép mindegyikhez.</strong> Ajánlott méret: <strong>1300 × 492 px</strong> (JPG/PNG/WebP, max 6 MB) — ez pontosan illeszkedik a kerethez, nincs fehér sáv és nincs torzítás. A lényeg legyen középen. Szekciók: Alap, Műszaki, Extrák, Hirdetés, Képek.</p>
    <div class="hub-promo-admin__grid">${cards}</div>`;
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

function tipusFieldsView() {
  const parents = tipusFieldsConfig.parents || [];
  const catalog = tipusFieldsConfig.catalog || [];
  const active = tipusFieldsActive || parents[0]?.value || "lakas";
  const selected = tipusFieldsConfig.by_tipus?.[active];
  const egyebAll = active === "egyeb" && selected == null;
  const selectedSet = new Set(Array.isArray(selected) ? selected : []);

  const parentBtns = parents
    .map(
      (p) =>
        `<button type="button" class="tipus-fields-parent ${p.value === active ? "on" : ""}" data-act="tipusFieldsSelect" data-tipus="${esc(p.value)}">${esc(p.label)}</button>`
    )
    .join("");

  const groups = [
    { id: "lista", title: "Listák / választók" },
    { id: "tartomany", title: "Tartományok" },
    { id: "igen_van", title: "Igen / van szűrők" },
  ];

  const grids = groups
    .map((g) => {
      const items = catalog.filter((c) => c.group === g.id);
      if (!items.length) return "";
      const checks = items
        .map((c) => {
          const on = !egyebAll && selectedSet.has(c.field_key);
          return `<label class="tipus-fields-check ${on ? "is-on" : ""}">
            <input type="checkbox" data-tipus-field="${esc(c.field_key)}" ${on ? "checked" : ""} ${egyebAll ? "disabled" : ""} />
            <span>${esc(c.label)}</span>
            <code>${esc(c.field_key)}</code>
          </label>`;
        })
        .join("");
      return `<section class="tipus-fields-group">
        <h3>${esc(g.title)}</h3>
        <div class="tipus-fields-grid">${checks}</div>
      </section>`;
    })
    .join("");

  const egyebRow =
    active === "egyeb"
      ? `<label class="tipus-fields-egyeb">
          <input type="checkbox" data-field="egyeb-all" data-act="tipusFieldsSelect" data-tipus="egyeb" ${egyebAll ? "checked" : ""} />
          Összes típusmező (unió) — ha be van pipálva, a lista alább nem számít
        </label>`
      : "";

  const coreHint = (tipusFieldsConfig.core || [])
    .map((k) => `<code>${esc(k)}</code>`)
    .join(" ");

  return `
    <h2 class="layout-cat-title">Típus → mezők</h2>
    <p class="hint">Válaszd a típust, pipáld a megjelenő mezőket. A közös mezők (hely, ár, szoba, típus, típus 2) mindig látszanak; a területmezők típus szerint. Mentés után hard refresh az ingatlan oldalon.</p>
    <p class="hint">Mindig látszik: ${coreHint || "—"}</p>
    <p class="hint"><a class="btn ghost" href="/data/ingatlan-tipus-menuk.csv" download="ingatlan-tipus-menuk.csv">Összes típus → menü CSV letöltése</a></p>
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <div class="tipus-fields-parents">${parentBtns}</div>
    ${egyebRow}
    <div class="tipus-fields-body">${grids}</div>
    <div class="row" style="margin-top:1rem;gap:0.65rem;flex-wrap:wrap">
      <button class="btn" type="button" data-act="saveTipusFields">Mentés</button>
      <button class="btn ghost" type="button" data-act="resetTipusFields">Alapértelmezés</button>
    </div>`;
}

function vehicleDeskPostingLayoutView(cat, label, sharedHint) {
  const previewHref = vehiclePostingPreviewHref(cat);
  const isMaster = cat === DESK_POSTING_LAYOUT_MASTER;
  const inheritNotice = isMaster
    ? `<p class="hint">Ez a <strong>master</strong> elrendezés — a live desk feladás (személyautó, leasing, bérautó, teher…) innen örökli a mezősorrendet. A szerkesztő ugyanazt az accordion menüt mutatja, mint a <a href="${esc(previewHref)}" target="_blank" rel="noopener">hirdetésfeladás</a> oldal (Alap / Műszaki / Extrák / Hirdetés + képek középen).</p>`
    : `<p class="hint">A mezőelrendezés és desk megjelenés a <strong>Személyautó feladás</strong> masterből jön (ugyanaz a 3 oszlopos desk, accordion menü, kép+leírás középen).</p>
       <p class="hint">Szerkesztés: Autók → Személyautó feladás. Itt csak előnézet.</p>
       <p><a class="btn" href="${esc(previewHref)}" target="_blank" rel="noopener">Live desk előnézet — ${esc(label)}</a></p>`;
  const fuelPreviewToolbar = isMaster
    ? `<div class="layout-desk-fuel-preview" role="group" aria-label="Üzemanyag-előnézet">
        ${DESK_FUEL_PREVIEW_PROFILES.map(
          ({ id, label: btnLabel }) =>
            `<button type="button" class="btn${deskFuelPreviewProfile === id ? "" : " ghost"}" data-act="setDeskFuelPreview" data-fuel-preview="${esc(id)}">${esc(btnLabel)}</button>`
        ).join("")}
      </div>
      <p class="hint layout-desk-fuel-preview-hint">Előnézet: mely mezők látszanak élőben az adott üzemanyagnál. A <strong>Gumi méretek</strong> és <strong>Elektromos / hibrid mezők</strong> csempéi mindig a bal oldali <strong>Műszaki adatok</strong> accordionban szerkeszthetők (húzás, sorrend).</p>`
    : "";
  const editorBlock = isMaster
    ? `${fuelPreviewToolbar}<div id="layout-root"></div>
       <div class="row" style="margin-top:1rem"><button class="btn" type="button" data-act="saveLayout">Elrendezés mentése</button></div>`
    : "";
  return `
    <h2 class="layout-cat-title">${esc(label)} — feladási mezők (desk)</h2>
    ${inheritNotice}
    <p class="hint">${esc(sharedHint)}</p>
    ${editorBlock}
    <p class="ok">${info}</p>
    <p class="err">${err}</p>`;
}

function layoutView() {
  const cat = layoutCategoryFromTab();
  const isImmoWizard = isIngatlanWizardLayoutTab();
  const navItem = layoutNavItemForTab();
  const label = isImmoWizard ? "Ingatlan feladás" : navItem?.label || categoryLabel(cat);
  const isImmo = isIngatlanWheelLayoutTab();
  const isSearch = isSearchLayoutCat(cat);
  const sharedHint = isImmo
    ? cat === "ingatlan"
      ? "Húzd a mezőket; −/+ szélesség; × törlés. Mentés: „Elrendezés mentése”. Közös séma a keresőre és feladásra (Kiadó — master)."
      : "Húzd a mezőket; −/+ szélesség; × törlés. Mentés csak erre a gombra — a Kiadó elrendezése nem változik."
    : isSearch
      ? cat === "teherauto-search"
        ? "Teherautó gyorskereső + Több szűrő mezői (3,5 t-ig és 3,5 t-tól közös nézet). 1. lépés = hero, 2 = műszaki, 3 = Akkumulátor és hatótáv (Extrák felett), 4 = Extrák, 5 = helyszín. Mentés után hard refresh."
        : "Személyautó gyorskereső + Több szűrő. 1 = gyorskereső, 2 = műszaki, 3 = Akkumulátor és hatótáv adatok (Extrák felett — üres rács, Törölt mezőkből rakd vissza), 4 = Extrák, 5 = helyszín. Szélesség / pozíció mint a többi. Mentés után az autó oldalon hard refresh."
      : isImmoWizard
        ? "Az ingatlanfeladás kerék-panelen kívüli mezői. Húzd a cellát a lapon belül vagy másik lépésre; az ár, leírás, képek és helyszín elrendezése itt kezelhető."
        : isVehiclePostingLayoutCat(cat)
          ? "3 oszlop mint a live desk: bal accordion és közép képek/leírás — húzd a mezőket, jobb szélén a szélesség. Mentés után hard refresh a feladáson."
          : "Csak ennek a kategóriának a mezői. Húzd a cellát a lapon belül vagy másik lépésre. Mentés után a hirdetésfeladáson hard refresh kell.";
  if (isVehiclePostingLayoutCat(cat)) {
    return vehicleDeskPostingLayoutView(cat, label, sharedHint);
  }
  const titleSuffix = isImmo
    ? "kerék-séma"
    : isSearch
      ? "kereső mezők"
      : "feladási mezők";
  return `
    <h2 class="layout-cat-title">${esc(label)} — ${titleSuffix}</h2>
    <p class="hint">${esc(sharedHint)}</p>
    <div id="layout-root"></div>
    <p class="ok">${info}</p>
    <p class="err">${err}</p>
    <div class="row" style="margin-top:1rem"><button class="btn" type="button" data-act="saveLayout">Elrendezés mentése</button></div>`;
}

function partnerProfilesView() {
  const statusLabel = {
    pending: '<span class="badge warn">jóváhagyásra vár</span>',
    approved: '<span class="badge ok">jóváhagyva</span>',
    rejected: '<span class="badge">elutasítva</span>',
  };
  const rows = partnerProfiles
    .map((partner) => {
      const status = partner.application_status || "pending";
      const profileHref = `/partner/${encodeURIComponent(partner.slug || "")}`;
      return `<tr>
        <td>#${partner.user_id}</td>
        <td><strong>${esc(partner.display_name)}</strong><br><small>${esc(partner.slug)}</small></td>
        <td>${esc(partner.contact_person || "—")}<br><small>${esc(partner.email || "")}</small></td>
        <td>${esc(partner.service_areas || "—")}</td>
        <td>${statusLabel[status] || esc(status)}</td>
        <td>${esc(fmtWhen(partner.created_at))}</td>
        <td class="row-actions">
          ${status === "approved" ? `<a href="${profileHref}" target="_blank" rel="noopener">profil</a>` : ""}
          ${status !== "approved" ? `<button class="btn" type="button" data-act="reviewPartner" data-id="${partner.user_id}" data-status="approved">Jóváhagyás</button>` : `<button class="btn ghost" type="button" data-act="reviewPartner" data-id="${partner.user_id}" data-status="pending">Visszavonás</button>`}
          ${status !== "rejected" ? `<button class="btn danger" type="button" data-act="reviewPartner" data-id="${partner.user_id}" data-status="rejected">Elutasítás</button>` : ""}
        </td>
      </tr>`;
    })
    .join("");
  return `
    ${info ? `<p class="ok">${esc(info)}</p>` : ""}
    ${err ? `<p class="err">${esc(err)}</p>` : ""}
    <p class="hint"><strong>Ingatlanos partnerek</strong> — a jelentkezők ellenőrzése és publikus partnerjelvény kezelése.</p>
    <div class="table-scroll">
      <table class="table-dense">
        <thead><tr><th>Felhasználó</th><th>Partner</th><th>Kapcsolat</th><th>Terület</th><th>Státusz</th><th>Jelentkezés</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">Még nincs partnerjelentkezés.</td></tr>'}</tbody>
      </table>
    </div>`;
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
    if (sub === "desk-guide") return adFormDeskGuideView();
    if (sub === "kivitel") return kivitelMenuView();
    if (sub === "akku") return akkuSearchMenuView();
    return layoutView();
  }
  if (section === "ingatlan") {
    if (sub === "listings") {
      return listingsView({ title: "Ingatlanhirdetések", emptyHint: "Nincs ingatlan hirdetés." });
    }
    if (sub === "tipus-mezok") return tipusFieldsView();
    if (sub === "partnerek") return partnerProfilesView();
    if (sub === "preview") return ingatlanPreviewView();
    return layoutView();
  }
  if (section === "home") return hubPromoView();
  if (section === "mobilweb") return searchCylinderMenuView();
  if (section === "pages") return pagesAdminView(sub);
  if (section === "backup") return backupView();
  return usersView("private");
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function backupCategoryFromListing(row) {
  const vertical = String(row?.vertical || "").trim().toLowerCase();
  const subtype = String(row?.subtype || "").trim().toLowerCase();
  if (vertical === "ingatlan") return "ingatlan";
  if (vertical === "teher" || subtype === "teherauto" || subtype === "kisteher") return "teherauto";
  if (subtype === "leasing") return "leasing";
  if (vertical === "auto" || subtype === "szemelyauto" || !subtype) return "szemelyauto";
  return "all";
}

function backupView() {
  const cats = backupList.categories?.length
    ? backupList.categories
    : [
        { id: "all", label: "Összes" },
        { id: "szemelyauto", label: "Személyautók" },
        { id: "leasing", label: "Leasing" },
        { id: "teherauto", label: "Teherautók" },
        { id: "ingatlan", label: "Ingatlanok" },
      ];
  const backups = backupList.backups || [];
  const options = backups
    .map(
      (b) =>
        `<option value="${esc(b.id)}" ${b.id === backupSelectedId ? "selected" : ""}>${esc(
          b.mtime || b.id
        )} · ${esc(formatBytes(b.sizeBytes))}</option>`
    )
    .join("");
  const catOptions = cats
    .map(
      (c) =>
        `<option value="${esc(c.id)}" ${c.id === backupCategory ? "selected" : ""}>${esc(c.label)}</option>`
    )
    .join("");
  const rows = (backupPreview?.listings || [])
    .map((row) => {
      const cat = backupCategoryFromListing(row);
      return `<tr>
      <td><input type="checkbox" data-act="backupListingCheck" data-backup-listing-id="${esc(row.id)}" data-backup-owner-email="${esc(row.ownerEmail || "")}" data-backup-category="${esc(cat)}" /></td>
      <td>${esc(row.id)}</td>
      <td>${esc(row.title)}</td>
      <td>${esc(row.status)}</td>
      <td>${esc(row.vertical || "")}${row.subtype ? " / " + esc(row.subtype) : ""}</td>
      <td>${esc(row.ownerEmail || "—")}</td>
    </tr>`;
    })
    .join("");

  return `
    <h2 class="layout-cat-title">Mentés / visszaállítás</h2>
    <p class="hint">Teljes hirdetés-pillanatkép készítése, majd kategória / user / ID szerinti részleges visszatöltés. A napi szerveres DB+kép mentés ettől függetlenül fut.</p>
    <p class="hint"><strong>Fontos:</strong> a kereső csak a <em>feladott</em> hirdetéseket mutatja. A mentett státuszúak visszaállításkor is rejtve maradnak, hacsak be nem kapcsolod a nyilvános visszaállítást.</p>
    ${info ? `<p class="ok" style="margin-top:0.75rem">${esc(info)}</p>` : ""}
    ${err ? `<p class="err" style="margin-top:0.75rem">${esc(err)}</p>` : ""}
    <div class="row" style="gap:0.75rem;flex-wrap:wrap;margin-top:0.85rem">
      <button class="btn" type="button" data-act="backupCreate" ${backupBusy ? "disabled" : ""}>Mentés most</button>
      <button class="btn ghost" type="button" data-act="backupReload" ${backupBusy ? "disabled" : ""}>Lista frissítése</button>
    </div>
    <div class="admin-list-group" style="margin-top:1.25rem">
      <h3 class="admin-section-title">Mentés kiválasztása</h3>
      <label>Pillanatkép
        <select data-act="backupSelect" data-backup-id>${options || '<option value="">— nincs mentés —</option>'}</select>
      </label>
      <div class="row" style="gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem">
        <label>Kategória
          <select data-act="backupFilterChange" data-backup-category>${catOptions}</select>
        </label>
        <label>Felhasználó (email)
          <input type="email" data-act="backupFilterChange" data-backup-user-email value="${esc(backupUserEmail)}" placeholder="pl. user@pelda.hu" />
        </label>
        <label>Hirdetés ID
          <input type="number" min="1" data-act="backupFilterChange" data-backup-listing-id-filter value="${esc(backupListingId)}" placeholder="pl. 118" />
        </label>
      </div>
      <div class="row" style="gap:0.75rem;flex-wrap:wrap;margin-top:0.85rem;align-items:center">
        <button class="btn" type="button" data-act="backupPreview" ${backupBusy || !backupSelectedId ? "disabled" : ""}>Előnézet</button>
        <button class="btn danger" type="button" data-act="backupRestore" ${backupBusy || !backupPreview?.listings?.length ? "disabled" : ""}>Kijelöltek visszaállítása</button>
        <label style="display:inline-flex;align-items:center;gap:0.4rem;margin:0">
          <input type="checkbox" data-act="backupForceFeladottChange" data-backup-force-feladott ${backupForceFeladott ? "checked" : ""} />
          Feladottként (nyilvános keresőben látszódjon)
        </label>
      </div>
    </div>
    ${
      backupPreview
        ? `<p class="hint" style="margin-top:1rem">Találat: <strong>${esc(backupPreview.matchCount)}</strong> hirdetés · mentés: ${esc(backupPreview.createdAt || backupPreview.id)}</p>
      <div class="row" style="gap:0.65rem;flex-wrap:wrap;margin-top:0.65rem">
        <button class="btn ghost" type="button" data-act="backupSelectAll" ${backupBusy ? "disabled" : ""}>Összes kijelölése</button>
        <button class="btn ghost" type="button" data-act="backupSelectNone" ${backupBusy ? "disabled" : ""}>Összes kijelölés törlése</button>
      </div>
      <div class="table-scroll" style="margin-top:0.65rem">
        <table class="table-dense">
          <thead><tr><th></th><th>ID</th><th>Cím</th><th>Státusz</th><th>Kategória</th><th>Email</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">Nincs találat.</td></tr>'}</tbody>
        </table>
      </div>`
        : `<p class="hint" style="margin-top:1rem">Válassz mentést, majd kattints az Előnézetre.</p>`
    }`;
}

function pagesAdminView(pageKey) {
  const guide = PAGE_ADMIN_GUIDES[pageKey] || PAGE_ADMIN_GUIDES.hub;
  const blocksPage = pageBlocksKey(pageKey);
  const left = sitePageBlocks.left || emptySideBlocks();
  const right = sitePageBlocks.right || emptySideBlocks();
  const center = sitePageBlocks.center;
  const jumps = (guide.jumps || [])
    .map(
      (j) =>
        `<button type="button" class="btn ghost" data-act="setTab" data-tab="${esc(j.tab)}">${esc(j.label)}</button>`
    )
    .join("");

  const videoInputs = (side, videos) =>
    [0, 1, 2]
      .map(
        (i) => `<label>YouTube link ${i + 1}
          <input type="url" data-side="${side}" data-video-index="${i}" value="${esc(videos[i] || "")}" placeholder="https://www.youtube.com/watch?v=…" />
        </label>`
      )
      .join("");

  const centerHtml = center
    ? `<div class="admin-list-group" style="margin-top:1.25rem">
        <h3 class="admin-section-title">Középső tartalom</h3>
        <label>Cím
          <input type="text" data-center-title value="${esc(center.title || "")}" maxlength="120" />
        </label>
        <label>HTML
          <textarea data-center-html rows="8" style="width:100%;min-height:9rem;resize:vertical">${esc(center.html || "")}</textarea>
        </label>
      </div>`
    : "";

  return `
    <h2 class="layout-cat-title">${esc(guide.title)} — tartalom</h2>
    <p class="hint">${esc(guide.blurb)}</p>
    <p class="hint">Élő oldal: <a href="${esc(guide.href)}" target="_blank" rel="noopener">${esc(guide.href)}</a> · blokk kulcs: <code>${esc(blocksPage)}</code></p>
    <div class="row" style="margin-top:0.75rem;gap:0.65rem;flex-wrap:wrap">
      ${jumps}
      <a class="btn ghost" href="${esc(guide.href)}" target="_blank" rel="noopener">Megnyitás</a>
    </div>
    <div class="row" style="align-items:stretch;gap:1rem;margin-top:1.25rem;flex-wrap:wrap">
      <div class="admin-list-group" style="flex:1;min-width:min(100%,280px)">
        <h3 class="admin-section-title">Bal oldalsáv</h3>
        <label>Cím
          <input type="text" data-side-title="left" value="${esc(left.title || "")}" maxlength="120" />
        </label>
        ${videoInputs("left", left.videos || [])}
      </div>
      <div class="admin-list-group" style="flex:1;min-width:min(100%,280px)">
        <h3 class="admin-section-title">Jobb oldalsáv</h3>
        <label>Cím
          <input type="text" data-side-title="right" value="${esc(right.title || "")}" maxlength="120" />
        </label>
        ${videoInputs("right", right.videos || [])}
      </div>
    </div>
    ${centerHtml}
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <div class="row" style="margin-top:1rem">
      <button class="btn" type="button" data-act="saveSitePageBlocks">Tartalom mentése</button>
    </div>`;
}

function backendBannerHtml() {
  if (!admin) return "";
  const live = isLiveAdminHost() || deployBackend?.backend === "supabase";
  if (!deployBackend && !live) return "";
  const label = live ? "Éles admin (Supabase)" : "Lokális SQLite";
  const detail = live
    ? "A mentés az élő oldalon is látszik (hard refresh)."
    : "Lokális mentés — nem kerül az éles oldalra.";
  return `<p class="hint ${live ? "ok" : "warn"}" style="margin:0 0 0.75rem"><strong>${esc(label)}.</strong> ${esc(detail)}</p>`;
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
    section === "pages" ||
    isLayoutTab() ||
    isPreviewTab() ||
    tab.endsWith(":listings") ||
    tab === "auto:kivitel" ||
    tab === "auto:akku" ||
    tab === "ingatlan:tipus-mezok" ||
    tab === "ingatlan:partnerek";
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
      ${backendBannerHtml()}
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
    const layoutCat = layoutCategoryFromTab();
    if (isDeskPostingLayoutAlias(layoutCat)) {
      return;
    }
    const root = document.getElementById("layout-root");
    if (!root) {
      if (isVehiclePostingLayoutCat(layoutCat)) return;
      err = err || "Hiányzik a szerkesztő felület (layout-root).";
      h(admin ? shell() : loginView());
      return;
    }
    root.classList.remove("layout-root--readonly");
    if (isIngatlanWheelLayoutTab()) {
      try {
        const category = layoutCategoryFromTab();
        const allowedFields = INGATLAN_TIPUS_LAYOUTS.includes(category)
          ? fieldKeysVisibleForTipus([category])
          : null;
        mountIngatlanWheelBoard(root, wheelSchema, {
          readOnly: false,
          allowedFields,
          onChange(schema) {
            wheelSchema = schema;
          },
        });
      } catch (error) {
        err = error?.message || "Ingatlan kerék-szerkesztő hiba.";
        root.innerHTML = `<p class="err">${esc(err)}</p>`;
      }
    } else {
      try {
        const isImmoWizard = isIngatlanWizardLayoutTab();
        mountLayoutBoard(root, layout, {
          deskPosting: layoutCategoryFromTab() === DESK_POSTING_LAYOUT_MASTER,
          fuelPreviewProfile:
            layoutCategoryFromTab() === DESK_POSTING_LAYOUT_MASTER ? deskFuelPreviewProfile : null,
          stepNames: isImmoWizard
            ? {
                1: "Ingatlan alapadatok",
                2: "Részletek",
                3: "Felszereltség",
                4: "Képek",
                5: "Ár, leírás és helyszín",
              }
            : isSearchLayoutCat(layoutCategoryFromTab())
            ? {
                1: "Gyorskereső",
                2: "Műszaki adatok",
                3: "Akkumulátor és hatótáv adatok",
                4: "Extrák",
                5: "Helyszín",
              }
            : undefined,
          onChange(cells) {
            layout = { ...layout, cells, category: layoutCategoryFromTab() };
          },
        });
      } catch (error) {
        err = error?.message || "Elrendezés-szerkesztő hiba.";
        root.innerHTML = `<p class="err">${esc(err)}</p>`;
      }
    }
    return;
  }
  if (isPreviewTab()) {
  }
}

async function bootBocsatech() {
  try {
    const [meResult, healthResult] = await Promise.allSettled([
      fetchJsonWithTimeout("/api/level1/me", 8000),
      fetchJsonWithTimeout("/api/health", 8000),
    ]);

    if (meResult.status === "fulfilled" && meResult.value.res.ok) {
      admin = meResult.value.data.admin || null;
    } else if (meResult.status === "rejected") {
      console.warn("Bocsatech /me:", meResult.reason);
    }

    if (healthResult.status === "fulfilled" && healthResult.value.res.ok) {
      deployBackend = healthResult.value.data;
    }

    if (admin) {
      try {
        await loadTab();
      } catch (loadError) {
        err = loadError?.message || "Betöltés sikertelen.";
        console.error("Bocsatech loadTab:", loadError);
      }
    }
  } catch (bootError) {
    console.error("Bocsatech boot:", bootError);
    if (!admin) {
      err = bootError?.message || "Indítási hiba.";
    } else {
      showBootPlaceholder("");
      app.querySelector(".hint")?.insertAdjacentHTML(
        "afterend",
        `<p class="err">${esc(bootError?.message || "Indítási hiba.")}</p><p class="hint">Hard refresh (Cmd+Shift+R), majd próbáld újra.</p>`
      );
    }
  } finally {
    render();
  }
}

render();
bootBocsatech();
