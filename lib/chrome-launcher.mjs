import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import { join, resolve } from "path";

const DEFAULT_PORT = 9222;

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findChromeExecutable() {
  return CHROME_PATHS.find((path) => existsSync(path)) ?? null;
}

export function getChromeProfileDir() {
  return resolve(process.cwd(), ".chrome-import-profile");
}

export function clearStaleProfileLocks(profileDir) {
  for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    const filePath = join(profileDir, name);
    if (!existsSync(filePath)) continue;
    try {
      unlinkSync(filePath);
    } catch {
      /* profil használatban */
    }
  }
}

export function readCdpPortFromProfile(profileDir) {
  const filePath = join(profileDir, "DevToolsActivePort");
  if (!existsSync(filePath)) return null;
  try {
    const line = readFileSync(filePath, "utf8").split("\n")[0]?.trim() ?? "";
    const port = Number.parseInt(line, 10);
    return Number.isFinite(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

export function startChromeWithDebugging(startUrl, port = DEFAULT_PORT) {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error(
      "Google Chrome nem található. Telepítsd a Chrome-ot, vagy indítsd kézzel: Google Chrome --remote-debugging-port=9222"
    );
  }

  const profileDir = getChromeProfileDir();
  mkdirSync(profileDir, { recursive: true });
  clearStaleProfileLocks(profileDir);

  const args = [
    `--remote-debugging-port=${port}`,
    `--remote-debugging-address=127.0.0.1`,
    `--user-data-dir=${profileDir}`,
    "--remote-allow-origins=*",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=TranslateUI",
    startUrl,
  ];

  const child = spawn(chromePath, args, { detached: true, stdio: "ignore" });
  child.unref();

  return { chromePath, profileDir, startUrl, port };
}

export async function isCdpReady(port = DEFAULT_PORT) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForCdpReady(port = DEFAULT_PORT, { profileDir, timeoutMs = 90000, onProgress } = {}) {
  const started = Date.now();
  let reportedFilePort = false;

  while (Date.now() - started < timeoutMs) {
    if (await isCdpReady(port)) return port;

    if (profileDir) {
      const filePort = readCdpPortFromProfile(profileDir);
      if (filePort && filePort !== port) {
        if (!reportedFilePort) {
          onProgress?.(`Chrome CDP port: ${filePort} (profil fájlból)`);
          reportedFilePort = true;
        }
        if (await isCdpReady(filePort)) return filePort;
      }
    }

    onProgress?.("Várakozás: Chrome CDP (9222)…");
    await sleep(1000);
  }

  return null;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
