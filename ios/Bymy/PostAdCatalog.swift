import Foundation

/// Mobil web `category-picker.js` — csoportok + opciók.
enum PostAdCatalog {
    struct Category: Identifiable, Hashable {
        let id: String
        let label: String
        let vertical: String
        let subtype: String
        var immoTipus: String? = nil
        var imagePath: String = ""
        var systemImage: String = "car.fill"
    }

    struct Group: Identifiable {
        let id: String
        let title: String
        let subtitle: String
        let thumbURL: String
        let accent: Accent
        let options: [Category]

        enum Accent {
            case car, truck, immo
        }
    }

    static let groups: [Group] = [
        .init(
            id: "auto",
            title: "Autó hirdetés",
            subtitle: "Személyautó és más",
            thumbURL: "https://bymy.hu/images/categories/benzin.jpg",
            accent: .car,
            options: [
                .init(id: "szemelyauto", label: "Személyautó", vertical: "auto", subtype: "szemelyauto",
                      imagePath: "/images/categories/benzin.png", systemImage: "car.fill"),
                .init(id: "leasing", label: "Leasing hirdetés", vertical: "auto", subtype: "leasing",
                      imagePath: "/images/categories/leasing.png", systemImage: "car.side.fill"),
                .init(id: "berauto", label: "Bérautó hirdetés", vertical: "auto", subtype: "berauto",
                      imagePath: "/images/categories/berelheto.png", systemImage: "key.fill"),
                .init(id: "lakokocsi", label: "Bérelhető lakókocsi hirdetés", vertical: "auto", subtype: "lakokocsi",
                      imagePath: "/images/categories/lakokocsi.png", systemImage: "trailer.fill"),
            ]
        ),
        .init(
            id: "teher",
            title: "Teherautó hirdetés",
            subtitle: "Kisteher és teherautó",
            thumbURL: "https://bymy.hu/images/categories/diesel.png",
            accent: .truck,
            options: [
                .init(id: "kisteher", label: "Kisteher 3,5 t-ig", vertical: "teher", subtype: "kisteher",
                      imagePath: "/images/categories/kisteher.png", systemImage: "truck.box.fill"),
                .init(id: "teherauto", label: "Teherautó 3,5 t-tól", vertical: "teher", subtype: "teherauto",
                      imagePath: "/images/categories/teherauto.png", systemImage: "bus.fill"),
            ]
        ),
        .init(
            id: "ingatlan",
            title: "Ingatlan hirdetések",
            subtitle: "Eladó, kiadó, Airbnb",
            thumbURL: "https://bymy.hu/images/hub-ingatlan.jpg?v=immoCat1",
            accent: .immo,
            options: [
                .init(id: "elado", label: "Eladó Ingatlanok", vertical: "ingatlan", subtype: "ingatlan",
                      immoTipus: "elado",
                      imagePath: "/images/hub-ingatlan-01-hazak.png", systemImage: "house.fill"),
                .init(id: "kiado", label: "Kiadó Ingatlanok", vertical: "ingatlan", subtype: "ingatlan",
                      immoTipus: "kiado",
                      imagePath: "/images/hub-ingatlan-02-lakasok.png", systemImage: "building.2.fill"),
                .init(id: "airbnb", label: "Airbnb Ingatlanok", vertical: "ingatlan", subtype: "ingatlan",
                      immoTipus: "airbnb",
                      imagePath: "/images/hub-ingatlan-photo.jpg", systemImage: "bed.double.fill"),
            ]
        ),
    ]

    /// Lapos lista (kompatibilitás).
    static var categories: [Category] { groups.flatMap(\.options) }

    static let fuels = SearchCatalog.fuels
    static let transmissions = SearchCatalog.transmissions
    static let conditions = SearchCatalog.conditions
    static let kivitels = SearchCatalog.kivitels
    static let drives = SearchCatalog.drives

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
