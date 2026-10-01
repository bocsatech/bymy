import SwiftUI

// MARK: - Saját hirdetések

struct MyAdsScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var items: [ListingsAPI.Listing] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var filter: Filter = .all

    enum Filter: String, CaseIterable {
        case all, active, inactive
        var title: String {
            switch self {
            case .all: return "Összes"
            case .active: return "Aktív"
            case .inactive: return "Inaktív"
            }
        }
    }

    private var filtered: [ListingsAPI.Listing] {
        switch filter {
        case .all: return items
        case .active: return items.filter { $0.status == "feladott" || $0.status == nil || $0.status == "" }
        case .inactive: return items.filter { let s = $0.status ?? ""; return s != "feladott" && !s.isEmpty }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Saját hirdetések")
                    .font(.system(size: 20, weight: .bold))
                Spacer()
                Button {
                    router.selectBottom(.post, isLoggedIn: true)
                    router.openFiokSection(nil)
                } label: {
                    Text("+ Új hirdetés")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(AppTheme.brandYellow)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Filter.allCases, id: \.self) { f in
                        Button {
                            filter = f
                        } label: {
                            Text(pillTitle(f))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(filter == f ? .black : AppTheme.text)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(filter == f ? AppTheme.brandYellow : Color(red: 0.949, green: 0.957, blue: 0.969))
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.bottom, 8)

            Group {
                if loading {
                    ProgressView("Hirdetések betöltése…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorText {
                    Text(errorText)
                        .foregroundStyle(.red)
                        .padding()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filtered.isEmpty {
                    Text("Nincs megjeleníthető hirdetés.")
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(filtered) { item in
                        Button {
                            router.openListingId = item.id
                        } label: {
                            HStack(spacing: 12) {
                                AsyncImage(url: item.imageURL) { phase in
                                    switch phase {
                                    case .success(let img): img.resizable().scaledToFill()
                                    default: Color(red: 0.93, green: 0.94, blue: 0.96)
                                    }
                                }
                                .frame(width: 88, height: 66)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.title)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(AppTheme.text)
                                        .lineLimit(2)
                                    Text(item.priceLabel)
                                        .font(.system(size: 14, weight: .bold))
                                    if !item.meta.isEmpty {
                                        Text(item.meta)
                                            .font(.system(size: 12))
                                            .foregroundStyle(AppTheme.textSecondary)
                                            .lineLimit(1)
                                    }
                                    if let status = item.status, !status.isEmpty {
                                        Text(status == "feladott" ? "Aktív" : status.capitalized)
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(status == "feladott" ? Color.green : AppTheme.tabInactive)
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                    .listStyle(.plain)
                }
            }
        }
        .background(AppTheme.bg)
        .task { await load() }
    }

    private func pillTitle(_ f: Filter) -> String {
        switch f {
        case .all: return "Összes (\(items.count))"
        case .active:
            let n = items.filter { $0.status == "feladott" || $0.status == nil || $0.status == "" }.count
            return "Aktív (\(n))"
        case .inactive:
            let n = items.filter { let s = $0.status ?? ""; return s != "feladott" && !s.isEmpty }.count
            return "Inaktív (\(n))"
        }
    }

    private func load() async {
        loading = true
        errorText = nil
        defer { loading = false }
        do {
            items = try await ListingsAPI.fetchMine(token: auth.token, limit: 200)
        } catch {
            errorText = error.localizedDescription
        }
    }
}

// MARK: - Kedvencek

struct FavoritesScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var items: [FavoriteItem] = []
    @State private var titleDraft = ""
    @State private var priceDraft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Kedvencek")
                    .font(.system(size: 22, weight: .bold))
                Text("Érdekes hirdetések, amelyekkel később foglalkoznál — a kedvenceid.")
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)

                HStack(spacing: 8) {
                    TextField("Pl. BMW 320d 2018", text: $titleDraft)
                        .textFieldStyle(.roundedBorder)
                    TextField("Ár", text: $priceDraft)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 90)
                    Button("Hozzáadás") { addManual() }
                        .font(.system(size: 14, weight: .bold))
                        .disabled(titleDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(16)

            if items.isEmpty {
                Text("Még nincs kedvenced.")
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(items) { item in
                        HStack(spacing: 12) {
                            if let url = item.imageURL {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let img): img.resizable().scaledToFill()
                                    default: Color(red: 0.93, green: 0.94, blue: 0.96)
                                    }
                                }
                                .frame(width: 72, height: 54)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.system(size: 15, weight: .semibold))
                                Text(item.price.isEmpty ? "Ár nincs megadva" : item.price)
                                    .font(.system(size: 13))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                            Spacer()
                            if item.listingId != nil {
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(AppTheme.tabInactive)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            if let id = item.listingId {
                                router.openListingId = id
                            }
                        }
                    }
                    .onDelete(perform: delete)
                }
                .listStyle(.plain)
            }
        }
        .background(AppTheme.bg)
        .onAppear { reload() }
    }

    private func reload() {
        items = FavoriteStore.load(email: auth.user?.email)
    }

    private func addManual() {
        let title = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        FavoriteStore.add(
            email: auth.user?.email,
            FavoriteItem(
                id: UUID().uuidString,
                listingId: nil,
                title: title,
                price: priceDraft.trimmingCharacters(in: .whitespacesAndNewlines),
                imageURL: nil
            )
        )
        titleDraft = ""
        priceDraft = ""
        reload()
    }

    private func delete(at offsets: IndexSet) {
        let ids = offsets.map { items[$0].id }
        FavoriteStore.remove(email: auth.user?.email, ids: ids)
        reload()
    }
}

