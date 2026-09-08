import Foundation

/// Használtautó HTML → mezők (a szerver `parse-listing.mjs` logikájának mobil változata).
enum HaListingHtmlParser {
  struct Parsed {
    var title: String = ""
    var price: String = ""
    var km: String = ""
    var year: String = ""
    var fuel: String = ""
    var brand: String = ""
    var model: String = ""
    var description: String = ""
    var imageURL: String = ""
    var attributes: [String: String] = [:]
  }

  static func parse(_ html: String, pageURL: String = "") -> Parsed {
    var out = Parsed()
    let attrs = mergeAttributes(html)
    out.attributes = attrs

    out.title = firstNonEmpty([
      metaContent(html, property: "og:title"),
      h1Text(html),
      jsonLdName(html),
      attr(attrs, ["cím", "cim", "hirdetés címe", "hirdetes cime"]),
      titleTag(html),
    ]).flatMap(cleanTitle) ?? ""

    out.price = firstNonEmpty([
      attr(attrs, ["vételár", "vetelar", "ár", "ar", "hirdetési ár", "hirdetesi ar"]),
      priceFromHtml(html),
    ]).map { $0.filter(\.isNumber).isEmpty ? $0 : $0 } ?? ""

    out.km = firstNonEmpty([
      attr(attrs, ["futásteljesítmény", "futasteljesitmeny", "kilométeróra", "kilometerora", "km"]),
      kmFromHtml(html),
    ]) ?? ""

    out.year = firstNonEmpty([
      yearDigits(attr(attrs, ["évjárat", "evjarat", "gyártási év", "gyartasi ev"])),
      yearFromTitle(out.title),
    ]) ?? ""

    out.fuel = firstNonEmpty([
      attr(attrs, ["üzemanyag", "uzemanyag"]),
    ]) ?? ""

    out.description = firstNonEmpty([
      descriptionFromHtml(html),
      attr(attrs, ["leírás", "leiras"]),
    ]).map { String($0.prefix(2000)) } ?? ""

    out.imageURL = firstNonEmpty([
      metaContent(html, property: "og:image"),
      firstListingImage(html, pageURL: pageURL),
    ]).flatMap { absolutize($0, pageURL: pageURL) } ?? ""

    let parts = out.title
      .replacingOccurrences(of: #"^Eladó\s+"#, with: "", options: .regularExpression)
      .replacingOccurrences(of: #"\s*\([^)]*\)\s*$"#, with: "", options: .regularExpression)
      .split(separator: " ")
      .map(String.init)
      .filter { !$0.isEmpty }
    if parts.count >= 1 { out.brand = parts[0] }
    if parts.count >= 2 { out.model = parts[1] }

    if out.brand.isEmpty {
      out.brand = attr(attrs, ["márka", "marka", "gyártmány", "gyartmany"]) ?? ""
    }
    if out.model.isEmpty {
      out.model = attr(attrs, ["modell", "típus", "tipus"]) ?? ""
    }

    return out
  }

  /// JS-ből kinyert mezők + HTML parse egyesítése (a jobb érték marad).
  static func merge(js: ImportAPI.PageFields, htmlParsed: Parsed) -> ImportAPI.PageFields {
    var next = js
    func prefer(_ current: String, _ candidate: String, minLen: Int = 1) -> String {
      let c = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
      let a = current.trimmingCharacters(in: .whitespacesAndNewlines)
      if c.count < minLen { return a }
      if a.count < minLen { return c }
      if isChrome(a) { return c }
      if a.count >= 8 { return a }
      return c.count > a.count ? c : a
    }
    next.visibleTitle = prefer(js.visibleTitle, htmlParsed.title, minLen: 4)
    next.price = prefer(js.price, htmlParsed.price)
    next.km = prefer(js.km, htmlParsed.km)
    next.year = prefer(js.year, htmlParsed.year)
    next.fuel = prefer(js.fuel, htmlParsed.fuel)
    next.brand = prefer(js.brand, htmlParsed.brand)
    next.model = prefer(js.model, htmlParsed.model)
    next.visibleDescription = prefer(js.visibleDescription, htmlParsed.description, minLen: 8)
    next.visibleImage = prefer(js.visibleImage, htmlParsed.imageURL, minLen: 8)
    if next.listingId.isEmpty {
      next.listingId = ImportAPI.listingId(from: js.url) ?? ""
    }
    return next
  }

  static func isChrome(_ text: String) -> Bool {
    let n = text
      .folding(options: .diacriticInsensitive, locale: .current)
      .lowercased()
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if n.isEmpty { return true }
    if n.contains("hasznaltauto"), n.count <= 64 { return true }
    if n == "belepes" || n.hasPrefix("belepes ") { return true }
    if n.contains("gyorsnezet"), n.count <= 40 { return true }
    if n.contains("javascript") { return true }
    return false
  }

  // MARK: - Helpers

  private static func stripTags(_ html: String) -> String {
    html
      .replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
      .replacingOccurrences(of: #"&nbsp;"#, with: " ", options: .caseInsensitive)
      .replacingOccurrences(of: #"&amp;"#, with: "&", options: .caseInsensitive)
      .replacingOccurrences(of: #"&quot;"#, with: "\"", options: .caseInsensitive)
      .replacingOccurrences(of: #"&#?\w+;"#, with: " ", options: .regularExpression)
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func cleanTitle(_ raw: String) -> String? {
    var t = raw
      .replacingOccurrences(of: #"\s*[|–-].*$"#, with: "", options: .regularExpression)
      .replacingOccurrences(of: #"haszn[aá]ltaut[oó]\.?\s*hu"#, with: " ", options: [.regularExpression, .caseInsensitive])
      .replacingOccurrences(of: #"\bbel[eé]p[eé]s\b"#, with: " ", options: [.regularExpression, .caseInsensitive])
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if isChrome(t) || t.count < 3 { return nil }
    return t
  }

  private static func firstNonEmpty(_ values: [String?]) -> String? {
    for v in values {
      let t = (v ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      if !t.isEmpty { return t }
    }
    return nil
  }

  private static func metaContent(_ html: String, property: String) -> String? {
    let patterns = [
      #"<meta[^>]*property=["']\#(property)["'][^>]*content=["']([^"']+)["']"#,
      #"<meta[^>]*content=["']([^"']+)["'][^>]*property=["']\#(property)["']"#,
    ]
    for p in patterns {
      if let m = firstMatch(p, in: html, group: 1) { return stripTags(m) }
    }
    return nil
  }

  private static func h1Text(_ html: String) -> String? {
    guard let raw = firstMatch(#"<h1[^>]*>([\s\S]*?)</h1>"#, in: html, group: 1) else { return nil }
    return stripTags(raw)
  }

  private static func titleTag(_ html: String) -> String? {
    guard let raw = firstMatch(#"<title[^>]*>([\s\S]*?)</title>"#, in: html, group: 1) else { return nil }
    return stripTags(raw)
  }

  private static func jsonLdName(_ html: String) -> String? {
    let scripts = matches(#"<script[^>]*type=["']application/ld\+json["'][^>]*>([\s\S]*?)</script>"#, in: html, group: 1)
    for script in scripts {
      if let name = firstMatch(#""name"\s*:\s*"([^"]{3,120})""#, in: script, group: 1) {
        return name
      }
    }
    return nil
  }

  private static func priceFromHtml(_ html: String) -> String? {
    let patterns = [
      #"class=["'][^"']*price[^"']*["'][^>]*>([^<]+)<"#,
      #">([\d\s.]{4,})\s*Ft<"#,
      #""price"\s*:\s*"?([\d\s.]+)"?"#,
      #"Vételár[\s\S]{0,80}?([\d\s.]{4,})\s*Ft"#,
    ]
    for p in patterns {
      if let m = firstMatch(p, in: html, group: 1) { return m }
    }
    return nil
  }

  private static func kmFromHtml(_ html: String) -> String? {
    firstMatch(#"([\d\s.]{2,})\s*km"#, in: html, group: 1)
  }

  private static func yearDigits(_ value: String?) -> String? {
    guard let value else { return nil }
    return firstMatch(#"(19|20)\d{2}"#, in: value, group: 0)
  }

  private static func yearFromTitle(_ title: String) -> String? {
    yearDigits(title)
  }

  private static func descriptionFromHtml(_ html: String) -> String? {
    let patterns = [
      #"<div[^>]*class=["'][^"']*leiras[^"']*["'][^>]*>([\s\S]*?)</div>"#,
      #"<textarea[^>]*>([\s\S]*?)</textarea>"#,
    ]
    for p in patterns {
      if let raw = firstMatch(p, in: html, group: 1) {
        let t = stripTags(raw)
        if t.count >= 8 { return t }
      }
    }
    return nil
  }

  private static func firstListingImage(_ html: String, pageURL: String) -> String? {
    let srcs = matches(#"<img[^>]+(?:src|data-src|data-lazy)=["']([^"']+)["']"#, in: html, group: 1)
    for src in srcs {
      let lower = src.lowercased()
      if lower.contains("logo") || lower.contains("icon") || lower.contains("sprite")
        || lower.contains("placeholder") || lower.contains("close") { continue }
      if lower.hasPrefix("data:") { continue }
      if absolutize(src, pageURL: pageURL) != nil { return src }
    }
    return nil
  }

  private static func absolutize(_ raw: String, pageURL: String) -> String? {
    let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("http://") || s.hasPrefix("https://") { return s }
    if s.hasPrefix("//") { return "https:\(s)" }
    guard let base = URL(string: pageURL), let abs = URL(string: s, relativeTo: base)?.absoluteString else {
      return nil
    }
    return abs
  }

  private static func mergeAttributes(_ html: String) -> [String: String] {
    var map: [String: String] = [:]
    // Táblázatok
    let tables = matches(#"<table[^>]*>([\s\S]*?)</table>"#, in: html, group: 1)
    for table in tables {
      let rows = matches(#"<tr[^>]*>([\s\S]*?)</tr>"#, in: table, group: 1)
      for row in rows {
        if let key = firstMatch(#"<td[^>]*class=["'][^"']*bal[^"']*pontos[^"']*["'][^>]*>([\s\S]*?)</td>"#, in: row, group: 1),
           let value = firstMatch(#"<td[^>]*class=["'][^"']*bal[^"']*pontos[^"']*["'][^>]*>[\s\S]*?</td>\s*<td[^>]*>([\s\S]*?)</td>"#, in: row, group: 1) {
          addAttr(&map, key: key, value: value)
          continue
        }
        let cells = matches(#"<t[dh][^>]*>([\s\S]*?)</t[dh]>"#, in: row, group: 1)
        if cells.count >= 2 {
          addAttr(&map, key: cells[0], value: cells[cells.count - 1])
        }
      }
    }
    // dt/dd
    let dts = matches(#"<dt[^>]*>([\s\S]*?)</dt>\s*<dd[^>]*>([\s\S]*?)</dd>"#, in: html, group: 1)
    let dds = matches(#"<dt[^>]*>([\s\S]*?)</dt>\s*<dd[^>]*>([\s\S]*?)</dd>"#, in: html, group: 2)
    for (k, v) in zip(dts, dds) {
      addAttr(&map, key: k, value: v)
    }
    // Szöveges „Címke: érték” sorok
    let plain = stripTags(html)
    let lineRe = try? NSRegularExpression(pattern: #"(?m)^(.{2,40}?):\s*(.+)$"#)
    let range = NSRange(plain.startIndex..., in: plain)
    lineRe?.enumerateMatches(in: plain, options: [], range: range) { match, _, _ in
      guard let match, match.numberOfRanges > 2,
            let kr = Range(match.range(at: 1), in: plain),
            let vr = Range(match.range(at: 2), in: plain) else { return }
      addAttr(&map, key: String(plain[kr]), value: String(plain[vr]))
    }
    return map
  }

  private static func addAttr(_ map: inout [String: String], key: String, value: String) {
    let k = stripTags(key).replacingOccurrences(of: ":", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
    let v = stripTags(value)
    guard k.count >= 2, k.count <= 60, !v.isEmpty, v.count <= 500 else { return }
    if map[k] == nil || (map[k]?.count ?? 0) < v.count {
      map[k] = v
    }
  }

  private static func attr(_ map: [String: String], _ keys: [String]) -> String? {
    let normalizedKeys = keys.map(normalizeKey)
    for (k, v) in map {
      let nk = normalizeKey(k)
      if normalizedKeys.contains(where: { nk == $0 || nk.contains($0) }), !v.isEmpty {
        return v
      }
    }
    return nil
  }

  private static func normalizeKey(_ value: String) -> String {
    value
      .folding(options: .diacriticInsensitive, locale: .current)
      .lowercased()
      .replacingOccurrences(of: #"[:.·,]"#, with: " ", options: .regularExpression)
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func firstMatch(_ pattern: String, in text: String, group: Int) -> String? {
    guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return nil }
    let range = NSRange(text.startIndex..., in: text)
    guard let m = re.firstMatch(in: text, options: [], range: range),
          m.numberOfRanges > group,
          let r = Range(m.range(at: group), in: text) else { return nil }
    return String(text[r])
  }

  private static func matches(_ pattern: String, in text: String, group: Int) -> [String] {
    guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
    let range = NSRange(text.startIndex..., in: text)
    return re.matches(in: text, options: [], range: range).compactMap { m in
      guard m.numberOfRanges > group, let r = Range(m.range(at: group), in: text) else { return nil }
      return String(text[r])
    }
  }
}
