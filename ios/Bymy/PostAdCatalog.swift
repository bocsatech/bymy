import Foundation

/// Hirdetés feladás menüfa (űrlapok később).
enum PostAdCatalog {
    struct Item: Identifiable, Hashable {
        let id: String
        let title: String
    }

    /// Autó hirdetés almenü
    static let autoItems: [Item] = [
        .init(id: "auto-szemelyauto", title: "Személyautó"),
        .init(id: "auto-leasing", title: "Leasing hirdetés"),
        .init(id: "auto-berauto", title: "Bérautó hirdetés"),
        .init(id: "auto-berlakokocsi", title: "Bérelhető lakókocsi hirdetés"),
    ]

    /// Teherautó hirdetés almenü
    static let teherItems: [Item] = [
        .init(id: "teher-kisteher", title: "Kisteher 3,5 t-ig"),
        .init(id: "teher-teherauto", title: "Teherautó 3,5 t-tól"),
    ]

    enum TruckKind: String, CaseIterable, Identifiable {
        case kisteher
        case teherauto

        var id: String { rawValue }

        var title: String {
            switch self {
            case .kisteher: return "Kisteherautó"
            case .teherauto: return "Teherautó"
            }
        }

        var subtitle: String {
            switch self {
            case .kisteher: return "3,5 t-ig"
            case .teherauto: return "3,5 t-tól"
            }
        }

        var catalogId: String {
            switch self {
            case .kisteher: return "teher-kisteher"
            case .teherauto: return "teher-teherauto"
            }
        }

        static func fromCatalogId(_ id: String) -> TruckKind? {
            switch id {
            case "teher-kisteher": return .kisteher
            case "teher-teherauto": return .teherauto
            default: return nil
            }
        }
    }

    /// Ingatlan → Típus (több is választható)
    static let ingatlanTipusok: [Item] = [
        .init(id: "elado", title: "Eladó"),
        .init(id: "kiado", title: "Kiadó"),
        .init(id: "berelheto", title: "Bérelhető"),
    ]

    /// Ingatlan → Kategória (több is választható; Eladó / Kiadó / Bérelhető alatt ugyanaz)
    static let ingatlanKategoriak: [Item] = [
        .init(id: "csaladi-haz", title: "Családi házak"),
        .init(id: "tarsashazi-lakas", title: "Társasházi lakások"),
        .init(id: "sorhaz", title: "Sorházak"),
        .init(id: "garazs", title: "Garázsok"),
        .init(id: "ipari", title: "Ipari ingatlanok"),
        .init(id: "telek", title: "Telkek"),
        .init(id: "nyaralo", title: "Nyaralók"),
        .init(id: "mezogazdasagi", title: "Mezőgazdasági ingatlanok"),
    ]
}
