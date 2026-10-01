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
    case ajanlasok

    var id: String { rawValue }

    var title: String {
        switch self {
        case .hub: return "Kezdőlap"
        case .auto: return "Autó"
        case .teherauto: return "Teherautó"
        case .ingatlan: return "Ingatlan"
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
    @Published var openListingId: String?
    @Published var openChat: MessagesAPI.Conversation?

    /// Alsó tab választás — igazodik a mobil web linkjeihez.
    func selectBottom(_ tab: BottomTab, isLoggedIn: Bool) {
        switch tab {
        case .home:
            bottomTab = .home
            topPage = .hub
        case .search:
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
        topPage = page
        switch page {
        case .ajanlasok:
            bottomTab = .feed
        case .hub:
            bottomTab = .home
        default:
            // Autó / Teherautó / Ingatlan = keresés jellegű
            if bottomTab == .post || bottomTab == .account {
                bottomTab = .home
            }
        }
    }

    var showsTopChrome: Bool {
        bottomTab != .post && bottomTab != .account && bottomTab != .search
    }

    var showsBottomChrome: Bool {
        bottomTab != .post
    }
}
