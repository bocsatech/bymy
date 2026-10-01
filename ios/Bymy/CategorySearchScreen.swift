import SwiftUI

/// Autó / Teherautó / Ingatlan — mobil web gyorskereső (sheet menük + sárga gombok).
struct CategorySearchScreen: View {
    let title: String
    let category: String

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter
    @StateObject private var catalog = VehicleCatalogStore()

    @State private var searchOpen = true
    @State private var brand = ""
    @State private var model = ""
    @State private var fuel = ""
    @State private var bodyType = ""
    @State private var condition = ""
    @State private var yearFrom = ""
    @State private var yearTo = ""
    @State private var priceFrom = ""
    @State private var priceTo = ""
    @State private var kmFrom = ""
    @State private var kmTo = ""
    @State private var transmission = ""
    @State private var drive = ""
    @State private var showMoreFilters = false

    @State private var sheet: SearchSheet?
    @State private var searchCommitted = false
    @State private var listings: [ListingsAPI.Listing] = []
    @State private var browseFeatured: [ListingsAPI.Listing] = []
    @State private var boostOwnerIds: Set<Int> = []
    @State private var boostListingIds: Set<Int> = []
    @State private var sort: ListingsAPI.DeskSort = .newest
    @State private var loading = false
    @State private var errorText: String?
    @State private var nearbyHint = false

    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)

    private var visibleListings: [ListingsAPI.Listing] {
        searchCommitted ? listings : browseFeatured
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                searchPanel
                if nearbyHint {
                    hintCard("Az „Autók a Közelben” térkép hamarosan jön az appban. Addig: Találatok mutatása.")
                }
                if let errorText {
                    Text(errorText)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                }
                resultsHeader
                resultsList
            }
            .padding(16)
            .padding(.bottom, 28)
        }
        .background(pageBg.ignoresSafeArea())
        .task {
            await catalog.load(kind: category == "teherauto" ? "kisteher" : "szemelyauto")
            await loadBrowse()
        }
        .sheet(item: $sheet) { item in
            SearchPickerSheet(item: item) { value in
                applySheet(item, value: value)
                sheet = nil
            } onDismiss: {
                sheet = nil
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .onChange(of: sort) { _, _ in
            guard searchCommitted else { return }
            listings = ListingsAPI.applyBoostSort(
                listings, sort: sort,
                boostListingIds: boostListingIds, boostOwnerIds: boostOwnerIds
            )
        }
    }

    // MARK: - Search panel (mint webes auto-search-panel)

    private var searchPanel: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { searchOpen.toggle() }
            } label: {
                HStack {
                    Text("Melyik járművet keresed?")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(AppTheme.text)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .rotationEffect(.degrees(searchOpen ? 180 : 0))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)

            if searchOpen {
                Divider()
                VStack(spacing: 0) {
                    // Gyártmány & Modell — egy kombinált blokk (web)
                    combinedBrandModel
                    fieldDivider
                    pickerRow("Évjárat", summary: yearSummary) {
                        sheet = .yearRange(from: yearFrom, to: yearTo)
                    }
                    fieldDivider
                    pickerRow("Vételár", summary: priceSummary) {
                        sheet = .priceRange(from: priceFrom, to: priceTo)
                    }
                    fieldDivider
                    pickerRow("Üzemanyag", summary: fuel.isEmpty ? "Mindegy" : fuel) {
                        sheet = .list(title: "Üzemanyag", options: SearchCatalog.fuels, selected: fuel)
                    }
                    fieldDivider
                    pickerRow("Kivitel", summary: bodyType.isEmpty ? "Mindegy" : bodyType) {
                        sheet = .list(title: "Kivitel", options: SearchCatalog.kivitels, selected: bodyType)
                    }
                    fieldDivider
                    pickerRow("Állapot", summary: condition.isEmpty ? "Mindegy" : condition) {
                        sheet = .list(title: "Állapot", options: SearchCatalog.conditions, selected: condition)
                    }

                    if showMoreFilters {
                        fieldDivider
                        pickerRow("Futott km", summary: kmSummary) {
                            sheet = .kmRange(from: kmFrom, to: kmTo)
                        }
                        fieldDivider
                        pickerRow("Sebességváltó", summary: transmission.isEmpty ? "Mindegy" : transmission) {
                            sheet = .list(title: "Sebességváltó", options: SearchCatalog.transmissions, selected: transmission)
                        }
                        fieldDivider
                        pickerRow("Hajtás", summary: drive.isEmpty ? "Mindegy" : drive) {
                            sheet = .list(title: "Hajtás", options: SearchCatalog.drives, selected: drive)
                        }
                    }
                }

                actionButtons
                    .padding(12)
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }

    private var combinedBrandModel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Gyártmány & Modell")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(AppTheme.text)

            Button {
                sheet = .list(title: "Gyártmány", options: catalog.brands, selected: brand)
            } label: {
                underlineValue(brand.isEmpty ? "Gyártmány" : brand, placeholder: brand.isEmpty)
            }
            .buttonStyle(.plain)

            Button {
                let models = catalog.models(for: brand)
                if models.isEmpty {
                    sheet = .text(title: "Modell", current: model)
                } else {
                    sheet = .list(title: "Modell", options: models, selected: model)
                }
            } label: {
                underlineValue(model.isEmpty ? "Modell" : model, placeholder: model.isEmpty)
            }
            .buttonStyle(.plain)
            .disabled(false)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private func underlineValue(_ text: String, placeholder: Bool) -> some View {
        HStack {
            Text(text)
                .font(.system(size: 16, weight: placeholder ? .medium : .semibold))
                .foregroundStyle(placeholder ? AppTheme.textSecondary : AppTheme.text)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AppTheme.tabInactive)
        }
        .padding(.bottom, 8)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color(red: 0.81, green: 0.84, blue: 0.87)).frame(height: 1.5)
        }
    }

    private func pickerRow(_ title: String, summary: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                Spacer()
                Text(summary)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(summary == "Mindegy" ? AppTheme.textSecondary : AppTheme.text)
                    .lineLimit(1)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppTheme.tabInactive)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var fieldDivider: some View {
        Divider().padding(.leading, 16)
    }

    private var actionButtons: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                yellowButton("Alaphelyzet") { resetAll(keepBrowse: true) }
                yellowButton(loading && searchCommitted ? nil : "Találatok mutatása", loading: loading && searchCommitted) {
                    Task { await search() }
                }
            }
            yellowButton("Autók a Közelben") { nearbyHint = true }
            HStack(spacing: 10) {
                outlineButton(showMoreFilters ? "Kevesebb szűrő" : "Több szűrő") {
                    withAnimation(.easeInOut(duration: 0.2)) { showMoreFilters.toggle() }
                }
                outlineButton("Szűrők törlése") { resetFiltersOnly() }
            }
        }
    }

    private var resultsHeader: some View {
        HStack {
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
    }

    @ViewBuilder
    private var resultsList: some View {
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
                Button { router.openListing(item.id) } label: {
                    ListingCardView(listing: item)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func hintCard(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(AppTheme.textSecondary)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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

    // MARK: - Summaries / sheets

    private var yearSummary: String {
        if yearFrom.isEmpty && yearTo.isEmpty { return "Mindegy" }
        return "\(yearFrom.isEmpty ? "…" : yearFrom) – \(yearTo.isEmpty ? "…" : yearTo)"
    }

    private var priceSummary: String {
        if priceFrom.isEmpty && priceTo.isEmpty { return "Mindegy" }
        let a = Int(priceFrom).map(SearchCatalog.formatPrice) ?? "…"
        let b = Int(priceTo).map(SearchCatalog.formatPrice) ?? "…"
        return "\(a) – \(b)"
    }

    private var kmSummary: String {
        if kmFrom.isEmpty && kmTo.isEmpty { return "Mindegy" }
        let a = Int(kmFrom).map(SearchCatalog.formatKm) ?? "…"
        let b = Int(kmTo).map(SearchCatalog.formatKm) ?? "…"
        return "\(a) – \(b)"
    }

    private func applySheet(_ item: SearchSheet, value: SearchSheetValue) {
        switch item {
        case .list(let title, _, _):
            let v = value.single
            switch title {
            case "Gyártmány":
                brand = v
                if !v.isEmpty { model = "" }
            case "Modell": model = v
            case "Üzemanyag": fuel = v
            case "Kivitel": bodyType = v
            case "Állapot": condition = v
            case "Sebességváltó": transmission = v
            case "Hajtás": drive = v
            default: break
            }
        case .text(let title, _):
            if title == "Modell" { model = value.single }
        case .yearRange:
            yearFrom = value.from
            yearTo = value.to
        case .priceRange:
            priceFrom = value.from
            priceTo = value.to
        case .kmRange:
            kmFrom = value.from
            kmTo = value.to
        }
    }

    private func resetFiltersOnly() {
        brand = ""; model = ""; fuel = ""; bodyType = ""; condition = ""
        yearFrom = ""; yearTo = ""; priceFrom = ""; priceTo = ""
        kmFrom = ""; kmTo = ""; transmission = ""; drive = ""
    }

    private func resetAll(keepBrowse: Bool) {
        resetFiltersOnly()
        searchCommitted = false
        listings = []
        nearbyHint = false
        sort = .newest
        if !keepBrowse { browseFeatured = [] }
    }

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
                page.listings, sort: .newest,
                boostListingIds: boostListingIds, boostOwnerIds: boostOwnerIds
            )
            browseFeatured = Array(all.filter { $0.promoKiemelt || $0.ownerBoost }.prefix(12))
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
                if !fuel.isEmpty, !item.meta.localizedCaseInsensitiveContains(fuel) { return false }
                if !bodyType.isEmpty {
                    let hay = "\(item.title) \(item.meta)".lowercased()
                    if !hay.contains(bodyType.lowercased()) { return false }
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
                filtered, sort: sort,
                boostListingIds: boostListingIds, boostOwnerIds: boostOwnerIds
            )
            listings = filtered
            searchCommitted = true
            browseFeatured = []
        } catch {
            errorText = error.localizedDescription
        }
    }
}

