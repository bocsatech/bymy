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
        .sheet(item: Binding(
            get: { router.openListingId.map(ListingSheetID.init(id:)) },
            set: { router.openListingId = $0?.id }
        )) { item in
            NavigationStack {
                ListingDetailScreen(listingId: item.id) { detail in
                    router.openListingId = nil
                    Task { await openMessage(for: detail) }
                }
            }
        }
        .sheet(item: $router.openChat) { conv in
            NavigationStack {
                ChatScreen(conversation: conv)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Kész") { router.openChat = nil }
                        }
                    }
            }
        }
    }

    private func openMessage(for detail: ListingsAPI.Detail) async {
        guard let token = auth.token else {
            router.showLogin = true
            return
        }
        do {
            let conv = try await MessagesAPI.startConversation(
                token: token,
                listingId: detail.id,
                title: detail.title,
                priceLabel: detail.priceLabel,
                meta: detail.meta,
                sellerId: detail.ownerUserId
            )
            router.openChat = conv
        } catch {
            // Fallback draft chat — send will create conversation
            router.openChat = MessagesAPI.Conversation(
                id: 0,
                listing: .init(
                    id: detail.id,
                    title: detail.title,
                    priceLabel: detail.priceLabel,
                    code: "BYMY-\(detail.id)",
                    meta: detail.meta
                ),
                peer: .init(id: detail.ownerUserId ?? 0, email: "", displayName: detail.sellerName),
                role: "buyer",
                unread: 0,
                updatedAt: "",
                lastMessage: nil
            )
        }
    }
}

private struct ListingSheetID: Identifiable {
    let id: String
}
