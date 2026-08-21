import { mountLayoutBoard } from "./bocsatech-layout.js?v=layoutCats1";
import { mountIngatlanWheelBoard } from "./bocsatech-ingatlan-wheels.js?v=immoWheel1";

const app = document.getElementById("app");

const LAYOUT_NAV = [
  {
    group: "Autók",
    items: [
      { id: "szemelyauto", label: "Személyautó" },
      { id: "leasing", label: "Leasing autók" },
      { id: "berauto", label: "Bérautók" },
      { id: "lakokocsi", label: "Bérelhető lakókocsi" },
      { id: "kisteher", label: "Teherautó 3,5-ig" },
      { id: "teherauto", label: "Teherautó 3,5-től" },
    ],
  },
  {
    group: "Ingatlanok",
    items: [{ id: "ingatlan", label: "Ingatlan" }],
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

let admin = null;
let tab = "visitors";
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
let hubPromo = { slots: {} };
let editingUser = null;

function otpSentMessage(data) {
  const to = data.emailMasked ? ` (${data.emailMasked})` : "";
  if (data.devCode) {
    return `Helyi mód: a kód ${data.devCode} (SMTP nincs beállítva).`;
  }
  return `A kódot elküldtük emailben${to}. Nézd a spam mappát is.`;
}

function isLayoutTab(value = tab) {
  return String(value).startsWith("layout:");
}

function layoutCategoryFromTab(value = tab) {
  if (!isLayoutTab(value)) return layoutCategory;
  const raw = String(value).slice("layout:".length) || "szemelyauto";
  const [cat] = raw.split(":");
  return cat || "szemelyauto";
}

function layoutIntentFromTab(value = tab) {
  if (!isLayoutTab(value)) return layoutIntent;
  const raw = String(value).slice("layout:".length) || "";
  const parts = raw.split(":");
  return parts[1] || "";
}

function layoutTabId(item) {
  return item.intent ? `layout:${item.id}:${item.intent}` : `layout:${item.id}`;
}

function categoryLabel(id) {
  for (const group of LAYOUT_NAV) {
    const hit = group.items.find((c) => c.id === id);
    if (hit) return hit.label;
  }
  return LAYOUT_CATEGORIES.find((c) => c.id === id)?.label || id;
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
    const evt =
      el.tagName === "FORM"
        ? "submit"
        : el.tagName === "SELECT" || isFile
          ? "change"
          : "click";
    el.addEventListener(evt, (event) => {
      if (el.tagName === "FORM") event.preventDefault();
      actions[el.getAttribute("data-act")](event, el);
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
      otpUser = data.username;
      otpEmailMasked = data.emailMasked || "";
      info = otpSentMessage(data);
      render();
    } catch (error) {
      err = error.message;
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
  setTab(_, el) {
    tab = el.getAttribute("data-tab");
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
      info = "Látogatóadatok frissítve.";
      render();
    } catch (error) {
      err = error.message;
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
      if (cat === "ingatlan") {
        const data = await api("/api/level1/ingatlan-wheel-schema", {
          method: "PUT",
          body: JSON.stringify({ schema: wheelSchema }),
        });
        wheelSchema = data.schema || wheelSchema;
        info =
          "Ingatlan kerék-séma mentve. Kereső és feladás hard refresh (Cmd+Shift+R) után frissül. A kategória (Keres/Kínál/Bérbe) csak az élő oldalon jelenik meg.";
        render();
        return;
      }
      const data = await api("/api/level1/form-layout", {
        method: "PUT",
        body: JSON.stringify({ category: cat, layout }),
      });
      layout = data.layout || layout;
      layoutCategory = data.category || cat;
      info = `Elrendezés mentve (${categoryLabel(layoutCategory)}). A hirdetésfeladáson hard refresh (Cmd+Shift+R) után látszik.`;
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async hubPromoActivate(_, el) {
    err = "";
    info = "";
    try {
      const slot = el.getAttribute("data-slot");
      const imageId = el.getAttribute("data-image-id");
      hubPromo = await api("/api/level1/hub-promo/active", {
        method: "PUT",
        body: JSON.stringify({ slot, imageId }),
      });
      info = "Aktív kép beállítva — minden oldalon frissül.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async hubPromoDelete(_, el) {
    const slot = el.getAttribute("data-slot");
    const imageId = el.getAttribute("data-image-id");
    if (!confirm("Törlöd ezt a feltöltött képet?")) return;
    err = "";
    info = "";
    try {
      hubPromo = await api("/api/level1/hub-promo/image", {
        method: "DELETE",
        body: JSON.stringify({ slot, imageId }),
      });
      info = "Kép törölve.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
  async hubPromoUpload(_, el) {
    const slot = el.getAttribute("data-slot");
    const file = el.files?.[0];
    if (!file || !slot) return;
    err = "";
    info = "";
    try {
      const image = await fileToDataUrl(file);
      hubPromo = await api("/api/level1/hub-promo/upload", {
        method: "POST",
        body: JSON.stringify({ slot, image }),
      });
      info = "Kép feltöltve és aktívra állítva.";
      el.value = "";
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

async function loadTab() {
  if (!admin) return;
  if (tab === "visitors") visitors = await api("/api/level1/visitors");
  if (tab === "users") users = (await api("/api/level1/users")).users;
  if (tab === "listings") listings = (await api("/api/level1/listings")).listings;
  if (tab === "hubpromo") hubPromo = await api("/api/level1/hub-promo");
  if (isLayoutTab()) {
    layoutCategory = layoutCategoryFromTab();
    layoutIntent = layoutIntentFromTab();
    if (layoutCategory === "ingatlan") {
      const data = await api("/api/level1/ingatlan-wheel-schema");
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
          <input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required />
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
      <p class="sub">Admin belépés — jelszó + email kód. 3 hiba után a felhasználónév zárolva.</p>
      <form class="card" data-act="login" style="max-width:420px">
        <label>Felhasználónév</label>
        <input name="username" autocomplete="username" value="${esc(lastUsername)}" required />
        <label>Jelszó</label>
        <input name="password" type="password" autocomplete="current-password" required />
        <p class="err">${esc(err)}</p>
        <div class="row" style="margin-top:1rem">
          <button class="btn" type="submit">Kód kérése</button>
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
  const rows = devices
    .map(
      (dev) => `<tr>
        <td>${esc(dev.ip)}</td>
        <td>${esc(dev.deviceName)}</td>
        <td>${esc(dev.deviceType)}</td>
        <td>${esc(dev.browser)}</td>
        <td>${esc(dev.os)}</td>
        <td>${esc(dev.screen)}</td>
        <td>${esc(dev.language)}</td>
        <td>${esc(dev.timezone)}</td>
        <td>${dev.hitCount ?? 0}</td>
        <td>${esc(fmtWhen(dev.firstSeenAt))}</td>
        <td>${esc(fmtWhen(dev.lastSeenAt))}</td>
        <td class="ua-cell" title="${esc(dev.userAgent)}">${esc((dev.userAgent || "").slice(0, 72))}${(dev.userAgent || "").length > 72 ? "…" : ""}</td>
      </tr>`
    )
    .join("");
  return `
    <div class="admin-visitors">
      ${visitors?.warning ? `<p class="err">Figyelem: ${esc(visitors.warning)}</p>` : ""}
      <p class="hint">„Jelenleg” = az elmúlt ${visitors?.onlineWindowMinutes || 5} percben aktív eszközök. A böngésző nem ad valódi számítógépnevet — a „gép név” a felismerhető eszköz/OS (pl. iPhone, Windows).</p>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Jelenleg</div><div class="stat-value">${visitors?.online ?? 0}</div><div class="stat-sub">aktív eszköz</div></div>
        <div class="stat-card"><div class="stat-label">Naponta</div><div class="stat-value">${d.unique ?? 0}</div><div class="stat-sub">${d.hits ?? 0} megtekintés</div></div>
        <div class="stat-card"><div class="stat-label">Hetente</div><div class="stat-value">${w.unique ?? 0}</div><div class="stat-sub">${w.hits ?? 0} megtekintés</div></div>
        <div class="stat-card"><div class="stat-label">Havonta</div><div class="stat-value">${m.unique ?? 0}</div><div class="stat-sub">${m.hits ?? 0} megtekintés</div></div>
      </div>
      <div class="row" style="margin:0.75rem 0 1rem">
        <button class="btn ghost" type="button" data-act="refreshVisitors">Frissítés</button>
      </div>
      <h3 class="admin-section-title">Látogatott gépek / eszközök</h3>
      <div class="table-scroll">
        <table class="table-dense">
          <thead>
            <tr>
              <th>IP</th><th>Gép / eszköz</th><th>Típus</th><th>Böngésző</th><th>OS</th>
              <th>Képernyő</th><th>Nyelv</th><th>Időzóna</th><th>Találatok</th>
              <th>Első</th><th>Utolsó</th><th>User-Agent</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="12">Még nincs látogatóadat. Nyiss meg egy oldalt a weben, majd frissíts.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function usersView() {
  const rows = users
    .map(
      (u) => `<tr>
        <td>${u.id}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.displayName || "")}</td>
        <td>${u.emailVerified ? "igen" : "nem"}</td>
        <td>${esc(fmtWhen(u.createdAt))}</td>
        <td>${esc(fmtWhen(u.lastLoginAt))}</td>
        <td>${u.listingCount ?? 0}</td>
        <td>
          <button class="btn" data-act="editUser" data-id="${u.id}">Kezelés</button>
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
  return `
    <div class="users-edit">
      ${messages}
      <p class="hint">Regisztrált felhasználók: regisztráció dátuma, utolsó belépés, hirdetések száma. „Kezelés” megnyitja a profilt és a hirdetéslistát.</p>
      <div class="table-scroll">
        <table class="table-dense"><thead><tr>
          <th>#</th><th>Email</th><th>Név</th><th>Aktivált</th>
          <th>Regisztráció</th><th>Utoljára belépett</th><th>Hirdetések</th><th></th>
        </tr></thead><tbody>${rows || `<tr><td colspan="8">Nincs user.</td></tr>`}</tbody></table>
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
                  <td>${esc(l.status || "")}</td>
                  <td>${esc(fmtWhen(l.updatedAt))}</td>
                  <td><a href="/hirdetes.html?id=${l.id}" target="_blank" rel="noreferrer">nyit</a></td>
                </tr>`
              )
              .join("") || `<tr><td colspan="5">Nincs hirdetése.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="row" style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1.25rem">
        <button class="btn" type="button" data-act="saveUser">Mentés</button>
        <button class="btn" type="button" data-act="cancelEditUser">Mégse</button>
      </div>
    </div>`;
}

function listingsView() {
  const rows = listings
    .map(
      (l) => `<tr>
        <td>${l.imageUrl ? `<img class="thumb" src="${esc(l.imageUrl)}" alt="" />` : ""}</td>
        <td>${l.id}</td>
        <td>${esc(l.title || "")}</td>
        <td>${esc(l.gyartmany || "")} ${esc(l.tipus || "")}</td>
        <td>
          <select data-act="setStatus" data-id="${l.id}">
            ${["mentett", "feladott", "inaktiv"]
              .map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </td>
        <td><a href="/hirdetes.html?id=${l.id}" target="_blank" rel="noreferrer">nyit</a></td>
        <td><button class="btn danger" data-act="delListing" data-id="${l.id}">Törlés</button></td>
      </tr>`
    )
    .join("");
  return `<table><thead><tr><th></th><th>#</th><th>Cím</th><th>Jármű</th><th>Státusz</th><th></th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="7">Nincs hirdetés.</td></tr>`}</tbody></table>`;
}

function hubPromoView() {
  const slots = hubPromo?.slots || {};
  const blocks = ["ingatlan", "auto"]
    .map((id) => {
      const slot = slots[id] || { label: id, images: [], activeId: "stock" };
      const thumbs = (slot.images || [])
        .map((img) => {
          const on = img.id === slot.activeId;
          return `<div class="hub-promo-admin__card ${on ? "is-active" : ""}">
            <button type="button" class="hub-promo-admin__pick" data-act="hubPromoActivate" data-slot="${esc(id)}" data-image-id="${esc(img.id)}" title="Aktívra állít">
              <img src="${esc(img.url)}" alt="" />
              <span>${img.stock ? "Eredeti" : "Feltöltött"}${on ? " · aktív" : ""}</span>
            </button>
            ${
              img.stock
                ? ""
                : `<button type="button" class="btn danger hub-promo-admin__del" data-act="hubPromoDelete" data-slot="${esc(id)}" data-image-id="${esc(img.id)}">Törlés</button>`
            }
          </div>`;
        })
        .join("");
      return `<section class="hub-promo-admin__slot">
        <h3>${esc(slot.label || id)}</h3>
        <p class="hint">Válassz egy képet (aktív = minden oldalon), vagy tölts fel újat. JPG/PNG/WebP, max 6 MB. A szöveg a képen van.</p>
        <div class="hub-promo-admin__grid">${thumbs || "<p>Nincs kép.</p>"}</div>
        <label class="btn ghost hub-promo-admin__upload">Új kép feltöltése
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-act="hubPromoUpload" data-slot="${esc(id)}" />
        </label>
      </section>`;
    })
    .join("");
  return `
    <p class="ok">${esc(info)}</p>
    <p class="err">${esc(err)}</p>
    <p class="hint">Kezdőlap két nagy téglalapja — ingatlan és jármű. Ugyanaz a kép jelenik meg minden oldalon.</p>
    <div class="hub-promo-admin">${blocks}</div>`;
}

function layoutView() {
  const label = categoryLabel(layoutCategoryFromTab());
  const isImmo = layoutCategoryFromTab() === "ingatlan";
  const sharedHint = isImmo
    ? "Közös kerék-séma a keresőre és a feladásra. Húzd a mezőket, állítsd a szélességet, üres sort is beszúrhatsz. A Keres/Kínál/Bérbe kategória csak az élő oldalon látszik."
    : "Csak ennek a kategóriának a mezői. Húzd a cellát a lapon belül vagy másik lépésre. Mentés után a hirdetésfeladáson hard refresh kell.";
  return `
    <h2 class="layout-cat-title">${esc(label)} — ${isImmo ? "kerék-séma" : "feladási mezők"}</h2>
    <p class="hint">${esc(sharedHint)}</p>
    <div id="layout-root"></div>
    <p class="ok">${info}</p>
    <p class="err">${err}</p>
    <div class="row" style="margin-top:1rem"><button class="btn" type="button" data-act="saveLayout">Elrendezés mentése</button></div>`;
}

function shell() {
  const body =
    tab === "visitors"
      ? visitorsView()
      : tab === "users"
        ? usersView()
        : tab === "listings"
          ? listingsView()
          : tab === "hubpromo"
            ? hubPromoView()
            : layoutView();
  const layoutNav = LAYOUT_NAV.map((group) => {
    const buttons = group.items
      .map((item) => {
        const tid = layoutTabId(item);
        return `<button class="tab tab--layout ${tab === tid ? "on" : ""}" data-act="setTab" data-tab="${esc(tid)}">${esc(item.label)}</button>`;
      })
      .join("");
    return `<div class="nav-section">
        <p class="nav-section-label">${esc(group.group)}</p>
        <div class="tabs tabs--stack">${buttons}</div>
      </div>`;
  }).join("");
  return `
    <div class="wrap ${isLayoutTab() || tab === "visitors" || tab === "users" ? "wrap--wide" : ""}">
      <div class="top">
        <div>
          <h1>Bocsatech</h1>
          <p class="sub">${esc(admin.username)} · ${esc(admin.email)}</p>
        </div>
        <button class="btn ghost" data-act="logout">Kilépés</button>
      </div>
      <div class="tabs">
        <button class="tab ${tab === "visitors" ? "on" : ""}" data-act="setTab" data-tab="visitors">Látogatók</button>
        <button class="tab ${tab === "users" ? "on" : ""}" data-act="setTab" data-tab="users">Felhasználók</button>
        <button class="tab ${tab === "listings" ? "on" : ""}" data-act="setTab" data-tab="listings">Hirdetések</button>
        <button class="tab ${tab === "hubpromo" ? "on" : ""}" data-act="setTab" data-tab="hubpromo">Kezdőlap képek</button>
      </div>
      ${layoutNav}
      <div class="card">${body}</div>
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
  if (admin && isLayoutTab()) {
    const root = document.getElementById("layout-root");
    if (layoutCategoryFromTab() === "ingatlan") {
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
  }
}

const me = await api("/api/level1/me").catch(() => ({ admin: null }));
admin = me.admin;
if (admin) await loadTab();
render();
