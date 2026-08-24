import Foundation

/// Gyors találat a kereső főoldalról (nem a kategória-sor)
enum ListingQuery: Equatable {
    case nearby
    case newListings
    case category(QuickCategory)

    var title: String {
        switch self {
        case .nearby: return "Közelben"
        case .newListings: return "Új hirdetések"
        case .category(let c): return c.title
        }
    }
}
