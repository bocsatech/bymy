import Foundation

/// Mobil web gyorskereső opciók (`auto-search-layout` + `kivitel-options` + `equipment-data`).
enum SearchCatalog {
    static let fuels = [
        "Benzin", "Dízel", "Benzin/Gáz", "Dízel/Gáz", "Hibrid",
        "Elektromos", "Etanol", "Biodízel", "Gáz", "LPG", "CNG",
    ]

    static let kivitels = [
        "Pickup", "Terepjáró", "Buggy", "Cabrio", "Coupe", "Egyterű",
        "Ferdehátú", "Hot rod", "Kisbusz", "Kombi", "Lépcsőshátú",
        "Mopedautó", "Sedan", "Sport", "Városi terepjáró (crossover)", "Egyéb",
    ]

    static let conditions = [
        "Normál", "Megkímélt", "Újszerű", "Sérülésmentes",
        "Serült", "Kitűnő", "Jó", "Megfelelő",
    ]

    static let transmissions = ["Manuális", "Automata", "Fokozatmentes"]

    static let drives = ["Első kerék", "Hátsó kerék", "Összkerék"]

    /// Gyakori tartalék márkák, ha a katalógus API nem érhető el.
    static let fallbackBrands = [
        "Audi", "BMW", "Citroen", "Dacia", "Fiat", "Ford", "Honda", "Hyundai",
        "Kia", "Mazda", "Mercedes-Benz", "Nissan", "Opel", "Peugeot", "Renault",
        "Seat", "Skoda", "Suzuki", "Toyota", "Volkswagen", "Volvo",
    ]

    static func yearOptions() -> [String] {
        let last = Calendar.current.component(.year, from: Date())
        return (1950...last).reversed().map(String.init)
    }

    static func priceOptions() -> [Int] {
        stride(from: 500_000, through: 50_000_000, by: 500_000).map { $0 }
    }

    static func kmOptions() -> [Int] {
        stride(from: 0, through: 500_000, by: 10_000).map { $0 }
    }

    static func formatPrice(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return (f.string(from: NSNumber(value: n)) ?? String(n)) + " Ft"
    }

    static func formatKm(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return (f.string(from: NSNumber(value: n)) ?? String(n)) + " km"
    }
}

@MainActor
final class VehicleCatalogStore: ObservableObject {
    @Published private(set) var brands: [String] = SearchCatalog.fallbackBrands
    @Published private(set) var modelsByBrand: [String: [String]] = [:]
    @Published private(set) var loaded = false

    func load(kind: String = "szemelyauto") async {
        if loaded { return }
        do {
            var comps = URLComponents(url: APIBase.url("api/vehicle-catalog"), resolvingAgainstBaseURL: false)!
            comps.queryItems = [URLQueryItem(name: "kind", value: kind)]
            var req = URLRequest(url: comps.url!)
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            req.timeoutInterval = 20
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, http.statusCode < 400 else { return }
            guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            let list = (root["gyartmanyok"] as? [Any])?.compactMap { $0 as? String } ?? []
            if !list.isEmpty {
                brands = list.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            }
            if let models = root["modellek"] as? [String: [Any]] {
                var map: [String: [String]] = [:]
                for (k, v) in models {
                    map[k] = v.compactMap { $0 as? String }
                }
                modelsByBrand = map
            }
            loaded = true
        } catch {
            // fallback brands maradnak
        }
    }

    func models(for brand: String) -> [String] {
        guard !brand.isEmpty else { return [] }
        return modelsByBrand[brand]
            ?? modelsByBrand.first(where: { $0.key.caseInsensitiveCompare(brand) == .orderedSame })?.value
            ?? []
    }
}
