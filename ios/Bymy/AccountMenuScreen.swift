import SwiftUI
import PhotosUI
import UIKit

/// Profilkép → teljes képernyős fiókmenü (bezárás után az előző oldalon marad).
struct AccountMenuScreen: View {
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var searchStore: SearchStore
    @EnvironmentObject private var pageLayout: PageLayoutStore
    @EnvironmentObject private var savedListings: SavedListingsStore

    var onClose: () -> Void
    /// Mentett keresés → főoldal kereső
    var onOpenSearch: (() -> Void)? = nil

    private enum Destination: Identifiable {
        case messages, savedSearches, favorites, myAds, settings, haImport, dealerImport, prints, reviews

        var id: String {
            switch self {
            case .messages: return "messages"
            case .savedSearches: return "saved"
            case .favorites: return "favorites"
            case .myAds: return "myAds"
            case .settings: return "settings"
            case .haImport: return "haImport"
            case .dealerImport: return "dealerImport"
            case .prints: return "prints"
            case .reviews: return "reviews"
            }
        }
    }

    @State private var destination: Destination?

    private let accentPurple = Color(red: 0.42, green: 0.28, blue: 0.72)

    var body: some View {
        Group {
            if let destination {
                destinationView(destination)
            } else {
                menuRoot
            }
        }
    }

