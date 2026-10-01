import Foundation

/// Mobil web `category-picker.js` WIZARD_CATEGORY_OPTIONS
enum PostAdCatalog {
    struct Category: Identifiable, Hashable {
        let id: String
        let label: String
        let vertical: String
        let subtype: String
        /// Ingatlan típus (elado / kiado / airbnb)
        var immoTipus: String? = nil
        var systemImage: String
    }

    static let categories: [Category] = [
        .init(id: "szemelyauto", label: "Személyautó", vertical: "auto", subtype: "szemelyauto", systemImage: "car.fill"),
        .init(id: "leasing", label: "Leasingautó", vertical: "auto", subtype: "leasing", systemImage: "car.side.fill"),
        .init(id: "berauto", label: "Bérautó", vertical: "auto", subtype: "berauto", systemImage: "key.fill"),
        .init(id: "lakokocsi", label: "Bérelhető Lakókocsi", vertical: "auto", subtype: "lakokocsi", systemImage: "trailer.fill"),
        .init(id: "kisteher", label: "Kisteherautó", vertical: "teher", subtype: "kisteher", systemImage: "truck.box.fill"),
        .init(id: "teherauto", label: "Teherautó", vertical: "teher", subtype: "teherauto", systemImage: "bus.fill"),
        .init(id: "elado", label: "Eladó Ingatlanok", vertical: "ingatlan", subtype: "ingatlan", immoTipus: "elado", systemImage: "house.fill"),
        .init(id: "kiado", label: "Kiadó Ingatlanok", vertical: "ingatlan", subtype: "ingatlan", immoTipus: "kiado", systemImage: "building.2.fill"),
        .init(id: "airbnb", label: "Airbnb Ingatlanok", vertical: "ingatlan", subtype: "ingatlan", immoTipus: "airbnb", systemImage: "bed.double.fill"),
    ]

    static let fuels = ["Benzin", "Dízel", "Hibrid", "Elektromos", "LPG", "CNG", "Egyéb"]
    static let transmissions = ["Manuális", "Automata", "Fokozatmentes"]
    static let conditions = ["Újszerű", "Kitűnő", "Jó", "Megfelelő", "Serült"]

    static let immoKategoriak: [(id: String, label: String)] = [
        ("csaladi-haz", "Családi házak"),
        ("tarsashazi", "Társasházi lakások"),
        ("sorhaz", "Sorházak"),
        ("garazs", "Garázsok"),
        ("ipari", "Ipari ingatlanok"),
        ("telek", "Telkek"),
        ("nyaralo", "Nyaralók"),
        ("mezogazdasagi", "Mezőgazdasági ingatlanok"),
    ]
}
