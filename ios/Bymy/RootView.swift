import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        Group {
            if auth.isRestoring {
                ProgressView("Betöltés…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppTheme.bg)
            } else if !auth.isLoggedIn {
                LoginScreen(mode: router.showRegister ? .register : .login, isGate: true)
            } else {
                AppShellView()
            }
        }
        .sheet(isPresented: $router.showLogin) {
            NavigationStack {
                LoginScreen(mode: .login)
            }
        }
        .sheet(isPresented: $router.showRegister) {
            NavigationStack {
                LoginScreen(mode: .register)
            }
        }
        .sheet(isPresented: $router.showMessages) {
            NavigationStack {
                MessagesInboxScreen()
            }
        }
    }
}
