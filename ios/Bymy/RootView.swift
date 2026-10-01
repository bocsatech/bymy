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
            } else {
                // Web: vendég is böngészhet; belépés csak védett műveleteknél (sheet).
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
                Group {
                    if auth.isLoggedIn {
                        FiokWebPanelScreen(szekcio: "uzenetek")
                    } else {
                        VStack(spacing: 12) {
                            Text("Az üzenetekhez be kell jelentkezned.")
                                .multilineTextAlignment(.center)
                            Button("Belépés") {
                                router.showMessages = false
                                router.showLogin = true
                            }
                            .fontWeight(.semibold)
                            .foregroundStyle(AppTheme.accent)
                        }
                        .padding()
                    }
                }
                .navigationTitle("Üzenetek")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Kész") { router.showMessages = false }
                    }
                }
                .environmentObject(auth)
            }
        }
    }
}
