import SwiftUI

struct ListingCardView: View {
    let listing: ListingsAPI.Listing

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            AsyncImage(url: listing.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Color(red: 0.93, green: 0.94, blue: 0.96)
                }
            }
            .frame(width: 108, height: 80)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                if let badge = listing.badge, !badge.isEmpty {
                    Text(badge.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(AppTheme.accent)
                }
                Text(listing.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                    .lineLimit(2)
                Text(listing.priceLabel)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(AppTheme.text)
                if !listing.meta.isEmpty {
                    Text(listing.meta)
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(AppTheme.bg)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct ListingsFeedView: View {
    let title: String
    let loader: () async throws -> [ListingsAPI.Listing]

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var listings: [ListingsAPI.Listing] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        Group {
            if loading && listings.isEmpty {
                ProgressView("Betöltés…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorText, listings.isEmpty {
                VStack(spacing: 12) {
                    Text(errorText)
                        .font(.system(size: 14))
                        .foregroundStyle(AppTheme.textSecondary)
                        .multilineTextAlignment(.center)
                    if errorText.localizedCaseInsensitiveContains("Belépés") {
                        Button("Belépés") { router.showLogin = true }
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(AppTheme.accent)
                    }
                    Button("Újra") { Task { await load() } }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        Text(title)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(AppTheme.text)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)

                        ForEach(listings) { item in
                            Button {
                                router.openListing(item.id)
                            } label: {
                                ListingCardView(listing: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .padding(.bottom, 24)
                }
                .refreshable { await load() }
            }
        }
        .background(AppTheme.bg)
        .task(id: auth.token) { await load() }
    }

    private func load() async {
        loading = true
        errorText = nil
        do {
            listings = try await loader()
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }
}

struct CategoryListScreen: View {
    let title: String
    let category: String
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        ListingsFeedView(title: title) {
            try await ListingsAPI.fetchCategory(category, token: auth.token)
        }
    }
}

struct RecommendationsScreen: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        ListingsFeedView(title: "Ajánlások") {
            try await ListingsAPI.fetchHome(limit: 30, token: auth.token)
        }
    }
}

struct SearchScreen: View {
    var body: some View {
        CategorySearchScreen(title: "Autó", category: "auto")
    }
}
