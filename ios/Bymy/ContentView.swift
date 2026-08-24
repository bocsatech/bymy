import SwiftUI

/// Vendég mód: csak Belépés vagy Regisztráció — nincs lapozás.
enum AuthPage: String {
    case login
    case register
}

struct ContentView: View {
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var pageLayout: PageLayoutStore
    @EnvironmentObject private var searchStore: SearchStore
    @EnvironmentObject private var savedListings: SavedListingsStore
    @ObservedObject private var biometricLock = BiometricLock.shared
    @State private var tab: BottomTab = .fooldal
    @State private var showSettings = false
    @State private var showAccountMenu = false

    var body: some View {
        Group {
            if profile.isRestoring {
                ProgressView("Fiók…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppTheme.bg.ignoresSafeArea())
            } else if profile.isLoggedIn {
                ZStack {
                    mainTabs
                    if biometricLock.needsLock(isLoggedIn: true) {
                        BiometricLockScreen(
                            lock: biometricLock,
                            displayName: profile.profile.displayName
                        )
                        .environmentObject(profile)
                        .transition(.opacity)
                        .zIndex(10)
                    }
                }
            } else {
                guestAuthOnly
            }
        }
        .fullScreenCover(isPresented: $showSettings) {
            SettingsScreen(onClose: { showSettings = false })
                .environmentObject(profile)
                .environmentObject(pageLayout)
        }
        .fullScreenCover(isPresented: $showAccountMenu) {
            AccountMenuScreen(
                onClose: { showAccountMenu = false },
                onOpenSearch: { tab = .kereses }
            )
            .environmentObject(profile)
            .environmentObject(searchStore)
            .environmentObject(pageLayout)
            .environmentObject(savedListings)
        }
    }

    /// Belépés nélkül: logo, utána belépő / regisztráció kártya.
    private var guestAuthOnly: some View {
        AuthLandingScreen()
            .environmentObject(profile)
    }

    private var mainTabs: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                if tab != .fooldal {
                    SiteAuthBar(
                        selectedPage: nil,
                        onLogin: {},
                        onRegister: {},
                        onAccount: { showAccountMenu = true }
                    )
                }

                TabView(selection: $tab) {
                    SearchScreen(
                        searchRoot: .homeLanding,
                        onOpenSettings: { showSettings = true },
                        onOpenAccount: { showAccountMenu = true }
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .contentMargins(.bottom, BottomTab.islandClearance, for: .scrollContent)
                    .tag(BottomTab.fooldal)

                    SearchScreen(
                        searchRoot: .searchMenu,
                        onOpenSettings: { showSettings = true }
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .contentMargins(.bottom, BottomTab.islandClearance, for: .scrollContent)
                    .tag(BottomTab.kereses)

                    PostAdScreen()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .contentMargins(.bottom, BottomTab.islandClearance, for: .scrollContent)
                        .tag(BottomTab.hirdetesFeladas)

                    MessagesScreen()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .contentMargins(.bottom, BottomTab.islandClearance, for: .scrollContent)
                        .tag(BottomTab.uzenetek)

                    FeedScreen()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .contentMargins(.bottom, BottomTab.islandClearance, for: .scrollContent)
                        .tag(BottomTab.hirfolyam)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            .ignoresSafeArea(edges: tab == .fooldal ? .top : [])
            /// Főoldalon fehér a státuszsáv mögött is (ne legyen szürke sáv a logo felett).
            .background((tab == .fooldal ? Color.white : AppTheme.bg).ignoresSafeArea())

            PageIconBar(selection: $tab)
        }
        .task(id: profile.token) {
            guard profile.isLoggedIn, let token = profile.token else {
                PushNotificationService.shared.stopPolling()
                return
            }
            let store = profile
            await PushNotificationService.shared.requestPermissionAndRegister(authToken: token)
            PushNotificationService.shared.startPolling { store.token }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(SearchStore())
        .environmentObject(ProfileStore())
        .environmentObject(PageLayoutStore())
        .environmentObject(SavedListingsStore())
}
