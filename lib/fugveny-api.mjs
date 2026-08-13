import { spawn } from "child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_CATBOOST = resolve(__dirname, "../../fugveny/catboost");

export function fugvenyRoot() {
  return join(homedir(), "Downloads", "fugveny");
}

export function queriesPath() {
  const dir = fugvenyRoot();
  mkdirSync(dir, { recursive: true });
  return join(dir, "queries.json");
}

function catboostDirs() {
  return [
    join(fugvenyRoot(), "catboost-src"),
    REPO_CATBOOST,
    join(homedir(), "bocsa-app", "fugveny", "catboost"),
  ].filter((p) => existsSync(join(p, "train.py")));
}

export function resolveCatboostDir() {
  const found = catboostDirs()[0];
  if (!found) {
    throw new Error(
      "Nincs CatBoost forrás. Futtasd: ~/bocsa-app/fugveny/mac/telepites.command"
    );
  }
  return found;
}

function pythonBin(catboostDir) {
  const venvPy3 = join(catboostDir, ".venv", "bin", "python3");
  if (existsSync(venvPy3)) return venvPy3;
  const venvPy = join(catboostDir, ".venv", "bin", "python");
  if (existsSync(venvPy)) return venvPy;
  return "python3";
}

function runCmd(bin, args, { cwd, timeoutMs = 600_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { cwd, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Időtúllépés: ${bin} ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || stdout || `${bin} exit ${code}`));
        return;
      }
      resolvePromise({ stdout, stderr, code });
    });
  });
}

function walkCsvFiles(dir, depth = 0, acc = []) {
  if (!existsSync(dir) || depth > 3) return acc;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["program", "node_modules", "catboost-src", ".venv"].includes(ent.name)) continue;
      walkCsvFiles(full, depth + 1, acc);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith(".csv")) {
      if (/reszleges-\d|progress|feature_importance|test_predictions|scored/i.test(ent.name)) {
        // scored érdekes lehet — tartsuk a scored-ot külön
        if (!/scored\.csv$/i.test(ent.name)) continue;
      }
      try {
        const st = statSync(full);
        acc.push({
          id: Buffer.from(full).toString("base64url"),
          name: ent.name,
          path: full,
          folder: basename(dirname(full)),
          bytes: st.size,
          mtime: st.mtime.toISOString(),
          rowsApprox: null,
        });
      } catch {
        /* skip */
      }
    }
  }
  return acc;
}

function countCsvRows(path) {
  try {
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    return Math.max(0, lines.length - 1);
  } catch {
    return null;
  }
}

export function listFugvenyLists() {
  const root = fugvenyRoot();
  mkdirSync(root, { recursive: true });
  const files = walkCsvFiles(root)
    .map((f) => ({ ...f, rowsApprox: countCsvRows(f.path) }))
    .sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));

  const models = [];
  const modelCandidates = [
    join(root, "uj lista", "catboost", "model.cbm"),
    join(root, "catboost", "model.cbm"),
  ];
  for (const m of modelCandidates) {
    if (!existsSync(m)) continue;
    const metricsPath = join(dirname(m), "metrics.json");
    let metrics = null;
    if (existsSync(metricsPath)) {
      try {
        metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
      } catch {
        metrics = null;
      }
    }
    models.push({
      path: m,
      dir: dirname(m),
      metrics,
      mtime: statSync(m).mtime.toISOString(),
    });
  }

  return { root, lists: files, models, catboostDir: catboostDirs()[0] || null };
}

export function decodeListId(id) {
  const path = Buffer.from(String(id), "base64url").toString("utf8");
  const root = resolve(fugvenyRoot());
  const resolved = resolve(path);
  if (!resolved.startsWith(root)) {
    throw new Error("Érvénytelen lista útvonal.");
  }
  if (!existsSync(resolved)) {
    throw new Error("A lista fájl nem található.");
  }
  return resolved;
}

function runPython(args, { cwd, timeoutMs = 600_000 } = {}) {
  const catboostDir = cwd || resolveCatboostDir();
  const bin = pythonBin(catboostDir);
  return runCmd(bin, args, { cwd: catboostDir, timeoutMs });
}

