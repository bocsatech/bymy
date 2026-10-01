import SwiftUI

/// Mobil web `.mw-app-tabbar`
struct MobileTabBar: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            tab(.home, systemImage: "house")
            tab(.search, systemImage: "magnifyingglass")
            fab
            tab(.feed, systemImage: "heart")
            tab(.account, systemImage: "person")
        }
        .padding(.horizontal, 6)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background(
            AppTheme.bg
                .shadow(color: .black.opacity(0.08), radius: 12, y: -2)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func tab(_ tab: BottomTab, systemImage: String) -> some View {
        let active = isActive(tab)
        return Button {
            router.selectBottom(tab, isLoggedIn: auth.isLoggedIn)
        } label: {
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .frame(height: 24)
                Text(tab.title)
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(active ? AppTheme.accent : AppTheme.tabInactive)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    private var fab: some View {
        Button {
            router.selectBottom(.post, isLoggedIn: auth.isLoggedIn)
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(AppTheme.brandYellow)
                        .frame(width: 54, height: 54)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Color.white, lineWidth: 3)
                        )
                        .shadow(color: AppTheme.brandYellow.opacity(0.45), radius: 10, y: 4)
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.black)
                }
                .offset(y: -10)

                Text("Feladás")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(AppTheme.text)
            }
            .frame(width: 64)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Hirdetés feladás")
    }

    private func isActive(_ tab: BottomTab) -> Bool {
        switch tab {
        case .home:
            return router.bottomTab == .home || (router.bottomTab == .feed && router.topPage == .hub)
        case .search:
            return router.bottomTab == .search
        case .post:
            return router.bottomTab == .post
        case .feed:
            return router.bottomTab == .feed || router.topPage == .ajanlasok
        case .account:
            return router.bottomTab == .account
        }
    }
}
