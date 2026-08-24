import Foundation
import Combine

/// Mentett hirdetés típusa — autó most, ingatlan később ugyanabban a sávban.
enum SavedListingKind: String, Codable, Hashable, CaseIterable {
    case auto
    case ingatlan

    var label: String {
        switch self {
        case .auto: return "Autó"
        case .ingatlan: return "Ingatlan"
        }
    }

    var placeholderSystemImage: String {
        switch self {
        case .auto: return "car.fill"
        case .ingatlan: return "house.fill"
        }
    }
}

struct SavedListingItem: Identifiable, Codable, Equatable, Hashable {
    var id: String { "\(kind.rawValue)-\(listingId)" }
    let listingId: String
    var kind: SavedListingKind
    var title: String
    var priceLabel: String
    var meta: String
    var imageURL: URL?
    var isDemo: Bool
    var savedAt: Date
}

/// Csillaggal elmentett hirdetések (autó + később ingatlan), UserDefaults.
@MainActor
final class SavedListingsStore: ObservableObject {
    @Published private(set) var items: [SavedListingItem] = []

    private let storageKey = "bymy.savedListings.v1"

    init() {
        load()
    }

    func contains(listingId: String) -> Bool {
        items.contains { $0.listingId == listingId }
    }

    func toggle(detail: ListingDetail, kind: SavedListingKind = .auto, isDemo: Bool = false) {
        if let idx = items.firstIndex(where: { $0.listingId == detail.id }) {
            items.remove(at: idx)
        } else {
            items.insert(
                SavedListingItem(
                    listingId: detail.id,
                    kind: kind,
                    title: detail.title,
                    priceLabel: detail.priceLabel,
                    meta: detail.meta,
                    imageURL: detail.imageURLs.first,
                    isDemo: isDemo,
                    savedAt: Date()
                ),
                at: 0
            )
        }
        persist()
    }

    func openRequest(for item: SavedListingItem) -> ListingOpenRequest {
        if item.isDemo, let demo = DemoListing.all.first(where: { $0.id == item.listingId }) {
            return .demo(demo)
        }
        return .remote(id: item.listingId)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([SavedListingItem].self, from: data) else {
            items = []
            return
        }
        items = decoded.sorted { $0.savedAt > $1.savedAt }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }
}
