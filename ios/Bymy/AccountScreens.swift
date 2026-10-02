import SwiftUI
import UIKit

/// Mobil web `fiok.html` / `beallitasok.html?szekcio=` menüpontok.
enum FiokSection: String, Hashable, Identifiable {
    case partnerProfil
    case autoImport
    case ertekbecslo
    case nyomtatasok
    case ertekelesek
    case kedvencek
    case sajatHirdetesek
    case mentettKeresesek
    case uzenetek
    case szemelyes
    case keresesiKorzet
    case ajanlasokKorzet
    case jelszo
    case notify
    case megjelenes

    var id: String { rawValue }

    var title: String {
        switch self {
        case .partnerProfil: return "Cégadatok"
        case .autoImport: return "Autóimport"
        case .ertekbecslo: return "Értékbecslő"
        case .nyomtatasok: return "Nyomtatások"
        case .ertekelesek: return "Értékelések"
        case .kedvencek: return "Kedvencek"
        case .sajatHirdetesek: return "Saját hirdetések"
        case .mentettKeresesek: return "Mentett kereséseim"
        case .uzenetek: return "Üzenetek"
        case .szemelyes: return "Személyes adatok"
        case .keresesiKorzet: return "Keresési körzet"
        case .ajanlasokKorzet: return "Ajánlások körzete"
        case .jelszo: return "Jelszó módosítása"
        case .notify: return "Hírlevél és értesítések"
        case .megjelenes: return "Megjelenés"
        }
    }

    var systemImage: String {
        switch self {
        case .partnerProfil: return "building.2"
        case .autoImport: return "car.side"
        case .ertekbecslo: return "chart.bar"
        case .nyomtatasok: return "doc.text"
        case .ertekelesek: return "star"
        case .kedvencek: return "heart"
        case .sajatHirdetesek: return "rectangle.stack"
        case .mentettKeresesek: return "magnifyingglass"
        case .uzenetek: return "envelope"
        case .szemelyes: return "person"
        case .keresesiKorzet: return "circle.dotted"
        case .ajanlasokKorzet: return "mappin.and.ellipse"
        case .jelszo: return "lock"
        case .notify: return "bell"
        case .megjelenes: return "circle.lefthalf.filled"
        }
    }
}

/// Profilkép: data URL vagy betű.
struct ProfileAvatarView: View {
    let letter: String
    var dataURL: String? = nil
    var size: CGFloat = 32

    var body: some View {
        ZStack {
            Circle().fill(AppTheme.avatarBg)
            if let image = decodedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            } else {
                Text(letter)
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundStyle(AppTheme.text)
            }
        }
        .frame(width: size, height: size)
        .overlay(Circle().stroke(AppTheme.border, lineWidth: 1.5))
    }

    private var decodedImage: UIImage? {
        guard let raw = dataURL?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if raw.hasPrefix("data:"), let comma = raw.firstIndex(of: ",") {
            let b64 = String(raw[raw.index(after: comma)...])
            if let data = Data(base64Encoded: b64) {
                return UIImage(data: data)
            }
        }
        if let data = Data(base64Encoded: raw) {
            return UIImage(data: data)
        }
        return nil
    }
}

