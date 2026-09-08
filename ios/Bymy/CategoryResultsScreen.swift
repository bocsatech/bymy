import SwiftUI

/// Gyors találatok — Közelben / Új hirdetések / kategória + irányítószám / km-sugár
struct CategoryResultsScreen: View {
    @EnvironmentObject private var store: SearchStore
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var savedListings: SavedListingsStore

    let query: ListingQuery
    var onBack: () -> Void
    var onOpenSettings: () -> Void

    @State private var openRequest: ListingOpenRequest?

    private var radiusKm: Int { max(1, profile.profile.searchRadiusKm) }
    private var postal: String {
        let p = profile.profile.postalCode.trimmingCharacters(in: .whitespaces)
        return p.isEmpty ? "nincs megadva" : p
    }

    private var cars: [DemoListing] {
        DemoListing.filtered(for: query, maxDistanceKm: radiusKm)
    }

    private var emptyMessage: String {
        switch query {
        case .newListings, .category(.uj):
            return "Még nincs új autóhirdetés."
        default:
            return "Nincs találat ebben a körzetben."
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(
                title: query.title,
                subtitle: "\(postal) · \(radiusKm) km",
                onBack: onBack,
                rightLabel: "Körzet",
                onRight: onOpenSettings
            )

            if profile.profile.postalCode.trimmingCharacters(in: .whitespaces).isEmpty {
                Button(action: onOpenSettings) {
                    HStack(spacing: 8) {
                        Image(systemName: "mappin.and.ellipse")
                        Text("Add meg az irányítószámot és a km-sugarat a Beállításokban")
                            .font(.footnote)
                            .multilineTextAlignment(.leading)
                    }
                    .foregroundStyle(AppTheme.accent)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.accent.opacity(0.08))
                }
                .buttonStyle(.plain)
            }

            ScrollView {
                LazyVStack(spacing: 12) {
                    Text("\(cars.count) találat · \(query.title) · \(radiusKm) km körzet")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if cars.isEmpty {
                        Text(emptyMessage)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.textSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    } else {
                        ForEach(cars) { car in
                            ListingFeedCard(
                                detail: car.asDetail,
                                onOpen: { openRequest = .demo(car) }
                            )
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 24)
            }
        }
        .background(AppTheme.bg)
        .onAppear {
            store.applyListingQuery(query)
        }
        .fullScreenCover(item: $openRequest) { req in
            ListingDetailLoader(request: req, onClose: { openRequest = nil })
                .environmentObject(profile)
                .environmentObject(savedListings)
        }
    }
}

struct DemoListing: Identifiable, Equatable {
    let id: String
    let title: String
    let priceLabel: String
    let meta: String
    let badge: String?
    let brand: String
    let model: String
    let priceFt: Int
    let km: Int
    let fuel: FuelType?
    let year: Int
    let isLeasing: Bool
    let isRentable: Bool
    let isOldtimer: Bool
    let postalCode: String
    let distanceKm: Int

