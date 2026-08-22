/** Böngésző beacon — oldallátogatás + heartbeat (jelenlegi látogatók). */
(function () {
  const KEY = "bymy_vid";
  let vid = "";
  try {
    vid = localStorage.getItem(KEY) || "";
  } catch {
    /* ignore */
  }

  function connType() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return "";
    return c.effectiveType || c.type || "";
  }

  function payload(kind) {
    return {
      kind: kind || "page",
      path: location.pathname + location.search,
      referrer: document.referrer || "",
      pageTitle: document.title || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screenWidth: window.screen && screen.width,
      screenHeight: window.screen && screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      platform: navigator.platform || "",
      connection: connType(),
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      cookieEnabled: navigator.cookieEnabled,
      userAgent: navigator.userAgent || "",
      visitorId: vid || undefined,
    };
  }

  function send(kind) {
    const body = JSON.stringify(payload(kind));
    const headers = { "Content-Type": "application/json" };
    if (vid) headers["X-Bymy-Vid"] = vid;
    fetch("/api/visit", {
      method: "POST",
      headers,
      body,
      credentials: "same-origin",
      keepalive: true,
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data && data.visitorId) {
          vid = data.visitorId;
          try {
            localStorage.setItem(KEY, vid);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }

  send("page");
  setInterval(() => send("heartbeat"), 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") send("heartbeat");
  });
})();
