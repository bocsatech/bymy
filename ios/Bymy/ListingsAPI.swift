import Foundation

/// Autosweb `GET /api/listings` — ugyanaz, mint a webes főoldal rács.
enum ListingsAPI {
  static var baseURL: URL { PartnerRecommendationsClient.baseURL }
  static let homeFetchLimit = 500

  struct HomeListing: Identifiable, Equatable {
    let id: String
    let title: String
    let priceLabel: String
    let meta: String
    let badge: String?
    let updatedAt: String
    let imageURLs: [URL]
    /// Autosweb status: feladott | inaktiv | mentett
    var status: String? = nil
    /// Tulajdonos (Autosweb users.id), ha van.
    var userId: String? = nil
    /// Keresőszűréshez (preview)
    var brand: String? = nil
    var model: String? = nil
    var year: Int? = nil
    var km: Int? = nil
    var priceFt: Int? = nil
    var fuelRaw: String? = nil
    var viewsWeb: Int = 0
    var viewsApp: Int = 0

    /// Aktív = megjelenik a nyilvános találati listában.
    var isActiveInSearch: Bool { (status ?? "").lowercased() == "feladott" }

    var featuredAd: FeaturedAd {
      FeaturedAd(
        id: id,
        title: title,
        priceLabel: priceLabel,
        meta: meta,
        badge: badge
      )
    }

    var messageTarget: ListingMessageTarget {
      ListingMessageTarget(
        listingId: id,
        title: title,
        priceLabel: priceLabel,
        meta: meta,
        sellerId: userId.flatMap(Int.init)
      )
    }

    /// Könnyű kártya a listához (részletes adat a loaderben jön).
    var cardDetail: ListingDetail {
      ListingDetail(
        id: id,
        title: title,
        priceLabel: priceLabel,
        kmLabel: meta.split(separator: "·").dropFirst().first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? "—",
        registrationLabel: meta.split(separator: "·").first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? "—",
        imageURLs: imageURLs,
        meta: meta,
        badge: badge,
        vehicleRows: [],
        equipment: [],
        description: "",
        sellerName: "Eladó",
        sellerPhone: nil,
        addressLines: [],
        mapQuery: nil,
        ownerUserId: userId.flatMap(Int.init)
      )
    }

    func withBadge(_ badge: String?) -> HomeListing {
      with(status: status, badge: badge)
    }

    func with(status: String?, badge: String? = nil) -> HomeListing {
      let nextStatus = status
      let nextBadge = badge ?? Self.statusBadgeLabel(nextStatus)
      return HomeListing(
        id: id,
        title: title,
        priceLabel: priceLabel,
        meta: meta,
        badge: nextBadge,
        updatedAt: updatedAt,
        imageURLs: imageURLs,
        status: nextStatus,
        userId: userId,
        brand: brand,
        model: model,
        year: year,
        km: km,
        priceFt: priceFt,
        fuelRaw: fuelRaw,
        viewsWeb: viewsWeb,
        viewsApp: viewsApp
      )
    }

    static func statusBadgeLabel(_ status: String?) -> String? {
      switch (status ?? "").lowercased() {
      case "feladott": return "Aktív"
      case "inaktiv": return "Inaktív"
      case "mentett": return "Inaktív"
      default: return nil
      }
    }
  }