struct FavoriteItem: Identifiable, Codable, Equatable {
    let id: String
    var listingId: String?
    var title: String
    var price: String
    var imageURL: URL?
}

enum FavoriteStore {
    private static let key = "bymy.parkplatz"

    static func load(email: String?) -> [FavoriteItem] {
        let map = readMap()
        let norm = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var rows = (map[norm] as? [[String: Any]]) ?? []

        // Merge listing-detail heart favorites
        let favIds = Set(UserDefaults.standard.stringArray(forKey: "bymy.favorites") ?? [])
        let existingListingIds = Set(rows.compactMap { $0["listingId"] as? String })
        for id in favIds where !existingListingIds.contains(id) {
            rows.insert([
                "id": id,
                "listingId": id,
                "title": "Hirdetés #\(id)",
                "price": "",
            ], at: 0)
        }

        return rows.compactMap { row in
            let id = String(row["id"] as? String ?? "")
            guard !id.isEmpty else { return nil }
            let img = (row["imageUrl"] as? String).flatMap { URL(string: $0) }
            return FavoriteItem(
                id: id,
                listingId: {
                    let lid = row["listingId"] as? String
                    return (lid?.isEmpty == false) ? lid : nil
                }(),
                title: (row["title"] as? String) ?? "Kedvenc",
                price: (row["price"] as? String) ?? "",
                imageURL: img
            )
        }
    }

    static func add(email: String?, _ item: FavoriteItem) {
        let norm = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !norm.isEmpty else { return }
        var map = readMap()
        var rows = (map[norm] as? [[String: Any]]) ?? []
        if rows.contains(where: { String($0["id"] as? String ?? "") == item.id }) { return }
        rows.insert([
            "id": item.id,
            "listingId": item.listingId ?? "",
            "title": item.title,
            "price": item.price,
            "imageUrl": item.imageURL?.absoluteString ?? "",
            "savedAt": Date().timeIntervalSince1970 * 1000,
        ], at: 0)
        map[norm] = rows
        writeMap(map)
    }

    static func remove(email: String?, ids: [String]) {
        let norm = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !norm.isEmpty else { return }
        var map = readMap()
        var rows = (map[norm] as? [[String: Any]]) ?? []
        rows.removeAll { ids.contains(String($0["id"] as? String ?? "")) }
        map[norm] = rows
        writeMap(map)

        var favs = Set(UserDefaults.standard.stringArray(forKey: "bymy.favorites") ?? [])
        for id in ids { favs.remove(id) }
        UserDefaults.standard.set(Array(favs), forKey: "bymy.favorites")
    }

    private static func readMap() -> [String: Any] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return obj
    }

    private static func writeMap(_ map: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: map) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

// MARK: - Mentett keresések

