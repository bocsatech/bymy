import Foundation
import UIKit

/// Használtautó import — a WebView HTML-jét a telefon dolgozza fel,
/// mentés a már éles `POST /api/listings` végponton (nem a hiányzó `/api/import/*`).
enum ImportAPI {
  struct BatchResult: Decodable {
    let listUrl: String?
    let count: Int?
    let savedCount: Int?
    let skippedCount: Int?
    let errorCount: Int?
    let items: [ImportedItem]?
    let errors: [ImportErrorEntry]?
    let refs: [ListingRef]?
    let mode: String?
  }

  struct DiscoverResult {
    let pageUrl: String?
    let count: Int?
    let mode: String?
    let refs: [ListingRef]?
  }

  struct ListingRef: Codable {
    let id: String?
    let adminUrl: String?
    let publicUrl: String?
  }

  struct ImportedItem: Decodable, Identifiable {
    var id: String { url ?? UUID().uuidString }
    let url: String?
    let cim: String?
    let ar: String?
    let km: String?
    let savedId: Int?
  }

  struct ImportErrorEntry: Decodable {
    let url: String?
    let message: String?
  }

  struct PageFields {
    var url: String
    var html: String
    var listingId: String
    var visibleTitle: String
    var visibleImage: String
    var visibleDescription: String
    var price: String
    var km: String
    var year: String
    var fuel: String
    var brand: String
    var model: String
    var imageJpegBase64: String
  }

  enum ImportError: LocalizedError {
    case server(String)
    case unreachable
    case decoding
    case notLoggedIn

    var errorDescription: String? {
      switch self {
      case .server(let msg): return msg
      case .unreachable:
        return AutoswebBaseURL.unreachableMessage()
      case .decoding: return "Érvénytelen válasz az import API-tól."
      case .notLoggedIn: return "Az importhoz be kell jelentkezned a bymy fiókodba."
      }
    }
  }

  private static func apiURL(_ path: String) -> URL? {
    ListingsAPI.apiURL(path)
  }

  private static var authToken: String? {
    UserDefaults.standard.string(forKey: "addelautod.authToken.v1")
  }

  /// Hirdetés-azonosítók kinyerése a HTML-ből — szerver nélkül.
  static func discover(html: String, pageUrl: String) async throws -> DiscoverResult {
    let refs = extractRefs(from: html, pageUrl: pageUrl)
    let mode: String
    if isAdminOrListingPage(pageUrl) {
      mode = pageUrl.lowercased().contains("admin.") || pageUrl.lowercased().contains("gyorsnezet")
        ? "admin-single"
        : "public-single"
    } else if refs.count <= 1, isAdminOrListingPage(pageUrl) || !refs.isEmpty {
      mode = refs.count <= 1 ? "admin-single" : "list"
    } else {
      mode = "list"
    }
    return DiscoverResult(pageUrl: pageUrl, count: refs.count, mode: mode, refs: refs)
  }

  static func importFromPage(
    html: String,
    pageUrl: String,
    visibleTitle: String = "",
    visibleImage: String = "",
    visibleDescription: String = "",
    limit: Int = 40
  ) async throws -> BatchResult {
    _ = limit
    let fields = PageFields(
      url: pageUrl,
      html: html,
      listingId: listingId(from: pageUrl) ?? extractRefs(from: html, pageUrl: pageUrl).first?.id ?? "",
      visibleTitle: visibleTitle,
      visibleImage: visibleImage,
      visibleDescription: visibleDescription,
      price: "",
      km: "",
      year: "",
      fuel: "",
      brand: "",
      model: "",
      imageJpegBase64: ""
    )
    return try await importExtracted([fields], listUrl: pageUrl)
  }

