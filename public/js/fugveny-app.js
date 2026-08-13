import { initVehicleCatalogSelects, typeNameForField } from "./vehicle-catalog-client.js";

const state = {
  lists: [],
  models: [],
  selectedId: null,
  lastEstimateParams: null,
};

const $ = (id) => document.getElementById(id);

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("hu-HU");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function setStatus(el, msg, kind = "") {
  el.textContent = msg || "";
  el.className = `fugveny-status${kind ? ` ${kind}` : ""}`;
}

function renderLists() {
  const box = $("fugveny-lists");
  const empty = $("fugveny-lists-empty");
  box.innerHTML = "";

  if (!state.lists.length) {
    empty.hidden = false;
    empty.textContent =
      "Nincs CSV a ~/Downloads/fugveny mappában. Futtasd az Inditas-uj-lista scrapet.";
    box.hidden = true;
    $("fugveny-train").disabled = true;
    $("fugveny-score").disabled = true;
    return;
  }

  empty.hidden = true;
  box.hidden = false;

  for (const item of state.lists) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `fugveny-list-item${item.id === state.selectedId ? " active" : ""}`;
    btn.innerHTML = `
      <input type="radio" name="fugveny-list" ${item.id === state.selectedId ? "checked" : ""} />
      <span>
        <strong>${item.name}</strong>
        <span>${item.folder} · ${fmtNum(item.rowsApprox)} sor · ${fmtBytes(item.bytes)}</span>
      </span>
      <span>${new Date(item.mtime).toLocaleString("hu-HU")}</span>
    `;
    btn.addEventListener("click", () => {
      state.selectedId = item.id;
      renderLists();
      $("fugveny-train").disabled = false;
      $("fugveny-score").disabled = false;
    });
    box.appendChild(btn);
  }

  if (!state.selectedId && state.lists[0]) {
    state.selectedId = state.lists[0].id;
    renderLists();
    $("fugveny-train").disabled = false;
    $("fugveny-score").disabled = false;
  }
}

function renderMetrics() {
  const box = $("fugveny-metrics");
  box.innerHTML = "";
  const model = state.models[0];
  if (!model?.metrics) {
    box.innerHTML = `<span class="fugveny-chip">Nincs betanított modell</span>`;
    return;
  }
  const m = model.metrics;
  box.innerHTML = [
    `MAE ${fmtNum(m.mae_Ft)} Ft`,
    `R² ${m.r2}`,
    `MAPE ${m.mape_pct}%`,
    `n=${fmtNum(m.n_total)}`,
  ]
    .map((t) => `<span class="fugveny-chip">${t}</span>`)
    .join("");
}

async function refreshAll() {
  const data = await api("/api/fugveny/lists");
  state.lists = data.lists || [];
  state.models = data.models || [];
  if (state.selectedId && !state.lists.some((l) => l.id === state.selectedId)) {
    state.selectedId = null;
  }
  renderLists();
  renderMetrics();
  await refreshQueries();
}

