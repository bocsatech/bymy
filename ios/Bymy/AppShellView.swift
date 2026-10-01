import SwiftUI

/// Mobil web héj: felső sáv + lapozás + alsó tab.
/// Tartalomoldalak = webes HTML 1:1 (native embed), hirdetés push a stacken.
struct AppShellView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                VStack(spacing: 0) {
                    if router.showsTopChrome {
                        MobileTopBar()
                    }
                    mainContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .padding(.bottom, router.showsBottomChrome ? 72 : 0)

                if router.showsBottomChrome {
                    MobileTabBar()
                }
            }
            .background(AppTheme.bg.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: Binding(
                get: { router.openListingId.map(ListingNavID.init(id:)) },
                set: { router.openListingId = $0?.id }
            )) { item in
                ListingWebDetailScreen(listingId: item.id)
                    .toolbar(.visible, for: .navigationBar)
            }
            .navigationDestination(item: $router.openChat) { conv in
                ChatScreen(conversation: conv)
                    .toolbar(.visible, for: .navigationBar)
            }
            .navigationDestination(item: $router.openFiokSection) { section in
                FiokSectionScreen(section: section)
                    .environmentObject(auth)
            }
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        switch router.bottomTab {
        case .home:
            TopPagesPager()
        case .feed:
            NativeWebPage(page: .ajanlasok)
        case .search:
            NativeWebPage(page: .kereses)
        case .post:
            if auth.isLoggedIn {
                NativeWebPage(page: .post)
            } else {
                VStack(spacing: 14) {
                    Text("A feladáshoz be kell jelentkezned.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(AppTheme.textSecondary)
                    Button("Belépés") { router.showLogin = true }
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(AppTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        case .account:
            if auth.isLoggedIn {
                AccountScreen()
            } else {
                VStack(spacing: 14) {
                    Text("A fiókhoz be kell jelentkezned.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(AppTheme.textSecondary)
                    Button("Belépés") { router.showLogin = true }
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(AppTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

private struct ListingNavID: Identifiable, Hashable {
    let id: String
}

struct TopPagesPager: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        // Web: nincs swipe a felső menü oldalai között — csak explicit navigáció.
        pageView(router.topPage)
            .id(router.topPage.id)
            .animation(.easeInOut(duration: 0.2), value: router.topPage)
    }

    @ViewBuilder
    private func pageView(_ page: TopPage) -> some View {
        switch page {
        case .hub:
            NativeWebPage(page: .hub)
        case .auto:
            NativeWebPage(page: .auto)
        case .teherauto:
            NativeWebPage(page: .teherauto)
        case .ingatlan:
            NativeWebPage(page: .ingatlan)
        case .ajanlasok:
            NativeWebPage(page: .ajanlasok)
        }
    }
}