// MARK: - Sheet model

enum SearchSheet: Identifiable {
    case list(title: String, options: [String], selected: String)
    case text(title: String, current: String)
    case yearRange(from: String, to: String)
    case priceRange(from: String, to: String)
    case kmRange(from: String, to: String)

    var id: String {
        switch self {
        case .list(let t, _, _): return "list-\(t)"
        case .text(let t, _): return "text-\(t)"
        case .yearRange: return "year"
        case .priceRange: return "price"
        case .kmRange: return "km"
        }
    }
}

struct SearchSheetValue {
    var single: String = ""
    var from: String = ""
    var to: String = ""
}

struct SearchPickerSheet: View {
    let item: SearchSheet
    let onDone: (SearchSheetValue) -> Void
    let onDismiss: () -> Void

    @State private var single = ""
    @State private var from = ""
    @State private var to = ""
    @State private var filterText = ""

    var body: some View {
        NavigationStack {
            Group {
                switch item {
                case .list(let title, let options, _):
                    listBody(title: title, options: options)
                case .text(let title, _):
                    Form {
                        TextField(title, text: $single)
                            .textInputAutocapitalization(.words)
                    }
                case .yearRange:
                    rangePickers(
                        options: SearchCatalog.yearOptions(),
                        format: { $0 }
                    )
                case .priceRange:
                    rangePickers(
                        options: SearchCatalog.priceOptions().map(String.init),
                        format: { SearchCatalog.formatPrice(Int($0) ?? 0) }
                    )
                case .kmRange:
                    rangePickers(
                        options: SearchCatalog.kmOptions().map(String.init),
                        format: { SearchCatalog.formatKm(Int($0) ?? 0) }
                    )
                }
            }
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Mégsem", action: onDismiss)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Kész") {
                        onDone(SearchSheetValue(single: single, from: from, to: to))
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear { seed() }
        }
    }

