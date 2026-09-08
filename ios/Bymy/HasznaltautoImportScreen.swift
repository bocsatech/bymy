import SwiftUI
import WebKit

/// Egy autó (gyorsnézet) vs. kereskedői járműlista import.
enum HasznaltautoImportMode {
  case standard
  case dealer

  var title: String {
    switch self {
    case .standard: return "Használtautó import"
    case .dealer: return "Kereskedői import"
    }
  }

  var startURL: URL {
    switch self {
    case .standard: return URL(string: "https://www.hasznaltauto.hu/")!
    case .dealer: return URL(string: "https://admin.hasznaltauto.hu/")!
    }
  }

  var stepsHint: String {
    switch self {
    case .standard:
      return "1. Jelentkezz be  ·  2. Nyisd meg EGY autó gyorsnézetét  ·  3. Importálás"
    case .dealer:
      return "1. Bejelentkezés (admin)  ·  2. Hirdetéseim / járműlista  ·  3. Lista importálása"
    }
  }

  var actionLabel: String {
    switch self {
    case .standard: return "Hirdetés importálása"
    case .dealer: return "Lista importálása (összes autó)"
    }
  }

  var footerHint: String {
    switch self {
    case .standard:
      return "A jelszavadat nem tároljuk — csak a megnyitott oldal adatait olvassuk ki."
    case .dealer:
      return "A listából automatikusan végigmegyünk a hirdetéseken. Lapozás után futtasd újra."
    }
  }
}

/// Bejelentkezés a hasznaltauto.hu-ra appban, majd egy gombnyomásra import.
struct HasznaltautoImportScreen: View {
  var mode: HasznaltautoImportMode = .standard
  var onClose: () -> Void
  var onImported: ((ImportAPI.BatchResult) -> Void)? = nil

  @State private var currentURL: URL
  @State private var importing = false
  @State private var statusText: String?
  @State private var bulkProgress: (done: Int, total: Int)?
  @State private var resultSummary: String?
  @State private var errorText: String?
  @State private var webViewRef: WKWebView?

  private let haTint = Color(red: 0.92, green: 0.45, blue: 0.05)
  private let maxDealerBatch = 50

  init(mode: HasznaltautoImportMode = .standard, onClose: @escaping () -> Void, onImported: ((ImportAPI.BatchResult) -> Void)? = nil) {
    self.mode = mode
    self.onClose = onClose
    self.onImported = onImported
    _currentURL = State(initialValue: mode.startURL)
  }

  var body: some View {
    VStack(spacing: 0) {
      ScreenHeader(
        title: mode.title,
        subtitle: headerSubtitle,
        onBack: onClose
      )

      instructionBar

      HasznaltautoImportWebView(
        startURL: mode.startURL,
        onURLChange: { currentURL = $0 },
        onWebViewReady: { webViewRef = $0 }
      )

      bottomBar
    }
    .background(AppTheme.bg)
    .alert("Import hiba", isPresented: Binding(
      get: { errorText != nil },
      set: { if !$0 { errorText = nil } }
    )) {
      Button("OK", role: .cancel) { errorText = nil }
    } message: {
      Text(errorText ?? "")
    }
    .alert("Import kész", isPresented: Binding(
      get: { resultSummary != nil },
      set: { if !$0 { resultSummary = nil } }
    )) {
      Button("OK") {
        resultSummary = nil
        onClose()
      }
    } message: {
      Text(resultSummary ?? "")
    }
  }

  private var headerSubtitle: String {
    if importing {
      if let bulkProgress {
        return "Autó \(bulkProgress.done)/\(bulkProgress.total)"
      }
      return "Feldolgozás…"
    }
    if currentURL.host?.contains("admin.") == true {
      return mode == .dealer ? "Admin → járműlista" : "Admin bejelentkezés"
    }
    if currentURL.host?.contains("hasznaltauto") == true {
      return "Bejelentkezés → Hirdetéseim"
    }
    return "hasznaltauto.hu"
  }

