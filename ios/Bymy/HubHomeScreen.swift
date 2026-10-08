import SwiftUI
import UIKit

/// Web `index.html` hub-feed — szekciók és sínek 1:1.
struct HubHomeScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var featured: [ListingsAPI.Listing] = []
    @State private var latestListings: [ListingsAPI.Listing] = []
    @State private var nearbyAutos: [ListingsAPI.Listing] = []
    @State private var nearbyFlats: [ListingsAPI.Listing] = []
    @State private var nearbyHouses: [ListingsAPI.Listing] = []
    @State private var loading = true
    @State private var errorText: String?

    private let pageBg = Color(red: 0.973, green: 0.976, blue: 0.980)
    private let gutter: CGFloat = 16

    private let autoCategoryDefs: [(id: String, label: String)] = [
        ("uj", "Új"),
        ("benzin", "Benzin"),
        ("diesel", "Dízel"),
        ("elektromos", "Elektromos"),
        ("hybrid", "Hybrid"),
        ("leasing", "Leasing"),
        ("berelheto", "Bérelhető"),
        ("ot", "OT"),
    ]
    @State private var autoCategories: [(id: String, label: String)] = [
        ("uj", "Új"),
        ("benzin", "Benzin"),
        ("diesel", "Dízel"),
        ("elektromos", "Elektromos"),
        ("hybrid", "Hybrid"),
        ("leasing", "Leasing"),
        ("berelheto", "Bérelhető"),
        ("ot", "OT"),
    ]

    private let ajanlasAuto: [(id: String, label: String, image: String)] = [
        ("atiras_ugyintezes", "Átírás ügyintézés", "ajanlas-atiras"),
        ("eredetvizsga", "Eredetvizsga", "ajanlas-eredet"),
        ("muszakivizsga", "Műszaki vizsga", "ajanlas-muszaki"),
        ("autoatvizsgalas", "Autoátvizsgálás", "ajanlas-atvizsgalas"),
        ("autoszerelo", "Autószerelő", "ajanlas-szerelo"),
        ("gumiszerelo", "Gumiszerelő", "ajanlas-gumi"),
        ("lakatos", "Lakatos", "ajanlas-lakatos"),
        ("klimaszerelo", "Klímaszerelő", "ajanlas-klima"),
        ("autokozmetika", "Autókozmetika", "ajanlas-kozmetika"),
        ("autovillamossag", "Autóvillamosság", "ajanlas-villamos"),
    ]

    private let ajanlasImmo: [(id: String, label: String, image: String)] = [
        ("ertekesites", "Értékesítés", "ajanlas-ertekesites"),
        ("ertekbecsles", "Értékbecslés", "ajanlas-ertekbecsles"),
        ("energetikai_tanusitvany", "Energetikai tanúsítvány", "ajanlas-energetikai"),
        ("szerkezeti_vizsgalat", "Szerkezeti vizsgálat", "ajanlas-szerkezeti"),
        ("hitelugyintezes", "Hitelügyintézés", "ajanlas-hitel"),
        ("foldmeres", "Földmérés", "ajanlas-foldmeres"),
        ("tervezok", "Tervezők", "ajanlas-tervezok"),
        ("lakberendezo", "Lakberendező", "ajanlas-lakberendezo"),
        ("kertepito", "Kertépítő", "ajanlas-kertepito"),
        ("ugyvedek", "Ügyvédek", "ajanlas-ugyvedek"),
        ("kozjegyzok", "Közjegyzők", "ajanlas-kozjegyzok"),
    ]

    private var categoryTileWidth: CGFloat {
        let screen = UIScreen.main.bounds.width
        return max(140, (screen - (2 * gutter) - 10) / 2)
    }

    private var listingTileWidth: CGFloat {
        categoryTileWidth
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 44) {
                promoRail

                // Autó kategóriák
                railHeader(title: "Autó kategóriák") { router.selectTop(.auto) }
                categoryRail(items: autoCategories)

                // Web `hf-mid-banner` — autó/teher promo a kategóriák alatt
                Button { router.selectTop(.auto) } label: {
                    AsyncImage(url: URL(string: "https://bymy.hu/images/hub-banner-auto-teher.png")) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                        default:
                            Color(red: 0.96, green: 0.96, blue: 0.95)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .aspectRatio(908 / 364, contentMode: .fit)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, gutter)

                if let errorText {
                    Text(errorText)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                        .padding(.horizontal, gutter)
                }

                // Kiemelt — weben csak ha van
                if !featured.isEmpty {
                    railHeader(title: "Kiemelt hirdetések") { router.selectTop(.auto) }
                    listingRail(items: featured)
                }

                // Legújabb hirdetések — feladás ideje (created_at)
                if !latestListings.isEmpty {
                    railHeader(title: "Legújabb hirdetések") { router.selectTop(.auto) }
                    listingRail(items: latestListings)
                }

                // Autók a közelben
                railHeader(title: "Autók a közelben") { router.selectTop(.auto) }
                listingRail(
                    items: nearbyAutos,
                    empty: loading ? "Betöltés…" : "Nincs autó a közelben."
                )

                // Eladó lakások a közelben
                railHeader(title: "Eladó lakások a közelben") { router.selectTop(.ingatlan) }
                listingRail(
                    items: nearbyFlats,
                    empty: loading ? "Betöltés…" : "Nincs lakás a közelben."
                )

                // Eladó házak a közelben
                railHeader(title: "Eladó házak a közelben") { router.selectTop(.ingatlan) }
                listingRail(
                    items: nearbyHouses,
                    empty: loading ? "Betöltés…" : "Nincs ház a közelben."
                )

                // Ajánlások ingatlan
                railHeader(title: "Ajánlások ingatlan") { router.selectTop(.ajanlasok) }
                ajanlasRail(items: ajanlasImmo)

                // Szolgáltatások
                railHeader(title: "Szolgáltatások") { router.selectTop(.ajanlasok) }
                Text("A szolgáltatók az Ajánlások oldalon érthetők el.")
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.horizontal, gutter)

                // Ajánlások autó
                railHeader(title: "Ajánlások autó") { router.selectTop(.ajanlasok) }
                ajanlasRail(items: ajanlasAuto)

                Color.clear.frame(height: 12)
            }
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background(pageBg.ignoresSafeArea())
        .task(id: auth.token) { await load() }
        .refreshable { await load() }
    }

    // MARK: - Promo

    private var promoRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                promoCard(
                    kicker: "Autó és teherautó",
                    titleTop: "Autók és",
                    titleBottom: "teherautók",
                    text: "Vétel és bérlés egy átlátható felületen.",
                    cta: "Járművek keresése →",
                    imageURL: URL(string: "https://bymy.hu/images/hub-auto-photo.jpg?v=hubHeroDemo1"),
                    tint: Color(red: 0.12, green: 0.35, blue: 0.72)
                ) { router.selectTop(.auto) }

                promoCard(
                    kicker: "Ingatlan",
                    titleTop: "Házak és",
                    titleBottom: "lakások",
                    text: "Vétel és bérlés egy átlátható felületen.",
                    cta: "Ingatlan keresése →",
                    imageURL: URL(string: "https://bymy.hu/images/hub-ingatlan-photo.jpg?v=hubHeroDemo1"),
                    tint: Color(red: 0.12, green: 0.45, blue: 0.32)
                ) { router.selectTop(.ingatlan) }
            }
            .padding(.horizontal, gutter)
        }
    }

    private func promoCard(
        kicker: String,
        titleTop: String,
        titleBottom: String,
        text: String,
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

                VStack(alignment: .leading, spacing: 3) {
                    Text(kicker.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white.opacity(0.9))
                    Text(titleTop)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(AppTheme.brandYellow)
                    Text(titleBottom)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                    Text(text)
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(2)
                    Text(cta)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.top, 2)
                }
                .padding(14)
            }
            .frame(width: 300, height: 170)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(Color(red: 0.83, green: 0.83, blue: 0.83), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Rails

    private func categoryRail(items: [(id: String, label: String)]) -> some View {
        let w = categoryTileWidth
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(items, id: \.id) { cat in
                    Button { router.selectTop(.auto) } label: {
                        AutoCategoryTile(
                            label: cat.label,
                            imageURL: URL(string: "https://bymy.hu/images/categories/list/\(cat.id).jpg?v=menuRails1"),
                            width: w
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, gutter)
        }
    }

    private func ajanlasRail(items: [(id: String, label: String, image: String)]) -> some View {
        let w = categoryTileWidth
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(items, id: \.id) { cat in
                    Button { router.selectTop(.ajanlasok) } label: {
                        AutoCategoryTile(
                            label: cat.label,
                            imageURL: URL(string: "https://bymy.hu/images/ajanlas/list/\(cat.image).jpg?v=menuRails1"),
                            width: w
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, gutter)
        }
    }

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

    private func listingRail(items: [ListingsAPI.Listing], empty: String? = nil) -> some View {
        Group {
            if items.isEmpty {
                if let empty {
                    Text(empty)
                        .font(.system(size: 13))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.horizontal, gutter)
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 10) {
                        ForEach(items) { item in
                            Button { router.openListing(item.id) } label: {
                                ListingTileCard(listing: item, width: listingTileWidth)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, gutter)
                }
            }
        }
    }

    /// Web `home-category-bar.js` matchesCategory — üzemanyag / új.
    private func matchesHomeCategory(_ item: ListingsAPI.Listing, _ categoryId: String) -> Bool {
        let fuel = (item.fuel ?? "").lowercased()
            .folding(options: .diacriticInsensitive, locale: .current)
        let allapot = (item.allapot ?? "").lowercased()
        let year = item.year
        let km = item.kmNum
        let currentYear = Calendar.current.component(.year, from: Date())
        let isHybrid = fuel.contains("hibrid") || fuel.contains("hybrid")
            || fuel.contains("benzin/elektromos") || fuel.contains("dizel/elektromos")
            || fuel.contains("diesel/elektromos")
        let isElectric = fuel.contains("elektromos") && !isHybrid
        let isDiesel = (fuel.contains("dizel") || fuel.contains("diesel")) && !isHybrid && !isElectric
        let isBenzin = fuel.contains("benzin") && !isHybrid && !isDiesel && !isElectric

        switch categoryId {
        case "uj":
            if let km, km <= 1000 { return true }
            if allapot.range(of: #"új|uj|gyári|gyari|0 km"#, options: .regularExpression) != nil { return true }
            if let year, year >= currentYear - 1 { return true }
            return false
        case "benzin":
            return isBenzin
        case "diesel":
            return isDiesel
        case "elektromos":
            return isElectric
        case "hybrid":
            return isHybrid
        case "leasing", "berelheto", "ot":
            return false
        default:
            return true
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
            async let a = ListingsAPI.fetchCategoryPage("auto", limit: 100, token: auth.token)
            async let i = ListingsAPI.fetchCategory("ingatlan", limit: 40, token: auth.token)
            let (autoPage, immoList) = try await (a, i)

            let autos = ListingsAPI.applyBoostSort(
                autoPage.listings,
                sort: .newest,
                boostListingIds: autoPage.boostListingIds,
                boostOwnerIds: autoPage.boostOwnerIds
            )

            // Kiemelt: promo / boost (web pickFeaturedListings)
            featured = Array(autos.filter { $0.promoKiemelt || $0.ownerBoost }.prefix(12))
            // Legújabb: feladás ideje szerint (web hub-latest-listings)
            latestListings = Array(
                autos.sorted { ($0.createdAt ?? $0.updatedAt ?? "") > ($1.createdAt ?? $1.updatedAt ?? "") }
                    .prefix(20)
            )
            nearbyAutos = Array(autos.prefix(16))
            autoCategories = autoCategoryDefs.map { cat in
                let n = autos.filter { matchesHomeCategory($0, cat.id) }.count
                return (cat.id, "\(cat.label) \(n)")
            }

            // Ingatlan: egyszerű szétválasztás cím alapján (web nearby később GPS-sel)
            nearbyFlats = Array(immoList.filter {
                $0.title.localizedCaseInsensitiveContains("lakás")
                    || $0.title.localizedCaseInsensitiveContains("lakas")
            }.prefix(12))
            nearbyHouses = Array(immoList.filter {
                $0.title.localizedCaseInsensitiveContains("ház")
                    || $0.title.localizedCaseInsensitiveContains("haz")
                    || $0.title.localizedCaseInsensitiveContains("családi")
            }.prefix(12))
            if nearbyFlats.isEmpty { nearbyFlats = Array(immoList.prefix(8)) }
            if nearbyHouses.isEmpty {
                nearbyHouses = Array(immoList.filter { !nearbyFlats.map(\.id).contains($0.id) }.prefix(8))
            }
        } catch {
            errorText = error.localizedDescription
        }
    }
}

/// Web `hf-card hf-card--kategoria` — fotó + címke.
struct AutoCategoryTile: View {
    let label: String
    let imageURL: URL?
    var width: CGFloat = 170

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                Color.white
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .padding(.horizontal, 8)
                            .padding(.vertical, 10)
                    default:
                        ProgressView()
                    }
                }
            }
            .frame(width: width, height: width * 10 / 16)
            .clipped()

            Text(label)
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(AppTheme.text)
                .lineLimit(2)
                .padding(.horizontal, 10)
                .padding(.top, 8)
                .padding(.bottom, 10)
                .frame(maxWidth: .infinity, minHeight: 40, alignment: .topLeading)
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
                if let badge = listing.badge, !badge.isEmpty {
                    Text(badge.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(AppTheme.accent)
                }
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
