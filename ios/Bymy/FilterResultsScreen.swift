import SwiftUI

/// Keresőfeltételek találati listája — élő Autosweb hirdetések (listings.db)
struct FilterResultsScreen: View {
  @EnvironmentObject private var store: SearchStore
  @EnvironmentObject private var profile: ProfileStore
  @EnvironmentObject private var savedListings: SavedListingsStore
  var onBack: () -> Void

  @State private var openRequest: ListingOpenRequest?
  @State private var listings: [ListingsAPI.HomeListing] = []
  @State private var loading = true
  @State private var errorText: String?

  private var items: [ListingsAPI.HomeListing] {
    listings.filter { ListingsAPI.matches($0, filter: store.filter) }
  }

  var body: some View {
    VStack(spacing: 0) {
      ScreenHeader(
        title: "Találatok",
        subtitle: loading ? "Betöltés…" : "\(items.count) hirdetés",
        onBack: onBack,
        rightLabel: "Frissítés",
        onRight: { Task { await reload() } }
      )

      ScrollView {
        LazyVStack(spacing: 12) {
          Text(store.filter.summary)
            .font(.footnote)
            .foregroundStyle(AppTheme.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)

          if loading && listings.isEmpty {
            ProgressView("Autosweb…")
              .frame(maxWidth: .infinity)
              .padding(.top, 40)
          } else if let errorText, listings.isEmpty {
            Text(errorText)
              .font(.body)
              .foregroundStyle(.red)
              .frame(maxWidth: .infinity)
              .padding(.top, 40)
          } else if items.isEmpty {
            Text("Nincs találat ezekkel a feltételekkel.")
              .font(.body)
              .foregroundStyle(AppTheme.textSecondary)
              .frame(maxWidth: .infinity)
              .padding(.top, 40)
          } else {
            ForEach(items) { ad in
              ListingFeedCard(
                detail: ad.cardDetail,
                onOpen: { openRequest = .remote(id: ad.id) }
              )
            }
          }
        }
        .padding(16)
        .padding(.bottom, 24)
      }
      .refreshable { await reload() }
    }
    .background(AppTheme.bg)
    .task { await reload() }
    .fullScreenCover(item: $openRequest) { req in
      ListingDetailLoader(request: req, onClose: { openRequest = nil })
        .environmentObject(profile)
        .environmentObject(savedListings)
    }
  }

  private func reload() async {
    loading = true
    errorText = nil
    defer { loading = false }
    do {
      listings = try await ListingsAPI.fetchHomeListings()
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }
}
