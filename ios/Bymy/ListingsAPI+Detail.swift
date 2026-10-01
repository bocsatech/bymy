import Foundation

extension ListingsAPI {
    struct SpecRow: Equatable, Identifiable {
        var id: String { "\(label)-\(value)" }
        let label: String
        let value: String
    }

    struct SpecBlock: Equatable, Identifiable {
        var id: String { title }
        let title: String
        let rows: [SpecRow]
    }

    struct EquipmentGroup: Equatable, Identifiable {
        var id: String { title }
        let title: String
        let items: [String]
    }

    /// Mobil web `listing.detail` (`?view=detail`) — hirdetes-detail.js view.
    struct Detail: Identifiable, Equatable {
        let id: String
        let title: String
        let subtitle: String
        let priceLabel: String
        let salePriceLabel: String?
        let meta: String
        let imageURLs: [URL]
        let highlights: [SpecRow]
        let promoText: String?
        let specBlocks: [SpecBlock]
        let perks: [String]
        let equipmentGroups: [EquipmentGroup]
        let description: String
        let sellerName: String
        let sellerPhone: String?
        let phoneMasked: String?
        let hasPhone: Bool
        let sellerAvatarURL: URL?
        let sellerSince: String?
        let addressLines: [String]
        let mapQuery: String?
        let website: String?
        let ownerUserId: Int?
        let code: String?
        let vertical: String?

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

    static func fetchRelated(id: String, token: String?, limit: Int = 24) async throws -> [Listing] {
        try await fetch(
            path: "api/listings/\(id)/related",
            query: ["limit": String(limit)],
            token: token
        )
    }

    struct RevealedContact {
        let phone: String?
        let addressLines: [String]?
        let mapQuery: String?
    }

    /// Web `revealListingContact` — POST `/api/listings/:id/reveal-contact`.
    /// Turnstile nélkül próbál; ha a szerver elutasítja, nil-t ad vissza (nem dob).
    static func revealContact(id: String, token: String?) async throws -> RevealedContact {
        var req = URLRequest(url: APIBase.url("api/listings/\(id)/reveal-contact"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 20
        if let token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: [:] as [String: Any])
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
            throw APIClient.APIError.server("A telefonszám most nem kérhető le.")
        }
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let phone = stringValue(obj["phone"])
            ?? (obj["phones"] as? [Any])?.compactMap { stringValue($0) }.first
        let address = (obj["addressLines"] as? [Any])?.compactMap { stringValue($0) }
        let mapQ = stringValue(obj["mapQuery"])
            ?? (address?.isEmpty == false ? address?.joined(separator: ", ") : nil)
        return RevealedContact(phone: phone, addressLines: address, mapQuery: mapQ)
    }

