import SwiftUI

@main
struct BymyApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var router = AppRouter()
    @AppStorage("bymy.theme") private var theme = "light"

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(router)
                .preferredColorScheme(preferredScheme)
        }
    }

    private var preferredScheme: ColorScheme? {
        switch theme {
        case "dark": return .dark
        case "system": return nil
        default: return .light
        }
    }
}