  /// Relatív API út — NE `appendingPathComponent("a/b/c")` (a `/` %-kódolódhat).
  static func apiURL(_ path: String, query: [URLQueryItem] = []) -> URL? {
    let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
    guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
      return nil
    }
    let basePath = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
    components.path = basePath + "/" + trimmed
    if !query.isEmpty {
      components.queryItems = query
    }
    return components.url
  }

  /// Relatív `/uploads/...` vagy abszolút URL → betölthető kép.
  static func absoluteImageURL(_ path: String?) -> URL? {
    let raw = (path ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !raw.isEmpty else { return nil }
    if raw.hasPrefix("http://") || raw.hasPrefix("https://") {
      return URL(string: raw)
    }
    var base = baseURL.absoluteString
    while base.hasSuffix("/") { base.removeLast() }
    let pathPart = raw.hasPrefix("/") ? raw : "/\(raw)"
    return URL(string: base + pathPart)
  }

  enum ListingsError: LocalizedError {
    case unreachable
    case server(String)
    case notLoggedIn
    case needsPhoto

    var errorDescription: String? {
      switch self {
      case .unreachable:
        return AutoswebBaseURL.unreachableMessage()
      case .server(let m):
        return m
      case .notLoggedIn:
        return "A feladáshoz / Hirdetéseimhez be kell jelentkezned."
      case .needsPhoto:
        return "Legalább egy fénykép kell a feladáshoz."
      }
    }
  }

  /// Új / szerkesztett hirdetés → `POST /api/listings` (`id` = frissítés).
  /// `photos`: base64 JPEG lista; szerkesztéskor üres = megmaradnak a régi képek.
  @discardableResult
  static func saveListing(
    form: [String: Any],
    status: String = "feladott",
    photos: [String] = [],
    token: String? = nil,
    listingId: Int? = nil
  ) async throws -> Int {
    guard let token, !token.isEmpty else { throw ListingsError.notLoggedIn }
    let isEdit = listingId != nil
    if status == "feladott", photos.isEmpty, !isEdit { throw ListingsError.needsPhoto }
    guard let url = apiURL("api/listings") else { throw ListingsError.unreachable }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = photos.isEmpty ? 30 : 120
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    var body: [String: Any] = ["form": form, "status": status]
    if let listingId { body["id"] = listingId }
    if !photos.isEmpty {
      body["photos"] = photos
    }
    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      if http.statusCode == 401 { throw ListingsError.notLoggedIn }
      if err == "Ismeretlen API." || err?.contains("Ismeretlen") == true {
        throw ListingsError.server("A mentés most nem sikerült. Próbáld újra.")
      }
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
    let decoded = try JSONDecoder().decode(SaveResponse.self, from: data)
    guard let id = decoded.listing?.id else {
      throw ListingsError.server("Mentés sikertelen — nincs azonosító.")
    }
    // Ha a szerver nem mentett képet, jelezzük (régi Autosweb — nincs listing-photos).
    if status == "feladott", !photos.isEmpty {
      let foKep = (decoded.listing?.fo_kep ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      if foKep.isEmpty {
        throw ListingsError.server(
          "A kép nem mentődött el. Próbáld újra."
        )
      }
    }
    PostedListingsStore.remember(id)
    return id
  }

  static func saveListingPhotos(id: String, items: [[String: String]], token: String?) async throws {
    guard let token, !token.isEmpty else { throw ListingsError.notLoggedIn }
    guard let url = apiURL("api/listings/\(id)/photos") else { throw ListingsError.unreachable }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 120
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["items": items])
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      if http.statusCode == 401 { throw ListingsError.notLoggedIn }
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
  }

  static func deleteListing(id: String, token: String?) async throws {
    guard let token, !token.isEmpty else { throw ListingsError.notLoggedIn }
    guard let url = apiURL("api/listings/\(id)") else { throw ListingsError.unreachable }
    var request = URLRequest(url: url)
    request.httpMethod = "DELETE"
    request.timeoutInterval = 25
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      if http.statusCode == 401 { throw ListingsError.notLoggedIn }
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
  }

  /// Aktív / inaktív: aktív (`feladott`) megjelenik a találati listában, inaktív nem.
  /// Először dedikált API, ha nincs (régi Autosweb): meglévő mentés endpointra esik vissza.
  @discardableResult
  static func setListingActive(id: String, active: Bool, token: String?) async throws -> String {
    guard let token, !token.isEmpty else { throw ListingsError.notLoggedIn }
    guard let listingId = Int(id) else {
      throw ListingsError.server("Érvénytelen hirdetés-azonosító.")
    }
    let desired = active ? "feladott" : "inaktiv"
    let body = try JSONSerialization.data(withJSONObject: ["status": desired, "active": active])

    // 1) POST /api/listings/:id/status
    if let statusURL = apiURL("api/listings/\(id)/status") {
      do {
        return try await postListingStatus(url: statusURL, token: token, body: body, fallbackStatus: desired)
      } catch let error as ListingsError {
        if !isUnsupportedStatusEndpoint(error) { throw error }
      }
    }

    // 2) PATCH /api/listings/:id
    if let patchURL = apiURL("api/listings/\(id)") {
      do {
        return try await patchListingStatus(url: patchURL, token: token, body: body, fallbackStatus: desired)
      } catch let error as ListingsError {
        if !isUnsupportedStatusEndpoint(error) { throw error }
      }
    }

    // 3) Régi Autosweb: teljes form újra mentése az új státusszal (POST /api/listings).
    return try await setListingActiveViaSave(
      id: id,
      listingId: listingId,
      active: active,
      token: token
    )
  }

  /// Régi szerver: GET form → POST mentés status-szal. Nem igényel PATCH-et.
  private static func setListingActiveViaSave(
    id: String,
    listingId: Int,
    active: Bool,
    token: String
  ) async throws -> String {
    let form = try await fetchFormDictionary(id: id, token: token)
    // Először inaktiv/feladott; ha a szerver nem ismeri az inaktivot → mentett.
    let primary = active ? "feladott" : "inaktiv"
    _ = try await saveListing(
      form: form,
      status: primary,
      photos: [],
      token: token,
      listingId: listingId
    )
    var actual = (try? await fetchListingStatus(id: id, token: token)) ?? primary
    if !active, actual == "feladott" {
      // Régi db: inaktiv → mentett-re normalizálódik; próbáljuk közvetlenül.
      _ = try await saveListing(
        form: form,
        status: "mentett",
        photos: [],
        token: token,
        listingId: listingId
      )
      actual = (try? await fetchListingStatus(id: id, token: token)) ?? "mentett"
    }
    if active {
      guard actual == "feladott" else {
        throw ListingsError.server("Nem sikerült aktiválni a hirdetést (státusz: \(actual)).")
      }
      return "feladott"
    }
    // UI: inaktív (akár inaktiv, akár mentett a szerveren)
    if actual == "feladott" {
      throw ListingsError.server("Nem sikerült inaktiválni a hirdetést.")
    }
    return actual == "inaktiv" ? "inaktiv" : "inaktiv"
  }

  private static func isUnsupportedStatusEndpoint(_ error: ListingsError) -> Bool {
    guard case .server(let msg) = error else { return false }
    return msg.localizedCaseInsensitiveContains("Nem támogatott")
      || msg.localizedCaseInsensitiveContains("405")
      || msg.localizedCaseInsensitiveContains("Ismeretlen API")
  }

  private static func postListingStatus(
    url: URL,
    token: String,
    body: Data,
    fallbackStatus: String
  ) async throws -> String {
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 25
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = body
    return try await performStatusRequest(request, fallbackStatus: fallbackStatus)
  }

  private static func patchListingStatus(
    url: URL,
    token: String,
    body: Data,
    fallbackStatus: String
  ) async throws -> String {
    var request = URLRequest(url: url)
    request.httpMethod = "PATCH"
    request.timeoutInterval = 25
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = body
    return try await performStatusRequest(request, fallbackStatus: fallbackStatus)
  }

  private static func performStatusRequest(_ request: URLRequest, fallbackStatus: String) async throws -> String {
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      if http.statusCode == 401 { throw ListingsError.notLoggedIn }
      // Csak 405 = nincs ilyen művelet; 404 lehet „nincs hirdetés” is.
      if http.statusCode == 405 || err == "Nem támogatott művelet." || err == "Ismeretlen API." {
        throw ListingsError.server(err ?? "Nem támogatott művelet.")
      }
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
    struct Wrap: Decodable {
      let listing: StatusListing?
    }
    struct StatusListing: Decodable {
      let status: String?
    }
    let wrap = try? JSONDecoder().decode(Wrap.self, from: data)
    return wrap?.listing?.status ?? fallbackStatus
  }

  /// Nyers form (tömbök megmaradnak) — státusz váltáshoz / szerkesztéshez.
  static func fetchFormDictionary(id: String, token: String? = nil) async throws -> [String: Any] {
    guard let url = apiURL("api/listings/\(id)") else { throw ListingsError.unreachable }
    var request = URLRequest(url: url)
    request.timeoutInterval = 25
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token, !token.isEmpty {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      if http.statusCode == 401 { throw ListingsError.notLoggedIn }
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
    guard
      let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      let listing = root["listing"] as? [String: Any],
      let form = listing["form"] as? [String: Any]
    else {
      throw ListingsError.server("Hirdetés nem található.")
    }
    return form
  }

  static func fetchListingStatus(id: String, token: String? = nil) async throws -> String {
    guard let url = apiURL("api/listings/\(id)") else { throw ListingsError.unreachable }
    var request = URLRequest(url: url)
    request.timeoutInterval = 25
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token, !token.isEmpty {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
    struct Wrap: Decodable {
      let listing: St?
    }
    struct St: Decodable {
      let status: String?
    }
    let wrap = try JSONDecoder().decode(Wrap.self, from: data)
    return (wrap.listing?.status ?? "").lowercased()
  }

  /// Szerkesztéshez: nyers form mezők stringként.
  static func fetchFormStrings(id: String, token: String? = nil) async throws -> [String: String] {
    guard let url = apiURL("api/listings/\(id)") else { throw ListingsError.unreachable }
    var request = URLRequest(url: url)
    request.timeoutInterval = 25
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token, !token.isEmpty {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      if http.statusCode == 401 { throw ListingsError.notLoggedIn }
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
    struct Wrap: Decodable {
      let listing: FormListing?
    }
    struct FormListing: Decodable {
      let form: [String: FormJSONValue]?
    }
    let wrap = try JSONDecoder().decode(Wrap.self, from: data)
    guard let form = wrap.listing?.form else {
      throw ListingsError.server("Hirdetés nem található.")
    }
    var out: [String: String] = [:]
    for (k, v) in form {
      if let s = v.stringValue, !s.isEmpty { out[k] = s }
    }
    return out
  }

  private enum FormJSONValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([String])
    case null

    init(from decoder: Decoder) throws {
      let c = try decoder.singleValueContainer()
      if c.decodeNil() { self = .null; return }
      if let b = try? c.decode(Bool.self) { self = .bool(b); return }
      if let n = try? c.decode(Double.self) { self = .number(n); return }
      if let s = try? c.decode(String.self) { self = .string(s); return }
      if let a = try? c.decode([String].self) { self = .array(a); return }
      self = .null
    }

    var stringValue: String? {
      switch self {
      case .string(let s): return s
      case .number(let n): return n == floor(n) ? String(Int(n)) : String(n)
      case .bool(let b): return b ? "1" : "0"
      case .array(let a): return a.joined(separator: ", ")
      case .null: return nil
      }
    }
  }

  static func recordView(id: String, source: String = "app") async {
    guard let url = apiURL("api/listings/\(id)/view") else { return }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 12
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: ["source": source])
    _ = try? await URLSession.shared.data(for: request)
  }

  static func fetchHomeListings(limit: Int = homeFetchLimit) async throws -> [HomeListing] {
    guard let url = apiURL("api/listings", query: [URLQueryItem(name: "limit", value: String(limit))]) else {
      throw ListingsError.unreachable
    }
    let all = try await fetchListings(url: url, token: nil, statusBadge: false)
    // Régi Autosweb is hozhat mentett/inaktív sort — keresőben csak aktív.
    return all.filter { listing in
      let s = (listing.status ?? "feladott").lowercased()
      return s == "feladott" || s.isEmpty
    }
  }

  /// Bejelentkezett user saját hirdetései (+ visszaesés régi Autoswebre).
  static func fetchMyListings(token: String?, limit: Int = 200) async throws -> [HomeListing] {
    guard let token, !token.isEmpty else { throw ListingsError.notLoggedIn }

    var byId: [String: HomeListing] = [:]
    var mineError: Error?

    // 1) Modern: /api/listings/mine
    var mineOK = false
    if let mineURL = apiURL("api/listings/mine", query: [URLQueryItem(name: "limit", value: String(limit))]) {
      do {
        let mine = try await fetchListings(url: mineURL, token: token, statusBadge: true)
        mineOK = true
        for item in mine { byId[item.id] = item }
        return byId.values.sorted { $0.updatedAt > $1.updatedAt }
      } catch {
        mineError = error
      }
    }

    // 2) Compat: /api/listings?mine=1
    if !mineOK,
       let compatURL = apiURL(
         "api/listings",
         query: [
           URLQueryItem(name: "mine", value: "1"),
           URLQueryItem(name: "limit", value: String(limit)),
         ]
       ) {
      do {
        let mine = try await fetchListings(url: compatURL, token: token, statusBadge: true)
        for item in mine { byId[item.id] = item }
        return byId.values.sorted { $0.updatedAt > $1.updatedAt }
      } catch {
        if mineError == nil { mineError = error }
      }
    }

    guard let listURL = apiURL(
      "api/listings",
      query: [URLQueryItem(name: "limit", value: String(homeFetchLimit))]
    ) else {
      throw ListingsError.unreachable
    }

    // 3) Eszközön feladott ID-k
    let localIds = PostedListingsStore.ids()
    if !localIds.isEmpty {
      do {
        let all = try await fetchListings(url: listURL, token: nil, statusBadge: true)
        for item in all where localIds.contains(item.id) {
          byId[item.id] = item.withBadge(item.badge ?? "Aktív")
        }
      } catch {
        if byId.isEmpty { throw error }
      }
    }

    if !byId.isEmpty {
      return byId.values.sorted { $0.updatedAt > $1.updatedAt }
    }

    // 4) Régi Autosweb (nincs /mine): minden aktív / feladott (helyi egyfelhasználós)
    if isUnsupportedMineError(mineError) {
      let all = try await fetchListings(url: listURL, token: nil, statusBadge: true)
      let feladott = all.filter { $0.isActiveInSearch || $0.badge == "Aktív" || $0.badge == "Feladott" }
      if !feladott.isEmpty { return feladott }
      throw ListingsError.server(
        "A hirdetéseid most nem tölthetők be. Próbáld újra."
      )
    }

    if let mineError {
      throw remapMineError(mineError)
    }

    return []
  }

  private static func isUnsupportedMineError(_ error: Error?) -> Bool {
    guard let error else { return false }
    let msg = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    return msg.localizedCaseInsensitiveContains("Nem támogatott")
      || msg.localizedCaseInsensitiveContains("405")
      || msg.localizedCaseInsensitiveContains("Ismeretlen API")
  }

  private static func remapMineError(_ error: Error) -> Error {
    if isUnsupportedMineError(error) {
      return ListingsError.server(
        "A lista most nem tölthető be. Próbáld újra."
      )
    }
    return error
  }

  // MARK: - Fetch helper

  private static func fetchListings(url: URL, token: String?, statusBadge: Bool) async throws -> [HomeListing] {
    var request = URLRequest(url: url)
    request.timeoutInterval = 25
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token, !token.isEmpty {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw ListingsError.unreachable
    }
    guard let http = response as? HTTPURLResponse else { throw ListingsError.unreachable }
    if http.statusCode >= 400 {
      let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
      if http.statusCode == 401 {
        throw ListingsError.notLoggedIn
      }
      if http.statusCode == 405 || err == "Nem támogatott művelet." {
        throw ListingsError.server("Nem támogatott művelet.")
      }
      if err == "Ismeretlen API." {
        throw ListingsError.server("A művelet most nem sikerült. Próbáld újra.")
      }
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }

    let decoded = try JSONDecoder().decode(ListResponse.self, from: data)
    let cards = decoded.listings.map { mapListing($0, statusBadge: statusBadge) }
    return cards.sorted { a, b in
      a.updatedAt > b.updatedAt
    }
  }

  // MARK: - Mapping

  private static func mapListing(_ row: RemoteListing, statusBadge: Bool) -> HomeListing {
    let preview = row.preview
    let rawTitle = preview?.title ?? row.hirdetes_cime ?? "Hirdetés #\(row.id)"
    var title = displayTitle(rawTitle, year: preview?.filter?.gyartasi_ev, specLine: preview?.specLine)
    title = sanitizeListingText(title)
    if title.isEmpty {
      title = "Hirdetés #\(row.id)"
    }
    let price = (preview?.price).flatMap { $0.isEmpty ? nil : $0 } ?? "—"
    let year = yearLabel(preview?.filter?.gyartasi_ev, specLine: preview?.specLine)
    let km = (preview?.km).flatMap { $0.isEmpty ? nil : $0 } ?? "—"
    let fuel = fuelLabel(preview?.filter?.uzemanyag)
    let meta = [year, km, fuel].joined(separator: " · ")
    let status = row.status
    let badge: String? = {
      guard statusBadge else { return nil }
      return HomeListing.statusBadgeLabel(status)
    }()
    let images = collectImageURLs(
      foKep: row.fo_kep,
      previewURL: preview?.imageUrl,
      previewURLs: preview?.imageUrls
    )
    let kmNum: Int? = {
      let digits = (preview?.km ?? "").filter(\.isNumber)
      return digits.isEmpty ? nil : Int(digits)
    }()
    let owner: String? = {
      if let n = row.user_id { return String(n) }
      if let s = row.userId, !s.isEmpty { return s }
      return nil
    }()
    return HomeListing(
      id: String(row.id),
      title: title,
      priceLabel: price,
      meta: meta,
      badge: badge,
      updatedAt: row.updated_at ?? row.created_at ?? "",
      imageURLs: images,
      status: status,
      userId: owner,
      brand: preview?.filter?.gyartmany,
      model: preview?.filter?.modell,
      year: preview?.filter?.gyartasi_ev,
      km: kmNum,
      priceFt: preview?.priceNum,
      fuelRaw: preview?.filter?.uzemanyag,
      viewsWeb: row.views_web ?? preview?.views?.web ?? 0,
      viewsApp: row.views_app ?? preview?.views?.app ?? 0
    )
  }

  static func collectImageURLs(foKep: String?, previewURL: String?, previewURLs: [String]?) -> [URL] {
    var seen = Set<String>()
    var images: [URL] = []
    func append(_ raw: String?) {
      guard let url = absoluteImageURL(raw) else { return }
      let key = url.absoluteString
      guard !seen.contains(key) else { return }
      seen.insert(key)
      images.append(url)
    }
    append(foKep)
    append(previewURL)
    for path in previewURLs ?? [] {
      append(path)
    }
    return images
  }

  private static func displayTitle(_ raw: String, year: Int?, specLine: String?) -> String {
    var base = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if base.lowercased().hasPrefix("eladó ") {
      base = String(base.dropFirst(6))
    }
    let upper = base.uppercased()
    if upper.range(of: #"\(\d{4}"#, options: .regularExpression) != nil {
      return upper
    }
    if let y = year, y > 1900 {
      return "\(upper) (\(y))"
    }
    if let spec = specLine,
       let match = spec.range(of: #"\b((?:19|20)\d{2})\b"#, options: .regularExpression) {
      return "\(upper) (\(spec[match]))"
    }
    return upper
  }

  private static func yearLabel(_ year: Int?, specLine: String?) -> String {
    if let y = year, y > 1900 { return String(y) }
    if let spec = specLine,
       let match = spec.range(of: #"\b((?:19|20)\d{2})\b"#, options: .regularExpression) {
      return String(spec[match])
    }
    return "—"
  }

  private static func fuelLabel(_ value: String?) -> String {
    let fuel = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if fuel.isEmpty { return "—" }
    if fuel.lowercased() == "dízel" || fuel.lowercased() == "diesel" { return "Dízel" }
    return fuel
  }

  // MARK: - Decode

  private struct ListResponse: Decodable {
    let listings: [RemoteListing]
  }

  private struct SaveResponse: Decodable {
    let listing: SavedListing?
  }

  private struct SavedListing: Decodable {
    let id: Int
    let fo_kep: String?
  }

  private struct RemoteListing: Decodable {
    let id: Int
    let hirdetes_cime: String?
    let fo_kep: String?
    let status: String?
    let created_at: String?
    let updated_at: String?
    let user_id: Int?
    let userId: String?
    let preview: RemotePreview?
    let views_web: Int?
    let views_app: Int?
  }

  private struct RemotePreview: Decodable {
    let title: String?
    let price: String?
    let priceNum: Int?
    let km: String?
    let specLine: String?
    let imageUrl: String?
    let imageUrls: [String]?
    let filter: RemoteFilter?
    let views: RemoteViews?
  }

  private struct RemoteViews: Decodable {
    let web: Int?
    let app: Int?
  }

  private struct RemoteFilter: Decodable {
    let uzemanyag: String?
    let gyartasi_ev: Int?
    let gyartmany: String?
    let modell: String?
  }

  private struct ErrBody: Decodable {
    let error: String?
  }

  /// Élő Autosweb lista szűrése a kereső feltételekkel.
  static func matches(_ ad: HomeListing, filter: SearchFilter) -> Bool {
    if !filter.gyartmanyok.isEmpty {
      let brands = Set(filter.gyartmanyok.map { $0.uppercased() })
      let b = (ad.brand ?? "").uppercased()
      let title = ad.title.uppercased()
      if !brands.contains(where: { b.contains($0) || title.contains($0) }) { return false }
    }
    if !filter.modellek.isEmpty {
      let models = filter.modellek.map { $0.lowercased() }
      let m = (ad.model ?? "").lowercased()
      let title = ad.title.lowercased()
      if !models.contains(where: { m.contains($0) || title.contains($0) }) { return false }
    }
    if !filter.fuels.isEmpty {
      let raw = (ad.fuelRaw ?? "").lowercased()
      let ok = filter.fuels.contains { fuel in
        switch fuel {
        case .diesel: return raw.contains("dízel") || raw.contains("diesel")
        case .benzin: return raw.contains("benzin") && !raw.contains("gáz")
        case .hybrid: return raw.contains("hibrid") || raw.contains("hybrid")
        case .elektromos: return raw.contains("elektrom")
        case .benzinGaz: return raw.contains("gáz") || raw.contains("gaz")
        }
      }
      if !ok { return false }
    }
    if let tol = filter.evTol, let y = ad.year, y < tol { return false }
    if let ig = filter.evIg, let y = ad.year, y > ig { return false }
    if let tol = filter.kmTol, let km = ad.km, km < tol { return false }
    if let ig = filter.kmIg, let km = ad.km, km > ig { return false }
    if let tol = filter.arTol, let p = ad.priceFt, p < tol { return false }
    if let ig = filter.arIg, let p = ad.priceFt, p > ig { return false }
    return true
  }
}

/// Eszközön feladott hirdetés-ID-k — Hirdetéseim visszaesés, ha a szerveren még nincs user_id.
enum PostedListingsStore {
  private static let key = "addelautod.postedListingIds.v1"

  static func remember(_ id: Int) {
    var ids = Set(ids().compactMap(Int.init))
    ids.insert(id)
    UserDefaults.standard.set(ids.sorted().map(String.init), forKey: key)
  }

  static func ids() -> Set<String> {
    let raw = UserDefaults.standard.stringArray(forKey: key) ?? []
    return Set(raw.filter { !$0.isEmpty })
  }
}
