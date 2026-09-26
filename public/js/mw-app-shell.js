(function () {
  var body = document.body;
  if (!body || !body.classList.contains("site-app")) return;
  if (body.classList.contains("auth-gate-page")) return;

  var page = body.getAttribute("data-site-page") || "";
  var isHub = body.classList.contains("hub-page--feed") || page === "hub";
  var isFiok = body.classList.contains("fiok-page") || page === "fiok";
  var isPostAd = page === "hirdetesfeladas";
  var CSS_HREF = "/css/hub-mobile-app.css?v=deskHdr5";

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
    if (id === "search" && (page === "kereses" || page === "auto" || page === "teherauto" || page === "ingatlan")) return true;
    if (id === "ajanlasok" && page === "ajanlasok") return true;
    if (id === "fiok" && (page === "fiok" || page === "beallitasok" || page === "uzenetek")) return true;
    if (id === "post" && page === "hirdetesfeladas") return true;
    return false;
  }

  function injectTop() {
    if (isHub || isFiok || isPostAd) return;
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
      body.querySelectorAll(".mw-app-top span[data-auth-firstname], .hub-header span[data-auth-firstname], .site-app-header span[data-auth-firstname], .site-header span[data-auth-firstname]").forEach(function (el) {
        el.textContent = first;
      });
      var letter = first.charAt(0).toUpperCase();
      body.querySelectorAll(".mw-app-top [data-avatar-letter], .hub-header [data-avatar-letter], .site-app-header [data-avatar-letter], .site-header [data-avatar-letter]").forEach(function (el) {
        el.textContent = letter;
      });
    } catch (e) {}
  }

  function tabCls(id) {
    return "mw-app-tab" + (isActivePage(id) ? " is-active" : "");
  }

  function injectTabbar() {
    if (isPostAd) {
      document.querySelectorAll(".mw-app-tabbar").forEach(function (el) {
        el.remove();
      });
      return;
    }
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
      '" href="/kereses.html"' +
      (isActivePage("search") ? ' aria-current="page"' : "") +
      ">" +
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
      { sel: 'a[href="/kereses.html"]', id: "search" },
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

    var idleTimer = null;
    var hidden = false;
    var IDLE_MS = 520;

    function showBar() {
      if (!hidden) return;
      hidden = false;
      bar.classList.remove("is-scroll-hidden");
    }

    function hideBar() {
      if (hidden) return;
      hidden = true;
      bar.classList.add("is-scroll-hidden");
    }

    function isTabbarTarget(target) {
      return target && target.closest && target.closest(".mw-app-tabbar");
    }

    function onScrollActivity() {
      hideBar();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(showBar, IDLE_MS);
    }

    window.addEventListener("scroll", onScrollActivity, { passive: true });
    document.addEventListener("scroll", onScrollActivity, { passive: true, capture: true });
    document.addEventListener(
      "touchmove",
      function (ev) {
        if (isTabbarTarget(ev.target)) return;
        onScrollActivity();
      },
      { passive: true, capture: true }
    );
    document.addEventListener(
      "wheel",
      function (ev) {
        if (isTabbarTarget(ev.target)) return;
        onScrollActivity();
      },
      { passive: true, capture: true }
    );
    document.addEventListener("bymy-scroll-activity", onScrollActivity);
  }

  function postAdHref() {
    if (page === "auto") return "/hirdetesfeladas.html?vertical=auto&subtype=szemelyauto&start=1";
    if (page === "teherauto") return "/hirdetesfeladas.html?vertical=auto&subtype=teherauto&start=1";
    if (page === "ingatlan") return "/hirdetesfeladas.html?vertical=ingatlan&subtype=ingatlan&start=1";
    return "/hirdetesfeladas.html";
  }

  function ajanlasokHref() {
    if (page === "auto") return "/ajanlasok.html?vertical=auto";
    if (page === "teherauto") return "/ajanlasok.html?vertical=teherauto";
    if (page === "ingatlan") return "/ajanlasok.html?vertical=ingatlan";
    return "/ajanlasok.html";
  }

  function removeExistingDeskHeaders() {
    document
      .querySelectorAll(
        "body.site-app > .hub-header, body.site-app > .site-header, body.site-app > header.site-app-header, body.site-app > .site-app-header, body.site-app > .home-header"
      )
      .forEach(function (el) {
        el.remove();
      });
  }

  function navActiveClass(id) {
    if (id === "hub") return isActivePage("hub") ? " active" : "";
    if (id === "auto") return page === "auto" ? " active" : "";
    if (id === "teherauto") return page === "teherauto" ? " active" : "";
    if (id === "ingatlan") return page === "ingatlan" ? " active" : "";
    if (id === "ajanlasok") return page === "ajanlasok" ? " active" : "";
    return "";
  }

  function ensureLogoCss() {
    if (document.querySelector('link[href*="bymy-logo-size.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/css/bymy-logo-size.css?v=deskHdr5";
    document.head.appendChild(link);
  }

  function ensureDeskHeaderCss() {
    var href = "/css/site-desk-header.css?v=deskHdr6";
    if (document.querySelector("link[data-site-desk-header-css], link[href*='site-desk-header.css']")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-site-desk-header-css", "1");
    document.head.appendChild(link);
  }

  function ensureNavFont() {
    if (document.querySelector('link[href*="family=DM+Sans"]')) return;
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
      var pre1 = document.createElement("link");
      pre1.rel = "preconnect";
      pre1.href = "https://fonts.googleapis.com";
      document.head.appendChild(pre1);
      var pre2 = document.createElement("link");
      pre2.rel = "preconnect";
      pre2.href = "https://fonts.gstatic.com";
      pre2.crossOrigin = "anonymous";
      document.head.appendChild(pre2);
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700;800&display=swap";
    document.head.appendChild(link);
  }

  function readNavCountsSync() {
    try {
      var raw = sessionStorage.getItem("bymy.navCounts.v1");
      if (!raw) return { auto: 0, teher: 0, ingatlan: 0 };
      var parsed = JSON.parse(raw);
      return {
        auto: Number(parsed && parsed.auto) || 0,
        teher: Number(parsed && parsed.teher) || 0,
        ingatlan: Number(parsed && parsed.ingatlan) || 0,
      };
    } catch (e) {
      return { auto: 0, teher: 0, ingatlan: 0 };
    }
  }

  function formatNavCount(n) {
    try {
      return new Intl.NumberFormat("hu-HU").format(Number(n) || 0);
    } catch (e) {
      return String(Number(n) || 0);
    }
  }

  function navCountHtml(key, counts) {
    return '<span class="nav-count" aria-hidden="true">' + formatNavCount(counts[key]) + "</span>";
  }

  function pruneForeignHeaders() {
    document
      .querySelectorAll(
        "body.site-app > .hub-header:not([data-site-desk-header]), body.site-app > .home-header:not([data-site-desk-header]), body.site-app > .site-header:not([data-site-desk-header]), body.site-app > header.site-app-header:not([data-site-desk-header]), body.site-app > .site-app-header:not([data-site-desk-header])"
      )
      .forEach(function (el) {
        el.remove();
      });
  }

  function injectDeskHeader() {
    /* Mindig ugyanaz a DOM — különben oldalanként elcsúszik a sav */
    removeExistingDeskHeaders();

    var msgSvg =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 6.8h9.5a2.2 2.2 0 0 1 2.2 2.2v4.2a2.2 2.2 0 0 1-2.2 2.2H10l-3.2 2.4V15.2H5A2.2 2.2 0 0 1 2.8 13V9a2.2 2.2 0 0 1 2.2-2.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14.2 8.2h4A2.2 2.2 0 0 1 20.4 10.4v3.4a2.2 2.2 0 0 1-2.2 2.2h-.7v1.7l-2.2-1.7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

    var counts = readNavCountsSync();

    var html =
      '<header class="hub-header" data-site-desk-header aria-label="Bymy">' +
      '<div class="hub-header-inner">' +
      '<a class="hub-logo" href="/" aria-label="Bymy">' +
      '<img class="bymy-logo-img bymy-logo-img--nav" src="/images/bymy-logo.png?v=logoUpload1" alt="Bymy.hu" width="190" height="48" decoding="async" />' +
      "</a>" +
      '<nav class="hub-nav" aria-label="Főmenü">' +
      '<a class="hub-nav-link hub-nav-link--kezdolap' +
      navActiveClass("hub") +
      '" href="/" aria-label="Kezdőlap">' +
      '<img class="hub-nav-kezdolap-img" src="/images/kezdolap-nav.png?v=kezdolapNav1" alt="" width="72" height="28" decoding="async" />' +
      "</a>" +
      '<a class="hub-nav-link' +
      navActiveClass("auto") +
      '" href="/auto.html">Autó ' +
      navCountHtml("auto", counts) +
      "</a>" +
      '<a class="hub-nav-link' +
      navActiveClass("teherauto") +
      '" href="/teherauto.html">Teherautó ' +
      navCountHtml("teher", counts) +
      "</a>" +
      '<a class="hub-nav-link' +
      navActiveClass("ingatlan") +
      '" href="/ingatlan.html">Ingatlan ' +
      navCountHtml("ingatlan", counts) +
      "</a>" +
      '<a class="hub-nav-link' +
      navActiveClass("ajanlasok") +
      '" href="' +
      ajanlasokHref() +
      '">Ajánlások</a>' +
      "</nav>" +
      '<div class="hub-header-top">' +
      '<div class="hub-header-actions site-header-actions">' +
      '<a class="hub-header-msg" href="/uzenetek.html" data-auth-member hidden>' +
      msgSvg +
      "<span>Üzenetek</span></a>" +
      '<div class="site-header-auth-row" data-auth-guest>' +
      '<a class="hub-btn hub-btn--ghost" href="/belepes.html" data-auth-login>Belépés</a>' +
      '<a class="hub-btn hub-btn--ghost" href="/regisztracio.html" data-auth-register>Regisztráció</a>' +
      "</div>" +
      '<div class="site-header-avatar-wrap" data-avatar-menu data-auth-member hidden>' +
      '<button type="button" class="site-header-profile" data-auth-avatar data-avatar-toggle aria-expanded="false" aria-label="Fiók" title="Fiók">' +
      '<span class="site-header-avatar">' +
      '<span data-avatar-letter>A</span>' +
      '<img data-avatar-img alt="" hidden width="44" height="44" />' +
      "</span>" +
      '<span class="site-header-firstname" data-auth-firstname></span>' +
      '<svg class="site-header-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button></div>" +
      '<a class="hub-btn hub-btn--post" href="' +
      postAdHref() +
      '" data-auth-guard>+ Hirdetésfeladás</a>' +
      '<button type="button" class="hub-theme-toggle" data-theme-toggle aria-label="Színmód" title="Színmód"></button>' +
      "</div></div></div></header>";

    var after = document.querySelector(".mw-app-top, .fiok-top");
    if (after && after.parentNode === body) {
      after.insertAdjacentHTML("afterend", html);
    } else {
      body.insertAdjacentHTML("afterbegin", html);
    }
    body.setAttribute("data-desk-hdr-ready", "1");
    pruneForeignHeaders();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", pruneForeignHeaders);
    }
    syncAuthCache();
    ensureDeskHeaderDeps();
  }

  function ensureDeskHeaderDeps() {
    function addModule(src) {
      if (document.querySelector('script[src="' + src + '"]')) return;
      var s = document.createElement("script");
      s.type = "module";
      s.src = src;
      document.body.appendChild(s);
    }
    addModule("/js/theme.js?v=willhabenHdr1");
    addModule("/js/site-avatar-menu.js?v=settingsHome1");
    addModule("/js/nav-counts.js?v=navCount4");
  }

  ensureCss();
  ensureLogoCss();
  ensureDeskHeaderCss();
  ensureNavFont();
  injectTop();
  injectDeskHeader();
  injectTabbar();
  if (!isPostAd) bindScrollHide();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureDeskHeaderCss);
  } else {
    ensureDeskHeaderCss();
  }

  import("/js/hub-promo.js?v=promoHomeOnly1")
    .then(function (mod) {
      if (mod && typeof mod.mountHubPromos === "function") return mod.mountHubPromos();
    })
    .catch(function () {});
})();
