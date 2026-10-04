import Foundation
import Combine

/// Alsó tab = mobil web `.mw-app-tabbar`
enum BottomTab: String, CaseIterable, Identifiable {
    case home
    case search
    case post
    case feed
    case account

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Főoldal"
        case .search: return "Keresés"
        case .post: return "Feladás"
        case .feed: return "Hírfolyam"
        case .account: return "Fiók"
        }
    }
}

/// Felső menüsáv = mobil web `.mw-app-pages`
enum TopPage: String, CaseIterable, Identifiable {
    case hub
    case auto
    case teherauto
    case ingatlan
    case ertekbecsles
    case ajanlasok

    var id: String { rawValue }

    var title: String {
        switch self {
        case .hub: return "Kezdőlap"
        case .auto: return "Autó"
        case .teherauto: return "Teherautó"
        case .ingatlan: return "Ingatlan"
        case .ertekbecsles: return "Értékbecslés"
        case .ajanlasok: return "Ajánlások"
        }
    }

    var index: Int { TopPage.allCases.firstIndex(of: self) ?? 0 }

    static func from(index: Int) -> TopPage {
        let cases = TopPage.allCases
        guard index >= 0, index < cases.count else { return .hub }
        return cases[index]
    }
}

@MainActor
final class AppRouter: ObservableObject {
    @Published var bottomTab: BottomTab = .home
    @Published var topPage: TopPage = .hub
    @Published var showLogin = false
    @Published var showMessages = false
    @Published var showRegister = false
    /// Push a NavigationStack-en (nem sheet).
    @Published var openListingId: String?
    @Published var openChat: MessagesAPI.Conversation?
    @Published var openFiokSection: FiokSection?

    /// Alsó tab választás — igazodik a mobil web linkjeihez.
    func selectBottom(_ tab: BottomTab, isLoggedIn: Bool) {
        // Tab váltás = vissza a listához (mint weben új oldal)
        openListingId = nil
        openChat = nil
        openFiokSection = nil

        switch tab {
        case .home:
            bottomTab = .home
            topPage = .hub
        case .search:
            // Web: Keresés tab → /kereses.html (kategória henger)
            bottomTab = .search
        case .post:
            if isLoggedIn {
                bottomTab = .post
            } else {
                showLogin = true
            }
        case .feed:
            bottomTab = .feed
            topPage = .ajanlasok
        case .account:
            if isLoggedIn {
                bottomTab = .account
            } else {
                showLogin = true
            }
        }
    }

    func selectTop(_ page: TopPage) {
        openListingId = nil
        openChat = nil
        openFiokSection = nil
        topPage = page
        switch page {
        case .ajanlasok:
            bottomTab = .feed
        case .hub:
            bottomTab = .home
        case .auto, .teherauto, .ingatlan, .ertekbecsles:
            // Web: vertical pages → Keresés tab active family
            bottomTab = .home
        }
    }

    func openListing(_ id: String) {
        openChat = nil
        openFiokSection = nil
        openListingId = id
    }

    func openFiokSection(_ section: FiokSection?) {
        openListingId = nil
        openChat = nil
        openFiokSection = section
        if section != nil {
            bottomTab = .account
        }
    }

    func openMessage(for detail: ListingsAPI.Detail, token: String?) async {
        guard let token, !token.isEmpty else {
            showLogin = true
            return
        }
        do {
            let conv = try await MessagesAPI.startConversation(
                token: token,
                listingId: detail.id,
                title: detail.title,
                priceLabel: detail.priceLabel,
                meta: detail.meta,
                sellerId: detail.ownerUserId
            )
            openChat = conv
        } catch {
            openChat = MessagesAPI.Conversation(
                id: 0,
                listing: .init(
                    id: detail.id,
                    title: detail.title,
                    priceLabel: detail.priceLabel,
                    code: "BYMY-\(detail.id)",
                    meta: detail.meta
                ),
                peer: .init(id: detail.ownerUserId ?? 0, email: "", displayName: detail.sellerName),
                role: "buyer",
                unread: 0,
                updatedAt: "",
                lastMessage: nil
            )
        }
    }

    /// Hirdetés / chat / fiók-aloldal / feladás: web szerint nincs top inject a wizardon;
    /// Fiók megtartja a felső sávot (mint `mw-app-top` a fiok.html-en).
    var showsTopChrome: Bool {
        openListingId == nil
            && openChat == nil
            && openFiokSection == nil
            && bottomTab != .post
    }

    var showsBottomChrome: Bool {
        openListingId == nil
            && openChat == nil
            && openFiokSection == nil
            && bottomTab != .post
    }
}
