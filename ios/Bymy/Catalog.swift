import Foundation

enum Catalog {
    /// Gyártmány → típusok (lista auto.csv / VehicleCatalog.json)
    static let brands: [String: [String]] = loadBrands()

    static var brandNames: [String] {
        brands.keys.sorted {
            $0.localizedStandardCompare($1) == .orderedAscending
        }
    }

    private static func loadBrands() -> [String: [String]] {
        guard
            let url = Bundle.main.url(forResource: "VehicleCatalog", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode(VehicleCatalogFile.self, from: data)
        else {
            assertionFailure("VehicleCatalog.json hiányzik a bundle-ből")
            return [:]
        }
        return decoded.modellek
    }

    /// Ár lépésköz: 500 000 Ft (0 … 50 M)
    static let priceStep = 500_000
    static let priceMaxCap = 50_000_000
    static var priceSteps: [Int] {
        Array(stride(from: 0, through: priceMaxCap, by: priceStep))
    }

    static func priceStepLabel(_ value: Int) -> String {
        if value == 0 { return "0 Ft" }
        return SearchFilter.formatPrice(value)
    }

    /// Évjárat: 1990 … aktuális év
    static var yearMax: Int {
        Calendar.current.component(.year, from: Date())
    }
    static let yearMin = 1990
    static var yearSteps: [Int] {
        Array(stride(from: yearMin, through: yearMax, by: 1))
    }

    /// Futott km: 0 … 500 000, 10 000-es lépésköz
    static let kmStep = 10_000
    static let kmMaxCap = 500_000
    static var kmSteps: [Int] {
        Array(stride(from: 0, through: kmMaxCap, by: kmStep))
    }

    static func kmStepLabel(_ value: Int) -> String {
        if value == 0 { return "0 km" }
        let formatted = value.formatted()
        return "\(formatted) km"
    }

    /// Hengerűrtartalom minimum görgető (cm³)
    static let hengerCm3MinSteps: [Int] = [
        500, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900,
        2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000,
        3500, 4000, 4500, 5000,
    ]

    /// Hengerűrtartalom maximum görgető (cm³) — +8000
    static let hengerCm3MaxSteps: [Int] = [
        500, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900,
        2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000,
        3500, 4000, 4500, 5000, 8000,
    ]

    static func hengerCm3StepLabel(_ value: Int) -> String {
        "\(value.formatted()) cm³"
    }

    static let savedIcons = ["🚗", "🔍", "⭐", "💎", "🏎️", "🛠️", "📌", "🔥"]
}

private struct VehicleCatalogFile: Decodable {
    let gyartmanyok: [String]?
    let modellek: [String: [String]]
}

enum SampleContent {
    static let feed: [FeedItem] = [
        FeedItem(
            id: "yt1",
            kind: .youtube,
            title: "Használtautó vásárlás — mire figyelj 2026-ban",
            source: "YouTube",
            subtitle: "Bymy · tippek",
            url: URL(string: "https://www.youtube.com")
        ),
        FeedItem(
            id: "n1",
            kind: .news,
            title: "Új elektromos modellek a magyar piacon",
            source: "Hírek",
            subtitle: "Összefoglaló a friss kínálatról",
            url: nil
        ),
        FeedItem(
            id: "yt2",
            kind: .youtube,
            title: "BMW 3-as teszt — dízel vs hibrid",
            source: "YouTube",
            subtitle: "Összehasonlító videó",
            url: URL(string: "https://www.youtube.com")
        ),
        FeedItem(
            id: "n2",
            kind: .news,
            title: "Átírás és eredetvizsgálat — rövid útmutató",
            source: "Útmutató",
            subtitle: "Közeli szolgáltatókhoz kapcsolódik",
            url: nil
        ),
    ]

    static let featured: [FeaturedAd] = [
        FeaturedAd(id: "a1", title: "BMW 320d · 2019", priceLabel: "8,9 M Ft", meta: "142 000 km · Diesel · Automat", badge: "Kiemelt"),
        FeaturedAd(id: "a2", title: "Volkswagen Golf 1.5 TSI", priceLabel: "6,2 M Ft", meta: "68 000 km · Benzin · 2021", badge: "Friss"),
        FeaturedAd(id: "a3", title: "Toyota Corolla Hybrid", priceLabel: "7,4 M Ft", meta: "51 000 km · Hybrid · 2022", badge: "Kiemelt"),
        FeaturedAd(id: "a4", title: "Skoda Octavia 2.0 TDI", priceLabel: "5,1 M Ft", meta: "118 000 km · Diesel · 2018", badge: nil),
        FeaturedAd(id: "a5", title: "Ford Kuga ST-Line", priceLabel: "9,8 M Ft", meta: "34 000 km · Hybrid · 2023", badge: "Kiemelt"),
    ]
}
