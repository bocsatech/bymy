/**
 * Mobil web: felső sáv + alsó sziget (tabbar) minden site-app oldalon.
 * Asztalon CSS rejti. Görgetés közben a sziget elrejtődik, megálláskor visszajön.
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains("site-app")) return;
  if (body.classList.contains("auth-gate-page")) return;

  var page = body.getAttribute("data-site-page") || "";
  var isHub = body.classList.contains("hub-page--feed") || page === "hub";
  var isFiok = body.classList.contains("fiok-page") || page === "fiok";
  var CSS_HREF = "/css/hub-mobile-app.css?v=mwTabAll1";

  function ensureCss() {
    if (document.querySelector('link[href*="hub-mobile-app.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  function isActivePage(id) {
    if (page === id) return true;
    if (id === "hub" && (page === "hub" || page === "" || page === "index")) return true;
    if (id === "search" && (page === "auto" || page === "teherauto" || page === "ingatlan")) return true;
    if (id === "ajanlasok" && page === "ajanlasok") return true;
    if (id === "fiok" && (page === "fiok" || page === "beallitasok" || page === "uzenetek")) return true;
    if (id === "post" && page === "hirdetesfeladas") return true;
    return false;
  }

  function injectTop() {
    if (isHub || isFiok) return;
    if (document.querySelector(".mw-app-top")) return;

    var pages = [
      { id: "hub", href: "/", label: "Kezdőlap" },
      { id: "auto", href: "/auto.html", label: "Autó" },
      { id: "teherauto", href: "/teherauto.html", label: "Teherautó" },
      { id: "ingatlan", href: "/ingatlan.html", label: "Ingatlan" },
      { id: "ajanlasok", href: "/ajanlasok.html", label: "Ajánlások" },
      {
        id: "hirdetesfeladas",
        href: "/hirdetesfeladas.html",
        label: "Hirdetés feladás",
        authGuard: true,
      },
    ];

    var nav = pages
      .map(function (p) {
        var cls =
          "mw-app-pages-link" +
          (isActivePage(p.id) ? " is-active" : "") +
          (p.id === "hirdetesfeladas" ? " mw-app-pages-link--post" : "");
        var attrs = p.authGuard ? " data-auth-guard" : "";
        return '<a class="' + cls + '" href="' + p.href + '"' + attrs + ">" + p.label + "</a>";
      })
      .join("");

    var html =
      '<header class="mw-app-top" aria-label="Bymy mobil">' +
      '<a class="mw-app-logo" href="/" aria-label="Bymy">' +
      '<img class="bymy-logo-img" src="/images/bymy-logo.png?v=logoUpload1" alt="Bymy.hu" width="280" height="130" decoding="async" />' +
      "</a>" +
      '<p class="mw-app-hello" data-auth-member hidden>Hello&nbsp;<span data-auth-firstname></span></p>' +
      '<a class="mw-app-login" href="/belepes.html" data-auth-guest aria-label="Belépés" title="Belépés">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20.2c1.7-3.2 4.3-4.8 7.5-4.8s5.8 1.6 7.5 4.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      "</a>" +
      '<a class="mw-app-avatar" href="/fiok.html" data-auth-member hidden aria-label="Fiók" title="Fiók">' +
      '<span data-avatar-letter>A</span>' +
      '<img data-avatar-img alt="" hidden width="44" height="44" />' +
      "</a>" +
      '<nav class="mw-app-pages" aria-label="Főmenü">' +
      nav +
      "</nav>" +
      "</header>";

    body.insertAdjacentHTML("afterbegin", html);
    syncAuthCache();
  }

  function syncAuthCache() {
    try {
      var raw = sessionStorage.getItem("bymy-auth-user");
      var user = raw ? JSON.parse(raw) : null;
      if (!user || !user.email) return;
      var first = String((user.profile && user.profile.firstName) || "").trim();
      if (!first && user.displayName && String(user.displayName).indexOf("@") < 0) {
        first = String(user.displayName).trim().split(/\s+/)[0] || "";
      }
      if (!first && user.email) {
        var local = String(user.email).split("@")[0] || "";
        first = local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
      }
      if (!first) return;
      body.querySelectorAll(".mw-app-top span[data-auth-firstname]").forEach(function (el) {
        el.textContent = first;
      });
      var letter = first.charAt(0).toUpperCase();
      body.querySelectorAll(".mw-app-top [data-avatar-letter]").forEach(function (el) {
        el.textContent = letter;
      });
    } catch (e) {}
  }

  function tabCls(id) {
    return "mw-app-tab" + (isActivePage(id) ? " is-active" : "");
  }

  function injectTabbar() {
    if (document.querySelector(".mw-app-tabbar")) {
      markActiveTabs(document.querySelector(".mw-app-tabbar"));
      return;
    }

    var html =
      '<nav class="mw-app-tabbar" aria-label="Mobil főmenü">' +
      '<a class="' +
      tabCls("hub") +
      '" href="/"' +
      (isActivePage("hub") ? ' aria-current="page"' : "") +
      ">" +
      '<span class="mw-app-tab__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 11.2 12 5l7.5 6.2V19a1 1 0 0 1-1 1h-4v-4.6H9.5V20h-4a1 1 0 0 1-1-1v-7.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>' +
      "</span><span>Főoldal</span></a>" +
      '<a class="' +
      tabCls("search") +
      '" href="/auto.html">' +
      '<span class="mw-app-tab__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.2" stroke="currentColor" stroke-width="1.7"/><path d="M16.2 16.2 20 20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      "</span><span>Keresés</span></a>" +
      '<a class="mw-app-tab mw-app-tab--fab' +
      (isActivePage("post") ? " is-active" : "") +
      '" href="/hirdetesfeladas.html" data-auth-guard aria-label="Hirdetés feladás" title="Hirdetés feladás">' +
      '<span class="mw-app-tab__fab" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
      '</span><span class="mw-app-tab__fab-label">Feladás</span></a>' +
      '<a class="' +
      tabCls("ajanlasok") +
      '" href="/ajanlasok.html">' +
      '<span class="mw-app-tab__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-6.5-4.2-8.5-8.2C2.1 9.2 3.6 5.8 6.8 5.2c1.8-.3 3.5.5 4.5 2 1-1.5 2.7-2.3 4.5-2 3.2.6 4.7 4 3.3 7.1-2 4-8.5 8.2-8.5 8.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      "</span><span>Hírfolyam</span></a>" +
      '<a class="' +
      tabCls("fiok") +
      '" href="/fiok.html">' +
      '<span class="mw-app-tab__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.2" r="3.6" stroke="currentColor" stroke-width="1.7"/><path d="M5.2 19.2c1.6-2.9 4.2-4.4 6.8-4.4s5.2 1.5 6.8 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      "</span><span>Fiók</span></a>" +
      "</nav>";

    body.insertAdjacentHTML("beforeend", html);
  }

  function markActiveTabs(bar) {
    if (!bar) return;
    bar.querySelectorAll(".mw-app-tab").forEach(function (a) {
      a.classList.remove("is-active");
      a.removeAttribute("aria-current");
    });
    var map = [
      { sel: 'a[href="/"]', id: "hub" },
      { sel: 'a[href="/auto.html"]', id: "search" },
      { sel: "a.mw-app-tab--fab", id: "post" },
      { sel: 'a[href="/ajanlasok.html"]', id: "ajanlasok" },
      { sel: 'a[href="/fiok.html"]', id: "fiok" },
    ];
    map.forEach(function (item) {
      if (!isActivePage(item.id)) return;
      var el = bar.querySelector(item.sel);
      if (!el) return;
      el.classList.add("is-active");
      if (item.id !== "post") el.setAttribute("aria-current", "page");
    });
  }

  function bindScrollHide() {
    var bar = document.querySelector(".mw-app-tabbar");
    if (!bar || bar.dataset.scrollHideBound === "1") return;
    bar.dataset.scrollHideBound = "1";

    var timer = null;
    var hide = function () {
      bar.classList.add("is-scroll-hidden");
      clearTimeout(timer);
      timer = setTimeout(function () {
        bar.classList.remove("is-scroll-hidden");
      }, 220);
    };

    window.addEventListener("scroll", hide, { passive: true });
    document.addEventListener(
      "scroll",
      function (ev) {
        if (ev.target && ev.target !== document && ev.target !== document.documentElement) {
          hide();
        }
      },
      { passive: true, capture: true }
    );
  }

  ensureCss();
  injectTop();
  injectTabbar();
  bindScrollHide();
})();
