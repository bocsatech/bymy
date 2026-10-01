import SwiftUI

@main
struct BymyApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(router)
                .preferredColorScheme(.light)
        }
    }
}
