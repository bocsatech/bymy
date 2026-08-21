import { mountLayoutBoard } from "./bocsatech-layout.js?v=layoutCats1";

const app = document.getElementById("app");

const LAYOUT_CATEGORIES = [
  { id: "szemelyauto", label: "Személyautó" },
  { id: "leasing", label: "Leasing hirdetés" },
  { id: "berauto", label: "Bérautó hirdetés" },
  { id: "lakokocsi", label: "Bérelhető lakókocsi" },
  { id: "kisteher", label: "Kisteher 3,5 t-ig" },
  { id: "teherauto", label: "Teherautó 3,5 t-tól" },
  { id: "ingatlan", label: "Ingatlan" },
];

let admin = null;
let tab = "users";
let layoutCategory = "szemelyauto";
let lastUsername = "";
let otpUser = "";
let otpEmailMasked = "";
let err = "";
let info = "";
let users = [];
let listings = [];
let layout = { cells: [], category: "szemelyauto" };
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
  return String(value).slice("layout:".length) || "szemelyauto";
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
    const evt = el.tagName === "FORM" ? "submit" : el.tagName === "SELECT" ? "change" : "click";
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
    if (isLayoutTab(tab)) layoutCategory = layoutCategoryFromTab(tab);
    err = "";
    info = "";
    loadTab().then(render);
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
      const data = await api("/api/level1/form-layout", {
        method: "PUT",
        body: JSON.stringify({ layout, category: cat }),
      });
      layout = data.layout;
      layoutCategory = data.category || cat;
      info = `Elrendezés mentve (${categoryLabel(layoutCategory)}). A hirdetésfeladáson hard refresh (Cmd+Shift+R) után látszik.`;
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
};

function categoryLabel(id) {
  return LAYOUT_CATEGORIES.find((c) => c.id === id)?.label || id;
}

async function loadTab() {
  if (!admin) return;
  if (tab === "users") users = (await api("/api/level1/users")).users;
  if (tab === "listings") listings = (await api("/api/level1/listings")).listings;
  if (isLayoutTab()) {
    layoutCategory = layoutCategoryFromTab();
    const data = await api(`/api/level1/form-layout?category=${encodeURIComponent(layoutCategory)}`);
    layout = data.layout;
    if (Array.isArray(data.categories) && data.categories.length) {
      /* server list is source of truth for labels if present */
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

function usersView() {
  const rows = users
    .map(
      (u) => `<tr>
        <td>${u.id}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.displayName || "")}</td>
        <td>${u.emailVerified ? "igen" : "nem"}</td>
        <td>${esc(u.createdAt || "")}</td>
        <td>
          <button class="btn" data-act="editUser" data-id="${u.id}">Szerkesztés</button>
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
      <table><thead><tr><th>#</th><th>Email</th><th>Név</th><th>Aktivált</th><th>Létrehozva</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="6">Nincs user.</td></tr>`}</tbody></table>
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
      <h2>User szerkesztés (#${esc(editingUser.id)})</h2>
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

function layoutView() {
  const label = categoryLabel(layoutCategoryFromTab());
  return `
    <h2 class="layout-cat-title">${esc(label)} — feladási mezők</h2>
    <p class="hint">Csak ennek a kategóriának a mezői. Húzd a cellát a lapon belül vagy másik lépésre. Mentés után a hirdetésfeladáson hard refresh kell.</p>
    <div id="layout-root"></div>
    <p class="ok">${info}</p>
    <p class="err">${err}</p>
    <div class="row" style="margin-top:1rem"><button class="btn" type="button" data-act="saveLayout">Elrendezés mentése</button></div>`;
}

function shell() {
  const body = tab === "users" ? usersView() : tab === "listings" ? listingsView() : layoutView();
  const layoutTabs = LAYOUT_CATEGORIES.map(
    (c) =>
      `<button class="tab tab--layout ${tab === `layout:${c.id}` ? "on" : ""}" data-act="setTab" data-tab="layout:${c.id}">${esc(c.label)}</button>`
  ).join("");
  return `
    <div class="wrap ${isLayoutTab() ? "wrap--wide" : ""}">
      <div class="top">
        <div>
          <h1>Bocsatech</h1>
          <p class="sub">${esc(admin.username)} · ${esc(admin.email)}</p>
        </div>
        <button class="btn ghost" data-act="logout">Kilépés</button>
      </div>
      <div class="tabs">
        <button class="tab ${tab === "users" ? "on" : ""}" data-act="setTab" data-tab="users">Userek</button>
        <button class="tab ${tab === "listings" ? "on" : ""}" data-act="setTab" data-tab="listings">Hirdetések</button>
      </div>
      <div class="nav-section">
        <p class="nav-section-label">Feladási mezők</p>
        <div class="tabs tabs--stack">${layoutTabs}</div>
      </div>
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
    mountLayoutBoard(document.getElementById("layout-root"), layout, {
      onChange(cells) {
        layout = { ...layout, cells, category: layoutCategoryFromTab() };
      },
    });
  }
}

const me = await api("/api/level1/me").catch(() => ({ admin: null }));
admin = me.admin;
if (admin) await loadTab();
render();
