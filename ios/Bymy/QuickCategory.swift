import Foundation

enum QuickCategory: String, CaseIterable, Identifiable {
    case uj, benzin, diesel, elektromos, hybrid, leasing, berelheto, ot

    var id: String { rawValue }

    var title: String {
        switch self {
        case .uj: return "Új"
        case .benzin: return "Benzin"
        case .diesel: return "Diesel"
        case .elektromos: return "Elektromos"
        case .hybrid: return "Hybrid"
        case .leasing: return "Leasing"
        case .berelheto: return "Bérelhető"
        case .ot: return "OT"
        }
    }

    var subtitle: String {
        switch self {
        case .uj: return "Friss modell"
        case .benzin: return "Otto motor"
        case .diesel: return "Dízelmotor"
        case .elektromos: return "Zöld hajtás"
        case .hybrid: return "Kombinált"
        case .leasing: return "Havi díj"
        case .berelheto: return "Rövid táv"
        case .ot: return "Oldtimer"
        }
    }

    /// Asset catalog image name (= autosweb /images/categories/*.png)
    var imageName: String { rawValue }
}
