import SwiftUI

/// Web hub kezdőlap: promo + vízszintes csempe-sínek (jobbra/balra csúsztatható).
struct HubHomeScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var featured: [ListingsAPI.Listing] = []
    @State private var autos: [ListingsAPI.Listing] = []
    @State private var trucks: [ListingsAPI.Listing] = []
    @State private var homes: [ListingsAPI.Listing] = []
    @State private var loading = true
    @State private var errorText: String?

    private let pageBg = Color(red: 0.973, green: 0.976, blue: 0.980)
    private let gutter: CGFloat = 16
    private let tileWidth: CGFloat = 200

    private let autoCategories: [(id: String, label: String)] = [
        ("uj", "Új"),
        ("benzin", "Benzin"),
        ("diesel", "Dízel"),
        ("elektromos", "Elektromos"),
        ("hybrid", "Hybrid"),
        ("leasing", "Leasing"),
        ("berelheto", "Bérelhető"),
        ("ot", "OT"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                promoRail

                railHeader(title: "Autó kategóriák") {
                    router.selectTop(.auto)
                }
                categoryRail

                if let errorText {
                    Text(errorText)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                        .padding(.horizontal, gutter)
                }

                railHeader(title: "Kiemelt hirdetések") {
                    router.selectTop(.auto)
                }
                listingRail(items: featured, empty: loading ? "Betöltés…" : "Még nincs kiemelt hirdetés")

                railHeader(title: "Autók") {
                    router.selectTop(.auto)
                }
                listingRail(items: autos, empty: loading ? "Betöltés…" : "Nincs autó hirdetés")

                railHeader(title: "Teherautók") {
                    router.selectTop(.teherauto)
                }
                listingRail(items: trucks, empty: loading ? "Betöltés…" : "Nincs teherautó hirdetés")

                railHeader(title: "Eladó ingatlanok") {
                    router.selectTop(.ingatlan)
                }
                listingRail(items: homes, empty: loading ? "Betöltés…" : "Nincs ingatlan hirdetés")

                Color.clear.frame(height: 12)
            }
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background(pageBg.ignoresSafeArea())
        .task(id: auth.token) { await load() }
        .refreshable { await load() }
    }

    // MARK: - Promo (Autó / Ingatlan) — vízszintes lapozás

    private var promoRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                promoCard(
                    kicker: "Autó és teherautó",
                    titleTop: "Autók és",
                    titleBottom: "teherautók",
                    cta: "Járművek keresése →",
                    imageURL: URL(string: "https://bymy.hu/images/hub-auto-photo.jpg"),
                    tint: Color(red: 0.12, green: 0.35, blue: 0.72)
                ) {
                    router.selectTop(.auto)
                }

                promoCard(
                    kicker: "Ingatlan",
                    titleTop: "Házak és",
                    titleBottom: "lakások",
                    cta: "Ingatlan keresése →",
                    imageURL: URL(string: "https://bymy.hu/images/hub-ingatlan-photo.jpg"),
                    tint: Color(red: 0.12, green: 0.45, blue: 0.32)
                ) {
                    router.selectTop(.ingatlan)
                }
            }
            .padding(.horizontal, gutter)
        }
    }

    private func promoCard(
        kicker: String,
        titleTop: String,
        titleBottom: String,
        cta: String,
        imageURL: URL?,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            ZStack(alignment: .bottomLeading) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        tint.opacity(0.35)
                    }
                }
                .frame(width: 300, height: 170)
                .clipped()

                LinearGradient(
                    colors: [.black.opacity(0.75), .black.opacity(0.15), .clear],
                    startPoint: .bottom,
                    endPoint: .top
                )

                VStack(alignment: .leading, spacing: 4) {
                    Text(kicker.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white.opacity(0.9))
                    Text(titleTop)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(AppTheme.brandYellow)
                    Text(titleBottom)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                    Text(cta)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.top, 4)
                }
                .padding(14)
            }
            .frame(width: 300, height: 170)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Category rail

    private var categoryRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(autoCategories, id: \.id) { cat in
                    Button {
                        router.selectTop(.auto)
                    } label: {
                        VStack(spacing: 8) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color.white)
                                Image(systemName: categoryIcon(cat.id))
                                    .font(.system(size: 22, weight: .semibold))
                                    .foregroundStyle(AppTheme.accent)
                            }
                            .frame(width: 110, height: 72)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(AppTheme.border, lineWidth: 1)
                            )

                            Text(cat.label)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AppTheme.text)
                                .lineLimit(1)
                        }
                        .frame(width: 110)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, gutter)
        }
    }

    private func categoryIcon(_ id: String) -> String {
        switch id {
        case "elektromos": return "bolt.car.fill"
        case "hybrid": return "leaf.fill"
        case "diesel", "benzin": return "fuelpump.fill"
        case "leasing": return "doc.text.fill"
        case "berelheto": return "key.fill"
        case "ot": return "building.columns.fill"
        case "uj": return "sparkles"
        default: return "car.fill"
        }
    }

    // MARK: - Listing rails

    private func railHeader(title: String, allAction: @escaping () -> Void) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(AppTheme.text)
            Spacer()
            Button("Összes", action: allAction)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
        }
        .padding(.horizontal, gutter)
    }

    private func listingRail(items: [ListingsAPI.Listing], empty: String) -> some View {
        Group {
            if items.isEmpty {
                Text(empty)
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.horizontal, gutter)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 10) {
                        ForEach(items) { item in
                            Button {
                                router.openListing(item.id)
                            } label: {
                                ListingTileCard(listing: item, width: tileWidth)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, gutter)
                }
            }
        }
    }

    private func load() async {
        guard auth.token != nil else {
            errorText = "Belépés szükséges a hirdetésekhez."
            loading = false
            return
        }
        loading = true
        errorText = nil
        defer { loading = false }
        do {
            async let a = ListingsAPI.fetchCategory("auto", limit: 24, token: auth.token)
            async let t = ListingsAPI.fetchCategory("teherauto", limit: 16, token: auth.token)
            async let i = ListingsAPI.fetchCategory("ingatlan", limit: 16, token: auth.token)
            let (autoList, truckList, homeList) = try await (a, t, i)
            autos = autoList
            trucks = truckList
            homes = homeList
            // Kiemelt: első autók (a szerver promo mezője később pontosítható)
            featured = Array(autoList.prefix(12))
        } catch {
            errorText = error.localizedDescription
        }
    }
}

/// Web `hf-card--listing` csempe.
struct ListingTileCard: View {
    let listing: ListingsAPI.Listing
    var width: CGFloat = 200

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: listing.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Color(red: 0.91, green: 0.92, blue: 0.94)
                }
            }
            .frame(width: width, height: width * 10 / 16)
            .clipped()

            VStack(alignment: .leading, spacing: 4) {
                Text(listing.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: 34, alignment: .topLeading)

                Text(listing.priceLabel)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(AppTheme.text)

                if !listing.meta.isEmpty {
                    Text(listing.meta)
                        .font(.system(size: 11))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, 8)
            .padding(.bottom, 10)
        }
        .frame(width: width)
        .background(Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .stroke(Color(red: 0.83, green: 0.83, blue: 0.83), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
}
