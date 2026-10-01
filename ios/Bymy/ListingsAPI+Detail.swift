import Foundation

extension ListingsAPI {
    struct Detail: Identifiable, Equatable {
        let id: String
        let title: String
        let priceLabel: String
        let meta: String
        let imageURLs: [URL]
        let rows: [(label: String, value: String)]
        let description: String
        let sellerName: String
        let sellerPhone: String?
        let ownerUserId: Int?

        static func == (lhs: Detail, rhs: Detail) -> Bool {
            lhs.id == rhs.id && lhs.title == rhs.title && lhs.priceLabel == rhs.priceLabel
        }
    }

    static func fetchDetail(id: String, token: String?) async throws -> Detail {
        var req = URLRequest(url: APIBase.url("api/listings/\(id)").appending(queryItems: [
            URLQueryItem(name: "view", value: "detail"),
        ]))
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 30
        if let token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIClient.APIError.unreachable }
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        if http.statusCode == 401 {
            throw APIClient.APIError.unauthorized((obj?["error"] as? String) ?? "Belépés szükséges.")
        }
        guard http.statusCode < 400, let listing = obj?["listing"] as? [String: Any] else {
            throw APIClient.APIError.server((obj?["error"] as? String) ?? "Hirdetés nem található.")
        }
        return mapDetail(listing, fallbackId: id)
    }

    private static func mapDetail(_ listing: [String: Any], fallbackId: String) -> Detail {
        let id = stringValue(listing["id"]) ?? fallbackId
        let form = listing["form"] as? [String: Any] ?? [:]
        let preview = listing["preview"] as? [String: Any] ?? [:]
        let detail = listing["detail"] as? [String: Any] ?? [:]

        let title =
            stringValue(preview["title"])
            ?? stringValue(detail["title"])
            ?? stringValue(form["hirdetes_cime"])
            ?? "Hirdetés"

        let priceLabel =
            stringValue(preview["priceLabel"])
            ?? stringValue(preview["price"])
            ?? formatPrice(intValue(form["vetelar"]))

        var metaParts: [String] = []
        if let y = stringValue(form["gyartasi_ev"]) ?? stringValue(preview["year"]) { metaParts.append(y) }
        if let km = intValue(form["km"]) ?? intValue(preview["km"]) {
            metaParts.append("\(formatNumber(km)) km")
        }
        if let fuel = stringValue(form["uzemanyag"]) ?? stringValue(preview["fuel"]) {
            metaParts.append(fuel)
        }

        var images: [URL] = []
        if let arr = preview["images"] as? [Any] {
            images.append(contentsOf: arr.compactMap { absoluteImageURL(stringValue($0) ?? "") })
        }
        if let arr = detail["images"] as? [Any] {
            for item in arr {
                if let u = absoluteImageURL(stringValue(item) ?? "") { images.append(u) }
            }
        }
        if let fo = stringValue(listing["fo_kep"]) ?? stringValue(form["fo_kep"]),
           let u = absoluteImageURL(fo) {
            images.insert(u, at: 0)
        }
        // dedupe
        var seen = Set<String>()
        images = images.filter { seen.insert($0.absoluteString).inserted }

        var rows: [(label: String, value: String)] = []
        let rowKeys: [(String, String)] = [
            ("Gyártmány", "gyartmany"),
            ("Modell", "modell"),
            ("Évjárat", "gyartasi_ev"),
            ("Km", "km"),
            ("Üzemanyag", "uzemanyag"),
            ("Váltó", "sebessegvalto"),
            ("Állapot", "allapot"),
            ("Szín", "szin"),
            ("Kivitel", "kivitel"),
            ("Település", "telepules"),
        ]
        for (label, key) in rowKeys {
            if let v = stringValue(form[key]), !v.isEmpty {
                rows.append((label, key == "km" ? "\(formatNumber(Int(v.filter(\.isNumber)) ?? 0)) km" : v))
            }
        }
        if let specs = detail["specs"] as? [[String: Any]] {
            for spec in specs {
                let label = stringValue(spec["label"]) ?? stringValue(spec["name"]) ?? ""
                let value = stringValue(spec["value"]) ?? ""
                if !label.isEmpty, !value.isEmpty {
                    rows.append((label, value))
                }
            }
        }

        let description =
            stringValue(detail["description"])
            ?? stringValue(form["leiras"])
            ?? ""

        let seller =
            stringValue(detail["sellerName"])
            ?? stringValue(form["hirdeto_nev"])
            ?? "Eladó"
        let phone =
            stringValue(detail["sellerPhone"])
            ?? stringValue(form["telefonszam"])
        let owner = intValue(listing["user_id"]) ?? intValue(listing["userId"])

        return Detail(
            id: id,
            title: title,
            priceLabel: priceLabel.isEmpty ? "Ár: —" : priceLabel,
            meta: metaParts.joined(separator: " · "),
            imageURLs: images,
            rows: rows,
            description: description,
            sellerName: seller,
            sellerPhone: phone,
            ownerUserId: owner
        )
    }

    private static func stringValue(_ any: Any?) -> String? {
        guard let any else { return nil }
        if let s = any as? String {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        if let n = any as? NSNumber { return n.stringValue }
        if let i = any as? Int { return String(i) }
        return nil
    }

    private static func intValue(_ any: Any?) -> Int? {
        if let i = any as? Int { return i }
        if let n = any as? NSNumber { return n.intValue }
        if let s = any as? String {
            let d = s.filter(\.isNumber)
            return d.isEmpty ? nil : Int(d)
        }
        return nil
    }
}

private extension URL {
    func appending(queryItems: [URLQueryItem]) -> URL {
        guard var comps = URLComponents(url: self, resolvingAgainstBaseURL: false) else { return self }
        comps.queryItems = (comps.queryItems ?? []) + queryItems
        return comps.url ?? self
    }
}
