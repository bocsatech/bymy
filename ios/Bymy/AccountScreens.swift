import SwiftUI

struct AccountScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 14) {
                    ZStack {
                        Circle().fill(AppTheme.avatarBg)
                        Text(auth.avatarLetter)
                            .font(.system(size: 22, weight: .bold))
                    }
                    .frame(width: 56, height: 56)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(auth.displayFirstName)
                            .font(.system(size: 20, weight: .bold))
                        Text(auth.user?.email ?? "")
                            .font(.system(size: 14))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
                .padding(.top, 8)

                accountRow("Üzenetek") { router.showMessages = true }
                accountRow("Beállítások") {}
                accountRow("Saját hirdetések") {}

                Button {
                    Task { await auth.logout() }
                    router.selectBottom(.home, isLoggedIn: false)
                } label: {
                    Text("Kijelentkezés")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.plain)
            }
            .padding(16)
        }
        .background(AppTheme.bg)
        .navigationTitle("Fiók")
    }

    private func accountRow(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.tabInactive)
            }
            .padding(.vertical, 14)
            .overlay(alignment: .bottom) {
                Rectangle().fill(AppTheme.border).frame(height: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct MessagesPlaceholderScreen: View {
    var body: some View {
        MessagesInboxScreen()
    }
}
