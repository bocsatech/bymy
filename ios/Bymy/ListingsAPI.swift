import Foundation

enum ListingsAPI {
    struct Listing: Identifiable, Equatable {
        let id: String
        let title: String
        let priceLabel: String
        let meta: String
        let imageURL: URL?
        let badge: String?
    }

    private struct Envelope: Decodable {
        let ok: Bool?
        let listings: [Raw]?
        let items: [Raw]?
        let error: String?
    }

    private struct Raw: Decodable {
        let id: FlexibleID?
        let title: String?
        let cim: String?
        let price: FlexibleNumber?
        let ar: FlexibleNumber?
        let priceLabel: String?
        let ar_label: String?
        let year: FlexibleNumber?
        let gyartasi_ev: FlexibleNumber?
        let km: FlexibleNumber?
        let kilometerora_allasa: FlexibleNumber?
        let fo_kep: String?
        let image: String?
        let imageUrl: String?
        let badge: String?
        let status: String?
    }

    private struct FlexibleID: Decodable {
        let value: String
        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let i = try? c.decode(Int.self) { value = String(i); return }
            if let s = try? c.decode(String.self) { value = s; return }
            value = UUID().uuidString
        }
    }

    private struct FlexibleNumber: Decodable {
        let value: Int?
        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let i = try? c.decode(Int.self) { value = i; return }
            if let d = try? c.decode(Double.self) { value = Int(d); return }
            if let s = try? c.decode(String.self) {
                let digits = s.filter(\.isNumber)
                value = Int(digits)
                return
            }
            value = nil
        }
    }

    static func fetchHome(limit: Int = 40) async throws -> [Listing] {
        try await fetch(path: "api/listings", query: ["limit": String(limit)])
    }

    static func fetchCategory(_ kind: String, limit: Int = 40) async throws -> [Listing] {
        try await fetch(path: "api/listings", query: [
            "limit": String(limit),
            "category": kind,
        ])
    }

    private static func fetch(path: String, query: [String: String]) async throws -> [Listing] {
        var comps = URLComponents(url: APIBase.url(path), resolvingAgainstBaseURL: false)!
        comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        var req = URLRequest(url: comps.url!)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 30
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIClient.APIError.unreachable }
        let decoded = try JSONDecoder().decode(Envelope.self, from: data)
        guard http.statusCode < 400 else {
            throw APIClient.APIError.server(decoded.error ?? "Hirdetések betöltése sikertelen.")
        }
        let raw = decoded.listings ?? decoded.items ?? []
        return raw.compactMap(map)
    }

    private static func map(_ raw: Raw) -> Listing? {
        let id = raw.id?.value ?? UUID().uuidString
        let title = (raw.title ?? raw.cim ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return nil }
        let priceFt = raw.price?.value ?? raw.ar?.value
        let priceLabel = raw.priceLabel ?? raw.ar_label ?? formatPrice(priceFt)
        let year = raw.year?.value ?? raw.gyartasi_ev?.value
        let km = raw.km?.value ?? raw.kilometerora_allasa?.value
        var metaParts: [String] = []
        if let year { metaParts.append(String(year)) }
        if let km { metaParts.append("\(formatNumber(km)) km") }
        let imageStr = raw.fo_kep ?? raw.imageUrl ?? raw.image
        let imageURL = imageStr.flatMap { absoluteImageURL($0) }
        return Listing(
            id: id,
            title: title,
            priceLabel: priceLabel,
            meta: metaParts.joined(separator: " · "),
            imageURL: imageURL,
            badge: raw.badge
        )
    }

    private static func absoluteImageURL(_ raw: String) -> URL? {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("http://") || s.hasPrefix("https://") { return URL(string: s) }
        if s.hasPrefix("/") { return URL(string: s, relativeTo: APIBase.current)?.absoluteURL }
        return URL(string: s, relativeTo: APIBase.current)?.absoluteURL
    }

    private static func formatPrice(_ ft: Int?) -> String {
        guard let ft, ft > 0 else { return "Ár: —" }
        return "\(formatNumber(ft)) Ft"
    }

    private static func formatNumber(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return f.string(from: NSNumber(value: n)) ?? String(n)
    }

    enum SaveError: LocalizedError {
        case notLoggedIn
        case needsPhoto
        case server(String)
        case unreachable

        var errorDescription: String? {
            switch self {
            case .notLoggedIn: return "A feladáshoz be kell jelentkezned."
            case .needsPhoto: return "Legalább egy fénykép kell a feladáshoz."
            case .server(let m): return m
            case .unreachable: return "Nincs kapcsolat a bymy.hu szerverrel."
            }
        }
    }

    private struct SaveResponse: Decodable {
        struct Saved: Decodable {
            let id: Int?
            let fo_kep: String?
        }
        let ok: Bool?
        let listing: Saved?
        let error: String?
    }

    /// `POST /api/listings` — ugyanaz, mint a webes feladás.
    @discardableResult
    static func saveListing(
        form: [String: Any],
        status: String = "feladott",
        photos: [String] = [],
        token: String?,
        listingId: Int? = nil
    ) async throws -> Int {
        guard let token, !token.isEmpty else { throw SaveError.notLoggedIn }
        let isEdit = listingId != nil
        if status == "feladott", photos.isEmpty, !isEdit { throw SaveError.needsPhoto }

        var body: [String: Any] = ["form": form, "status": status]
        if let listingId { body["id"] = listingId }
        if !photos.isEmpty { body["photos"] = photos }

        var req = URLRequest(url: APIBase.url("api/listings"))
        req.httpMethod = "POST"
        req.timeoutInterval = photos.isEmpty ? 30 : 120
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw SaveError.unreachable
        }
        guard let http = response as? HTTPURLResponse else { throw SaveError.unreachable }
        let decoded = try? JSONDecoder().decode(SaveResponse.self, from: data)
        if http.statusCode == 401 { throw SaveError.notLoggedIn }
        if http.statusCode >= 400 {
            throw SaveError.server(decoded?.error ?? "HTTP \(http.statusCode)")
        }
        guard let id = decoded?.listing?.id else {
            throw SaveError.server(decoded?.error ?? "Mentés sikertelen — nincs azonosító.")
        }
        if status == "feladott", !photos.isEmpty {
            let foKep = (decoded?.listing?.fo_kep ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if foKep.isEmpty {
                throw SaveError.server("A kép nem mentődött el. Próbáld újra.")
            }
        }
        return id
    }
}