/// Mobil web `fiok.html` — sárga fejléc + flat `mm-nav` sorok.
struct AccountScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var unreadMessages = 0

    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)

    private var isCompany: Bool {
        let t = (auth.user?.profile.accountType ?? "").lowercased()
        return t == "business" || t == "dealer"
    }

    private var isDealer: Bool {
        (auth.user?.profile.accountType ?? "").lowercased() == "dealer"
    }

    private var menuItems: [FiokMenuItem] {
        var items: [FiokMenuItem] = []
        if isCompany {
            items.append(.link(.partnerProfil))
        }
        items.append(.link(.autoImport))
        if isDealer {
            items.append(.link(.ertekbecslo))
        }
        items.append(.link(.nyomtatasok))
        items.append(.link(.ertekelesek))
        items.append(.soon(title: "Kiemelések", systemImage: "plus.square"))
        items.append(.link(.kedvencek))
        items.append(.link(.sajatHirdetesek))
        items.append(.link(.mentettKeresesek))
        items.append(.link(.uzenetek, badge: unreadMessages > 0 ? unreadMessages : nil))
        items.append(.link(.szemelyes))
        items.append(.link(.keresesiKorzet))
        items.append(.link(.ajanlasokKorzet))
        items.append(.link(.jelszo))
        items.append(.link(.notify))
        items.append(.link(.megjelenes))
        return items
    }

    var body: some View {
        VStack(spacing: 0) {
            // Web: `.fiok-top` rejtve, ha van `mw-app-top` — a natív MobileTopBar helyettesíti.
            if !router.showsTopChrome {
                fiokHeader
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    sideHead
                    navCard
                    logoutButton
                }
                .padding(.horizontal, 12)
                .padding(.top, 12)
                .padding(.bottom, 28)
            }
        }
        .background(pageBg.ignoresSafeArea())
        .task { await refreshUnread() }
    }

    private var sideHead: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text("Fiókom")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.black.opacity(0.62))
                if isCompany {
                    Text(auth.user?.profile.accountType == "dealer" ? "Kereskedő" : "Cég")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.black.opacity(0.75))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.white.opacity(0.55))
                        .clipShape(Capsule())
                }
            }
            Text("Üdv, \(auth.displayFirstName)")
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Color.black)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(AppTheme.brandYellow)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var navCard: some View {
        VStack(spacing: 2) {
            ForEach(Array(menuItems.enumerated()), id: \.offset) { _, item in
                switch item {
                case .link(let section, let badge):
                    menuRow(section: section, badge: badge) {
                        open(section)
                    }
                case .soon(let title, let systemImage):
                    soonRow(title: title, systemImage: systemImage)
                }
            }
        }
        .padding(8)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func open(_ section: FiokSection) {
        if section == .uzenetek {
            router.showMessages = true
            return
        }
        router.openFiokSection(section)
    }

    private var logoutButton: some View {
        Button {
            Task {
                await auth.logout()
                router.selectBottom(.home, isLoggedIn: false)
            }
        } label: {
            Text("Kijelentkezés")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var fiokHeader: some View {
        HStack {
            Button {
                router.selectBottom(.home, isLoggedIn: true)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                    Text("Vissza")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(AppTheme.accent)
            }
            .buttonStyle(.plain)

            Spacer()

            Text("Fiókom")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(AppTheme.text)

            Spacer()

            Color.clear.frame(width: 72, height: 1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white)
        .overlay(alignment: .bottom) {
            Rectangle().fill(AppTheme.border).frame(height: 1)
        }
    }

    private func menuRow(section: FiokSection, badge: Int?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                iconBadge(section.systemImage)
                Text(section.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if let badge, badge > 0 {
                    Text("\(badge)")
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(AppTheme.accent)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func soonRow(title: String, systemImage: String) -> some View {
        HStack(spacing: 10) {
            iconBadge(systemImage)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AppTheme.tabInactive)
            Spacer()
            Text("Hamarosan")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(AppTheme.tabInactive)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(red: 0.949, green: 0.957, blue: 0.969))
                .clipShape(Capsule())
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
    }

    private func iconBadge(_ icon: String) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(Color(red: 0.949, green: 0.957, blue: 0.969))
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(red: 0.278, green: 0.329, blue: 0.404))
        }
        .frame(width: 32, height: 32)
    }

    private func refreshUnread() async {
        guard let token = auth.token else { return }
        if let list = try? await MessagesAPI.listConversations(token: token) {
            unreadMessages = list.reduce(0) { $0 + $1.unread }
        }
    }
}

private enum FiokMenuItem {
    case link(FiokSection, badge: Int? = nil)
    case soon(title: String, systemImage: String)
}

// MARK: - Section router

struct FiokSectionScreen: View {
    let section: FiokSection
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        Group {
            switch section {
            case .szemelyes:
                PersonalDataScreen()
            case .jelszo:
                PasswordChangeScreen()
            case .notify:
                NotifyPrefsScreen()
            case .keresesiKorzet:
                RadiusSettingsScreen(kind: .search)
            case .ajanlasokKorzet:
                RadiusSettingsScreen(kind: .recommendations)
            case .megjelenes:
                FiokWebPanelScreen(szekcio: "megjelenes")
            case .sajatHirdetesek:
                MyAdsScreen()
            case .kedvencek:
                FavoritesScreen()
            case .mentettKeresesek:
                SavedSearchesScreen()
            case .ertekelesek:
                RatingsScreen()
            case .nyomtatasok:
                FiokInfoScreen(
                    title: "Nyomtatások",
                    lead: "Ártábla és adásvételi szerződés nyomtatása. A funkció hamarosan elérhető.",
                    empty: "Ez a menüpont előkészületben van."
                )
            case .autoImport:
                FiokWebPanelScreen(szekcio: "import")
            case .ertekbecslo:
                FiokWebPanelScreen(szekcio: "ertekbecslo")
            case .partnerProfil:
                FiokWebPanelScreen(szekcio: "partner-profil")
            case .uzenetek:
                MessagesInboxScreen()
            }
        }
        .navigationTitle(section.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    router.openFiokSection(nil)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Vissza")
                    }
                }
            }
        }
        .toolbar(.visible, for: .navigationBar)
    }
}

struct FiokInfoScreen: View {
    let title: String
    let lead: String
    let empty: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                Text(lead)
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)
                Text(empty)
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.tabInactive)
                    .padding(.top, 8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(AppTheme.bg)
    }
}
