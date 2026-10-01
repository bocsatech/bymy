import SwiftUI

/// Autó / Teherautó / Ingatlan — mobil web kereső + találatok.
struct CategorySearchScreen: View {
    let title: String
    let category: String

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var brand = ""
    @State private var model = ""
    @State private var fuel = ""
    @State private var yearFrom = ""
    @State private var yearTo = ""
    @State private var priceFrom = ""
    @State private var priceTo = ""
    @State private var kmFrom = ""
    @State private var kmTo = ""
    @State private var transmission = ""
    @State private var showMoreFilters = false

    /// Web: találatok csak „Találatok mutatása” után.
    @State private var searchCommitted = false
    @State private var listings: [ListingsAPI.Listing] = []
    @State private var browseFeatured: [ListingsAPI.Listing] = []
    @State private var boostOwnerIds: Set<Int> = []
    @State private var boostListingIds: Set<Int> = []
    @State private var sort: ListingsAPI.DeskSort = .newest
    @State private var loading = false
    @State private var errorText: String?
    @State private var nearbyHint = false

    private let fuels = ["", "Benzin", "Dízel", "Hibrid", "Elektromos", "LPG"]
    private let transmissions = ["", "Manuális", "Automata"]
    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)

    private var visibleListings: [ListingsAPI.Listing] {
        searchCommitted ? listings : browseFeatured
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AppTheme.text)

                filterCard

                actionButtons

                if showMoreFilters {
                    moreFiltersCard
                }

                if nearbyHint {
                    Text("Az „Autók a Közelben” térkép hamarosan jön az appban. Addig használd a keresőt + Találatok mutatása.")
                        .font(.system(size: 13))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }

                if let errorText {
                    Text(errorText)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                }

                resultsHeader

                if loading && visibleListings.isEmpty {
                    ProgressView("Betöltés…")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                } else if visibleListings.isEmpty {
                    Text(
                        searchCommitted
                            ? "Nincs találat ezekre a feltételekre."
                            : "Állíts be keresési feltételeket, majd kattints a „Találatok mutatása” gombra."
                    )
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.vertical, 8)
                } else {
                    ForEach(visibleListings) { item in
                        Button {
                            router.openListing(item.id)
                        } label: {
                            ListingCardView(listing: item)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 28)
        }
        .background(pageBg.ignoresSafeArea())
        .task { await loadBrowse() }
        .onChange(of: sort) { _, _ in
            guard searchCommitted else { return }
            listings = ListingsAPI.applyBoostSort(
                listings,
                sort: sort,
                boostListingIds: boostListingIds,
                boostOwnerIds: boostOwnerIds
            )
        }
    }

    private var filterCard: some View {
        VStack(spacing: 0) {
            menuRow("Gyártmány", value: brand.isEmpty ? "Mindegy" : brand) {
                TextField("pl. BMW, Audi…", text: $brand)
                    .textInputAutocapitalization(.words)
            }
            Divider().padding(.leading, 14)
            menuRow("Modell", value: model.isEmpty ? "Mindegy" : model) {
                TextField("Modell", text: $model)
                    .textInputAutocapitalization(.words)
            }
            Divider().padding(.leading, 14)
            menuRow("Üzemanyag", value: fuel.isEmpty ? "Mindegy" : fuel) {
                Picker("Üzemanyag", selection: $fuel) {
                    Text("Mindegy").tag("")
                    ForEach(fuels.filter { !$0.isEmpty }, id: \.self) { Text($0).tag($0) }
                }
                .labelsHidden()
                .pickerStyle(.menu)
            }
            Divider().padding(.leading, 14)
            menuRow("Évjárat", value: yearSummary) {
                HStack {
                    TextField("tól", text: $yearFrom).keyboardType(.numberPad)
                    Text("–")
                    TextField("ig", text: $yearTo).keyboardType(.numberPad)
                }
            }
            Divider().padding(.leading, 14)
            menuRow("Vételár", value: priceSummary) {
                HStack {
                    TextField("tól", text: $priceFrom).keyboardType(.numberPad)
                    Text("–")
                    TextField("ig", text: $priceTo).keyboardType(.numberPad)
                }
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }

    private var moreFiltersCard: some View {
        VStack(spacing: 0) {
            menuRow("Futott km", value: kmSummary) {
                HStack {
                    TextField("tól", text: $kmFrom).keyboardType(.numberPad)
                    Text("–")
                    TextField("ig", text: $kmTo).keyboardType(.numberPad)
                }
            }
            Divider().padding(.leading, 14)
            menuRow("Sebességváltó", value: transmission.isEmpty ? "Mindegy" : transmission) {
                Picker("Sebességváltó", selection: $transmission) {
                    Text("Mindegy").tag("")
                    ForEach(transmissions.filter { !$0.isEmpty }, id: \.self) { Text($0).tag($0) }
                }
                .labelsHidden()
                .pickerStyle(.menu)
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }

    /// Mobil web sárga gombok: Alaphelyzet | Találatok, Autók a Közelben, Több szűrő | Szűrők törlése
    private var actionButtons: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                yellowButton("Alaphelyzet") { resetAll(keepBrowse: true) }
                yellowButton(loading && searchCommitted ? nil : "Találatok mutatása", loading: loading && searchCommitted) {
                    Task { await search() }
                }
            }
            yellowButton("Autók a Közelben") {
                nearbyHint = true
            }
            HStack(spacing: 10) {
                outlineButton(showMoreFilters ? "Kevesebb szűrő" : "Több szűrő") {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showMoreFilters.toggle()
                    }
                }
                outlineButton("Szűrők törlése") {
                    resetFiltersOnly()
                }
            }
        }
    }

    private var resultsHeader: some View {
        HStack(alignment: .center) {
            Text(
                searchCommitted
                    ? (listings.isEmpty ? "0 találat" : "\(listings.count) találat")
                    : (browseFeatured.isEmpty ? "Kiemelt" : "Kiemelt · \(browseFeatured.count)")
            )
            .font(.system(size: 15, weight: .bold))

            Spacer()

            if searchCommitted {
                Menu {
                    ForEach(ListingsAPI.DeskSort.allCases) { option in
                        Button(option.label) { sort = option }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(sort.label)
                            .font(.system(size: 13, weight: .semibold))
                        Image(systemName: "chevron.down")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(AppTheme.accent)
                }
            }
        }
        .padding(.top, 4)
    }

    private func yellowButton(_ title: String?, loading: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Spacer()
                if loading {
                    ProgressView().tint(.black)
                } else if let title {
                    Text(title)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(.black)
                        .multilineTextAlignment(.center)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 44)
            .padding(.horizontal, 8)
            .background(AppTheme.brandYellow)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(loading)
    }

    private func outlineButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(AppTheme.text)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 40)
                .background(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var yearSummary: String {
        if yearFrom.isEmpty && yearTo.isEmpty { return "Mindegy" }
        return "\(yearFrom.isEmpty ? "…" : yearFrom) – \(yearTo.isEmpty ? "…" : yearTo)"
    }

    private var priceSummary: String {
        if priceFrom.isEmpty && priceTo.isEmpty { return "Mindegy" }
        return "\(priceFrom.isEmpty ? "…" : priceFrom) – \(priceTo.isEmpty ? "…" : priceTo) Ft"
    }

    private var kmSummary: String {
        if kmFrom.isEmpty && kmTo.isEmpty { return "Mindegy" }
        return "\(kmFrom.isEmpty ? "…" : kmFrom) – \(kmTo.isEmpty ? "…" : kmTo) km"
    }

    private func menuRow<Content: View>(_ title: String, value: String, @ViewBuilder editor: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                Spacer()
                Text(value)
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
            }
            editor()
                .font(.system(size: 15))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    private func resetFiltersOnly() {
        brand = ""; model = ""; fuel = ""
        yearFrom = ""; yearTo = ""; priceFrom = ""; priceTo = ""
        kmFrom = ""; kmTo = ""; transmission = ""
    }

    private func resetAll(keepBrowse: Bool) {
        resetFiltersOnly()
        searchCommitted = false
        listings = []
        nearbyHint = false
        sort = .newest
        if !keepBrowse {
            browseFeatured = []
        }
    }

    /// Web featured browse: kiemelt / előresorolt csempék — nem az összes autó.
    private func loadBrowse() async {
        guard auth.token != nil else { return }
        loading = true
        errorText = nil
        defer { loading = false }
        do {
            let page = try await ListingsAPI.fetchCategoryPage(category, limit: 80, token: auth.token)
            boostOwnerIds = page.boostOwnerIds
            boostListingIds = page.boostListingIds
            let all = ListingsAPI.applyBoostSort(
                page.listings,
                sort: .newest,
                boostListingIds: boostListingIds,
                boostOwnerIds: boostOwnerIds
            )
            let featured = all.filter { $0.promoKiemelt || $0.ownerBoost }
            browseFeatured = Array(featured.prefix(12))
            searchCommitted = false
            listings = []
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func search() async {
        guard auth.isLoggedIn else {
            router.showLogin = true
            return
        }
        loading = true
        errorText = nil
        nearbyHint = false
        defer { loading = false }
        do {
            let page = try await ListingsAPI.fetchCategoryPage(category, limit: 120, token: auth.token)
            boostOwnerIds = page.boostOwnerIds
            boostListingIds = page.boostListingIds

            let b = brand.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let m = model.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let yFrom = Int(yearFrom.filter(\.isNumber))
            let yTo = Int(yearTo.filter(\.isNumber))
            let pFrom = Int(priceFrom.filter(\.isNumber))
            let pTo = Int(priceTo.filter(\.isNumber))
            let kFrom = Int(kmFrom.filter(\.isNumber))
            let kTo = Int(kmTo.filter(\.isNumber))

            var filtered = page.listings.filter { item in
                if !b.isEmpty {
                    let hay = "\(item.brand ?? "") \(item.title)".lowercased()
                    if !hay.contains(b) { return false }
                }
                if !m.isEmpty {
                    let hay = "\(item.model ?? "") \(item.title)".lowercased()
                    if !hay.contains(m) { return false }
                }
                if !fuel.isEmpty {
                    if !item.meta.localizedCaseInsensitiveContains(fuel) { return false }
                }
                if !transmission.isEmpty {
                    if !item.meta.localizedCaseInsensitiveContains(transmission)
                        && !(item.title.localizedCaseInsensitiveContains(transmission)) {
                        // Sebességváltó gyakran nincs a meta-ban — ne dobjuk el, ha nincs adat
                    }
                }
                if let yFrom {
                    let year = Int(item.meta.split(separator: "·").first.map(String.init)?.filter(\.isNumber) ?? "") ?? 0
                    if year > 0, year < yFrom { return false }
                }
                if let yTo {
                    let year = Int(item.meta.split(separator: "·").first.map(String.init)?.filter(\.isNumber) ?? "") ?? 0
                    if year > 0, year > yTo { return false }
                }
                if let pFrom, let price = item.priceNum, price > 0, price < pFrom { return false }
                if let pTo, let price = item.priceNum, price > 0, price > pTo { return false }
                if let kFrom, let km = item.kmNum, km < kFrom { return false }
                if let kTo, let km = item.kmNum, km > kTo { return false }
                return true
            }

            filtered = ListingsAPI.applyBoostSort(
                filtered,
                sort: sort,
                boostListingIds: boostListingIds,
                boostOwnerIds: boostOwnerIds
            )
            listings = filtered
            searchCommitted = true
            browseFeatured = []
        } catch {
            errorText = error.localizedDescription
        }
    }
}