struct SavedSearchesScreen: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var items: [SavedSearchItem] = []
    @State private var nameDraft = ""
    @State private var queryDraft = ""
    @State private var notify = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Mentett kereséseim")
                    .font(.system(size: 22, weight: .bold))
                Text("Mentett szűréseid. Bekapcsolhatod az értesítést új találatokra.")
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)

                TextField("Keresés neve (pl. Audi A4 diesel)", text: $nameDraft)
                    .textFieldStyle(.roundedBorder)
                TextField("Szűrő szövegesen", text: $queryDraft)
                    .textFieldStyle(.roundedBorder)
                Toggle("Értesítés", isOn: $notify)
                Button("Mentés") { add() }
                    .font(.system(size: 15, weight: .bold))
                    .disabled(nameDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(16)

            if items.isEmpty {
                Text("Nincs mentett keresésed.")
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.name)
                                .font(.system(size: 15, weight: .semibold))
                            if !item.query.isEmpty {
                                Text(item.query)
                                    .font(.system(size: 13))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                            if item.notify {
                                Text("Értesítés bekapcsolva")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(AppTheme.accent)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .onDelete { offsets in
                        SavedSearchStore.remove(email: auth.user?.email, ids: offsets.map { items[$0].id })
                        reload()
                    }
                }
                .listStyle(.plain)
            }
        }
        .background(AppTheme.bg)
        .onAppear { reload() }
    }

    private func reload() {
        items = SavedSearchStore.load(email: auth.user?.email)
    }

    private func add() {
        let name = nameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        SavedSearchStore.add(
            email: auth.user?.email,
            SavedSearchItem(
                id: UUID().uuidString,
                name: name,
                query: queryDraft.trimmingCharacters(in: .whitespacesAndNewlines),
                notify: notify
            )
        )
        nameDraft = ""
        queryDraft = ""
        notify = false
        reload()
    }
}

struct SavedSearchItem: Identifiable, Equatable {
    let id: String
    var name: String
    var query: String
    var notify: Bool
}

enum SavedSearchStore {
    private static let key = "bymy.savedSearches"

    static func load(email: String?) -> [SavedSearchItem] {
        let norm = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let map = readMap()
        let rows = (map[norm] as? [[String: Any]]) ?? []
        return rows.compactMap { row in
            let id = row["id"] as? String ?? ""
            guard !id.isEmpty else { return nil }
            return SavedSearchItem(
                id: id,
                name: (row["name"] as? String) ?? "Keresés",
                query: (row["query"] as? String) ?? "",
                notify: (row["notify"] as? Bool) ?? false
            )
        }
    }

    static func add(email: String?, _ item: SavedSearchItem) {
        let norm = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !norm.isEmpty else { return }
        var map = readMap()
        var rows = (map[norm] as? [[String: Any]]) ?? []
        rows.insert([
            "id": item.id,
            "name": item.name,
            "query": item.query,
            "notify": item.notify,
        ], at: 0)
        map[norm] = rows
        writeMap(map)
    }

    static func remove(email: String?, ids: [String]) {
        let norm = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !norm.isEmpty else { return }
        var map = readMap()
        var rows = (map[norm] as? [[String: Any]]) ?? []
        rows.removeAll { ids.contains($0["id"] as? String ?? "") }
        map[norm] = rows
        writeMap(map)
    }

    private static func readMap() -> [String: Any] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return obj
    }

    private static func writeMap(_ map: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: map) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

// MARK: - Értékelések

