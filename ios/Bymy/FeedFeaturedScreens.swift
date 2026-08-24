import SwiftUI
import UIKit

struct FeedScreen: View {
    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(title: "Hírfolyam", subtitle: "Hírek · YouTube")
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(SampleContent.feed) { item in
                        FeedCard(item: item)
                    }
                    Text("Demo tartalom — később Autosweb + YouTube.")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.textTertiary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 8)
                }
                .padding(16)
            }
        }
        .background(AppTheme.bg)
    }
}

private struct FeedCard: View {
    let item: FeedItem

    var body: some View {
        Button {
            if let url = item.url {
                UIApplication.shared.open(url)
            }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(item.kind == .youtube ? "YouTube" : item.source)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(item.kind == .youtube ? Color.red.opacity(0.12) : AppTheme.accent.opacity(0.12))
                    .foregroundStyle(item.kind == .youtube ? Color.red.opacity(0.85) : AppTheme.accent)
                    .clipShape(Capsule())

                Text(item.title)
                    .font(.headline)
                    .foregroundStyle(AppTheme.text)
                    .multilineTextAlignment(.leading)
                Text(item.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.textSecondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(AppTheme.bgElevated)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(AppTheme.border, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }
}

/// Ugyanazok a hirdetések, mint a webes főoldalon (`GET /api/listings`).
struct FeaturedScreen: View {
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var savedListings: SavedListingsStore
    @State private var openRequest: ListingOpenRequest?
    @State private var listings: [ListingsAPI.HomeListing] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(
                title: "Kiemeltek",
                subtitle: subtitleText,
                rightLabel: "Frissítés",
                onRight: { Task { await reload() } }
            )

            if loading && listings.isEmpty {
                ProgressView("Betöltés…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorText, listings.isEmpty {
                VStack(spacing: 12) {
                    Text(errorText)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                    Button("Újra") { Task { await reload() } }
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if listings.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "car.side")
                        .font(.system(size: 36))
                        .foregroundStyle(AppTheme.textTertiary)
                    Text("Még nincs hirdetés a webes főoldalon.")
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.textSecondary)
                        .multilineTextAlignment(.center)
                    Text("Importáld / mentsd az Autosweben, majd Frissítés.")
                        .font(.caption)
                        .foregroundStyle(AppTheme.textTertiary)
                        .multilineTextAlignment(.center)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(listings) { ad in
                            ListingFeedCard(
                                detail: ad.cardDetail,
                                onOpen: { openRequest = .remote(id: ad.id) }
                            )
                        }
                        Text("Ugyanaz a lista, mint a webes főoldalon. Később külön jelöljük a tényleges kiemelést.")
                            .font(.footnote)
                            .foregroundStyle(AppTheme.textTertiary)
                            .padding(.top, 8)
                    }
                    .padding(16)
                }
                .refreshable { await reload() }
            }
        }
        .background(AppTheme.bg)
        .task { await reload() }
        .fullScreenCover(item: $openRequest) { req in
            ListingDetailLoader(request: req, onClose: { openRequest = nil })
                .environmentObject(profile)
                .environmentObject(savedListings)
        }
    }

    private var subtitleText: String {
        if loading && listings.isEmpty { return "Autosweb…" }
        if errorText != nil, listings.isEmpty { return "Hiba" }
        if listings.isEmpty { return "Nincs hirdetés" }
        return "\(listings.count) hirdetés · Autosweb"
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