    private var navTitle: String {
        switch item {
        case .list(let t, _, _), .text(let t, _): return t
        case .yearRange: return "Évjárat"
        case .priceRange: return "Vételár"
        case .kmRange: return "Futott km"
        }
    }

    private func seed() {
        switch item {
        case .list(_, _, let selected): single = selected
        case .text(_, let current): single = current
        case .yearRange(let f, let t), .priceRange(let f, let t), .kmRange(let f, let t):
            from = f; to = t
        }
    }

    private func listBody(title: String, options: [String]) -> some View {
        let q = filterText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let filtered = q.isEmpty ? options : options.filter { $0.lowercased().contains(q) }
        return List {
            if title == "Gyártmány" || title == "Modell" || options.count > 12 {
                Section {
                    TextField("Keresés…", text: $filterText)
                }
            }
            Section {
                Button {
                    single = ""
                } label: {
                    HStack {
                        Text("Mindegy")
                        Spacer()
                        if single.isEmpty { Image(systemName: "checkmark") }
                    }
                }
                ForEach(filtered, id: \.self) { opt in
                    Button {
                        single = opt
                    } label: {
                        HStack {
                            Text(opt).foregroundStyle(AppTheme.text)
                            Spacer()
                            if single == opt { Image(systemName: "checkmark").foregroundStyle(AppTheme.accent) }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func rangePickers(options: [String], format: @escaping (String) -> String) -> some View {
        Form {
            Section("-tól") {
                Picker("tól", selection: $from) {
                    Text("Mindegy").tag("")
                    ForEach(options, id: \.self) { Text(format($0)).tag($0) }
                }
                .pickerStyle(.wheel)
                .frame(height: 120)
            }
            Section("-ig") {
                Picker("ig", selection: $to) {
                    Text("Mindegy").tag("")
                    ForEach(options, id: \.self) { Text(format($0)).tag($0) }
                }
                .pickerStyle(.wheel)
                .frame(height: 120)
            }
        }
    }
}