    private var menuRoot: some View {
        VStack(spacing: 0) {
            ScreenHeader(title: "Fiók", subtitle: nil, onBack: onClose)

            ScrollView {
                VStack(spacing: 0) {
                    menuRow(icon: "bubble.left.and.bubble.right", title: "Üzenetek") {
                        destination = .messages
                    }
                    Divider().padding(.leading, 56)
                    menuRow(icon: "star", title: "Mentett kereséseim") {
                        destination = .savedSearches
                    }
                    Divider().padding(.leading, 56)
                    menuRow(icon: "heart", title: "Kedvencek") {
                        destination = .favorites
                    }
                    Divider().padding(.leading, 56)
                    menuRow(icon: "car.side", title: "Saját hirdetések") {
                        destination = .myAds
                    }
                    Divider().padding(.leading, 56)
                    menuRow(icon: "square.and.arrow.down", title: "Autóimport") {
                        destination = .haImport
                    }
                    Divider().padding(.leading, 56)
                    menuRow(icon: "gearshape", title: "Beállítások") {
                        destination = .settings
                    }
                    Divider().padding(.leading, 56)
                    menuRow(icon: "printer", title: "Nyomtatások") {
                        destination = .prints
                    }
                    Divider().padding(.leading, 56)
                    menuRow(icon: "star.bubble", title: "Értékelések") {
                        destination = .reviews
                    }
                }
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(AppTheme.border.opacity(0.85), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.06), radius: 10, x: 0, y: 3)
                .padding(16)

                VStack(spacing: 12) {
                    Text("Bejelentkezve mint \(displayName)")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Button {
                        Task {
                            await profile.logout()
                            onClose()
                        }
                    } label: {
                        Text("Kijelentkezés")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(accentPurple)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(accentPurple, lineWidth: 1.5)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
        .background(Color(red: 0.949, green: 0.957, blue: 0.969).ignoresSafeArea())
    }

    private var displayName: String {
        let name = profile.profile.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty { return name }
        let email = profile.profile.email.trimmingCharacters(in: .whitespacesAndNewlines)
        return email.isEmpty ? "—" : email
    }

    private func menuRow(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(AppTheme.text)
                    .frame(width: 28, alignment: .center)
                Text(title)
                    .font(.body)
                    .foregroundStyle(AppTheme.text)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.textTertiary)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func destinationView(_ dest: Destination) -> some View {
        switch dest {
        case .messages:
            MessagesScreen(onClose: { destination = nil })
        case .savedSearches:
            SavedSearchesScreen(
                onOpenSearch: {
                    destination = nil
                    onClose()
                    onOpenSearch?()
                },
                onBack: { destination = nil }
            )
        case .settings:
            SettingsScreen(onClose: { destination = nil })
                .environmentObject(profile)
                .environmentObject(pageLayout)
        case .haImport:
            HasznaltautoImportScreen(mode: .standard, onClose: { destination = nil })
        case .dealerImport:
            HasznaltautoImportScreen(mode: .dealer, onClose: { destination = nil })
        case .favorites:
            accountPlaceholder(title: "Kedvencek", message: "Itt jelennek meg a kedvenc hirdetéseid.")
        case .myAds:
            MyListingsScreen(onBack: { destination = nil })
                .environmentObject(profile)
        case .prints:
            accountPlaceholder(title: "Nyomtatások", message: "Nyomtatási előzmények és dokumentumok.")
        case .reviews:
            accountPlaceholder(title: "Értékelések", message: "Kapott és adott értékelések.")
        }
    }

    private func accountPlaceholder(title: String, message: String) -> some View {
        VStack(spacing: 0) {
            ScreenHeader(title: title, onBack: { destination = nil })
            VStack(spacing: 12) {
                Spacer()
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppTheme.bgGrouped)
        }
    }
}

/// Fiók → Hirdetéseim — a bejelentkezett user feladott hirdetései.
struct MyListingsScreen: View {
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var savedListings: SavedListingsStore
    var onBack: () -> Void

    @State private var listings: [ListingsAPI.HomeListing] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var openRequest: ListingOpenRequest?
    @State private var editTarget: MyListingEditTarget?
    @State private var deleteTarget: ListingsAPI.HomeListing?
    @State private var photoTarget: ListingsAPI.HomeListing?
    @State private var busyId: String?
    @State private var actionError: String?

    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(
                title: "Saját hirdetések",
                subtitle: subtitleText,
                onBack: onBack,
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
                        .padding(.horizontal, 24)
                    Button("Újra") { Task { await reload() } }
                        .font(.body.weight(.semibold))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if listings.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "car.side")
                        .font(.system(size: 36))
                        .foregroundStyle(AppTheme.textTertiary)
                    Text("Itt jelennek meg a feladott hirdetéseid.")
                        .font(.subheadline)
                        .foregroundStyle(AppTheme.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    Text("Adj fel hirdetést bejelentkezve — utána itt listázzuk.")
                        .font(.caption)
                        .foregroundStyle(AppTheme.textTertiary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AppTheme.bgGrouped)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(listings) { ad in
                            VStack(alignment: .leading, spacing: 10) {
                                ListingFeedCard(
                                    detail: ad.cardDetail,
                                    onOpen: { openRequest = .remote(id: ad.id) }
                                )
                                HStack(spacing: 10) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(ad.isActiveInSearch ? "Aktív" : "Inaktív")
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(ad.isActiveInSearch ? AppTheme.accent : AppTheme.textSecondary)
                                        Text(ad.isActiveInSearch
                                             ? "Megjelenik a keresőben"
                                             : "Nem látszik a keresőben")
                                            .font(.caption2)
                                            .foregroundStyle(AppTheme.textTertiary)
                                    }
                                    Spacer(minLength: 8)
                                    Toggle(
                                        "",
                                        isOn: Binding(
                                            get: { ad.isActiveInSearch },
                                            set: { newValue in
                                                Task { await setActive(ad, active: newValue) }
                                            }
                                        )
                                    )
                                    .labelsHidden()
                                    .tint(AppTheme.accent)
                                    .disabled(busyId != nil)
                                }
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)

                                Text("Web: \(ad.viewsWeb) · Mobilapp: \(ad.viewsApp)")
                                    .font(.caption)
                                    .foregroundStyle(AppTheme.textSecondary)
                                    .padding(.horizontal, 4)

                                HStack(spacing: 10) {
                                    Button {
                                        Task { await beginEdit(ad) }
                                    } label: {
                                        Text(busyId == ad.id ? "…" : "Módosítás")
                                            .font(.subheadline.weight(.semibold))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 10)
                                            .foregroundStyle(AppTheme.accent)
                                            .background(AppTheme.accent.opacity(0.12))
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(busyId != nil)

                                    Button {
                                        photoTarget = ad
                                    } label: {
                                        Text("Képkezelés")
                                            .font(.subheadline.weight(.semibold))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 10)
                                            .foregroundStyle(AppTheme.accent)
                                            .background(AppTheme.accent.opacity(0.12))
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(busyId != nil)

                                    Button {
                                        deleteTarget = ad
                                    } label: {
                                        Text("Törlés")
                                            .font(.subheadline.weight(.semibold))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 10)
                                            .foregroundStyle(Color.red.opacity(0.9))
                                            .background(Color.red.opacity(0.08))
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(busyId != nil)
                                }
                            }
                        }
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
        .fullScreenCover(item: $editTarget) { target in
            Group {
                switch target {
                case .car(let id):
                    PostAdCarScreen(
                        onClose: { editTarget = nil },
                        editingListingId: id,
                        onSaved: { Task { await reload() } }
                    )
                case .truck(let kind, let id):
                    PostAdTruckScreen(
                        kind: kind,
                        onClose: { editTarget = nil },
                        editingListingId: id,
                        onSaved: { Task { await reload() } }
                    )
                }
            }
            .environmentObject(profile)
        }
        .sheet(item: $photoTarget) { ad in
            MyListingPhotosSheet(
                listing: ad,
                token: profile.token,
                onClose: { photoTarget = nil },
                onSaved: {
                    photoTarget = nil
                    Task { await reload() }
                }
            )
        }
        .alert(
            "Hirdetés törlése",
            isPresented: Binding(
                get: { deleteTarget != nil },
                set: { if !$0 { deleteTarget = nil } }
            )
        ) {
            Button("Mégsem", role: .cancel) { deleteTarget = nil }
            Button("Törlés", role: .destructive) {
                if let ad = deleteTarget {
                    Task { await deleteListing(ad) }
                }
            }
        } message: {
            Text(deleteTarget.map { "Biztosan törlöd: \($0.title)?" } ?? "")
        }
        .alert(
            "Hiba",
            isPresented: Binding(
                get: { actionError != nil },
                set: { if !$0 { actionError = nil } }
            )
        ) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
    }

