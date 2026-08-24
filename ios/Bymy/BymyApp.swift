import SwiftUI

@main
struct BymyApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var searchStore = SearchStore()
    @StateObject private var profileStore = ProfileStore()
    @StateObject private var pageLayoutStore = PageLayoutStore()
    @StateObject private var savedListingsStore = SavedListingsStore()

    init() {
        AutoswebBaseURL.applyStored()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(searchStore)
                .environmentObject(profileStore)
                .environmentObject(pageLayoutStore)
                .environmentObject(savedListingsStore)
                .onReceive(NotificationCenter.default.publisher(for: .bymyRemoteProfileApplied)) { note in
                    pageLayoutStore.applyFromRemote(note.object as? AuthAPI.PageLayoutDTO)
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active:
                        AutoswebBaseURL.applyStored()
                    case .background:
                        BiometricLock.shared.lockIfNeeded()
                    default:
                        break
                    }
                }
        }
    }
}