  private var instructionBar: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(mode.stepsHint)
        .font(.caption)
        .foregroundStyle(AppTheme.textSecondary)
      if let bulkProgress, bulkProgress.total > 0 {
        ProgressView(value: Double(bulkProgress.done), total: Double(bulkProgress.total))
          .tint(haTint)
        Text("Gyorsnézet: \(bulkProgress.done) / \(bulkProgress.total)")
          .font(.caption.weight(.semibold))
          .foregroundStyle(haTint)
      } else if let statusText {
        Text(statusText)
          .font(.caption.weight(.medium))
          .foregroundStyle(haTint)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 16)
    .padding(.vertical, 10)
    .background(Color.white)
    .overlay(alignment: .bottom) {
      Divider()
    }
  }

  private var bottomBar: some View {
    VStack(spacing: 10) {
      Text(mode.footerHint)
        .font(.caption2)
        .foregroundStyle(AppTheme.textTertiary)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 8)

      Button {
        Task { await runImport() }
      } label: {
        HStack(spacing: 8) {
          if importing {
            ProgressView()
              .tint(.white)
              .scaleEffect(0.85)
          }
          Text(importing ? "Importálás…" : mode.actionLabel)
            .font(.body.weight(.semibold))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .foregroundStyle(.white)
        .background(haTint.opacity(importing ? 0.65 : 1))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
      }
      .buttonStyle(.plain)
      .disabled(importing || webViewRef == nil)
    }
    .padding(16)
    .background(Color.white)
    .overlay(alignment: .top) {
      Divider()
    }
  }

  @MainActor
  private func runImport() async {
    guard let webView = webViewRef else { return }
    guard currentURL.host?.contains("hasznaltauto") == true else {
      errorText = mode == .dealer
        ? "Először jelentkezz be az admin.hasznaltauto.hu-ra."
        : "Először jelentkezz be a hasznaltauto.hu-ra (www vagy admin)."
      return
    }

    if mode == .dealer && currentURL.host?.contains("admin.") != true {
      errorText = "Kereskedői importhoz az admin.hasznaltauto.hu Hirdetéseim / járműlista oldal kell."
      return
    }

    importing = true
    bulkProgress = nil
    statusText = "Oldal beolvasása…"
    defer {
      importing = false
      statusText = nil
      bulkProgress = nil
    }

    let pagePayload: (
      url: String,
      html: String,
      listingId: String,
      visibleTitle: String,
      visibleImage: String,
      visibleDescription: String,
      price: String,
      km: String,
      year: String,
      fuel: String,
      brand: String,
      model: String,
      imageJpegBase64: String
    )
    do {
      pagePayload = try await extractPage(from: webView)
    } catch {
      errorText = "Nem sikerült beolvasni az oldalt: \(error.localizedDescription)"
      return
    }

    if pagePayload.html.isEmpty {
      errorText = mode == .dealer
        ? "Üres oldal — nyisd meg a járműlistát (táblázat a hirdetésekkel), majd próbáld újra."
        : "Az oldal tartalma üres — görgess le a hirdetésekig, majd próbáld újra."
      return
    }

    statusText = "Hirdetések azonosítása…"
    do {
      let discovered = try await ImportAPI.discover(html: pagePayload.html, pageUrl: pagePayload.url)
      let refs = resolveImportRefs(discovered)

      if mode == .standard && (discovered.mode == "admin-single" || discovered.mode == "public-single" || refs.count <= 1) {
        statusText = "Hirdetés feldolgozása…"
        let fields = ImportAPI.PageFields(
          url: pagePayload.url,
          html: pagePayload.html,
          listingId: pagePayload.listingId.isEmpty
            ? (refs.first?.id ?? ImportAPI.listingId(from: pagePayload.url) ?? "")
            : pagePayload.listingId,
          visibleTitle: pagePayload.visibleTitle,
          visibleImage: pagePayload.visibleImage,
          visibleDescription: pagePayload.visibleDescription,
          price: pagePayload.price,
          km: pagePayload.km,
          year: pagePayload.year,
          fuel: pagePayload.fuel,
          brand: pagePayload.brand,
          model: pagePayload.model,
          imageJpegBase64: pagePayload.imageJpegBase64
        )
        let result = try await ImportAPI.importExtracted([fields], listUrl: pagePayload.url)
        finishImport(result)
        return
      }

      if refs.isEmpty {
        errorText = mode == .dealer
          ? "Nem találtunk autót a listán. Görgess le a táblázatig, vagy lapozz, majd próbáld újra."
          : "Nem találtunk importálható hirdetést ezen az oldalon."
        return
      }

      let batch = Array(refs.prefix(mode == .dealer ? maxDealerBatch : refs.count))
      if mode == .dealer && refs.count > maxDealerBatch {
        statusText = "Első \(maxDealerBatch) autó (összesen \(refs.count))…"
      }

      var listings: [[String: Any]] = []
      bulkProgress = (0, batch.count)

      for (index, ref) in batch.enumerated() {
        guard let adminUrl = ref.adminUrl, let adminURL = URL(string: adminUrl) else { continue }
        bulkProgress = (index, batch.count)
        statusText = "Gyorsnézet \(index + 1)/\(batch.count)…"
        let detail = try await loadAndExtract(webView: webView, url: adminURL)
        var entry: [String: Any] = [
          "url": adminUrl,
          "adminUrl": adminUrl,
          "html": detail.html,
        ]
        if let id = ref.id { entry["id"] = id }
        if let pub = ref.publicUrl { entry["publicUrl"] = pub }
        if !detail.visibleTitle.isEmpty { entry["visibleTitle"] = detail.visibleTitle }
        if !detail.visibleImage.isEmpty { entry["visibleImage"] = detail.visibleImage }
        if !detail.visibleDescription.isEmpty { entry["visibleDescription"] = detail.visibleDescription }
        if !detail.price.isEmpty { entry["price"] = detail.price }
        if !detail.km.isEmpty { entry["km"] = detail.km }
        if !detail.year.isEmpty { entry["year"] = detail.year }
        if !detail.fuel.isEmpty { entry["fuel"] = detail.fuel }
        if !detail.brand.isEmpty { entry["brand"] = detail.brand }
        if !detail.model.isEmpty { entry["model"] = detail.model }
        if !detail.imageJpegBase64.isEmpty { entry["imageJpegBase64"] = detail.imageJpegBase64 }
        listings.append(entry)
        bulkProgress = (index + 1, batch.count)
      }

      guard !listings.isEmpty else {
        errorText = "Egyetlen gyorsnézet oldal sem töltődött be."
        return
      }

      statusText = "Mentés (\(listings.count) hirdetés)…"
      let result = try await ImportAPI.importListings(listings, listUrl: pagePayload.url)
      finishImport(result, totalOnList: refs.count, importedBatch: listings.count)
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }

  private func resolveImportRefs(_ discovered: ImportAPI.DiscoverResult) -> [ImportAPI.ListingRef] {
    var seen = Set<String>()
    var out: [ImportAPI.ListingRef] = []
    for ref in discovered.refs ?? [] {
      guard let id = ref.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else { continue }
      guard seen.insert(id).inserted else { continue }
      let adminUrl = ref.adminUrl?.contains("gyorsnezet") == true
        ? ref.adminUrl
        : Self.gyorsnezetURL(for: id)
      out.append(ImportAPI.ListingRef(id: id, adminUrl: adminUrl, publicUrl: ref.publicUrl))
    }
    return out
  }

  private static func gyorsnezetURL(for id: String) -> String {
    "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/\(id)"
  }

  @MainActor
  private func finishImport(_ result: ImportAPI.BatchResult, totalOnList: Int? = nil, importedBatch: Int? = nil) {
    let saved = result.savedCount ?? 0
    let skipped = result.skippedCount ?? 0
    let errors = result.errorCount ?? 0
    var summary = "\(saved) hirdetés importálva."
    if skipped > 0 { summary += " \(skipped) már bent volt." }
    if errors > 0 { summary += " \(errors) hiba." }
    if mode == .dealer, let total = totalOnList, let batch = importedBatch, total > batch {
      summary += "\n\nA listán \(total) autó volt — most \(batch)-et dolgoztunk fel. Lapozz, majd importáld újra a többit."
    }
    resultSummary = summary
    onImported?(result)
  }

  @MainActor
  private func extractPage(from webView: WKWebView) async throws -> (
    url: String,
    html: String,
    listingId: String,
    visibleTitle: String,
    visibleImage: String,
    visibleDescription: String,
    price: String,
    km: String,
    year: String,
    fuel: String,
    brand: String,
    model: String,
    imageJpegBase64: String
  ) {
    let script = """
    JSON.stringify((function() {
      function clean(t) {
        return (t || '').replace(/\\s+/g, ' ').trim();
      }
      function isBadTitle(t) {
        return !t || t.length < 4 || t.length > 140
          || /javascript|gyorsnézet|gyorsnezet|hiba!|belépés|haszn[aá]ltaut[oó]\\.hu|regisztr/i.test(t);
      }
      function pickTitle() {
        const og = document.querySelector('meta[property="og:title"]');
        if (og && og.content && !isBadTitle(clean(og.content))) return clean(og.content).replace(/\\s*[|–-].*$/, '');
        const selectors = [
          'h1', 'h2',
          '[class*="hirdetes"][class*="cim"]',
          '[class*="title"]',
          '[class*="cim"]',
          '[class*="Cim"]',
          '.jarmu-adat h1',
          '.adatlap h1'
        ];
        for (const sel of selectors) {
          for (const el of document.querySelectorAll(sel)) {
            const t = clean(el.innerText || el.textContent || '');
            if (!isBadTitle(t)) return t;
          }
        }
        const dt = [...document.querySelectorAll('dt, td.bal.pontos, th')];
        for (const el of dt) {
          const label = clean(el.innerText || '');
          if (!/c[ií]m|hirdet[eé]s c[ií]me/i.test(label)) continue;
          const val = clean((el.nextElementSibling && el.nextElementSibling.innerText) || '');
          if (!isBadTitle(val)) return val;
        }
        const docTitle = clean((document.title || '').replace(/\\s*[|–-].*$/, ''));
        return isBadTitle(docTitle) ? '' : docTitle;
      }
      function pickImage() {
        const og = document.querySelector('meta[property="og:image"]');
        if (og && og.content && /^https?:/i.test(og.content)) return og.content;
        const imgs = [...document.querySelectorAll('img')];
        imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
        for (const img of imgs) {
          let src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') || '';
          if (src.startsWith('//')) src = 'https:' + src;
          if (!src.startsWith('http')) continue;
          if (/close|logo|icon|sprite|placeholder|prototip|static\\/images|avatar|badge/i.test(src)) continue;
          if (img.naturalWidth >= 80 || img.width >= 80 || /hasznaltauto|kep|photo|galeria/i.test(src)) return src;
        }
        return '';
      }
      function pickImageJpeg() {
        const imgs = [...document.querySelectorAll('img')];
        imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
        for (const img of imgs) {
          try {
            if ((img.naturalWidth || img.width || 0) < 120) continue;
            const src = img.currentSrc || img.src || '';
            if (/close|logo|icon|sprite|placeholder/i.test(src)) continue;
            const c = document.createElement('canvas');
            const w = Math.min(img.naturalWidth || img.width || 800, 1600);
            const h = Math.round(w * ((img.naturalHeight || img.height || 600) / Math.max(img.naturalWidth || img.width || 1, 1)));
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const data = c.toDataURL('image/jpeg', 0.82);
            if (data && data.length > 2000) return data;
          } catch (e) {}
        }
        return '';
      }
      function pickDescription() {
        for (const sel of ['textarea', '[class*="leiras"]', '[class*="description"]', '[id*="leiras"]']) {
          for (const el of document.querySelectorAll(sel)) {
            const t = clean(el.value || el.innerText || el.textContent || '');
            if (t.length >= 8 && !/^leírás$/i.test(t)) return t;
          }
        }
        const body = (document.body.innerText || '').replace(/\\r\\n/g, '\\n');
        const m = body.match(/(?:^|\\n)\\s*Leírás\\s*\\n+([\\s\\S]{8,4000}?)(?=\\n\\s*(?:Felszereltség|Általános|Műszaki|Megtalálható|Okmányok|Hirdetés)\\b|$)/i);
        if (m) return clean(m[1]);
        return '';
      }
      function fieldAfter(label) {
        const rows = document.querySelectorAll('tr, dl > *');
        for (const row of rows) {
          const text = clean(row.innerText || '');
          if (!text) continue;
          const re = new RegExp('^' + label + '\\\\s*[:\\n]\\s*(.+)$', 'i');
          const m = text.match(re);
          if (m) return clean(m[1].split('\\n')[0]);
        }
        const body = document.body.innerText || '';
        const re = new RegExp(label + '\\\\s*[:\\n]\\s*([^\\n]{1,80})', 'i');
        const m = body.match(re);
        return m ? clean(m[1]) : '';
      }
      function pickPrice() {
        const t = document.body.innerText || '';
        const m = t.match(/(\\d[\\d\\s.]{3,})\\s*Ft/i);
        return m ? m[1] : fieldAfter('Ár') || fieldAfter('Vételár');
      }
      function pickKm() {
        return fieldAfter('Kilométeróra') || fieldAfter('Km') || fieldAfter('Futásteljesítmény');
      }
      function pickYear() {
        const v = fieldAfter('Évjárat') || fieldAfter('Gyártási év') || '';
        const m = v.match(/(19|20)\\d{2}/);
        return m ? m[0] : '';
      }
      function pickFuel() {
        return fieldAfter('Üzemanyag') || '';
      }
      function pickListingId() {
        const href = location.href;
        let m = href.match(/\\/gyorsnezet\\/[^/]+\\/(\\d{5,})/i);
        if (m) return m[1];
        m = href.match(/-(\\d{5,})(?:\\?|$)/);
        return m ? m[1] : '';
      }
      const title = pickTitle();
      const parts = title.split(/\\s+/).filter(Boolean);
      return {
        url: location.href,
        html: document.documentElement.outerHTML.slice(0, 400000),
        listingId: pickListingId(),
        visibleTitle: title,
        visibleImage: pickImage(),
        visibleDescription: pickDescription(),
        price: pickPrice(),
        km: pickKm(),
        year: pickYear(),
        fuel: pickFuel(),
        brand: parts[0] || '',
        model: parts[1] || '',
        imageJpegBase64: pickImageJpeg()
      };
    })())
    """
    let jsonString: String = try await withCheckedThrowingContinuation { cont in
      webView.evaluateJavaScript(script) { value, error in
        if let error { cont.resume(throwing: error); return }
        guard let s = value as? String else {
          cont.resume(throwing: ImportAPI.ImportError.decoding)
          return
        }
        cont.resume(returning: s)
      }
    }
    guard
      let data = jsonString.data(using: .utf8),
      let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let pageUrl = payload["url"] as? String,
      let html = payload["html"] as? String
    else {
      throw ImportAPI.ImportError.decoding
    }
    func str(_ key: String) -> String {
      if let s = payload[key] as? String { return s }
      if let n = payload[key] as? NSNumber { return n.stringValue }
      return ""
    }
    return (
      pageUrl,
      html,
      str("listingId"),
      str("visibleTitle"),
      str("visibleImage"),
      str("visibleDescription"),
      str("price"),
      str("km"),
      str("year"),
      str("fuel"),
      str("brand"),
      str("model"),
      str("imageJpegBase64")
    )
  }

  @MainActor
  private func loadAndExtract(webView: WKWebView, url: URL) async throws -> (
    url: String,
    html: String,
    listingId: String,
    visibleTitle: String,
    visibleImage: String,
    visibleDescription: String,
    price: String,
    km: String,
    year: String,
    fuel: String,
    brand: String,
    model: String,
    imageJpegBase64: String
  ) {
    let previousDelegate = webView.navigationDelegate
    defer { webView.navigationDelegate = previousDelegate }

    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      final class NavBox: NSObject, WKNavigationDelegate {
        var finish: ((Error?) -> Void)?
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finish?(nil) }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish?(error) }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish?(error) }
      }
      let box = NavBox()
      HaImportNavRetain.current = box
      box.finish = { error in
        HaImportNavRetain.current = nil
        if let error { cont.resume(throwing: error) } else { cont.resume() }
      }
      webView.navigationDelegate = box
      webView.load(URLRequest(url: url))
    }
    try await Task.sleep(nanoseconds: 1_400_000_000)
    return try await extractPage(from: webView)
  }
}

// MARK: - WKWebView

private enum HaImportNavRetain {
  static var current: NSObject?
}

private struct HasznaltautoImportWebView: UIViewRepresentable {
  let startURL: URL
  var onURLChange: (URL) -> Void
  var onWebViewReady: (WKWebView) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(onURLChange: onURLChange)
  }

  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    config.websiteDataStore = .default()
    config.defaultWebpagePreferences.allowsContentJavaScript = true
    let web = WKWebView(frame: .zero, configuration: config)
    web.navigationDelegate = context.coordinator
    web.allowsBackForwardNavigationGestures = true
    web.customUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    web.load(URLRequest(url: startURL))
    DispatchQueue.main.async {
      onWebViewReady(web)
    }
    return web
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {}

  final class Coordinator: NSObject, WKNavigationDelegate {
    let onURLChange: (URL) -> Void

    init(onURLChange: @escaping (URL) -> Void) {
      self.onURLChange = onURLChange
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      if let url = webView.url {
        onURLChange(url)
      }
    }
  }
}

#Preview("Standard") {
  HasznaltautoImportScreen(onClose: {})
}

#Preview("Dealer") {
  HasznaltautoImportScreen(mode: .dealer, onClose: {})
}
