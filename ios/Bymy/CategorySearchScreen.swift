import SwiftUI

/// Autó / Teherautó / Ingatlan — keresőmenük + találatok (mobil web home-qs).
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
    @State private var showResults = false
    @State private var listings: [ListingsAPI.Listing] = []
    @State private var loading = false
    @State private var errorText: String?

    private let fuels = ["", "Benzin", "Dízel", "Hibrid", "Elektromos", "LPG"]
    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AppTheme.text)

                VStack(spacing: 0) {
                    menuRow("Gyártmány", value: brand.isEmpty ? "Mindegy" : brand) {
                        brandPicker
                    }
                    Divider().padding(.leading, 14)
                    menuRow("Modell", value: model.isEmpty ? "Mindegy" : model) {
                        TextField("Modell", text: $model)
                            .textInputAutocapitalization(.words)
                    }
                    Divider().padding(.leading, 14)
                    menuRow("Üzemanyag", value: fuel.isEmpty ? "Mindegy" : fuel) {
                        fuelPicker
                    }
                    Divider().padding(.leading, 14)
                    menuRow("Évjárat", value: yearSummary) {
                        HStack {
                            TextField("tól", text: $yearFrom)
                                .keyboardType(.numberPad)
                            Text("–")
                            TextField("ig", text: $yearTo)
                                .keyboardType(.numberPad)
                        }
                    }
                    Divider().padding(.leading, 14)
                    menuRow("Vételár", value: priceSummary) {
                        HStack {
                            TextField("tól", text: $priceFrom)
                                .keyboardType(.numberPad)
                            Text("–")
                            TextField("ig", text: $priceTo)
                                .keyboardType(.numberPad)
                        }
                    }
                }
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 1)
                )

                Button {
                    Task { await search() }
                } label: {
                    HStack {
                        Spacer()
                        if loading {
                            ProgressView().tint(.black)
                        } else {
                            Text("Találatok mutatása")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.black)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 14)
                    .background(AppTheme.brandYellow)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(loading)

                Button("Szűrők törlése") {
                    brand = ""; model = ""; fuel = ""
                    yearFrom = ""; yearTo = ""; priceFrom = ""; priceTo = ""
                    showResults = false
                    listings = []
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppTheme.accent)

                if let errorText {
                    Text(errorText)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                }

                if showResults {
                    Text(listings.isEmpty ? "Nincs találat" : "\(listings.count) találat")
                        .font(.system(size: 15, weight: .bold))
                        .padding(.top, 4)

                    ForEach(listings) { item in
                        Button {
                            router.openListingId = item.id
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
        .task {
            // Előnézet: legújabb hirdetések a kategóriában
            await loadPreview()
        }
    }

    private var yearSummary: String {
        if yearFrom.isEmpty && yearTo.isEmpty { return "Mindegy" }
        return "\(yearFrom.isEmpty ? "…" : yearFrom) – \(yearTo.isEmpty ? "…" : yearTo)"
    }

    private var priceSummary: String {
        if priceFrom.isEmpty && priceTo.isEmpty { return "Mindegy" }
        return "\(priceFrom.isEmpty ? "…" : priceFrom) – \(priceTo.isEmpty ? "…" : priceTo) Ft"
    }

    private var brandPicker: some View {
        TextField("pl. BMW, Audi…", text: $brand)
            .textInputAutocapitalization(.words)
    }

    private var fuelPicker: some View {
        Picker("Üzemanyag", selection: $fuel) {
            Text("Mindegy").tag("")
            ForEach(fuels.filter { !$0.isEmpty }, id: \.self) { Text($0).tag($0) }
        }
        .labelsHidden()
        .pickerStyle(.menu)
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

    private func loadPreview() async {
        guard auth.token != nil else { return }
        loading = true
        defer { loading = false }
        do {
            let all = try await ListingsAPI.fetchCategory(category, limit: 20, token: auth.token)
            listings = all
            showResults = true
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
        defer { loading = false }
        do {
            var all = try await ListingsAPI.fetchCategory(category, limit: 80, token: auth.token)
            let b = brand.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let m = model.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let yFrom = Int(yearFrom.filter(\.isNumber))
            let yTo = Int(yearTo.filter(\.isNumber))
            let pFrom = Int(priceFrom.filter(\.isNumber))
            let pTo = Int(priceTo.filter(\.isNumber))

            all = all.filter { item in
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
                if let yFrom {
                    let year = Int(item.meta.split(separator: "·").first.map(String.init)?.filter(\.isNumber) ?? "") ?? 0
                    if year > 0, year < yFrom { return false }
                }
                if let yTo {
                    let year = Int(item.meta.split(separator: "·").first.map(String.init)?.filter(\.isNumber) ?? "") ?? 0
                    if year > 0, year > yTo { return false }
                }
                if pFrom != nil || pTo != nil {
                    let digits = item.priceLabel.filter(\.isNumber)
                    let price = Int(digits) ?? 0
                    if let pFrom, price > 0, price < pFrom { return false }
                    if let pTo, price > 0, price > pTo { return false }
                }
                return true
            }
            listings = all
            showResults = true
        } catch {
            errorText = error.localizedDescription
        }
    }
}
