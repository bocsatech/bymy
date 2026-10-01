import Foundation

enum ListingsAPI {
    struct Listing: Identifiable, Equatable {
        let id: String
        let title: String
        let priceLabel: String
        let meta: String
        let imageURL: URL?
        let badge: String?
        var brand: String? = nil
        var model: String? = nil
    }

    private struct Envelope: Decodable {
        let listings: [RemoteListing]?
        let items: [RemoteListing]?
        let error: String?
    }

    private struct RemoteListing: Decodable {
        let id: FlexibleID
        let hirdetes_cime: String?
        let fo_kep: String?
        let status: String?
        let preview: RemotePreview?
        let user_id: Int?
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
    }

    private struct RemoteFilter: Decodable {
        let uzemanyag: String?
        let gyartasi_ev: FlexibleNumber?
        let gyartmany: String?
        let modell: String?
    }

    struct FlexibleID: Decodable {
        let value: String
        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let i = try? c.decode(Int.self) { value = String(i); return }
            if let s = try? c.decode(String.self) { value = s; return }
            value = UUID().uuidString
        }
    }

    struct FlexibleNumber: Decodable {
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

    static func fetchHome(limit: Int = 40, token: String? = nil) async throws -> [Listing] {
        try await fetch(path: "api/listings", query: [
            "limit": String(limit),
            "status": "feladott",
        ], token: token)
    }

    static func fetchCategory(_ kind: String, limit: Int = 40, token: String? = nil) async throws -> [Listing] {
        let vertical = kind == "teherauto" ? "teher" : kind
        return try await fetch(path: "api/listings", query: [
            "limit": String(limit),
            "status": "feladott",
            "vertical": vertical,
        ], token: token)
    }

    static func fetch(path: String, query: [String: String], token: String? = nil) async throws -> [Listing] {
        var comps = URLComponents(url: APIBase.url(path), resolvingAgainstBaseURL: false)!
        comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        var req = URLRequest(url: comps.url!)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 30
        if let token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIClient.APIError.unreachable }

        if http.statusCode == 401 {
            let err = (try? JSONDecoder().decode(Envelope.self, from: data))?.error
            throw APIClient.APIError.unauthorized(err ?? "Belépés szükséges.")
        }

        // Robust path: if Codable fails on unknown fields, still try JSONSerialization
        if let decoded = try? JSONDecoder().decode(Envelope.self, from: data), http.statusCode < 400 {
            let rows = decoded.listings ?? decoded.items ?? []
            let mapped = rows.map(mapRemote)
            if !mapped.isEmpty || rows.isEmpty {
                return mapped
            }
        }

        guard http.statusCode < 400 else {
            let err = (try? JSONDecoder().decode(Envelope.self, from: data))?.error
            throw APIClient.APIError.server(err ?? "Hirdetések betöltése sikertelen.")
        }

        // Fallback: dictionary parse (preview nested)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIClient.APIError.decoding
        }
        let arr = (root["listings"] as? [[String: Any]]) ?? (root["items"] as? [[String: Any]]) ?? []
        return arr.compactMap(mapDict)
    }

    private static func mapRemote(_ row: RemoteListing) -> Listing {
        let preview = row.preview
        var title = (preview?.title ?? row.hirdetes_cime ?? "Hirdetés #\(row.id.value)")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if title.lowercased().hasPrefix("eladó ") {
            title = String(title.dropFirst(6))
        }
        if title.isEmpty { title = "Hirdetés #\(row.id.value)" }

        let price = (preview?.price).flatMap { $0.isEmpty ? nil : $0 } ?? formatPrice(preview?.priceNum)
        let year: String = {
            if let y = preview?.filter?.gyartasi_ev?.value, y > 1900 { return String(y) }
            return "—"
        }()
        let km = (preview?.km).flatMap { $0.isEmpty ? nil : $0 } ?? "—"
        let fuel = (preview?.filter?.uzemanyag).flatMap { $0.isEmpty ? nil : $0 } ?? "—"
        let meta = [year, km, fuel].joined(separator: " · ")

        let imageURL =
            absoluteImageURL(row.fo_kep)
            ?? absoluteImageURL(preview?.imageUrl)
            ?? preview?.imageUrls?.compactMap(absoluteImageURL).first

        return Listing(
            id: row.id.value,
            title: title,
            priceLabel: price,
            meta: meta,
            imageURL: imageURL,
            badge: nil,
            brand: preview?.filter?.gyartmany,
            model: preview?.filter?.modell
        )
    }

    private static func mapDict(_ row: [String: Any]) -> Listing? {
        let id = stringAny(row["id"]) ?? UUID().uuidString
        let preview = row["preview"] as? [String: Any] ?? [:]
        let form = row["form"] as? [String: Any] ?? [:]
        var title = (stringAny(preview["title"])
            ?? stringAny(row["hirdetes_cime"])
            ?? stringAny(form["hirdetes_cime"])
            ?? "Hirdetés #\(id)")
        if title.lowercased().hasPrefix("eladó ") {
            title = String(title.dropFirst(6))
        }
        let price = stringAny(preview["price"])
            ?? formatPrice(intAny(preview["priceNum"]) ?? intAny(form["vetelar"]))
        let filter = preview["filter"] as? [String: Any] ?? [:]
        let year = stringAny(filter["gyartasi_ev"]) ?? stringAny(form["gyartasi_ev"]) ?? "—"
        let km = stringAny(preview["km"]) ?? {
            if let n = intAny(form["km"]) { return "\(formatNumber(n)) km" }
            return "—"
        }()
        let fuel = stringAny(filter["uzemanyag"]) ?? stringAny(form["uzemanyag"]) ?? "—"
        let imageURL =
            absoluteImageURL(stringAny(row["fo_kep"]))
            ?? absoluteImageURL(stringAny(preview["imageUrl"]))
            ?? (preview["imageUrls"] as? [Any])?.compactMap { absoluteImageURL(stringAny($0)) }.first

        return Listing(
            id: id,
            title: title,
            priceLabel: price,
            meta: [year, km, fuel].joined(separator: " · "),
            imageURL: imageURL,
            badge: nil,
            brand: stringAny(filter["gyartmany"]),
            model: stringAny(filter["modell"])
        )
    }

    private static func stringAny(_ any: Any?) -> String? {
        guard let any else { return nil }
        if let s = any as? String {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        if let n = any as? NSNumber { return n.stringValue }
        if let i = any as? Int { return String(i) }
        return nil
    }

    private static func intAny(_ any: Any?) -> Int? {
        if let i = any as? Int { return i }
        if let n = any as? NSNumber { return n.intValue }
        if let s = any as? String {
            let d = s.filter(\.isNumber)
            return d.isEmpty ? nil : Int(d)
        }
        return nil
    }

    static func absoluteImageURL(_ raw: String?) -> URL? {
        guard let raw else { return nil }
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }
        if s.hasPrefix("http://") || s.hasPrefix("https://") { return URL(string: s) }
        if s.hasPrefix("/") { return URL(string: s, relativeTo: APIBase.current)?.absoluteURL }
        return URL(string: s, relativeTo: APIBase.current)?.absoluteURL
    }

    static func formatPrice(_ ft: Int?) -> String {
        guard let ft, ft > 0 else { return "Ár: —" }
        return "\(formatNumber(ft)) Ft"
    }

    static func formatNumber(_ n: Int) -> String {
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
