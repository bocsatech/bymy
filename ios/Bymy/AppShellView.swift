import SwiftUI

/// Mobil web héj: felső sáv + iOS lapozás + alsó tab.
struct AppShellView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    var body: some View {
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
    }

    @ViewBuilder
    private var mainContent: some View {
        switch router.bottomTab {
        case .home, .feed:
            TopPagesPager()
        case .search:
            SearchScreen()
        case .post:
            PostAdPlaceholderScreen()
        case .account:
            AccountScreen()
        }
    }
}

struct TopPagesPager: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        TabView(selection: Binding(
            get: { router.topPage.index },
            set: { router.selectTop(TopPage.from(index: $0)) }
        )) {
            ForEach(Array(TopPage.allCases.enumerated()), id: \.element.id) { index, page in
                pageView(page)
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .animation(.easeInOut(duration: 0.2), value: router.topPage)
    }

    @ViewBuilder
    private func pageView(_ page: TopPage) -> some View {
        switch page {
        case .hub:
            HubHomeScreen()
        case .auto:
            CategoryListScreen(title: "Autó", category: "auto")
        case .teherauto:
            CategoryListScreen(title: "Teherautó", category: "teherauto")
        case .ingatlan:
            CategoryListScreen(title: "Ingatlan", category: "ingatlan")
        case .ajanlasok:
            RecommendationsScreen()
        }
    }
}