  static func importExtracted(_ pages: [PageFields], listUrl: String) async throws -> BatchResult {
    guard let token = authToken, !token.isEmpty else { throw ImportError.notLoggedIn }

    var items: [ImportedItem] = []
    var errors: [ImportErrorEntry] = []
    var savedCount = 0
    var skippedCount = 0

    for page in pages {
      do {
        let enriched = enrich(page)
        try validateReadyToSave(enriched)
        let form = buildForm(from: enriched)
        guard let photo = try await resolvePhotoBase64(enriched), !photo.isEmpty else {
          throw ImportError.server(
            "Nincs fénykép a hirdetéshez — nyisd meg a gyorsnézetet / hirdetés oldalt, ahol látszik az autó képe."
          )
        }
        let id = try await ListingsAPI.saveListing(
          form: form,
          status: "feladott",
          photos: [photo],
          token: token
        )
        savedCount += 1
        items.append(
          ImportedItem(
            url: enriched.url,
            cim: form["hirdetes_cime"] as? String,
            ar: form["vetelar"] as? String,
            km: form["km"] as? String,
            savedId: id
          )
        )
      } catch let error as ImportError {
        if case .server(let msg) = error, msg.localizedCaseInsensitiveContains("már") {
          skippedCount += 1
        } else {
          errors.append(ImportErrorEntry(url: page.url, message: error.errorDescription))
        }
      } catch let error as ListingsAPI.ListingsError {
        errors.append(
          ImportErrorEntry(url: page.url, message: error.errorDescription ?? error.localizedDescription)
        )
      } catch {
        errors.append(
          ImportErrorEntry(
            url: page.url,
            message: (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
          )
        )
      }
    }

    if savedCount == 0, items.isEmpty, let first = errors.first?.message {
      throw ImportError.server(first)
    }

    return BatchResult(
      listUrl: listUrl,
      count: items.count,
      savedCount: savedCount,
      skippedCount: skippedCount,
      errorCount: errors.count,
      items: items,
      errors: errors,
      refs: nil,
      mode: pages.count <= 1 ? "single" : "list"
    )
  }

  static func importListings(_ listings: [[String: Any]], listUrl: String) async throws -> BatchResult {
    let pages: [PageFields] = listings.compactMap { entry in
      let url = String(entry["url"] as? String ?? entry["adminUrl"] as? String ?? "")
      guard !url.isEmpty else { return nil }
      let html = String(entry["html"] as? String ?? "")
      let id = String(entry["id"] as? String ?? listingId(from: url) ?? "")
      return PageFields(
        url: url,
        html: html,
        listingId: id,
        visibleTitle: String(entry["visibleTitle"] as? String ?? ""),
        visibleImage: String(entry["visibleImage"] as? String ?? ""),
        visibleDescription: String(entry["visibleDescription"] as? String ?? ""),
        price: String(entry["price"] as? String ?? ""),
        km: String(entry["km"] as? String ?? ""),
        year: String(entry["year"] as? String ?? ""),
        fuel: String(entry["fuel"] as? String ?? ""),
        brand: String(entry["brand"] as? String ?? ""),
        model: String(entry["model"] as? String ?? ""),
        imageJpegBase64: String(entry["imageJpegBase64"] as? String ?? "")
      )
    }
    return try await importExtracted(pages, listUrl: listUrl)
  }

  // MARK: - Mentés (éles /api/listings)

  private static func enrich(_ page: PageFields) -> PageFields {
    let parsed = HaListingHtmlParser.parse(page.html, pageURL: page.url)
    return HaListingHtmlParser.merge(js: page, htmlParsed: parsed)
  }

  private static func validateReadyToSave(_ page: PageFields) throws {
    let title = cleanTitle(page.visibleTitle)
    let brand = page.brand.trimmingCharacters(in: .whitespacesAndNewlines)
    let priceOk = !page.price.filter(\.isNumber).isEmpty
    let hasName = (!title.isEmpty && !HaListingHtmlParser.isChrome(title))
      || (!brand.isEmpty && brand.count >= 2)
    let hasImage = !page.imageJpegBase64.isEmpty || page.visibleImage.hasPrefix("http")
    if !hasName && !priceOk {
      throw ImportError.server(
        "Nem sikerült kiolvasni a hirdetés adatait (cím / ár). Nyisd meg a konkrét autó gyorsnézetét vagy a nyilvános hirdetés oldalt, majd próbáld újra."
      )
    }
    if !hasImage {
      throw ImportError.server(
        "Nem találtunk fényképet. Görgess a képekhez a gyorsnézeten, majd importálj újra."
      )
    }
  }

  private static func buildForm(from page: PageFields) -> [String: Any] {
    let id = page.listingId.isEmpty ? (listingId(from: page.url) ?? "") : page.listingId
    let title = cleanTitle(page.visibleTitle)
    let brand = page.brand.isEmpty
      ? (title.split(separator: " ").map(String.init).first ?? "")
      : page.brand
    let model: String = {
      if !page.model.isEmpty { return page.model }
      let parts = title.split(separator: " ").map(String.init)
      return parts.count > 1 ? parts[1] : ""
    }()
    let priceDigits = page.price.filter(\.isNumber)
    let kmDigits = page.km.filter(\.isNumber)
    let yearDigits = String(page.year.filter(\.isNumber).prefix(4))

    var cim = ""
    if !title.isEmpty, !HaListingHtmlParser.isChrome(title) {
      cim = title.lowercased().hasPrefix("eladó") ? title : "Eladó \(title)"
    } else if !brand.isEmpty {
      let parts = [brand, model].filter { !$0.isEmpty }.joined(separator: " ")
      cim = yearDigits.count == 4 ? "Eladó \(parts) (\(yearDigits))" : "Eladó \(parts)"
    }
    if cim.isEmpty {
      cim = id.isEmpty ? "Importált autó" : "Importált autó #\(id)"
    }

    var form: [String: Any] = [
      "jarmu_kategoria": "szemelyauto",
      "forras_url": page.url,
      "hasznaltauto_hirdetes_id": id,
      "hirdetes_cime": cim,
    ]
    if !brand.isEmpty { form["gyartmany"] = brand }
    if !model.isEmpty { form["modell"] = model }
    if !priceDigits.isEmpty { form["vetelar"] = priceDigits }
    if !kmDigits.isEmpty { form["km"] = kmDigits }
    if yearDigits.count == 4 { form["gyartasi_ev"] = yearDigits }
    if !page.fuel.isEmpty { form["uzemanyag"] = page.fuel }
    if !page.visibleDescription.isEmpty {
      form["leiras"] = String(page.visibleDescription.prefix(2000))
    }
    if !page.visibleImage.isEmpty, page.visibleImage.hasPrefix("http") {
      form["fo_kep"] = page.visibleImage
    }
    return form
  }

  private static func resolvePhotoBase64(_ page: PageFields) async throws -> String? {
    if !page.imageJpegBase64.isEmpty {
      return stripDataURL(page.imageJpegBase64)
    }
    guard page.visibleImage.hasPrefix("http"), let url = URL(string: page.visibleImage) else {
      return nil
    }
    var req = URLRequest(url: url)
    req.setValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      forHTTPHeaderField: "User-Agent"
    )
    req.setValue(page.url, forHTTPHeaderField: "Referer")
    do {
      let (data, response) = try await URLSession.shared.data(for: req)
      if let http = response as? HTTPURLResponse, http.statusCode >= 400 { return nil }
      if let image = UIImage(data: data) {
        let resized = resize(image, maxSide: 1600)
        if let jpeg = resized.jpegData(compressionQuality: 0.82) {
          return jpeg.base64EncodedString()
        }
      }
      return data.count > 2000 ? data.base64EncodedString() : nil
    } catch {
      return nil
    }
  }

