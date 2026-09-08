import Foundation

/// Egy hirdetés megjelenítése (lista + részletes).
struct ListingDetail: Identifiable, Equatable {
  let id: String
  let title: String
  let priceLabel: String
  let kmLabel: String
  let registrationLabel: String
  let imageURLs: [URL]
  /// Lista kártyán: év · km · üzemanyag
  let meta: String
  let badge: String?
  let vehicleRows: [ListingKV]
  let equipment: [String]
  let description: String
  let sellerName: String
  let sellerPhone: String?
  let addressLines: [String]
  let mapQuery: String?
  let ownerUserId: Int?

  var messageTarget: ListingMessageTarget {
    ListingMessageTarget(
      listingId: id,
      title: title,
      priceLabel: priceLabel,
      meta: meta,
      sellerId: ownerUserId
    )
  }

  /// Saját hirdetés: ha a formban nincs telefon/név/cím, a profilból pótoljuk (UI).
  func enrichedWithProfileContact(
    name: String,
    phone: String,
    street: String = "",
    postalCode: String = "",
    city: String = "",
    country: String = "Magyarország"
  ) -> ListingDetail {
    let nextName: String = {
      if sellerName != "Eladó", !sellerName.isEmpty { return sellerName }
      let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
      return n.isEmpty ? sellerName : n
    }()
    let nextPhone: String? = {
      if let sellerPhone, !sellerPhone.isEmpty { return sellerPhone }
      let p = phone.trimmingCharacters(in: .whitespacesAndNewlines)
      return p.isEmpty ? nil : p
    }()
    let nextAddress: [String]
    let nextMap: String?
    if addressLines.isEmpty {
      nextAddress = Self.makeAddressLines(street: street, postal: postalCode, city: city)
      nextMap = Self.makeMapQuery(street: street, postal: postalCode, city: city, country: country)
    } else {
      nextAddress = addressLines
      nextMap = mapQuery
    }
    return ListingDetail(
      id: id,
      title: title,
      priceLabel: priceLabel,
      kmLabel: kmLabel,
      registrationLabel: registrationLabel,
      imageURLs: imageURLs,
      meta: meta,
      badge: badge,
      vehicleRows: vehicleRows,
      equipment: equipment,
      description: description,
      sellerName: nextName,
      sellerPhone: nextPhone,
      addressLines: nextAddress,
      mapQuery: nextMap ?? mapQuery,
      ownerUserId: ownerUserId
    )
  }

  static func makeAddressLines(street: String, postal: String, city: String, megye: String = "") -> [String] {
    var address: [String] = []
    let s = street.trimmingCharacters(in: .whitespacesAndNewlines)
    if !s.isEmpty { address.append(s) }
    let cityLine = [postal, city, megye]
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .joined(separator: " ")
    if !cityLine.isEmpty { address.append(cityLine) }
    return address
  }

  static func makeMapQuery(
    street: String,
    postal: String,
    city: String,
    megye: String = "",
    country: String = "Magyarország"
  ) -> String? {
    let parts = [street, postal, city, megye, country]
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    guard parts.count >= 2 else { return nil }
    return parts.joined(separator: ", ")
  }
}

struct ListingKV: Identifiable, Equatable {
  var id: String { label + "|" + value }
  let label: String
  let value: String
}

