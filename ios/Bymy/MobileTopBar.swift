import SwiftUI

/// Mobil web `.mw-app-top` + `.mw-app-pages`
struct MobileTopBar: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter
    /// Web: `hub-theme-toggle` / Színmód (inverz)
    @AppStorage("bymy.theme") private var theme = "light"

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button {
                    router.selectTop(.hub)
                } label: {
                    Image("BymyLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Bymy")

                Spacer(minLength: 8)

                HStack(spacing: 8) {
                    Button {
                        router.selectBottom(.post, isLoggedIn: auth.isLoggedIn)
                    } label: {
                        Text("+")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(.black)
                            .frame(width: 34, height: 34)
                            .background(AppTheme.brandYellow)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Új hirdetés")

                    Button {
                        theme = (theme == "dark") ? "light" : "dark"
                    } label: {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.white,
                                        Color(red: 0.294, green: 0.333, blue: 0.388)
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .overlay(
                                Circle()
                                    .stroke(Color(red: 0.784, green: 0.784, blue: 0.784), lineWidth: 1)
                            )
                            .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(theme == "dark" ? "Váltás világos módra" : "Váltás sötét módra")

                    if auth.isLoggedIn {
                        Button {
                            router.showMessages = true
                        } label: {
                            Image(systemName: "bubble.left.and.bubble.right")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                                .frame(width: 34, height: 34)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Üzenetek")

                        Button {
                            router.selectBottom(.account, isLoggedIn: true)
                        } label: {
                            ProfileAvatarView(
                                letter: auth.avatarLetter,
                                dataURL: auth.user?.profile.avatarDataUrl,
                                size: 32
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Fiók")
                    } else {
                        Button {
                            router.showLogin = true
                        } label: {
                            Image(systemName: "person.crop.circle")
                                .font(.system(size: 22, weight: .regular))
                                .foregroundStyle(AppTheme.textSecondary)
                                .frame(width: 34, height: 34)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Belépés")
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
            .padding(.bottom, 8)

            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        // TEMP: Ingatlan menü elrejtve — vissza: szűrés törlése
                        ForEach(TopPage.allCases.filter { $0 != .ingatlan }) { page in
                            Button {
                                router.selectTop(page)
                            } label: {
                                Text(page.title)
                                    .font(.system(size: 14, weight: router.topPage == page ? .bold : .semibold))
                                    .foregroundStyle(router.topPage == page ? AppTheme.accent : AppTheme.textSecondary)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(
                                        Capsule(style: .continuous)
                                            .fill(router.topPage == page ? AppTheme.accent.opacity(0.1) : Color.clear)
                                    )
                            }
                            .buttonStyle(.plain)
                            .id(page.id)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.bottom, 8)
                }
                .onChange(of: router.topPage) { _, page in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        proxy.scrollTo(page.id, anchor: .center)
                    }
                }
            }
        }
        .background(AppTheme.bg)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(AppTheme.border)
                .frame(height: 1)
        }
    }
}
