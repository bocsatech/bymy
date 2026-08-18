import { mountLayoutBoard } from "./bocsatech-layout.js?v=visLayout3";

const app = document.getElementById("app");

let admin = null;
let tab = "users";
let lastUsername = "";
let otpUser = "";
let err = "";
let info = "";
let users = [];
let listings = [];
let layout = { cells: [] };

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
      info = data.devCode
        ? `Helyi mód: a kód ${data.devCode} (SMTP nincs beállítva).`
        : "A kódot elküldtük emailben.";
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
    render();
  },
  setTab(_, el) {
    tab = el.getAttribute("data-tab");
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
      const data = await api("/api/level1/form-layout", {
        method: "PUT",
        body: JSON.stringify({ layout }),
      });
      layout = data.layout;
      info = "Elrendezés mentve. A hirdetésfeladáson hard refresh (Cmd+Shift+R) után látszik.";
      render();
    } catch (error) {
      err = error.message;
      render();
    }
  },
};

async function loadTab() {
  if (!admin) return;
  if (tab === "users") users = (await api("/api/level1/users")).users;
  if (tab === "listings") listings = (await api("/api/level1/listings")).listings;
  if (tab === "layout") layout = (await api("/api/level1/form-layout")).layout;
}

function loginView() {
  if (otpUser) {
    return `
      <div class="wrap">
        <h1>Bocsatech</h1>
        <p class="sub">Második tényező: email kód</p>
        <form class="card" data-act="otp" style="max-width:420px">
          <label>6 jegyű kód</label>
          <input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required />
          <p class="ok">${info}</p>
          <p class="err">${err}</p>
          <button class="btn" type="submit">Belépés</button>
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
        <p class="err">${err}</p>
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
        <td><button class="btn danger" data-act="delUser" data-id="${u.id}">Törlés</button></td>
      </tr>`
    )
    .join("");
  return `<table><thead><tr><th>#</th><th>Email</th><th>Név</th><th>Aktivált</th><th>Létrehozva</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="6">Nincs user.</td></tr>`}</tbody></table>`;
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
  return `
    <p class="hint">Húzd a cellát a lapon belül vagy egy másik lépés táblájára. A jobb szélén méretezed, a × törli — a törölt mezők alulról visszaállíthatók. Mentés után a hirdetésfeladáson hard refresh kell.</p>
    <div id="layout-root"></div>
    <p class="ok">${info}</p>
    <p class="err">${err}</p>
    <div class="row" style="margin-top:1rem"><button class="btn" type="button" data-act="saveLayout">Elrendezés mentése</button></div>`;
}

function shell() {
  const body = tab === "users" ? usersView() : tab === "listings" ? listingsView() : layoutView();
  return `
    <div class="wrap ${tab === "layout" ? "wrap--wide" : ""}">
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
        <button class="tab ${tab === "layout" ? "on" : ""}" data-act="setTab" data-tab="layout">Feladási mezők</button>
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
  if (admin && tab === "layout") {
    mountLayoutBoard(document.getElementById("layout-root"), layout, {
      onChange(cells) {
        layout = { ...layout, cells };
      },
    });
  }
}

const me = await api("/api/level1/me").catch(() => ({ admin: null }));
admin = me.admin;
if (admin) await loadTab();
render();