extension ListingsAPI {
  /// Teljes hirdetés: `GET /api/listings/:id`
  /// Token kell inaktív saját hirdetéshez (csak tulajdonos látja).
  static func fetchDetail(id: String, token: String? = nil) async throws -> ListingDetail {
    guard let url = apiURL("api/listings/\(id)") else {
      throw ListingsError.unreachable
    }
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
      struct Err: Decodable { let error: String? }
      let err = (try? JSONDecoder().decode(Err.self, from: data))?.error
      throw ListingsError.server(err ?? "HTTP \(http.statusCode)")
    }
    let wrap = try JSONDecoder().decode(DetailResponse.self, from: data)
    guard let listing = wrap.listing else {
      throw ListingsError.server("Hirdetés nem található.")
    }
    return mapDetail(listing)
  }

  // MARK: - Detail mapping

  private static func mapDetail(_ row: RemoteDetailListing) -> ListingDetail {
    let form = row.form ?? [:]
    func str(_ key: String) -> String {
      guard let v = form[key] else { return "" }
      switch v {
      case .string(let s): return s.trimmingCharacters(in: .whitespacesAndNewlines)
      case .number(let n):
        return n == floor(n) ? String(Int(n)) : String(n)
      case .bool(let b): return b ? "Igen" : "Nem"
      case .array(let a): return a.joined(separator: ", ")
      case .null: return ""
      }
    }
    func arr(_ key: String) -> [String] {
      guard let v = form[key] else { return [] }
      let raw: [String]
      switch v {
      case .array(let items):
        raw = items
      case .string(let s):
        // Ha stringként jön, ne karakterezzük — vesszővel bontjuk vagy egy tételként kezeljük
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return [] }
        raw = t.contains(",")
          ? t.split(separator: ",").map { String($0) }
          : [t]
      default:
        return []
      }
      // 1 betűs elemek: korábbi szerver bug (string for...of) szemete
      return raw
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { $0.count >= 2 }
    }

    let year = str("gyartasi_ev")
    let month = str("gyartasi_honap")
    let regYear = str("forgalomba_helyezes_ev").isEmpty ? year : str("forgalomba_helyezes_ev")
    let regMonth = str("forgalomba_helyezes_honap").isEmpty ? month : str("forgalomba_helyezes_honap")
    let registration: String = {
      if !regYear.isEmpty, !regMonth.isEmpty { return "\(regMonth.padLeft2).\(regYear)" }
      if !regYear.isEmpty { return regYear }
      return "—"
    }()

    let priceRaw = str("vetelar").isEmpty ? str("akcios_ar") : str("vetelar")
    let priceLabel = formatPriceHu(priceRaw)
    let kmLabel = formatKmHu(str("km"))
    let fuel = Self.detailFuelLabel(str("uzemanyag"))
    let yearLabel = year.isEmpty ? "—" : year
    let meta = [yearLabel, kmLabel, fuel].joined(separator: " · ")

    let rawTitle = str("hirdetes_cime").isEmpty
      ? (row.hirdetes_cime ?? "Hirdetés #\(row.id)")
      : str("hirdetes_cime")
    var title = sanitizeListingText(Self.detailDisplayTitle(rawTitle, year: Int(year)))
    if title.isEmpty {
      title = "Hirdetés #\(row.id)"
    }

    var kepekPaths: [String] = []
    let kepekRaw = str("kepek")
    if !kepekRaw.isEmpty,
       let data = kepekRaw.data(using: .utf8),
       let arr = try? JSONDecoder().decode([String].self, from: data) {
      kepekPaths = arr
    }
    let images = collectImageURLs(
      foKep: row.fo_kep ?? str("fo_kep"),
      previewURL: str("fo_kep").isEmpty ? nil : str("fo_kep"),
      previewURLs: kepekPaths
    )

    let kw = str("teljesitmeny_kw")
    let le = str("teljesitmeny_le")
    let power: String = {
      if !kw.isEmpty, !le.isEmpty { return "\(kw) kW (\(le) LE)" }
      if !kw.isEmpty { return "\(kw) kW" }
      if !le.isEmpty { return "\(le) LE" }
      return ""
    }()

    let muszaki: String = {
      let y = str("muszaki_ev")
      let m = str("muszaki_honap")
      if !y.isEmpty, !m.isEmpty { return "\(m.padLeft2).\(y)" }
      if !y.isEmpty { return y }
      return ""
    }()

    let rows: [ListingKV] = [
      ("Jármű típusa", str("kivitel").isEmpty ? str("tipus") : str("kivitel")),
      ("Állapot", str("allapot")),
      ("Teljesítmény", power),
      ("Üzemanyag", str("uzemanyag")),
      ("Sebességváltó", str("sebessegvalto")),
      ("Hajtás", str("hajtas")),
      ("Külső szín", str("szin")),
      ("Ülések száma", str("szemelyek")),
      ("Ajtók száma", str("ajtok")),
      ("Előző tulajdonosok", str("tulajdonosok_szama")),
      ("Műszaki érvényesség", muszaki),
    ].compactMap { pair -> ListingKV? in
      let v = pair.1.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !v.isEmpty else { return nil }
      return ListingKV(label: pair.0, value: v)
    }

    var equipment = arr("felszereltseg")
    let klima = str("klima")
    if !klima.isEmpty, !equipment.contains(where: { $0.localizedCaseInsensitiveContains("klíma") || $0.localizedCaseInsensitiveContains("klima") }) {
      equipment.insert(klima, at: 0)
    }
    if str("nem_dohanyzo").lowercased().hasPrefix("i") || str("nem_dohanyzo") == "1" {
      if !equipment.contains(where: { $0.localizedCaseInsensitiveContains("dohány") }) {
        equipment.append("Nem dohányzó jármű")
      }
    }

    let phone = formatPhone(
      country: str("telefon1_orszag"),
      area: str("telefon1_korzet"),
      number: str("telefon1_szam")
    )
    let phoneFallback: String = {
      if !phone.isEmpty { return phone }
      for key in ["telefonszam", "telefon", "phone", "mobil"] {
        let v = str(key).trimmingCharacters(in: .whitespacesAndNewlines)
        if !v.isEmpty { return v }
      }
      return ""
    }()
    // Scrape gyakran a település/cím mezőbe is belerakja a Használtautó.hu / Belépés fejlécet
    let city = sanitizeListingField(str("telepules"))
    let postal = sanitizeListingField(str("iranyitoszam"))
    let street = sanitizeListingField(str("megtekintesi_cim"))
    let megye = sanitizeListingField(str("megye"))
    let address = ListingDetail.makeAddressLines(street: street, postal: postal, city: city, megye: megye)
    let mapQuery = ListingDetail.makeMapQuery(street: street, postal: postal, city: city, megye: megye)
    let sellerName: String = {
      let named = str("hirdeto_nev")
      if !named.isEmpty { return named }
      let email = str("email")
      if !email.isEmpty, let local = email.split(separator: "@").first, !local.isEmpty {
        let s = String(local)
        // Ne mutassuk a telefonos fiók t…@phone.bymy.local lokális részét névként
        if s.hasPrefix("t"), s.count > 8, s.allSatisfy({ $0.isNumber || $0 == "t" }) {
          return "Eladó"
        }
        return s
      }
      return "Eladó"
    }()

    return ListingDetail(
      id: String(row.id),
      title: title,
      priceLabel: priceLabel,
      kmLabel: kmLabel,
      registrationLabel: registration,
      imageURLs: images,
      meta: meta,
      badge: HomeListing.statusBadgeLabel(row.status),
      vehicleRows: rows,
      equipment: equipment,
      description: sanitizeListingText(str("leiras")),
      sellerName: sellerName,
      sellerPhone: phoneFallback.isEmpty ? nil : phoneFallback,
      addressLines: address,
      mapQuery: mapQuery,
      ownerUserId: row.user_id
    )
  }

  private static func detailDisplayTitle(_ raw: String, year: Int?) -> String {
    var base = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if base.lowercased().hasPrefix("eladó ") {
      base = String(base.dropFirst(6))
    }
    let upper = base.uppercased()
    if upper.range(of: #"\(\d{4}"#, options: .regularExpression) != nil { return upper }
    if let y = year, y > 1900 { return "\(upper) (\(y))" }
    return upper
  }

  private static func detailFuelLabel(_ value: String) -> String {
    let fuel = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if fuel.isEmpty { return "—" }
    if fuel.lowercased() == "dízel" || fuel.lowercased() == "diesel" { return "Dízel" }
    return fuel
  }

  private static func formatPriceHu(_ raw: String) -> String {
    let digits = raw.filter(\.isNumber)
    guard let n = Int(digits), n > 0 else { return raw.isEmpty ? "—" : raw }
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "hu_HU")
    return "\(f.string(from: NSNumber(value: n)) ?? "\(n)") Ft"
  }

  private static func formatKmHu(_ raw: String) -> String {
    let digits = raw.filter(\.isNumber)
    guard let n = Int(digits), n > 0 else { return raw.isEmpty ? "—" : raw }
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "hu_HU")
    return "\(f.string(from: NSNumber(value: n)) ?? "\(n)") km"
  }

  private static func formatPhone(country: String, area: String, number: String) -> String {
    let c = country.trimmingCharacters(in: .whitespaces)
    let a = area.trimmingCharacters(in: .whitespaces)
    let n = number.trimmingCharacters(in: .whitespaces)
    if c.isEmpty, a.isEmpty, n.isEmpty { return "" }
    if !c.isEmpty { return [c, a, n].filter { !$0.isEmpty }.joined(separator: " ") }
    return [a, n].filter { !$0.isEmpty }.joined(separator: " ")
  }

  private struct DetailResponse: Decodable {
    let listing: RemoteDetailListing?
  }

  private struct RemoteDetailListing: Decodable {
    let id: Int
    let hirdetes_cime: String?
    let fo_kep: String?
    let status: String?
    let user_id: Int?
    let form: [String: FormValue]?
  }

  enum FormValue: Decodable, Equatable {
    case string(String)
    case number(Double)
    case array([String])
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
      let c = try decoder.singleValueContainer()
      if c.decodeNil() { self = .null; return }
      if let b = try? c.decode(Bool.self) { self = .bool(b); return }
      if let n = try? c.decode(Double.self) { self = .number(n); return }
      if let s = try? c.decode(String.self) { self = .string(s); return }
      if let a = try? c.decode([String].self) { self = .array(a); return }
      if let a = try? c.decode([FormValue].self) {
        self = .array(a.compactMap {
          if case .string(let s) = $0 { return s }
          if case .number(let n) = $0 { return String(Int(n)) }
          return nil
        })
        return
      }
      self = .null
    }
  }
}

