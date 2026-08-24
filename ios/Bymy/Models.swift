import Foundation

enum FuelType: String, Codable, CaseIterable, Identifiable {
    case benzin, diesel, hybrid, elektromos, benzinGaz = "benzin-gaz"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .benzin: return "Benzin"
        case .diesel: return "Diesel"
        case .hybrid: return "Hybrid"
        case .elektromos: return "Elektromos"
        case .benzinGaz: return "Benzin/Gáz"
        }
    }
}

struct SearchFilter: Codable, Equatable {
    // MARK: Egyszerű + Alap
    var gyartmanyok: [String] = []
    var modellek: [String] = []
    var fuels: [FuelType] = []
    var arTol: Int? = nil
    var arIg: Int? = nil
    var evTol: Int? = nil
    var evIg: Int? = nil
    var kmTol: Int? = nil
    var kmIg: Int? = nil

    var allapotok: [String] = []
    var kiviteles: [String] = []
    var ajtok: [String] = []
    var szemelyek: [String] = []
    var okmanyJellegek: [String] = []
    var okmanyErvenyesseg: [String] = []
    var hirdetok: [String] = []

    // MARK: Műszaki
    var hengerCm3Tol: Int? = nil
    var hengerCm3Ig: Int? = nil
    var kwTol: Int? = nil
    var kwIg: Int? = nil
    var nyomatekNmTol: Int? = nil
    var nyomatekNmIg: Int? = nil
    var sajatTomegTol: Int? = nil
    var sajatTomegIg: Int? = nil
    var osszTomegTol: Int? = nil
    var osszTomegIg: Int? = nil
    var sebessegvaltok: [String] = []
    var felezoValto: Bool = false
    var hajtasok: [String] = []
    var hengerElrendezesek: [String] = []
    var szinek: [String] = []
    var metalfeny: Bool = false
    var akkumulatorKwhTol: Int? = nil
    var akkumulatorKwhIg: Int? = nil
    var jelenlegiAkkukapacitasTol: Int? = nil
    var jelenlegiAkkukapacitasIg: Int? = nil
    var acToltoCsatlakozok: [String] = []
    var acToltoTeljesitmenyTol: Int? = nil
    var acToltoTeljesitmenyIg: Int? = nil
    var dcToltoCsatlakozok: [String] = []
    var dcToltoTeljesitmenyTol: Int? = nil
    var dcToltoTeljesitmenyIg: Int? = nil
    var hatotavTol: Int? = nil
    var hatotavIg: Int? = nil
    var autopalyaHatotavTol: Int? = nil
    var autopalyaHatotavIg: Int? = nil
    var teliHatotavTol: Int? = nil
    var teliHatotavIg: Int? = nil
    var villamToltes: Bool = false
    var zoldRendszam: Bool = false
    var toltoCsatlakozok: [String] = []

    // MARK: Raktér (teherautó)
    var rakterTerfogatTol: Int? = nil
    var rakterTerfogatIg: Int? = nil
    var rakterHosszTol: Int? = nil
    var rakterHosszIg: Int? = nil
    var rakterSzelessegTol: Int? = nil
    var rakterSzelessegIg: Int? = nil
    var rakterMagassagTol: Int? = nil
    var rakterMagassagIg: Int? = nil
    var doblemezTavolsagTol: Int? = nil
    var doblemezTavolsagIg: Int? = nil

    /// Feladás / kereső járműtípus (személyautó | kisteher | teherautó)
    var vehicleKind: String? = nil

    // MARK: Extrák
    var klima: String? = nil
    var nemDohanyzo: Bool = false
    var holgyTulajdonos: Bool = false
    /// Teljes felszereltség-lista kapcsolói (címke → be/ki)
    var extras: [String: Bool] = [:]

    var activeExtrasCount: Int {
        extras.values.filter { $0 }.count
            + (klima != nil ? 1 : 0)
            + (nemDohanyzo ? 1 : 0)
            + (holgyTulajdonos ? 1 : 0)
    }

    var brandLabel: String {
        if gyartmanyok.isEmpty { return "Mindegy" }
        if gyartmanyok.count == 1 { return gyartmanyok[0] }
        if gyartmanyok.count <= 3 { return gyartmanyok.joined(separator: ", ") }
        return "\(gyartmanyok.count) márka"
    }

    var modelLabel: String {
        if modellek.isEmpty { return "Mindegy" }
        if modellek.count == 1 { return modellek[0] }
        if modellek.count <= 3 { return modellek.joined(separator: ", ") }
        return "\(modellek.count) modell"
    }

    var fuelLabel: String {
        if fuels.isEmpty { return "Mindegy" }
        if fuels.count == 1 { return fuels[0].label }
        if fuels.count <= 3 { return fuels.map(\.label).joined(separator: ", ") }
        return "\(fuels.count) üzemanyag"
    }

    var summary: String {
        var parts: [String] = []
        if !gyartmanyok.isEmpty { parts.append(brandLabel) }
        if !modellek.isEmpty { parts.append(modelLabel) }
        if !fuels.isEmpty { parts.append(fuelLabel) }
        if let ig = arIg { parts.append("– \(Self.formatPrice(ig))") }
        else if let tol = arTol { parts.append("\(Self.formatPrice(tol)) –") }
        if !allapotok.isEmpty { parts.append("állapot") }
        if !kiviteles.isEmpty { parts.append("kivitel") }
        if !hirdetok.isEmpty { parts.append("hirdető") }
        if !sebessegvaltok.isEmpty { parts.append("váltó") }
        if !hajtasok.isEmpty { parts.append("hajtás") }
        if activeExtrasCount > 0 { parts.append("\(activeExtrasCount) extra") }
        return parts.isEmpty ? "Nincs szűrő" : parts.joined(separator: " · ")
    }

    var isEmpty: Bool { summary == "Nincs szűrő" }

    static func formatPrice(_ n: Int) -> String {
        if n >= 1_000_000 {
            let m = Double(n) / 1_000_000
            if m == floor(m) { return "\(Int(m)) M Ft" }
            return String(format: "%.1f M Ft", m)
        }
        return "\(n / 1000) ezer Ft"
    }
}

struct SavedSearch: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var icon: String
    var filter: SearchFilter
    var createdAt: Date
}

struct FeedItem: Identifiable {
    let id: String
    let kind: Kind
    let title: String
    let source: String
    let subtitle: String
    let url: URL?

    enum Kind { case news, youtube }
}

struct FeaturedAd: Identifiable {
    let id: String
    let title: String
    let priceLabel: String
    let meta: String
    let badge: String?
}
