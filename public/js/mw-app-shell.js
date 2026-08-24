/**
 * Mobil web felső sáv: logo, Hello, profil, oldalnevek — minden site-app oldalon.
 * Asztalon CSS rejti. Ha már van .mw-app-top (kezdőlap), nem dupláz.
 */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains("site-app")) return;
  if (body.classList.contains("fiok-page")) return;
  /* Kezdőlap: a felső sáv már a HTML-ben van — ne injektáljunk másodikat */
  if (body.classList.contains("hub-page--feed") || body.getAttribute("data-site-page") === "hub") return;
  if (document.querySelector(".mw-app-top")) return;

  if (!document.querySelector('link[href*="hub-mobile-app.css"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/css/hub-mobile-app.css?v=mwPostAd1";
    document.head.appendChild(link);
  }

  var page = body.getAttribute("data-site-page") || "";
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

  function isActive(id) {
    if (page === id) return true;
    if (id === "hub" && (page === "hub" || page === "" || page === "index")) return true;
    return false;
  }

  var nav = pages
    .map(function (p) {
      var cls =
        "mw-app-pages-link" +
        (isActive(p.id) ? " is-active" : "") +
        (p.id === "hirdetesfeladas" ? " mw-app-pages-link--post" : "");
      var attrs = p.authGuard ? ' data-auth-guard' : "";
      return (
        '<a class="' +
        cls +
        '" href="' +
        p.href +
        '"' +
        attrs +
        ">" +
        p.label +
        "</a>"
      );
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

  // Auth cache: keresztnév / avatar betű azonnal
  try {
    var raw = sessionStorage.getItem("bymy-auth-user");
    var user = raw ? JSON.parse(raw) : null;
    if (user && user.email) {
      var first = String((user.profile && user.profile.firstName) || "").trim();
      if (!first && user.displayName && String(user.displayName).indexOf("@") < 0) {
        first = String(user.displayName).trim().split(/\s+/)[0] || "";
      }
      if (!first && user.email) {
        var local = String(user.email).split("@")[0] || "";
        first = local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
      }
      if (first) {
        body.querySelectorAll(".mw-app-top span[data-auth-firstname]").forEach(function (el) {
          el.textContent = first;
        });
        var letter = first.charAt(0).toUpperCase();
        body.querySelectorAll(".mw-app-top [data-avatar-letter]").forEach(function (el) {
          el.textContent = letter;
        });
      }
    }
  } catch (e) {}
})();