    private var subtitleText: String {
        if loading && listings.isEmpty { return "Autosweb…" }
        if errorText != nil, listings.isEmpty { return "Hiba" }
        if listings.isEmpty { return "Nincs hirdetés" }
        return "\(listings.count) hirdetés"
    }

    private func reload() async {
        loading = true
        errorText = nil
        defer { loading = false }
        do {
            listings = try await ListingsAPI.fetchMyListings(token: profile.token)
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    @MainActor
    private func beginEdit(_ ad: ListingsAPI.HomeListing) async {
        guard busyId == nil else { return }
        guard let id = Int(ad.id) else {
            actionError = "Érvénytelen hirdetés-azonosító."
            return
        }
        busyId = ad.id
        defer { busyId = nil }
        do {
            let form = try await ListingsAPI.fetchFormStrings(id: ad.id, token: profile.token)
            let kindRaw = (form["jarmu_kategoria"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if kindRaw == PostAdCatalog.TruckKind.kisteher.rawValue {
                editTarget = .truck(.kisteher, id)
            } else if kindRaw == PostAdCatalog.TruckKind.teherauto.rawValue {
                editTarget = .truck(.teherauto, id)
            } else {
                editTarget = .car(id)
            }
        } catch {
            actionError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    @MainActor
    private func setActive(_ ad: ListingsAPI.HomeListing, active: Bool) async {
        guard busyId == nil else { return }
        if ad.isActiveInSearch == active { return }
        busyId = ad.id
        defer { busyId = nil }
        do {
            let status = try await ListingsAPI.setListingActive(
                id: ad.id,
                active: active,
                token: profile.token
            )
            if let idx = listings.firstIndex(where: { $0.id == ad.id }) {
                listings[idx] = listings[idx].with(status: status)
            }
        } catch {
            actionError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    @MainActor
    private func deleteListing(_ ad: ListingsAPI.HomeListing) async {
        deleteTarget = nil
        guard busyId == nil else { return }
        busyId = ad.id
        defer { busyId = nil }
        do {
            try await ListingsAPI.deleteListing(id: ad.id, token: profile.token)
            listings.removeAll { $0.id == ad.id }
        } catch {
            actionError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

private enum MyListingEditTarget: Identifiable {
    case car(Int)
    case truck(PostAdCatalog.TruckKind, Int)

    var id: String {
        switch self {
        case .car(let id): return "car-\(id)"
        case .truck(let kind, let id): return "truck-\(kind.rawValue)-\(id)"
        }
    }
}

private struct MyListingPhotoDraft: Identifiable {
    let id: UUID
    var url: String?
    var jpegData: Data?
    var image: UIImage?

    init(url: URL) {
        id = UUID()
        self.url = url.absoluteString
    }

    init(image: UIImage, jpegData: Data) {
        id = UUID()
        self.image = image
        self.jpegData = jpegData
    }
}

private struct MyListingPhotosSheet: View {
    let listing: ListingsAPI.HomeListing
    let token: String?
    var onClose: () -> Void
    var onSaved: () -> Void

    @State private var items: [MyListingPhotoDraft]
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var saving = false
    @State private var errorText: String?

    init(
        listing: ListingsAPI.HomeListing,
        token: String?,
        onClose: @escaping () -> Void,
        onSaved: @escaping () -> Void
    ) {
        self.listing = listing
        self.token = token
        self.onClose = onClose
        self.onSaved = onSaved
        _items = State(initialValue: listing.imageURLs.map(MyListingPhotoDraft.init(url:)))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        HStack(spacing: 12) {
                            photoThumb(item)
                                .frame(width: 72, height: 54)
                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(index == 0 ? "Főkép" : "Kép \(index + 1)")
                                    .font(.subheadline.weight(.semibold))
                                HStack {
                                    Button("↑") { move(index, by: -1) }
                                        .disabled(index == 0)
                                    Button("↓") { move(index, by: 1) }
                                        .disabled(index == items.count - 1)
                                    Button("Törlés", role: .destructive) {
                                        items.remove(at: index)
                                    }
                                }
                                .font(.caption.weight(.semibold))
                            }
                        }
                    }
                }
                Section {
                    PhotosPicker(selection: $pickerItems, maxSelectionCount: 8, matching: .images) {
                        Text("Képek hozzáadása")
                    }
                }
            }
            .navigationTitle("Képkezelés")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Bezárás", action: onClose)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Mentés") { Task { await save() } }
                        .disabled(saving || items.isEmpty)
                }
            }
            .onChange(of: pickerItems) { _, newItems in
                Task { await addPicked(newItems) }
            }
            .alert("Hiba", isPresented: Binding(
                get: { errorText != nil },
                set: { if !$0 { errorText = nil } }
            )) {
                Button("OK", role: .cancel) { errorText = nil }
            } message: {
                Text(errorText ?? "")
            }
            .overlay {
                if saving {
                    ProgressView("Mentés…")
                        .padding()
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    @ViewBuilder
    private func photoThumb(_ item: MyListingPhotoDraft) -> some View {
        if let image = item.image {
            Image(uiImage: image).resizable().scaledToFill()
        } else if let raw = item.url, let url = URL(string: raw) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image): image.resizable().scaledToFill()
                default: Color.gray.opacity(0.2)
                }
            }
        } else {
            Color.gray.opacity(0.2)
        }
    }

    private func move(_ index: Int, by delta: Int) {
        let next = index + delta
        guard items.indices.contains(next) else { return }
        items.swapAt(index, next)
    }

    private func addPicked(_ picked: [PhotosPickerItem]) async {
        guard !picked.isEmpty else { return }
        pickerItems = []
        for item in picked {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data),
                  let prepared = try? PostAdPhotoStore.prepare(image)
            else { continue }
            items.append(MyListingPhotoDraft(image: prepared.image, jpegData: prepared.jpegData))
        }
    }

    private func save() async {
        guard !items.isEmpty else {
            errorText = "Legalább egy kép kell."
            return
        }
        saving = true
        defer { saving = false }
        do {
            let payload: [[String: String]] = items.compactMap { item in
                if let url = item.url, !url.isEmpty { return ["url": url] }
                if let data = item.jpegData {
                    return ["data": "data:image/jpeg;base64,\(data.base64EncodedString())"]
                }
                return nil
            }
            try await ListingsAPI.saveListingPhotos(id: listing.id, items: payload, token: token)
            onSaved()
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