    static let all: [DemoListing] = [
        .init(id: "1", title: "BMW 320d · 2019", priceLabel: "8,9 M Ft", meta: "142 000 km · Diesel · Automat", badge: "Kiemelt", brand: "BMW", model: "3-as", priceFt: 8_900_000, km: 142_000, fuel: .diesel, year: 2019, isLeasing: false, isRentable: false, isOldtimer: false, postalCode: "1117", distanceKm: 8),
        .init(id: "2", title: "Volkswagen Golf 1.5 TSI", priceLabel: "6,2 M Ft", meta: "68 000 km · Benzin · 2021", badge: "Friss", brand: "VOLKSWAGEN", model: "Golf", priceFt: 6_200_000, km: 68_000, fuel: .benzin, year: 2021, isLeasing: false, isRentable: false, isOldtimer: false, postalCode: "1024", distanceKm: 12),
        .init(id: "3", title: "Toyota Corolla Hybrid", priceLabel: "7,4 M Ft", meta: "51 000 km · Hybrid · 2022", badge: "Kiemelt", brand: "TOYOTA", model: "Corolla", priceFt: 7_400_000, km: 51_000, fuel: .hybrid, year: 2022, isLeasing: true, isRentable: false, isOldtimer: false, postalCode: "1138", distanceKm: 5),
        .init(id: "4", title: "Skoda Octavia 2.0 TDI", priceLabel: "5,1 M Ft", meta: "118 000 km · Diesel · 2018", badge: nil, brand: "SKODA", model: "Octavia", priceFt: 5_100_000, km: 118_000, fuel: .diesel, year: 2018, isLeasing: false, isRentable: false, isOldtimer: false, postalCode: "1048", distanceKm: 18),
        .init(id: "5", title: "Ford Kuga ST-Line", priceLabel: "9,8 M Ft", meta: "34 000 km · Hybrid · 2023", badge: "Kiemelt", brand: "FORD", model: "Kuga", priceFt: 9_800_000, km: 34_000, fuel: .hybrid, year: 2023, isLeasing: false, isRentable: true, isOldtimer: false, postalCode: "1095", distanceKm: 6),
        .init(id: "6", title: "Tesla Model 3", priceLabel: "14,2 M Ft", meta: "22 000 km · Elektromos · 2024", badge: "Új", brand: "TESLA", model: "Model 3", priceFt: 14_200_000, km: 22_000, fuel: .elektromos, year: 2024, isLeasing: true, isRentable: false, isOldtimer: false, postalCode: "1052", distanceKm: 3),
        .init(id: "7", title: "VW ID.3 Pro", priceLabel: "11,5 M Ft", meta: "15 000 km · Elektromos · 2025", badge: "Új", brand: "VOLKSWAGEN", model: "ID.3", priceFt: 11_500_000, km: 15_000, fuel: .elektromos, year: 2025, isLeasing: false, isRentable: false, isOldtimer: false, postalCode: "1112", distanceKm: 9),
        .init(id: "8", title: "Mercedes C 220d", priceLabel: "10,1 M Ft", meta: "89 000 km · Diesel · 2020", badge: nil, brand: "MERCEDES-BENZ", model: "C-osztály", priceFt: 10_100_000, km: 89_000, fuel: .diesel, year: 2020, isLeasing: true, isRentable: false, isOldtimer: false, postalCode: "1124", distanceKm: 11),
        .init(id: "9", title: "Opel Corsa 1.2", priceLabel: "4,2 M Ft", meta: "41 000 km · Benzin · 2022", badge: nil, brand: "OPEL", model: "Corsa", priceFt: 4_200_000, km: 41_000, fuel: .benzin, year: 2022, isLeasing: false, isRentable: true, isOldtimer: false, postalCode: "1037", distanceKm: 14),
        .init(id: "10", title: "Trabant 601", priceLabel: "1,8 M Ft", meta: "62 000 km · Benzin · 1985", badge: "OT", brand: "TRABANT", model: "601", priceFt: 1_800_000, km: 62_000, fuel: .benzin, year: 1985, isLeasing: false, isRentable: false, isOldtimer: true, postalCode: "1173", distanceKm: 22),
        .init(id: "11", title: "Audi A4 2.0 TDI", priceLabel: "7,9 M Ft", meta: "95 000 km · Diesel · 2021", badge: nil, brand: "AUDI", model: "A4", priceFt: 7_900_000, km: 95_000, fuel: .diesel, year: 2021, isLeasing: false, isRentable: false, isOldtimer: false, postalCode: "1144", distanceKm: 7),
        .init(id: "12", title: "Suzuki Swift", priceLabel: "3,6 M Ft", meta: "28 000 km · Benzin · 2023", badge: "Friss", brand: "SUZUKI", model: "Swift", priceFt: 3_600_000, km: 28_000, fuel: .benzin, year: 2023, isLeasing: false, isRentable: true, isOldtimer: false, postalCode: "1082", distanceKm: 4),
    ]

    static func filtered(for query: ListingQuery, maxDistanceKm: Int = 500) -> [DemoListing] {
        all.filter { car in
            guard car.distanceKm <= maxDistanceKm else { return false }
            switch query {
            case .nearby:
                return true
            case .newListings:
                return false
            case .category(let category):
                switch category {
                case .uj: return false
                case .benzin: return car.fuel == .benzin && !car.isOldtimer
                case .diesel: return car.fuel == .diesel
                case .elektromos: return car.fuel == .elektromos
                case .hybrid: return car.fuel == .hybrid
                case .leasing: return car.isLeasing
                case .berelheto: return car.isRentable
                case .ot: return car.isOldtimer
                }
            }
        }
    }

    static func filtered(for category: QuickCategory, maxDistanceKm: Int = 500) -> [DemoListing] {
        filtered(for: .category(category), maxDistanceKm: maxDistanceKm)
    }

    /// Szűrés a kereső feltételai alapján (demo lista)
    static func filtered(for filter: SearchFilter) -> [DemoListing] {
        all.filter { car in
            if !filter.gyartmanyok.isEmpty {
                let brands = Set(filter.gyartmanyok.map { $0.uppercased() })
                let carBrand = car.brand.uppercased()
                let aliases: [String: String] = ["VW": "VOLKSWAGEN", "MERCEDES": "MERCEDES-BENZ"]
                let normalized = aliases[carBrand] ?? carBrand
                let ok = brands.contains(where: {
                    let b = aliases[$0] ?? $0
                    return b == normalized || carBrand.hasPrefix(b) || b.hasPrefix(carBrand)
                })
                if !ok { return false }
            }
            if !filter.modellek.isEmpty {
                let models = filter.modellek.map { $0.lowercased() }
                let hay = "\(car.model) \(car.title)".lowercased()
                if !models.contains(where: { hay.contains($0.lowercased()) }) {
                    return false
                }
            }
            if !filter.fuels.isEmpty {
                guard let fuel = car.fuel, filter.fuels.contains(fuel) else { return false }
            }
            if let tol = filter.evTol, car.year < tol { return false }
            if let ig = filter.evIg, car.year > ig { return false }
            if let tol = filter.kmTol, car.km < tol { return false }
            if let ig = filter.kmIg, car.km > ig { return false }
            if let tol = filter.arTol, car.priceFt < tol { return false }
            if let ig = filter.arIg, car.priceFt > ig { return false }
            return true
        }
    }
}
