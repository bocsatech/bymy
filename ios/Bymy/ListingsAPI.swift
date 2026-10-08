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
        var ownerBoost: Bool = false
        var ownerUserId: Int? = nil
        var priceNum: Int? = nil
        var kmNum: Int? = nil
        var updatedAt: String? = nil
        var createdAt: String? = nil
        var promoKiemelt: Bool = false
        var status: String? = nil
    }

    struct Page: Equatable {
        var listings: [Listing]
        var boostOwnerIds: Set<Int>
        var boostListingIds: Set<Int>
    }

    enum DeskSort: String, CaseIterable, Identifiable {
        case newest
        case priceAsc = "price-asc"
        case priceDesc = "price-desc"
        case kmAsc = "km-asc"

        var id: String { rawValue }

        var label: String {
            switch self {
            case .newest: return "Legfrissebbek elöl"
            case .priceAsc: return "Ár szerint növekvő"
            case .priceDesc: return "Ár szerint csökkenő"
            case .kmAsc: return "Km szerint növekvő"
            }
        }
    }

    private struct Envelope: Decodable {
        let listings: [RemoteListing]?
        let items: [RemoteListing]?
        let boostOwnerIds: [FlexibleID]?
        let boostListingIds: [FlexibleID]?
        let error: String?
    }

    private struct RemoteListing: Decodable {
        let id: FlexibleID
        let hirdetes_cime: String?
        let fo_kep: String?
        let status: String?
        let preview: RemotePreview?
        let user_id: Int?
        let ownerBoost: Bool?
        let updated_at: String?
        let created_at: String?
        let form: RemoteForm?
    }

    private struct RemoteForm: Decodable {
        let owner_user_id: Int?
        let promo_kiemelt: String?
        let km: FlexibleNumber?
        let vetelar: FlexibleNumber?
    }

    private struct RemotePreview: Decodable {
        let title: String?
        let price: String?
        let priceNum: Int?
        let km: String?
        let kmNum: Int?
        let specLine: String?
        let imageUrl: String?
        let imageUrls: [String]?
        let filter: RemoteFilter?
        let promo: RemotePromo?
    }

    private struct RemotePromo: Decodable {
        let kiemelt: Bool?
    }

    private struct RemoteFilter: Decodable {
        let uzemanyag: String?
        let gyartasi_ev: FlexibleNumber?
        let gyartmany: String?
        let modell: String?
        let owner_user_id: Int?
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
        try await fetchPage(path: "api/listings", query: [
            "limit": String(limit),
            "status": "feladott",
        ], token: token).listings
    }

    static func fetchCategory(_ kind: String, limit: Int = 40, token: String? = nil) async throws -> [Listing] {
        try await fetchCategoryPage(kind, limit: limit, token: token).listings
    }

    static func fetchCategoryPage(_ kind: String, limit: Int = 40, token: String? = nil) async throws -> Page {
        let vertical = kind == "teherauto" ? "teher" : kind
        return try await fetchPage(path: "api/listings", query: [
            "limit": String(limit),
            "status": "feladott",
            "vertical": vertical,
        ], token: token)
    }

    /// Boostolt hirdetések elöl — mint weben `applyOwnerBoostSort`.
    static func applyBoostSort(_ items: [Listing], sort: DeskSort = .newest, boostListingIds: Set<Int> = [], boostOwnerIds: Set<Int> = []) -> [Listing] {
        let marked = items.map { item -> Listing in
            var copy = item
            if isBoosted(item, boostListingIds: boostListingIds, boostOwnerIds: boostOwnerIds) {
                copy.ownerBoost = true
            }
            return copy
        }
        return marked.sorted { a, b in
            let aB = a.ownerBoost ? 0 : 1
            let bB = b.ownerBoost ? 0 : 1
            if aB != bB { return aB < bB }
            switch sort {
            case .priceAsc:
                return (a.priceNum ?? Int.max) < (b.priceNum ?? Int.max)
            case .priceDesc:
                return (a.priceNum ?? -1) > (b.priceNum ?? -1)
            case .kmAsc:
                return (a.kmNum ?? Int.max) < (b.kmNum ?? Int.max)
            case .newest:
                return (a.updatedAt ?? "") > (b.updatedAt ?? "")
            }
        }
    }

    static func isBoosted(_ item: Listing, boostListingIds: Set<Int>, boostOwnerIds: Set<Int>) -> Bool {
        if item.ownerBoost { return true }
        if let id = Int(item.id), boostListingIds.contains(id) { return true }
        if let oid = item.ownerUserId, oid > 0, boostOwnerIds.contains(oid) { return true }
        return false
    }

    static func fetch(path: String, query: [String: String], token: String? = nil) async throws -> [Listing] {
        try await fetchPage(path: path, query: query, token: token).listings
    }

    /// Web `fetchExistingListingIds` — GET `/api/listings/exists?ids=`.
    static func existingIds(_ ids: [String]) async throws -> Set<String> {
        let unique = Array(Set(ids.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })).prefix(200)
        if unique.isEmpty { return [] }
        var comps = URLComponents(url: APIBase.url("api/listings/exists"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "ids", value: unique.joined(separator: ","))]
        var req = URLRequest(url: comps.url!)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
            throw APIClient.APIError.server("Kedvencek ellenőrzése sikertelen.")
        }
        struct Envelope: Decodable { let ids: [FlexibleID]? }
        let decoded = try JSONDecoder().decode(Envelope.self, from: data)
        return Set((decoded.ids ?? []).map { $0.value })
    }

    /// Web `fetchMyListings` — GET `/api/listings/mine`.
    static func fetchMine(token: String?, limit: Int = 200) async throws -> [Listing] {
        guard let token, !token.isEmpty else {
            throw APIClient.APIError.unauthorized("Belépés szükséges.")
        }
        return try await fetch(
            path: "api/listings/mine",
            query: ["limit": String(limit)],
            token: token
        )
    }

    static func fetchPage(path: String, query: [String: String], token: String? = nil) async throws -> Page {
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

        if let decoded = try? JSONDecoder().decode(Envelope.self, from: data), http.statusCode < 400 {
            let rows = decoded.listings ?? decoded.items ?? []
            let boostOwners = Set((decoded.boostOwnerIds ?? []).compactMap { Int($0.value) }.filter { $0 > 0 })
            let boostListings = Set((decoded.boostListingIds ?? []).compactMap { Int($0.value) }.filter { $0 > 0 })
            let mapped = rows.map { mapRemote($0, boostOwnerIds: boostOwners, boostListingIds: boostListings) }
            if !mapped.isEmpty || rows.isEmpty {
                return Page(listings: mapped, boostOwnerIds: boostOwners, boostListingIds: boostListings)
            }
        }

        guard http.statusCode < 400 else {
            let err = (try? JSONDecoder().decode(Envelope.self, from: data))?.error
            throw APIClient.APIError.server(err ?? "Hirdetések betöltése sikertelen.")
        }

        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIClient.APIError.decoding
        }
        let boostOwners = Set(((root["boostOwnerIds"] as? [Any]) ?? []).compactMap { intAny($0) }.filter { $0 > 0 })
        let boostListings = Set(((root["boostListingIds"] as? [Any]) ?? []).compactMap { intAny($0) }.filter { $0 > 0 })
        let arr = (root["listings"] as? [[String: Any]]) ?? (root["items"] as? [[String: Any]]) ?? []
        let mapped = arr.compactMap { mapDict($0, boostOwnerIds: boostOwners, boostListingIds: boostListings) }
        return Page(listings: mapped, boostOwnerIds: boostOwners, boostListingIds: boostListings)
    }

    private static func mapRemote(_ row: RemoteListing, boostOwnerIds: Set<Int>, boostListingIds: Set<Int>) -> Listing {
        let preview = row.preview
        var title = (preview?.title ?? row.hirdetes_cime ?? "Hirdetés #\(row.id.value)")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if title.lowercased().hasPrefix("eladó ") {
            title = String(title.dropFirst(6))
        }
        if title.isEmpty { title = "Hirdetés #\(row.id.value)" }

        let priceNum = preview?.priceNum ?? row.form?.vetelar?.value
        let price = (preview?.price).flatMap { $0.isEmpty ? nil : $0 } ?? formatPrice(priceNum)
        let year: String = {
            if let y = preview?.filter?.gyartasi_ev?.value, y > 1900 { return String(y) }
            return "—"
        }()
        let kmNum = preview?.kmNum ?? row.form?.km?.value
        let km = (preview?.km).flatMap { $0.isEmpty ? nil : $0 }
            ?? kmNum.map { "\(formatNumber($0)) km" }
            ?? "—"
        let fuel = (preview?.filter?.uzemanyag).flatMap { $0.isEmpty ? nil : $0 } ?? "—"
        let meta = [year, km, fuel].joined(separator: " · ")

        let imageURL =
            absoluteImageURL(row.fo_kep)
            ?? absoluteImageURL(preview?.imageUrl)
            ?? preview?.imageUrls?.compactMap(absoluteImageURL).first

        let ownerId = row.form?.owner_user_id ?? preview?.filter?.owner_user_id ?? row.user_id
        let idNum = Int(row.id.value)
        let boosted = row.ownerBoost == true
            || (idNum.map { boostListingIds.contains($0) } ?? false)
            || (ownerId.map { boostOwnerIds.contains($0) } ?? false)

        let promo = preview?.promo?.kiemelt == true
            || row.form?.promo_kiemelt == "1"

        return Listing(
            id: row.id.value,
            title: title,
            priceLabel: price,
            meta: meta,
            imageURL: imageURL,
            badge: boosted ? "Előresorolt" : (promo ? "Kiemelt" : nil),
            brand: preview?.filter?.gyartmany,
            model: preview?.filter?.modell,
            ownerBoost: boosted,
            ownerUserId: ownerId,
            priceNum: priceNum,
            kmNum: kmNum,
            updatedAt: row.updated_at ?? row.created_at,
            createdAt: row.created_at ?? row.updated_at,
            promoKiemelt: promo,
            status: row.status
        )
    }

    private static func mapDict(_ row: [String: Any], boostOwnerIds: Set<Int>, boostListingIds: Set<Int>) -> Listing? {
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
        let priceNum = intAny(preview["priceNum"]) ?? intAny(form["vetelar"])
        let price = stringAny(preview["price"]) ?? formatPrice(priceNum)
        let filter = preview["filter"] as? [String: Any] ?? [:]
        let year = stringAny(filter["gyartasi_ev"]) ?? stringAny(form["gyartasi_ev"]) ?? "—"
        let kmNum = intAny(preview["kmNum"]) ?? intAny(form["km"])
        let km = stringAny(preview["km"]) ?? {
            if let n = kmNum { return "\(formatNumber(n)) km" }
            return "—"
        }()
        let fuel = stringAny(filter["uzemanyag"]) ?? stringAny(form["uzemanyag"]) ?? "—"
        let imageURL =
            absoluteImageURL(stringAny(row["fo_kep"]))
            ?? absoluteImageURL(stringAny(preview["imageUrl"]))
            ?? (preview["imageUrls"] as? [Any])?.compactMap { absoluteImageURL(stringAny($0)) }.first

        let ownerId = intAny(form["owner_user_id"]) ?? intAny(filter["owner_user_id"]) ?? intAny(row["user_id"])
        let idNum = Int(id)
        let boosted = (row["ownerBoost"] as? Bool) == true
            || (idNum.map { boostListingIds.contains($0) } ?? false)
            || (ownerId.map { boostOwnerIds.contains($0) } ?? false)
        let promoObj = preview["promo"] as? [String: Any]
        let promo = (promoObj?["kiemelt"] as? Bool) == true || stringAny(form["promo_kiemelt"]) == "1"

        return Listing(
            id: id,
            title: title,
            priceLabel: price,
            meta: [year, km, fuel].joined(separator: " · "),
            imageURL: imageURL,
            badge: boosted ? "Előresorolt" : (promo ? "Kiemelt" : nil),
            brand: stringAny(filter["gyartmany"]),
            model: stringAny(filter["modell"]),
            ownerBoost: boosted,
            ownerUserId: ownerId,
            priceNum: priceNum,
            kmNum: kmNum,
            updatedAt: stringAny(row["updated_at"]) ?? stringAny(row["created_at"]),
            createdAt: stringAny(row["created_at"]) ?? stringAny(row["updated_at"]),
            promoKiemelt: promo,
            status: stringAny(row["status"])
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