async function refreshQueries() {
  const data = await api("/api/fugveny/queries");
  const queries = data.queries || [];
  const box = $("fugveny-queries");
  const empty = $("fugveny-queries-empty");
  box.innerHTML = "";
  empty.hidden = queries.length > 0;

  for (const q of queries) {
    const row = document.createElement("div");
    row.className = "fugveny-query-row";
    row.innerHTML = `
      <div>
        <div class="name">${q.name}</div>
        <div class="meta">${q.type} · ${new Date(q.updatedAt || q.createdAt).toLocaleString("hu-HU")}</div>
      </div>
      <div class="fugveny-actions">
        <button type="button" class="fugveny-btn secondary" data-run="${q.id}">Futtatás</button>
        <button type="button" class="fugveny-btn secondary" data-del="${q.id}">Törlés</button>
      </div>
    `;
    box.appendChild(row);
  }

  box.querySelectorAll("[data-run]").forEach((btn) => {
    btn.addEventListener("click", () => runQuery(btn.getAttribute("data-run")));
  });
  box.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/api/fugveny/queries/${encodeURIComponent(btn.getAttribute("data-del"))}`, {
        method: "DELETE",
      });
      await refreshQueries();
    });
  });
}

function formToObject(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) obj[k] = String(v).trim();
  return obj;
}

/** Becsléshez: a katalógus hosszú típusnevét lerövidíti (szögletes zárójel nélkül, modellnév nélkül). */
function estimateParamsFromForm(form) {
  const params = formToObject(form);
  if (params.tipus) {
    params.tipus = typeNameForField(params.tipus, params.modell);
  }
  return params;
}

function showTable(rows) {
  const wrap = $("fugveny-query-table-wrap");
  const table = $("fugveny-query-table");
  if (!rows?.length) {
    wrap.hidden = true;
    return;
  }
  const cols = [
    "Gyartmany",
    "Modell",
    "Tipus",
    "Ev",
    "Kmora_allas",
    "Vetelar_Ft",
    "Becsult_ar_Ft",
    "Elteres_pct",
  ].filter((c) => c in rows[0]);
  table.querySelector("thead").innerHTML = `<tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  table.querySelector("tbody").innerHTML = rows
    .map(
      (r) =>
        `<tr>${cols
          .map((c) => {
            let v = r[c];
            if (c.includes("Ft") || c === "Kmora_allas" || c === "Ev") v = fmtNum(v);
            if (c === "Elteres_pct") v = `${Number(v).toFixed(1)}%`;
            return `<td>${v ?? ""}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");
  wrap.hidden = false;
}

async function runQuery(id) {
  const status = $("fugveny-query-status");
  setStatus(status, "Futtatás…");
  try {
    const data = await api("/api/fugveny/queries/run", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    if (data.prediction) {
      const p = data.prediction.becsult_ar_Ft;
      setStatus(status, `Becslés: ${fmtNum(p)} Ft`, "ok");
      showTable([]);
      return;
    }
    setStatus(status, `${data.total ?? 0} találat (mutatva: ${data.rows?.length || 0})`, "ok");
    showTable(data.rows || []);
  } catch (err) {
    setStatus(status, err.message, "error");
  }
}

$("fugveny-refresh").addEventListener("click", () => refreshAll().catch(console.error));

$("fugveny-train").addEventListener("click", async () => {
  if (!state.selectedId) return;
  const status = $("fugveny-train-status");
  const log = $("fugveny-log");
  $("fugveny-train").disabled = true;
  $("fugveny-score").disabled = true;
  setStatus(status, "Tanítás folyik — ez eltarthat…");
  log.hidden = false;
  log.textContent = "";
  try {
    const data = await api("/api/fugveny/train", {
      method: "POST",
      body: JSON.stringify({ listId: state.selectedId, iterations: 800 }),
    });
    log.textContent = data.log || "";
    setStatus(
      status,
      data.metrics
        ? `Kész — MAE ${fmtNum(data.metrics.mae_Ft)} Ft, R² ${data.metrics.r2}`
        : "Kész",
      "ok"
    );
    await refreshAll();
  } catch (err) {
    setStatus(status, err.message, "error");
    log.textContent = err.message;
  } finally {
    $("fugveny-train").disabled = !state.selectedId;
    $("fugveny-score").disabled = !state.selectedId;
  }
});

$("fugveny-score").addEventListener("click", async () => {
  if (!state.selectedId) return;
  const status = $("fugveny-train-status");
  setStatus(status, "Pontozás…");
  try {
    const data = await api("/api/fugveny/score", {
      method: "POST",
      body: JSON.stringify({ listId: state.selectedId }),
    });
    setStatus(status, `Pontozott lista: ${data.out}`, "ok");
    $("fugveny-log").hidden = false;
    $("fugveny-log").textContent = data.log || data.out;
  } catch (err) {
    setStatus(status, err.message, "error");
  }
});

$("fugveny-estimate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const params = estimateParamsFromForm(e.target);
  state.lastEstimateParams = params;
  const box = $("fugveny-estimate-result");
  box.hidden = false;
  box.textContent = "Számolás…";
  try {
    const data = await api("/api/fugveny/predict", {
      method: "POST",
      body: JSON.stringify(params),
    });
    box.innerHTML = `Becsült vételár: <strong>${fmtNum(data.becsult_ar_Ft)} Ft</strong>`;
  } catch (err) {
    box.textContent = err.message;
  }
});

$("fugveny-save-estimate").addEventListener("click", async () => {
  const form = $("fugveny-estimate-form");
  const params = state.lastEstimateParams || estimateParamsFromForm(form);
  const name = prompt("Lekérdezés neve", `${params.gyartmany || ""} ${params.modell || ""} becslés`);
  if (!name) return;
  await api("/api/fugveny/queries", {
    method: "POST",
    body: JSON.stringify({ name, type: "estimate", params }),
  });
  await refreshQueries();
});

$("fugveny-filter-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = formToObject(e.target);
  const { name, type, ...rest } = raw;
  const params = { ...rest };
  if (type === "undervalued") params.undervalued = true;
  await api("/api/fugveny/queries", {
    method: "POST",
    body: JSON.stringify({ name, type, params }),
  });
  e.target.reset();
  e.target.type.value = "undervalued";
  e.target.maxElteresPct.value = "-5";
  e.target.limit.value = "30";
  await refreshQueries();
  setStatus($("fugveny-query-status"), "Lekérdezés mentve.", "ok");
});

refreshAll().catch((err) => {
  $("fugveny-lists-empty").textContent = err.message;
});

initVehicleCatalogSelects({
  brandSelect: $("fugveny-gyartmany"),
  modelSelect: $("fugveny-modell"),
  yearSelect: $("fugveny-ev"),
  tipusSelect: $("fugveny-tipus"),
  yearFromCatalog: true,
  brandEmptyLabel: "Válasszon",
  modelEmptyLabel: "Előbb válassz gyártmányt",
  yearEmptyLabel: "Mindegy",
  tipusEmptyLabel: "Előbb gyártmány, modell és év",
}).catch((error) => console.error("Járműkatalógus (árlekérdezés):", error));
