const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
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
  if (window.turnstile?.render) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      waitForTurnstileApi(8000).then(resolve, reject);
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile script hiba"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function waitForTurnstileApi(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (window.turnstile?.render) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Turnstile nem töltődött be"));
        return;
      }
      setTimeout(tick, 40);
    };
    tick();
  });
}

/**
 * Cloudflare Turnstile — Managed ellenőrző, Cloudflare logóval (normal méret).
 */
export async function mountTurnstile(container, { theme = "light", size = "normal", appearance = "always" } = {}) {
  if (!container) return { enabled: false, ready: true, getToken: async () => "", reset: () => {} };

  const config = await loadConfig();
  if (config.required && !config.enabled) {
    if (size !== "invisible") {
      container.innerHTML =
        '<p class="auth-security-fail">A biztonsági ellenőrzés nincs beállítva az oldalon. Próbáld később.</p>';
    }
    return {
      enabled: true,
      ready: false,
      error: "Turnstile nincs konfigurálva",
      getToken: async () => "",
      reset: () => {},
    };
  }
  if (!config.enabled || !config.siteKey) {
    return { enabled: false, ready: true, getToken: async () => "", reset: () => {} };
  }

  const invisible = size === "invisible";
  if (invisible) {
    container.setAttribute("aria-hidden", "true");
    container.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;clip:rect(0,0,0,0)";
  } else {
    const box = container.closest(".auth-security-box") || container.closest(".hd-phone-security") || container;
    box.hidden = false;
    container.hidden = false;
  }
  container.innerHTML = "";
  container.setAttribute("aria-busy", "true");

  let widgetId = null;
  let token = "";

  try {
    await loadScript();
    await waitForTurnstileApi();

    // Cloudflare: size csak compact | flexible | normal (nincs "invisible").
    const renderSize = invisible ? "normal" : size === "invisible" ? "normal" : size;
    widgetId = window.turnstile.render(container, {
      sitekey: config.siteKey,
      theme,
      size: renderSize,
      appearance: invisible ? "execute" : appearance,
      language: "hu",
      callback: (value) => {
        token = String(value || "");
        container.setAttribute("aria-busy", "false");
        container.removeAttribute("data-turnstile-error");
      },
      "expired-callback": () => {
        token = "";
      },
      "error-callback": () => {
        token = "";
        container.setAttribute("data-turnstile-error", "1");
      },
      "timeout-callback": () => {
        token = "";
      },
    });
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    console.error("[turnstile]", error);
    container.innerHTML =
      '<p class="auth-security-fail">A biztonsági ellenőrző most nem elérhető. Frissítsd az oldalt, és próbáld újra.</p>';
    return {
      enabled: true,
      ready: false,
      error: error?.message || "Turnstile hiba",
      getToken: async () => "",
      reset: () => {},
    };
  }

  const getToken = async ({ waitMs = 0 } = {}) => {
    const read = () => {
      if (token) return token;
      try {
        return String(window.turnstile?.getResponse?.(widgetId) || "");
      } catch {
        return "";
      }
    };
    let value = read();
    if (value || waitMs <= 0) return value;
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      value = read();
      if (value) return value;
    }
    return read();
  };

  const reset = () => {
    token = "";
    try {
      window.turnstile?.reset?.(widgetId);
    } catch {
      /* ignore */
    }
  };

  const widget = { enabled: true, ready: true, getToken, reset };

  if (invisible) {
    widget.execute = async ({ waitMs = 15000 } = {}) => {
      token = "";
      try {
        await window.turnstile?.execute?.(widgetId);
      } catch {
        /* ignore */
      }
      return getToken({ waitMs });
    };
  }

  return widget;
}
