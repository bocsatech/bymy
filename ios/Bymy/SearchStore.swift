import Foundation
import Combine

@MainActor
final class SearchStore: ObservableObject {
    @Published var filter = SearchFilter()
    @Published var saved: [SavedSearch] = []

    private let storageKey = "addelautod.savedSearches.v4"
    /// false: hirdetésfeladás draft — nincs mentett keresés / külön a fő keresőtől
    private let persistSavedSearches: Bool

    init(persistSavedSearches: Bool = true) {
        self.persistSavedSearches = persistSavedSearches
        if persistSavedSearches {
            load()
        }
    }

    func setBrand(_ brand: String, on: Bool) {
        var list = filter.gyartmanyok
        if on {
            if !list.contains(brand) { list.append(brand) }
        } else {
            list.removeAll { $0 == brand }
        }
        list.sort()
        filter.gyartmanyok = list
        pruneModels()
    }

    func clearBrands() {
        filter.gyartmanyok = []
        filter.modellek = []
    }

    func isBrandOn(_ brand: String) -> Bool {
        filter.gyartmanyok.contains(brand)
    }

    func setModel(_ model: String, on: Bool) {
        var list = filter.modellek
        if on {
            if !list.contains(model) { list.append(model) }
        } else {
            list.removeAll { $0 == model }
        }
        filter.modellek = list.sorted()
    }

    func clearModels() {
        filter.modellek = []
    }

    func clearModels(for brand: String) {
        let allowed = Set(Catalog.brands[brand] ?? [])
        filter.modellek.removeAll { allowed.contains($0) }
    }

    func isModelOn(_ model: String) -> Bool {
        filter.modellek.contains(model)
    }

    /// Egy gyártmányhoz tartozó, bekapcsolt modellek
    func models(for brand: String) -> [String] {
        let allowed = Set(Catalog.brands[brand] ?? [])
        return filter.modellek.filter { allowed.contains($0) }
    }

    func modelLabel(for brand: String) -> String {
        let m = models(for: brand)
        if m.isEmpty { return "Mindegy" }
        if m.count == 1 { return m[0] }
        if m.count <= 3 { return m.joined(separator: ", ") }
        return "\(m.count) modell"
    }

    /// Gyors kategória a főoldali ikonokról (Új, Diesel, …)
    func applyQuickCategory(_ category: QuickCategory) {
        applyListingQuery(.category(category))
    }

    func applyListingQuery(_ query: ListingQuery) {
        filter = SearchFilter()
        let year = Calendar.current.component(.year, from: Date())
        switch query {
        case .nearby:
            break
        case .newListings:
            filter.evTol = year - 1
        case .category(let category):
            switch category {
            case .uj:
                filter.evTol = year - 1
            case .benzin:
                filter.fuels = [.benzin]
            case .diesel:
                filter.fuels = [.diesel]
            case .elektromos:
                filter.fuels = [.elektromos]
            case .hybrid:
                filter.fuels = [.hybrid]
            case .leasing, .berelheto, .ot:
                break
            }
        }
    }

    private func pruneModels() {
        let allowed = Set(filter.gyartmanyok.flatMap { Catalog.brands[$0] ?? [] })
        filter.modellek = filter.modellek.filter { allowed.contains($0) }
    }

    func setFuel(_ fuel: FuelType, on: Bool) {
        var list = filter.fuels
        if on {
            if !list.contains(fuel) { list.append(fuel) }
        } else {
            list.removeAll { $0 == fuel }
        }
        // stabil sorrend: FuelType.allCases szerint
        filter.fuels = FuelType.allCases.filter { list.contains($0) }
    }

    func clearFuels() {
        filter.fuels = []
    }

    func isFuelOn(_ fuel: FuelType) -> Bool {
        filter.fuels.contains(fuel)
    }

    func setPrice(tol: Int?, ig: Int?) {
        var i = ig
        if let tVal = tol, let iVal = i, tVal > iVal {
            i = tVal
        }
        filter.arTol = tol
        filter.arIg = i
    }

    func setPriceMin(_ value: Int?) {
        setPrice(tol: value, ig: filter.arIg)
    }

    func setPriceMax(_ value: Int?) {
        setPrice(tol: filter.arTol, ig: value)
    }

    func setYear(tol: Int?, ig: Int?) {
        var i = ig
        if let tVal = tol, let iVal = i, tVal > iVal {
            i = tVal
        }
        filter.evTol = tol
        filter.evIg = i
    }