  private static func resize(_ image: UIImage, maxSide: CGFloat) -> UIImage {
    let size = image.size
    let longest = max(size.width, size.height)
    guard longest > maxSide, longest > 0 else { return image }
    let scale = maxSide / longest
    let newSize = CGSize(width: size.width * scale, height: size.height * scale)
    let renderer = UIGraphicsImageRenderer(size: newSize)
    return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: newSize)) }
  }

  private static func stripDataURL(_ raw: String) -> String {
    if let range = raw.range(of: "base64,", options: .caseInsensitive) {
      return String(raw[range.upperBound...])
        .replacingOccurrences(of: "\n", with: "")
        .replacingOccurrences(of: "\r", with: "")
    }
    return raw
  }

  private static func cleanTitle(_ raw: String) -> String {
    raw
      .replacingOccurrences(of: #"haszn[aá]ltaut[oó]\.?\s*hu"#, with: " ", options: .regularExpression)
      .replacingOccurrences(of: #"\bbel[eé]p[eé]s\b"#, with: " ", options: .regularExpression)
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  // MARK: - Discover (helyi)

  private static func isAdminOrListingPage(_ url: String) -> Bool {
    let u = url.lowercased()
    if u.contains("gyorsnezet") { return true }
    if u.contains("/szemelyauto/") && listingId(from: url) != nil { return true }
    if u.contains("admin.hasznaltauto") && listingId(from: url) != nil { return true }
    return false
  }

  static func listingId(from url: String) -> String? {
    if let m = url.range(of: #"/gyorsnezet/[^/"'\s]+/(\d{5,})"#, options: .regularExpression) {
      let s = String(url[m])
      if let d = s.range(of: #"\d{5,}$"#, options: .regularExpression) {
        return String(s[d])
      }
    }
    if let m = url.range(of: #"-\d{5,}(?:\?|$|/)"#, options: .regularExpression) {
      let s = String(url[m]).trimmingCharacters(in: CharacterSet(charactersIn: "?/"))
      return s.replacingOccurrences(of: "-", with: "")
    }
    if let m = url.range(of: #"-(\d{5,})$"#, options: .regularExpression) {
      return String(url[m]).replacingOccurrences(of: "-", with: "")
    }
    return nil
  }

  private static func extractRefs(from html: String, pageUrl: String) -> [ListingRef] {
    var byId: [String: ListingRef] = [:]
    let patterns = [
      #"/gyorsnezet/[^/"'\s]+/(\d{5,})"#,
      #"/szemelyauto/[^"'?\s]+-(\d{5,})"#,
      #"data-(?:id|hirdetesid|adid)=["'](\d{5,})["']"#,
    ]
    for pattern in patterns {
      guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
      let range = NSRange(html.startIndex..., in: html)
      regex.enumerateMatches(in: html, options: [], range: range) { match, _, _ in
        guard let match, match.numberOfRanges > 1,
              let idRange = Range(match.range(at: 1), in: html) else { return }
        let id = String(html[idRange])
        guard id.count >= 5 else { return }
        byId[id] = ListingRef(
          id: id,
          adminUrl: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/\(id)",
          publicUrl: "https://www.hasznaltauto.hu/szemelyauto/import-\(id)"
        )
      }
    }
    if let id = listingId(from: pageUrl) {
      byId[id] = ListingRef(
        id: id,
        adminUrl: pageUrl.contains("admin.") || pageUrl.contains("gyorsnezet")
          ? pageUrl
          : "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/\(id)",
        publicUrl: pageUrl.contains("www.hasznaltauto") ? pageUrl : "https://www.hasznaltauto.hu/szemelyauto/import-\(id)"
      )
    }
    return byId.values.sorted { ($0.id ?? "") < ($1.id ?? "") }
  }
}