    private static func mapDetail(_ listing: [String: Any], fallbackId: String) -> Detail {
        let id = stringValue(listing["id"]) ?? fallbackId
        let form = listing["form"] as? [String: Any] ?? [:]
        let preview = listing["preview"] as? [String: Any] ?? [:]
        let detail = listing["detail"] as? [String: Any] ?? [:]

        let title =
            stringValue(detail["title"])
            ?? stringValue(preview["title"])
            ?? stringValue(form["hirdetes_cime"])
            ?? "Hirdetés"

        let subtitle = stringValue(detail["metaLine"])
            ?? stringValue(detail["typeName"])
            ?? ""

        let priceLabel =
            stringValue(detail["price"])
            ?? stringValue(preview["price"])
            ?? formatPrice(intValue(form["vetelar"]))

        let salePrice = stringValue(detail["salePrice"])

        var metaParts: [String] = []
        if let y = stringValue(detail["year"]) ?? stringValue(form["gyartasi_ev"]) { metaParts.append(y) }
        if let km = stringValue(detail["km"]) {
            metaParts.append(km)
        } else if let km = intValue(form["km"]) {
            metaParts.append("\(formatNumber(km)) km")
        }
        if let fuel = stringValue(detail["fuel"]) ?? stringValue(form["uzemanyag"]) {
            metaParts.append(fuel)
        }

        var images: [URL] = []
        if let arr = detail["images"] as? [Any] {
            images.append(contentsOf: arr.compactMap { absoluteImageURL(stringValue($0)) })
        }
        if let arr = preview["images"] as? [Any] {
            for item in arr {
                if let u = absoluteImageURL(stringValue(item)) { images.append(u) }
            }
        }
        if let fo = stringValue(detail["imageUrl"]) ?? stringValue(listing["fo_kep"]),
           let u = absoluteImageURL(fo) {
            images.insert(u, at: 0)
        }
        var seen = Set<String>()
        images = images.filter { seen.insert($0.absoluteString).inserted }

        let vehicle = specRows(from: detail["vehicleSpecs"])
        let motor = specRows(from: detail["motorSpecs"])
        let docs = specRows(from: detail["documentSpecs"])
        let tires = specRows(from: detail["tireSpecs"])

        var blocks: [SpecBlock] = []
        if !vehicle.isEmpty { blocks.append(.init(title: "Jármű adatok", rows: vehicle)) }
        if !motor.isEmpty { blocks.append(.init(title: "Motor adatok", rows: motor)) }
        if !docs.isEmpty { blocks.append(.init(title: "Okmányok", rows: docs)) }
        if !tires.isEmpty { blocks.append(.init(title: "Abroncs", rows: tires)) }

        if blocks.isEmpty {
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
            var fallback: [SpecRow] = []
            for (label, key) in rowKeys {
                if let v = stringValue(form[key]), !v.isEmpty {
                    let display = key == "km" ? "\(formatNumber(Int(v.filter(\.isNumber)) ?? 0)) km" : v
                    fallback.append(.init(label: label, value: display))
                }
            }
            if !fallback.isEmpty {
                blocks.append(.init(title: "Adatok", rows: fallback))
            }
        }

        // Web highlightSpecsFromView — kivonat a detail mezőkből / headerSpecs
        var highlights: [SpecRow] = []
        if let header = detail["headerSpecs"] as? [[String: Any]] {
            highlights = header.compactMap { row in
                let label = stringValue(row["label"]) ?? ""
                let value = stringValue(row["value"]) ?? ""
                guard !label.isEmpty, !value.isEmpty, value != "—" else { return nil }
                return SpecRow(label: label, value: value)
            }
        }
        if highlights.isEmpty {
            if let y = stringValue(detail["year"]), y != "—" { highlights.append(.init(label: "Évjárat", value: y)) }
            if let km = stringValue(detail["km"]), km != "—" { highlights.append(.init(label: "Km", value: km)) }
            if let fuel = stringValue(detail["fuel"]), fuel != "—" { highlights.append(.init(label: "Üzemanyag", value: fuel)) }
            if let power = stringValue(detail["power"]), power != "—" { highlights.append(.init(label: "Teljesítmény", value: power)) }
        }
        if highlights.isEmpty {
            highlights = Array(blocks.first?.rows.prefix(4) ?? [])
        }

        let perks = (detail["perks"] as? [Any])?.compactMap { stringValue($0) } ?? []

        var equipmentGroups: [EquipmentGroup] = []
        if let groups = detail["equipmentGroups"] as? [[String: Any]] {
            equipmentGroups = groups.compactMap { g in
                let title = stringValue(g["title"]) ?? ""
                let items = (g["items"] as? [Any])?.compactMap { stringValue($0) } ?? []
                guard !title.isEmpty, !items.isEmpty else { return nil }
                return EquipmentGroup(title: title, items: items)
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
        let phone = stringValue(detail["phone"]) ?? stringValue(form["telefonszam"])
        let phoneMasked = stringValue(detail["phoneMasked"])
        let hasPhoneFlag = (detail["hasPhone"] as? Bool)
            ?? (phone != nil || phoneMasked != nil)
        let owner = intValue(detail["userId"]) ?? intValue(listing["user_id"]) ?? intValue(listing["userId"])

        let address = (detail["addressLines"] as? [Any])?.compactMap { stringValue($0) } ?? []
        let mapQuery = stringValue(detail["mapQuery"])
        let website = stringValue(detail["website"])
        let avatar = absoluteImageURL(stringValue(detail["sellerAvatarUrl"]))
        let since = stringValue(detail["sellerSince"])
        let code = stringValue(detail["code"])
        let vertical = stringValue(detail["vertical"])

        let brand = stringValue(detail["brand"]) ?? stringValue(form["gyartmany"])
        let typeName = stringValue(detail["typeName"])
        let promo: String? = {
            if let b = brand, let t = typeName { return "\(b) \(t)".trimmingCharacters(in: .whitespaces) }
            return brand ?? typeName
        }()

        return Detail(
            id: id,
            title: title,
            subtitle: subtitle,
            priceLabel: priceLabel.isEmpty ? "—" : priceLabel,
            salePriceLabel: salePrice,
            meta: metaParts.joined(separator: " · "),
            imageURLs: images,
            highlights: highlights,
            promoText: promo,
            specBlocks: blocks,
            perks: perks,
            equipmentGroups: equipmentGroups,
            description: description,
            sellerName: seller,
            sellerPhone: phone,
            phoneMasked: phoneMasked,
            hasPhone: hasPhoneFlag || phone != nil || phoneMasked != nil,
            sellerAvatarURL: avatar,
            sellerSince: since,
            addressLines: address,
            mapQuery: mapQuery,
            website: website,
            ownerUserId: owner,
            code: code,
            vertical: vertical
        )
    }

    private static func specRows(from any: Any?) -> [SpecRow] {
        guard let arr = any as? [[String: Any]] else { return [] }
        return arr.compactMap { row in
            let label = stringValue(row["label"]) ?? stringValue(row["name"]) ?? ""
            let value = stringValue(row["value"]) ?? ""
            guard !label.isEmpty, !value.isEmpty else { return nil }
            return SpecRow(label: label, value: value)
        }
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