async function packagesOk(dir) {
  try {
    await runCmd(
      pythonBin(dir),
      ["-c", "import numpy, pandas, sklearn, catboost; print('ok')"],
      { cwd: dir, timeoutMs: 60_000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function ensureCatboostVenv() {
  const dir = resolveCatboostDir();
  const hasVenv =
    existsSync(join(dir, ".venv", "bin", "python3")) ||
    existsSync(join(dir, ".venv", "bin", "python"));

  if (!hasVenv) {
    await runCmd("python3", ["-m", "venv", ".venv"], { cwd: dir, timeoutMs: 120_000 });
  }

  if (await packagesOk(dir)) {
    return dir;
  }

  const py = pythonBin(dir);
  // python -m pip megbízhatóbb, mint a pip bináris
  await runCmd(py, ["-m", "pip", "install", "--upgrade", "pip"], {
    cwd: dir,
    timeoutMs: 180_000,
  });
  await runCmd(py, ["-m", "pip", "install", "-r", "requirements.txt"], {
    cwd: dir,
    timeoutMs: 600_000,
  });

  if (!(await packagesOk(dir))) {
    throw new Error(
      "CatBoost függőségek telepítése sikertelen. Terminálban:\n" +
        `cd "${dir}" && source .venv/bin/activate && python -m pip install -r requirements.txt`
    );
  }
  return dir;
}

export async function trainFugvenyModel({ listId, iterations = 800 } = {}) {
  const csvPath = decodeListId(listId);
  const outDir = join(dirname(csvPath), "catboost");
  mkdirSync(outDir, { recursive: true });
  await ensureCatboostVenv();
  const result = await runPython(
    ["train.py", "--csv", csvPath, "--out", outDir, "--iterations", String(iterations)],
    { timeoutMs: 900_000 }
  );
  let metrics = null;
  const metricsPath = join(outDir, "metrics.json");
  if (existsSync(metricsPath)) {
    metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
  }
  return { ok: true, outDir, metrics, log: result.stdout };
}

export async function predictOne(input = {}) {
  await ensureCatboostVenv();
  const args = ["predict.py"];
  const map = {
    gyartmany: "--gyartmany",
    modell: "--modell",
    tipus: "--tipus",
    uzemanyag: "--uzemanyag",
    ev: "--ev",
    honap: "--honap",
    ccm: "--ccm",
    kw: "--kw",
    le: "--le",
    km: "--km",
  };
  for (const [key, flag] of Object.entries(map)) {
    if (input[key] != null && input[key] !== "") {
      args.push(flag, String(input[key]));
    }
  }
  const { stdout, stderr } = await runPython(args, { timeoutMs: 120_000 });
  const text = String(stdout || "").trim();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error(stderr || stdout || "Nincs predikció kimenet.");
  }
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
}

export async function scoreList({ listId } = {}) {
  const csvPath = decodeListId(listId);
  const out = join(dirname(csvPath), "catboost", "scored.csv");
  mkdirSync(dirname(out), { recursive: true });
  await ensureCatboostVenv();
  const { stdout } = await runPython(["predict.py", "--csv", csvPath, "--out", out], {
    timeoutMs: 600_000,
  });
  return { ok: true, out, log: stdout };
}

export function loadQueries() {
  const path = queriesPath();
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(data) ? data : data.queries || [];
  } catch {
    return [];
  }
}

export function saveQuery(query) {
  const queries = loadQueries();
  const id = query.id || `q_${Date.now()}`;
  const entry = {
    id,
    name: String(query.name || "Lekérdezés").trim(),
    createdAt: query.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    type: query.type || "estimate", // estimate | filter | undervalued
    params: query.params || {},
  };
  const idx = queries.findIndex((q) => q.id === id);
  if (idx >= 0) queries[idx] = entry;
  else queries.unshift(entry);
  writeFileSync(queriesPath(), JSON.stringify(queries, null, 2), "utf8");
  return entry;
}

export function deleteQuery(id) {
  const next = loadQueries().filter((q) => q.id !== id);
  writeFileSync(queriesPath(), JSON.stringify(next, null, 2), "utf8");
  return { ok: true };
}

/** Mentett lekérdezés futtatása scored/lista CSV-n */
export function runSavedQuery(id) {
  const q = loadQueries().find((x) => x.id === id);
  if (!q) throw new Error("Nincs ilyen lekérdezés.");

  if (q.type === "estimate") {
    return { query: q, mode: "estimate", params: q.params };
  }

  const scoredCandidates = [
    join(fugvenyRoot(), "uj lista", "catboost", "scored.csv"),
    join(fugvenyRoot(), "catboost", "scored.csv"),
  ];
  const scored = scoredCandidates.find((p) => existsSync(p));
  if (!scored) {
    throw new Error("Nincs scored.csv — előbb taníts és pontozd a listát.");
  }

  const text = readFileSync(scored, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { query: q, rows: [], scored };

  const headers = splitCsvLine(lines[0]);
  let rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? "";
    });
    return obj;
  });

  const p = q.params || {};
  if (p.gyartmany) {
    rows = rows.filter((r) => String(r.Gyartmany || "").toLowerCase() === String(p.gyartmany).toLowerCase());
  }
  if (p.modell) {
    rows = rows.filter((r) => String(r.Modell || "").toLowerCase() === String(p.modell).toLowerCase());
  }
  if (p.maxKm != null && p.maxKm !== "") {
    rows = rows.filter((r) => Number(r.Kmora_allas) <= Number(p.maxKm));
  }
  if (p.minEv != null && p.minEv !== "") {
    rows = rows.filter((r) => Number(r.Ev) >= Number(p.minEv));
  }
  if (p.maxEv != null && p.maxEv !== "") {
    rows = rows.filter((r) => Number(r.Ev) <= Number(p.maxEv));
  }
  if (q.type === "undervalued" || p.undervalued) {
    const maxPct = Number(p.maxElteresPct ?? -5);
    rows = rows.filter((r) => Number(r.Elteres_pct) <= maxPct);
    rows.sort((a, b) => Number(a.Elteres_pct) - Number(b.Elteres_pct));
  } else if (p.sort === "olcso") {
    rows.sort((a, b) => Number(a.Elteres_pct) - Number(b.Elteres_pct));
  }

  const limit = Math.min(Number(p.limit) || 50, 200);
  return { query: q, scored, total: rows.length, rows: rows.slice(0, limit) };
}

function splitCsvLine(line) {
  const cols = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      cols.push(cur);
      cur = "";
    } else cur += ch;
  }
  cols.push(cur);
  return cols;
}
