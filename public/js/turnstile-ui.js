const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptPromise = null;
let cachedConfig = null;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch("/api/auth/turnstile-config", {
      credentials: "same-origin",
      cache: "no-store",
    });
    cachedConfig = res.ok ? await res.json() : { enabled: false, siteKey: "" };
  } catch {
    cachedConfig = { enabled: false, siteKey: "" };
  }
  return cachedConfig;
}

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Turnstile script hiba")));
      if (window.turnstile) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile script hiba"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export async function mountTurnstile(container, { theme = "auto" } = {}) {
  if (!container) return { enabled: false, getToken: async () => "", reset: () => {} };
  const config = await loadConfig();
  if (!config.enabled || !config.siteKey) {
    return { enabled: false, getToken: async () => "", reset: () => {} };
  }

  await loadScript();
  container.hidden = false;
  container.innerHTML = "";
  let widgetId = null;
  let token = "";

  widgetId = window.turnstile.render(container, {
    sitekey: config.siteKey,
    theme,
    callback: (value) => {
      token = String(value || "");
    },
    "expired-callback": () => {
      token = "";
    },
    "error-callback": () => {
      token = "";
    },
  });

  return {
    enabled: true,
    getToken: async () => {
      if (token) return token;
      try {
        const fresh = window.turnstile?.getResponse?.(widgetId);
        return String(fresh || "");
      } catch {
        return "";
      }
    },
    reset: () => {
      token = "";
      try {
        window.turnstile?.reset?.(widgetId);
      } catch {
      }
    },
  };
}