    func setYearMin(_ value: Int?) {
        setYear(tol: value, ig: filter.evIg)
    }

    func setYearMax(_ value: Int?) {
        setYear(tol: filter.evTol, ig: value)
    }

    func setKm(tol: Int?, ig: Int?) {
        var i = ig
        if let tVal = tol, let iVal = i, tVal > iVal {
            i = tVal
        }
        filter.kmTol = tol
        filter.kmIg = i
    }

    func setKmMin(_ value: Int?) {
        setKm(tol: value, ig: filter.kmIg)
    }

    func setKmMax(_ value: Int?) {
        setKm(tol: filter.kmTol, ig: value)
    }

    func setHengerCm3(tol: Int?, ig: Int?) {
        var i = ig
        if let tVal = tol, let iVal = i, tVal > iVal {
            i = tVal
        }
        filter.hengerCm3Tol = tol
        filter.hengerCm3Ig = i
    }

    func setHengerCm3Min(_ value: Int?) {
        setHengerCm3(tol: value, ig: filter.hengerCm3Ig)
    }

    func setHengerCm3Max(_ value: Int?) {
        setHengerCm3(tol: filter.hengerCm3Tol, ig: value)
    }

    func setExtra(_ key: String, on: Bool) {
        filter.extras[key] = on
    }

    func isExtraOn(_ key: String) -> Bool {
        filter.extras[key] == true
    }

    func toggleMulti(_ keyPath: WritableKeyPath<SearchFilter, [String]>, value: String, on: Bool) {
        var list = filter[keyPath: keyPath]
        if on {
            if !list.contains(value) { list.append(value) }
        } else {
            list.removeAll { $0 == value }
        }
        filter[keyPath: keyPath] = list
    }

    func clearMulti(_ keyPath: WritableKeyPath<SearchFilter, [String]>) {
        filter[keyPath: keyPath] = []
    }

    func isMultiOn(_ keyPath: KeyPath<SearchFilter, [String]>, value: String) -> Bool {
        filter[keyPath: keyPath].contains(value)
    }

    func setFelezoValto(_ on: Bool) { filter.felezoValto = on }
    func setMetalfeny(_ on: Bool) { filter.metalfeny = on }
    func setNemDohanyzo(_ on: Bool) { filter.nemDohanyzo = on }
    func setHolgyTulajdonos(_ on: Bool) { filter.holgyTulajdonos = on }
    func setKlima(_ value: String?) { filter.klima = value }
    func setVillamToltes(_ on: Bool) { filter.villamToltes = on }
    func setZoldRendszam(_ on: Bool) { filter.zoldRendszam = on }
    func setVehicleKind(_ kind: String?) { filter.vehicleKind = kind }

    func setIntRange(
        _ tolPath: WritableKeyPath<SearchFilter, Int?>,
        _ igPath: WritableKeyPath<SearchFilter, Int?>,
        tol: Int?,
        ig: Int?
    ) {
        var i = ig
        if let tVal = tol, let iVal = i, tVal > iVal { i = tVal }
        filter[keyPath: tolPath] = tol
        filter[keyPath: igPath] = i
    }

    func reset() {
        filter = SearchFilter()
    }

    func apply(_ item: SavedSearch) {
        filter = item.filter
    }

    @discardableResult
    func saveCurrent(name: String? = nil) -> SavedSearch? {
        guard persistSavedSearches else { return nil }
        guard !filter.isEmpty else { return nil }
        let icon = Catalog.savedIcons[saved.count % Catalog.savedIcons.count]
        let item = SavedSearch(
            id: UUID().uuidString,
            name: (name?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 } ?? filter.summary,
            icon: icon,
            filter: filter,
            createdAt: Date()
        )
        saved.insert(item, at: 0)
        if saved.count > 12 { saved = Array(saved.prefix(12)) }
        persist()
        return item
    }

    func remove(_ id: String) {
        saved.removeAll { $0.id == id }
        persist()
    }

    private func load() {
        guard persistSavedSearches else { return }
        guard let data = UserDefaults.standard.data(forKey: storageKey) else { return }
        if let decoded = try? JSONDecoder().decode([SavedSearch].self, from: data) {
            saved = decoded
        }
    }

    private func persist() {
        guard persistSavedSearches else { return }
        if let data = try? JSONEncoder().encode(saved) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }
}
