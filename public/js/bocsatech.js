const app = document.getElementById("app");

let admin = null;
let tab = "users";
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
    try {
      const data = await api("/api/level1/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.value,
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
  async saveLayout(event) {
    err = "";
    info = "";
    const form = event.target;
    const cells = [...form.querySelectorAll("[data-field]")].map((row) => ({
      field_key: row.getAttribute("data-field"),
      order: Number(row.querySelector("[name=order]").value),
      colSpan: Number(row.querySelector("[name=colSpan]").value),
      maxWidthRem: row.querySelector("[name=maxWidthRem]").value
        ? Number(row.querySelector("[name=maxWidthRem]").value)
        : null,
    }));
    try {
      const data = await api("/api/level1/form-layout", {
        method: "PUT",
        body: JSON.stringify({ layout: { cells } }),
      });
      layout = data.layout;
      info = "Elrendezés mentve. A hirdetésfeladáson hard refresh után látszik.";
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
        <input name="username" autocomplete="username" required />
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
  const groups = new Map();
  for (const cell of layout.cells || []) {
    const step = cell.step || 1;
    if (!groups.has(step)) groups.set(step, []);
    groups.get(step).push(cell);
  }
  const blocks = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, cells]) => {
      const items = cells
        .sort((a, b) => a.order - b.order)
        .map(
          (cell) => `<div class="layout-card" data-field="${esc(cell.field_key)}">
            <div><strong>${esc(cell.label)}</strong><br /><small>${esc(cell.field_key)}</small></div>
            <label>Sorrend<input name="order" type="number" value="${cell.order}" /></label>
            <label>Oszlop<select name="colSpan"><option value="1" ${cell.colSpan !== 2 ? "selected" : ""}>1</option><option value="2" ${cell.colSpan === 2 ? "selected" : ""}>2 (teljes)</option></select></label>
            <label>Szélesség (rem)<input name="maxWidthRem" type="number" min="8" max="40" step="0.5" value="${cell.maxWidthRem ?? ""}" placeholder="alap" /></label>
          </div>`
        )
        .join("");
      return `<h3>Lépés ${step}</h3>${items}`;
    })
    .join("");
  return `
    <p class="hint">A szélesség a mezőre vonatkozik, nem a sor rácsára — így a következő sor nem csúszik rá. A sorrend a CSS <code>order</code> érték; cellát másik sorba tenni a következő kör (DOM áthelyezés).</p>
    <form data-act="saveLayout">
      <div class="layout-grid">${blocks}</div>
      <p class="ok">${info}</p>
      <p class="err">${err}</p>
      <div class="row" style="margin-top:1rem"><button class="btn" type="submit">Elrendezés mentése</button></div>
    </form>`;
}

function shell() {
  const body = tab === "users" ? usersView() : tab === "listings" ? listingsView() : layoutView();
  return `
    <div class="wrap">
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
}

const me = await api("/api/level1/me").catch(() => ({ admin: null }));
admin = me.admin;
if (admin) await loadTab();
render();