private extension String {
  var padLeft2: String {
    count >= 2 ? self : String(repeating: "0", count: 2 - count) + self
  }
}

/// Használtautó.hu / Belépés fejléc kiszűrése a leírásból / címből.
func sanitizeListingText(_ value: String) -> String {
  let lines = value
    .replacingOccurrences(of: "\r\n", with: "\n")
    .components(separatedBy: .newlines)
    .map { stripInlineListingChrome($0.trimmingCharacters(in: .whitespacesAndNewlines)) }
    .filter { !$0.isEmpty }
    .filter { !isListingSiteChromeLine($0) }
  let text = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
  if text.isEmpty { return "" }
  if isListingSiteChromeLine(text.replacingOccurrences(of: "\n", with: " ")) { return "" }
  return text
}

/// Egy soros mező (település, cím, gyártmány…): chrome → üres.
func sanitizeListingField(_ value: String) -> String {
  let cleaned = sanitizeListingText(value)
    .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)
  if cleaned.isEmpty || isListingSiteChromeLine(cleaned) { return "" }
  return cleaned
}

private func stripInlineListingChrome(_ line: String) -> String {
  var s = line
  let patterns = [
    #"(?i)haszn[aá]ltaut[oó]\.?\s*hu"#,
    #"(?i)\bhaszn[aá]ltaut[oó]\b"#,
    #"(?i)\bbel[eé]p[eé]s\b"#,
    #"(?i)\bregisztr[aá]ci[oó]\b"#,
    #"(?i)\badd\s*el\s*autod(\.hu)?\b"#,
  ]
  for p in patterns {
    s = s.replacingOccurrences(of: p, with: " ", options: .regularExpression)
  }
  s = s.replacingOccurrences(of: #"[|·•]+"#, with: " ", options: .regularExpression)
  s = s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
  return s.trimmingCharacters(in: .whitespacesAndNewlines)
}

private func isListingSiteChromeLine(_ line: String) -> Bool {
  let folded = line
    .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "hu_HU"))
    .lowercased()
    .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)
  if folded.isEmpty { return true }
  var onlyChrome = folded
  onlyChrome = onlyChrome.replacingOccurrences(of: #"hasznaltauto(\.hu)?"#, with: " ", options: .regularExpression)
  onlyChrome = onlyChrome.replacingOccurrences(of: #"\bbelepes\b"#, with: " ", options: .regularExpression)
  onlyChrome = onlyChrome.replacingOccurrences(of: #"\bregisztracio\b"#, with: " ", options: .regularExpression)
  onlyChrome = onlyChrome.replacingOccurrences(of: #"\badd el autod(\.hu)?\b"#, with: " ", options: .regularExpression)
  onlyChrome = onlyChrome.replacingOccurrences(of: #"\bbymy(\.hu)?\b"#, with: " ", options: .regularExpression)
  onlyChrome = onlyChrome.replacingOccurrences(of: #"[|·•\-–—./:!]+"#, with: " ", options: .regularExpression)
  onlyChrome = onlyChrome.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)
  if onlyChrome.isEmpty { return true }
  if folded.contains("hasznaltauto"), folded.count <= 64 { return true }
  if folded.contains("belepes"), folded.count <= 24 { return true }
  if folded == "belepes" || folded == "regisztracio" { return true }
  if folded == "add el autod" || folded == "add el autod.hu" { return true }
  if folded == "bymy" || folded == "bymy.hu" { return true }
  return false
}

extension DemoListing {
  var asDetail: ListingDetail {
    let fuelDisplay: String = {
      switch fuel {
      case .benzin: return "Benzin"
      case .diesel: return "Dízel"
      case .hybrid: return "Hybrid"
      case .elektromos: return "Elektromos"
      case .benzinGaz: return "Benzin/gáz"
      case .none: return "—"
      }
    }()
    let reg = "01.\(year)"
    let rows: [ListingKV] = [
      ListingKV(label: "Jármű típusa", value: model),
      ListingKV(label: "Állapot", value: isOldtimer ? "Oldtimer" : "Használt"),
      ListingKV(label: "Üzemanyag", value: fuelDisplay),
      ListingKV(label: "Gyártmány", value: brand),
      ListingKV(label: "Modell", value: model),
    ]
    var equipment: [String] = []
    if isLeasing { equipment.append("Leasing") }
    if isRentable { equipment.append("Bérelhető") }
    let cityGuess = "Budapest"
    return ListingDetail(
      id: id,
      title: title,
      priceLabel: priceLabel,
      kmLabel: {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "hu_HU")
        return "\(f.string(from: NSNumber(value: km)) ?? "\(km)") km"
      }(),
      registrationLabel: reg,
      imageURLs: [],
      meta: meta,
      badge: badge,
      vehicleRows: rows,
      equipment: equipment,
      description: "\(title) — demo hirdetés a keresőből. Élő adatokhoz nyisd a Kiemelteket (Autosweb).",
      sellerName: "Demo Eladó",
      sellerPhone: "+36 30 000 0000",
      addressLines: ["\(postalCode) \(cityGuess)"],
      mapQuery: "\(postalCode) \(cityGuess), Magyarország",
      ownerUserId: nil
    )
  }
}
