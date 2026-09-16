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

function manualCheckClass(container) {
  if (container.closest(".auth-security-box")) return "auth-manual-check";
  if (container.closest(".hd-phone-security")) return "hd-manual-check";
  return "bymy-manual-check";
}

function attachManualCheck(container) {
  const label = document.createElement("label");
  label.className = manualCheckClass(container);
  label.innerHTML =
    '<input type="checkbox" autocomplete="off" /><span>Biztonsági ellenőrzés — pipáld be a mezőt</span>';
  container.parentElement?.insertBefore(label, container);
  const input = label.querySelector("input");
  return {
    label,
    isChecked: () => Boolean(input?.checked),
    reset: () => {
      if (input) input.checked = false;
    },
    onChange: (fn) => input?.addEventListener("change", fn),
  };
}

function disabledWidget(extra = {}) {
  return {
    enabled: false,
    ready: true,
    getToken: async () => "",
    reset: () => {},
    isManualChecked: () => true,
    ...extra,
  };
}

/**
 * Cloudflare Turnstile — Managed ellenőrző.
 * requireManualCheck: saját pipa kötelező (Managed auto-pass ellen); alapból normal méretnél be.
 */
export async function mountTurnstile(
  container,
  { theme = "light", size = "normal", appearance = "always", requireManualCheck = null } = {}
) {
  if (!container) return disabledWidget();

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
      isManualChecked: () => false,
    };
  }
  if (!config.enabled || !config.siteKey) {
    return disabledWidget({ isManualChecked: () => true });
  }

  const invisible = size === "invisible";
  const needManual = requireManualCheck ?? !invisible;
  const box = container.closest(".auth-security-box") || container.closest(".hd-phone-security") || container;

  if (!invisible) {
    box.hidden = false;
    container.hidden = false;
  }

  let manual = null;
  if (needManual) {
    manual = attachManualCheck(container);
    container.hidden = true;
  }

  let widgetId = null;
  let token = "";
  let rendered = false;

  const renderWidget = async () => {
    if (rendered) return;
    rendered = true;
    container.hidden = false;
    container.innerHTML = "";
    container.setAttribute("aria-busy", "true");

    await loadScript();
    await waitForTurnstileApi();

    widgetId = window.turnstile.render(container, {
      sitekey: config.siteKey,
      theme,
      size: invisible ? "invisible" : size,
      appearance: invisible ? "execute" : appearance,
      language: "hu",
      "feedback-enabled": false,
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
  };

  if (manual) {
    manual.onChange(async () => {
      if (!manual.isChecked()) {
        token = "";
        rendered = false;
        container.innerHTML = "";
        container.hidden = true;
        if (widgetId != null) {
          try {
            window.turnstile?.remove?.(widgetId);
          } catch {
            /* ignore */
          }
          widgetId = null;
        }
        return;
      }
      try {
        await renderWidget();
      } catch (error) {
        console.error("[turnstile]", error);
        container.innerHTML =
          '<p class="auth-security-fail">A biztonsági ellenőrző most nem elérhető. Frissítsd az oldalt.</p>';
        container.hidden = false;
      }
    });
  } else {
    try {
      if (invisible) {
        container.setAttribute("aria-hidden", "true");
        container.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;clip:rect(0,0,0,0)";
      }
      await renderWidget();
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
        isManualChecked: () => true,
      };
    }
  }

  const readToken = () => {
    if (manual && !manual.isChecked()) return "";
    if (token) return token;
    if (widgetId == null) return "";
    try {
      return String(window.turnstile?.getResponse?.(widgetId) || "");
    } catch {
      return "";
    }
  };

  const getToken = async ({ waitMs = 0 } = {}) => {
    if (manual && !manual.isChecked()) return "";
    if (!rendered && manual?.isChecked()) {
      try {
        await renderWidget();
      } catch {
        return "";
      }
    }
    let value = readToken();
    if (value || waitMs <= 0) return value;
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      value = readToken();
      if (value) return value;
    }
    return readToken();
  };

  const reset = () => {
    token = "";
    manual?.reset();
    rendered = false;
    container.innerHTML = "";
    container.hidden = Boolean(manual);
    if (widgetId != null) {
      try {
        window.turnstile?.remove?.(widgetId);
      } catch {
        /* ignore */
      }
      widgetId = null;
    }
  };

  const widget = {
    enabled: true,
    ready: true,
    getToken,
    reset,
    isManualChecked: () => (manual ? manual.isChecked() : true),
  };

  if (invisible && !needManual) {
    widget.execute = async ({ waitMs = 15000 } = {}) => {
      token = "";
      if (!rendered) await renderWidget();
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