struct RatingsScreen: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var rows: [RatingRow] = []
    @State private var loading = true
    @State private var errorText: String?

    struct RatingRow: Identifiable {
        let id: String
        let score: Int
        let dateLabel: String
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Értékelések")
                .font(.system(size: 22, weight: .bold))
                .padding(.horizontal, 16)
                .padding(.top, 16)
            Text("A kapott értékelések — csak pontszám és dátum.")
                .font(.system(size: 14))
                .foregroundStyle(AppTheme.textSecondary)
                .padding(.horizontal, 16)

            if loading {
                ProgressView("Betöltés…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorText {
                Text(errorText)
                    .foregroundStyle(.red)
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if rows.isEmpty {
                Text("Még nincs kapott értékelés.")
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(rows) { row in
                    HStack {
                        Text("\(row.score) / 10")
                            .font(.system(size: 18, weight: .bold))
                        Spacer()
                        Text(row.dateLabel)
                            .font(.system(size: 13))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
                .listStyle(.plain)
            }
        }
        .background(AppTheme.bg)
        .task { await load() }
    }

    private func load() async {
        loading = true
        errorText = nil
        defer { loading = false }
        do {
            rows = try await AccountAPI.fetchSellerRatings(token: auth.token)
        } catch {
            errorText = error.localizedDescription
        }
    }
}

// MARK: - Autóimport (web ha-imp-panel szöveg-1:1)

struct AutoImportScreen: View {
    @State private var mode: String = "standard"
    @State private var urlText = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Használtautó import")
                    .font(.system(size: 22, weight: .bold))

                VStack(alignment: .leading, spacing: 10) {
                    Text("1 Válaszd ki a profilod típusát")
                        .font(.system(size: 16, weight: .bold))
                    HStack(spacing: 8) {
                        modeBtn("Privát felhasználó", value: "standard")
                        modeBtn("Kereskedő", value: "dealer")
                    }
                }
                .padding(14)
                .background(Color(red: 0.973, green: 0.976, blue: 0.98))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 10) {
                    Text("2 Használtautó oldal megnyitása")
                        .font(.system(size: 16, weight: .bold))
                    Link(destination: URL(string: "https://www.hasznaltauto.hu")!) {
                        Label("hasznaltauto.hu megnyitása", systemImage: "arrow.up.right")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(AppTheme.brandYellow)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                .padding(14)
                .background(Color(red: 0.973, green: 0.976, blue: 0.98))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 10) {
                    Text("3 Import a böngészőből")
                        .font(.system(size: 16, weight: .bold))
                    Text("A teljes bookmarklet-folyamat a webes Fiók → Autóimport menüben érhető el (Safari / Chrome). Az appban illeszd be a hirdetés URL-jét, vagy használd a webes importot.")
                        .font(.system(size: 14))
                        .foregroundStyle(AppTheme.textSecondary)
                    TextField("https://www.hasznaltauto.hu/…", text: $urlText)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    if let url = URL(string: urlText), url.host != nil {
                        Link("URL megnyitása", destination: url)
                            .font(.system(size: 14, weight: .semibold))
                    }
                }
                .padding(14)
                .background(Color(red: 0.973, green: 0.976, blue: 0.98))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Text("A jelszavadat nem tároljuk — csak a megnyitott oldal adatait olvassuk ki.")
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.tabInactive)
            }
            .padding(16)
        }
        .background(AppTheme.bg)
    }

    private func modeBtn(_ title: String, value: String) -> some View {
        Button {
            mode = value
        } label: {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(mode == value ? .black : AppTheme.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(mode == value ? AppTheme.brandYellow : Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Partner / Cégadatok

struct PartnerProfileScreen: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Cégadatok")
                    .font(.system(size: 22, weight: .bold))
                Text("A teljes partneri profil szerkesztő a webes Fiók → Cégadatok menüben érhető el. Itt a nyilvános partneroldal mezőit (név, cím, nyitvatartás, logó) állíthatod.")
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)
                if let url = URL(string: "https://bymy.hu/beallitasok.html?szekcio=partner-profil") {
                    Link("Megnyitás a weben", destination: url)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(AppTheme.accent)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(AppTheme.bg)
    }
}

// MARK: - Személyes / jelszó / notify / körzet / megjelenés

struct PersonalDataScreen: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var street = ""
    @State private var postalCode = ""
    @State private var city = ""
    @State private var country = "Magyarország"
    @State private var phone = ""
    @State private var busy = false
    @State private var flash = ""
    @State private var flashOk = false

    var body: some View {
        Form {
            Section {
                HStack(spacing: 14) {
                    ProfileAvatarView(
                        letter: auth.avatarLetter,
                        dataURL: auth.user?.profile.avatarDataUrl,
                        size: 64
                    )
                    VStack(alignment: .leading, spacing: 4) {
                        Text(auth.user?.email ?? "")
                            .font(.system(size: 14, weight: .semibold))
                        Text("A fióktípus regisztrációkor rögzül.")
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
            }

            Section("Név") {
                TextField("Vezetéknév", text: $lastName)
                TextField("Keresztnév", text: $firstName)
            }
            Section("Cím") {
                TextField("Utca, házszám", text: $street)
                TextField("Irányítószám", text: $postalCode)
                    .keyboardType(.numberPad)
                TextField("Település", text: $city)
                TextField("Ország", text: $country)
            }
            Section("Elérhetőség") {
                TextField("Telefon", text: $phone)
                    .keyboardType(.phonePad)
            }

            if !flash.isEmpty {
                Section {
                    Text(flash).foregroundStyle(flashOk ? .green : .red)
                }
            }

            Section {
                Button {
                    Task { await save() }
                } label: {
                    if busy { ProgressView() } else { Text("Mentés").fontWeight(.semibold) }
                }
                .disabled(busy)
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        let p = auth.user?.profile
        firstName = p?.firstName ?? ""
        lastName = p?.lastName ?? ""
        street = p?.street ?? ""
        postalCode = p?.postalCode ?? ""
        city = p?.city ?? ""
        country = (p?.country?.isEmpty == false) ? (p?.country ?? "Magyarország") : "Magyarország"
        phone = p?.phone ?? ""
    }

    private func save() async {
        guard let token = auth.token else { return }
        busy = true
        flash = ""
        defer { busy = false }
        do {
            var profile = auth.user?.profile ?? AuthAPI.RemoteProfile()
            profile.firstName = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
            profile.lastName = lastName.trimmingCharacters(in: .whitespacesAndNewlines)
            profile.street = street.trimmingCharacters(in: .whitespacesAndNewlines)
            profile.postalCode = postalCode.trimmingCharacters(in: .whitespacesAndNewlines)
            profile.city = city.trimmingCharacters(in: .whitespacesAndNewlines)
            profile.country = country.trimmingCharacters(in: .whitespacesAndNewlines)
            profile.phone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
            let user = try await AuthAPI.saveProfile(token: token, profile: profile)
            auth.apply(token: token, user: user)
            flash = "Mentve."
            flashOk = true
        } catch {
            flash = error.localizedDescription
            flashOk = false
        }
    }
}

struct PasswordChangeScreen: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var current = ""
    @State private var newPass = ""
    @State private var confirm = ""
    @State private var busy = false
    @State private var flash = ""
    @State private var flashOk = false

    var body: some View {
        Form {
            Section {
                SecureField("Jelenlegi jelszó", text: $current)
                SecureField("Új jelszó", text: $newPass)
                SecureField("Új jelszó megerősítése", text: $confirm)
            }
            if !flash.isEmpty {
                Section { Text(flash).foregroundStyle(flashOk ? .green : .red) }
            }
            Section {
                Button {
                    Task { await save() }
                } label: {
                    if busy { ProgressView() } else { Text("Jelszó mentése").fontWeight(.semibold) }
                }
                .disabled(busy)
            }
        }
    }

    private func save() async {
        guard let token = auth.token else { return }
        busy = true
        flash = ""
        defer { busy = false }
        do {
            try await AuthAPI.changePassword(
                token: token,
                currentPassword: current,
                newPassword: newPass,
                newPasswordConfirm: confirm
            )
            current = ""
            newPass = ""
            confirm = ""
            flash = "Jelszó frissítve."
            flashOk = true
        } catch {
            flash = error.localizedDescription
            flashOk = false
        }
    }
}

struct NotifyPrefsScreen: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var messages = true
    @State private var favorites = true
    @State private var interests = true
    @State private var newsletter = true
    @State private var busy = false
    @State private var flash = ""

    var body: some View {
        Form {
            Section {
                Toggle("Üzenetek", isOn: $messages)
                Toggle("Kedvencek: árváltozás", isOn: $favorites)
                Toggle("Érdeklődések", isOn: $interests)
                Toggle("Hírlevél", isOn: $newsletter)
            }
            if !flash.isEmpty {
                Section { Text(flash).foregroundStyle(AppTheme.accent) }
            }
            Section {
                Button {
                    Task { await save() }
                } label: {
                    if busy { ProgressView() } else { Text("Mentés").fontWeight(.semibold) }
                }
                .disabled(busy)
            }
        }
        .onAppear {
            let p = auth.user?.profile
            messages = p?.notifyMessages ?? true
            favorites = p?.notifyFavorites ?? true
            interests = p?.notifyInterests ?? true
            newsletter = p?.notifyNewsletter ?? true
        }
    }

    private func save() async {
        guard let token = auth.token else { return }
        busy = true
        defer { busy = false }
        do {
            var profile = auth.user?.profile ?? AuthAPI.RemoteProfile()
            profile.notifyMessages = messages
            profile.notifyFavorites = favorites
            profile.notifyInterests = interests
            profile.notifyNewsletter = newsletter
            let user = try await AuthAPI.saveProfile(token: token, profile: profile)
            auth.apply(token: token, user: user)
            flash = "Mentve."
        } catch {
            flash = error.localizedDescription
        }
    }
}

struct RadiusSettingsScreen: View {
    enum Kind { case search, recommendations }

    let kind: Kind
    @EnvironmentObject private var auth: AuthStore

    @State private var postalCode = ""
    @State private var city = ""
    @State private var radiusKm = 30
    @State private var busy = false
    @State private var flash = ""

    private var options: [Int] {
        kind == .search ? [5, 10, 15, 20, 30, 50, 75, 100] : [5, 10, 15, 20, 30]
    }

    var body: some View {
        Form {
            Section("Helyszín") {
                TextField("Irányítószám", text: $postalCode)
                    .keyboardType(.numberPad)
                TextField("Település", text: $city)
            }
            Section("Sugár") {
                Picker("Km", selection: $radiusKm) {
                    ForEach(options, id: \.self) { km in
                        Text("\(km) km").tag(km)
                    }
                }
                .pickerStyle(.wheel)
                .frame(height: 120)
            }
            if !flash.isEmpty {
                Section { Text(flash).foregroundStyle(AppTheme.accent) }
            }
            Section {
                Button {
                    Task { await save() }
                } label: {
                    if busy { ProgressView() } else { Text("Mentés").fontWeight(.semibold) }
                }
                .disabled(busy)
            }
        }
        .onAppear {
            let p = auth.user?.profile
            postalCode = p?.postalCode ?? ""
            city = p?.city ?? ""
            if kind == .search {
                radiusKm = p?.searchRadiusKm ?? 30
            } else {
                radiusKm = min(p?.recommendationsRadiusKm ?? 30, 30)
            }
            if !options.contains(radiusKm) { radiusKm = 30 }
        }
    }

    private func save() async {
        guard let token = auth.token else { return }
        busy = true
        defer { busy = false }
        do {
            var profile = auth.user?.profile ?? AuthAPI.RemoteProfile()
            profile.postalCode = postalCode.trimmingCharacters(in: .whitespacesAndNewlines)
            profile.city = city.trimmingCharacters(in: .whitespacesAndNewlines)
            if kind == .search {
                profile.searchRadiusKm = radiusKm
            } else {
                profile.recommendationsRadiusKm = radiusKm
            }
            let user = try await AuthAPI.saveProfile(token: token, profile: profile)
            auth.apply(token: token, user: user)
            flash = "Mentve."
        } catch {
            flash = error.localizedDescription
        }
    }
}

struct AppearanceScreen: View {
    @AppStorage("bymy.textScale") private var textScale = 100
    @AppStorage("bymy.theme") private var theme = "light"

    var body: some View {
        Form {
            Section("Téma") {
                Picker("Megjelenés", selection: $theme) {
                    Text("Világos").tag("light")
                    Text("Sötét").tag("dark")
                    Text("Rendszer").tag("system")
                }
                .pickerStyle(.segmented)
            }
            Section("Szövegméret") {
                Picker("Méret", selection: $textScale) {
                    Text("100%").tag(100)
                    Text("110%").tag(110)
                    Text("120%").tag(120)
                    Text("130%").tag(130)
                    Text("140%").tag(140)
                    Text("150%").tag(150)
                }
            }
            Section {
                Text("A szövegméret a tartalomra vonatkozik; a felső menü változatlan marad (mint weben).")
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
    }
}
