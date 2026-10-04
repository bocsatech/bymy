import SwiftUI

/// Mobil web héj: felső sáv + alsó tab + natív tartalom (API Bearer).
/// WebView csak Fiók komplex paneleknél — előtte `autosweb_session` cookie.
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
                ListingDetailScreen(listingId: item.id) { detail in
                    Task { await router.openMessage(for: detail, token: auth.token) }
                }
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
            RecommendationsScreen()
        case .search:
            // Web Keresés tab → kereses.html; natívan a kategória kereső (Autó)
            CategorySearchScreen(title: "Autó", category: "auto")
        case .post:
            PostAdScreen()
        case .account:
            AccountScreen()
        }
    }
}

private struct ListingNavID: Identifiable, Hashable {
    let id: String
}

struct TopPagesPager: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        pageView(router.topPage)
            .id(router.topPage.id)
            .animation(.easeInOut(duration: 0.2), value: router.topPage)
    }

    @ViewBuilder
    private func pageView(_ page: TopPage) -> some View {
        switch page {
        case .hub:
            HubHomeScreen()
        case .auto:
            CategorySearchScreen(title: "Autó", category: "auto")
        case .teherauto:
            CategorySearchScreen(title: "Teherautó", category: "teherauto")
        case .ingatlan:
            CategorySearchScreen(title: "Ingatlan", category: "ingatlan")
        case .ertekbecsles:
            NativeWebPage(page: .ertekbecsles)
        case .ajanlasok:
            RecommendationsScreen()
        }
    }
}
