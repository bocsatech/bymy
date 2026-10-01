import SwiftUI

/// Mobil web `.mw-app-top` + `.mw-app-pages`
struct MobileTopBar: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

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
                            ZStack {
                                Circle()
                                    .fill(AppTheme.avatarBg)
                                Text(auth.avatarLetter)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(AppTheme.text)
                            }
                            .frame(width: 32, height: 32)
                            .overlay(Circle().stroke(AppTheme.border, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Fiók")
                    } else {
                        Button {
                            router.showLogin = true
                        } label: {
                            Image(systemName: "person")
                                .font(.system(size: 16, weight: .semibold))
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
                        ForEach(TopPage.allCases) { page in
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
