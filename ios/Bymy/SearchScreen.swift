import SwiftUI
import UIKit

struct SearchScreen: View {
    enum SearchRoot {
        case homeLanding
        case searchMenu
    }

    @EnvironmentObject private var store: SearchStore
    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var savedListings: SavedListingsStore
    /// Főoldal tab vs. Keresés tab (járműválasztó).
    var searchRoot: SearchRoot = .homeLanding
    /// Keresési körzet / irányítószám — Beállítások
    var onOpenSettings: (() -> Void)? = nil
    /// Profilkép → fiókmenü (a főoldalon a scrollban van, nem ragad fent).
    var onOpenAccount: (() -> Void)? = nil

    @State private var mode: Mode = .landing
    @State private var panel: Panel = .simple
    @State private var listPanel: Panel = .simple
    @State private var openAccordion: AccordionSection? = nil
    /// Részletes keresés accordionok ugyanazon az oldalon (nem új képernyő)
    @State private var showDetailedSearch = false
    @State private var brandQuery = ""
    @State private var toast: String?
    @State private var activeQuery: ListingQuery?
    @State private var messageTarget: ListingMessageTarget?
    @State private var messagesReturn: Mode = .landing
    @State private var truckSearchKind: PostAdCatalog.TruckKind? = nil
    @State private var openSearchTop: SearchTopSection? = .auto
    @State private var openSaved: ListingOpenRequest?
    /// Főoldal Ajánlások csempe → csak ez a kategória nyílik meg.
    @State private var recommendationsCategoryId: String? = nil

    private enum Mode {
        case landing, vehiclePick, search, truckSearch, settings, messages, results, filterResults, postAd, recommendations
    }

    private enum SearchTopSection: String {
        case auto, teher, ingatlan
    }

    private enum Panel {
        case simple, advanced, brand, model(String), fuel, price, year, km, allapot, kivitel
        case ajtok, szemelyek, okmanyok, hirdeto, hengerurtartalom
    }

    private enum AccordionSection: String {
        case alap, muszaki, extrak
    }

    private var menuRootMode: Mode {
        searchRoot == .searchMenu ? .vehiclePick : .landing
    }

    private func goRoot() {
        mode = menuRootMode
    }

    var body: some View {
        Group {
            switch mode {
            case .landing:
                searchLanding
            case .vehiclePick:
                searchVehiclePicker
            case .search:
                filterStack
            case .truckSearch:
                if let truckSearchKind {
                    SearchTruckScreen(
                        kind: truckSearchKind,
                        onBack: {
                            self.truckSearchKind = nil
                            mode = .vehiclePick
                        },
                        onResults: {
                            mode = .filterResults
                        }
                    )
                } else {
                    searchVehiclePicker
                }
            case .settings:
                SettingsScreen(onClose: {
                    if activeQuery != nil {
                        mode = .results
                    } else {
                        goRoot()
                    }
                })
            case .messages:
                if let messageTarget {
                    // Hirdetés → Üzenet: egyből a chat, nem az inbox
                    StartChatScreen(
                        target: messageTarget,
                        onClose: {
                            self.messageTarget = nil
                            mode = messagesReturn
                        }
                    )
                } else {
                    MessagesScreen(
                        onClose: {
                            mode = messagesReturn
                        }
                    )
                }
            case .results:
                if let query = activeQuery {
                    CategoryResultsScreen(
                        query: query,
                        onBack: {
                            activeQuery = nil
                            goRoot()
                        },
                        onOpenSettings: {
                            if let onOpenSettings {
                                onOpenSettings()
                            } else {
                                mode = .settings
                            }
                        }
                    )
                } else {
                    searchLanding
                }
            case .filterResults:
                FilterResultsScreen(
                    onBack: {
                        if truckSearchKind != nil {
                            mode = .truckSearch
                        } else {
                            mode = .search
                            panel = listPanel
                        }
                    }
                )
            case .postAd:
                PostAdScreen(onClose: { goRoot() })
            case .recommendations:
                RecommendationsScreen(
                    initialCategoryId: recommendationsCategoryId,
                    onClose: {
                        recommendationsCategoryId = nil
                        goRoot()
                    }
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        /// Főoldal TabView a státuszsáv alá nyúlik; listák / kereső ne menjen az óra mögé.
        .padding(.top, searchRoot == .homeLanding && mode != .landing ? statusBarHeight : 0)
        .fullScreenCover(item: $openSaved) { req in
            ListingDetailLoader(request: req, onClose: { openSaved = nil })
                .environmentObject(profile)
                .environmentObject(savedListings)
        }
        .onAppear {
            if searchRoot == .searchMenu, mode == .landing {
                mode = .vehiclePick
            }
        }
        .alert("Mentés", isPresented: Binding(
            get: { toast != nil },
            set: { if !$0 { toast = nil } }
        )) {
            Button("OK", role: .cancel) { toast = nil }
        } message: {
            Text(toast ?? "")
        }
    }

    /// Óra / Dynamic Island / térerő sáv magassága — a céges logo mögéjük kerül.
    private var statusBarHeight: CGFloat {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? scenes.flatMap(\.windows).first
        return window?.safeAreaInsets.top ?? 59
    }

    private enum HomeFeedSection: String, CaseIterable, Identifiable {
        case kiemelt, autokKozel, szolgaltatasok, ingatlanok
        case ajanlasok, elmentett, ajanlottVideok, kereseseid

        var id: String { rawValue }

        var title: String {
            switch self {
            case .kiemelt: return "Kiemelt hirdetések"
            case .autokKozel: return "Autók a közelben"
            case .szolgaltatasok: return "Szolgáltatások"
            case .ingatlanok: return "Ingatlanok"
            case .ajanlasok: return "Ajánlások"
            case .elmentett: return "Elmentett hirdetések"
            case .ajanlottVideok: return "Ajánlott videók"
            case .kereseseid: return "Kereséseid"
            }
        }
    }

    /// Főoldal: logo a státuszsáv / Dynamic Island alá csúszik (óra–kamera kitakarhat belőle).
    private var searchLanding: some View {
        let topInset = statusBarHeight
        return ScrollView {
            VStack(spacing: 0) {
                homeHeader

                VStack(alignment: .leading, spacing: 22) {
                    ForEach(HomeFeedSection.allCases) { section in
                        homeRail(section)
                    }
                }
                .padding(.top, 16)
                .padding(.bottom, 28)
            }
            .frame(maxWidth: .infinity, alignment: .top)
            /// ScrollView safe-area insetjét ellensúlyozza — nincs sáv az óra alatt, a logo felcsúszik.
            .padding(.top, -topInset)
        }
        .contentMargins(.top, 0, for: .scrollContent)
        .scrollContentBackground(.hidden)
        .background(Color.white.ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
    }

    /// Fejléc: logo az óra / Dynamic Island mögé nyúlik; alatta 1,5 cm, majd választóvonal.
    private var homeHeader: some View {
        /// BymyLogo.png 958×415 — arány megmarad.
        let logoHeight = UIScreen.main.bounds.width * (415.0 / 958.0)
        /// 1,5 cm → pont (160 pt / inch)
        let gapBelowLogo = 1.5 / 2.54 * 160.0
        return VStack(spacing: 0) {
            ZStack(alignment: .topTrailing) {
                Image("BymyLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity)
                    .frame(height: logoHeight)
                    .allowsHitTesting(false)
                    .accessibilityLabel("Bymy")

                Button {
                    onOpenAccount?()
                } label: {
                    ProfileAvatarView(
                        image: profile.avatarImage,
                        letter: profile.profile.avatarLetter,
                        size: 36
                    )
                    .frame(width: 36, height: 36)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
                    .shadow(color: .black.opacity(0.18), radius: 2, y: 1)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Fiók menü")
                /// Egyenesen lejjebb: a logo alatti üres sávba (nem a wordmarkra).
                .padding(.top, logoHeight + (gapBelowLogo - 36) / 2)
                .padding(.trailing, 12)
                .onAppear { profile.loadAvatarFromDisk() }
            }
            .frame(maxWidth: .infinity, alignment: .top)
            .frame(height: logoHeight + gapBelowLogo, alignment: .top)
            .background(Color.white)

            Rectangle().fill(AppTheme.border).frame(height: 1)
        }
        .background(Color.white)
    }

    private func homeRail(_ section: HomeFeedSection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(section.title)
                .font(.title3.weight(.bold))
                .foregroundStyle(AppTheme.text)
                .padding(.horizontal, 16)

            if section == .ajanlasok {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 16) {
                        ForEach(PartnerCategoryCatalog.items, id: \.id) { item in
                            homePhotoTile(title: item.label, imageName: item.imageName) {
                                recommendationsCategoryId = item.id
                                mode = .recommendations
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            } else if section == .elmentett {
                homeSavedRail
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        ForEach(QuickCategory.allCases) { category in
                            CategoryIconButton(category: category) {
                                openHomeRailItem(section, category: category)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
    }

    private var homeSavedRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                if savedListings.items.isEmpty {
                    ForEach(SavedListingKind.allCases, id: \.self) { kind in
                        homeEmptyTile(title: kind.label, systemImage: kind.placeholderSystemImage)
                    }
                } else {
                    ForEach(savedListings.items) { item in
                        homeSavedListingTile(item)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func homeSavedListingTile(_ item: SavedListingItem) -> some View {
        let size: CGFloat = 88
        let corner: CGFloat = 16
        return Button {
            openSaved = savedListings.openRequest(for: item)
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .fill(Color(red: 0.965, green: 0.969, blue: 0.976))
                    if let url = item.imageURL {
                        ListingRemoteImage(url: url)
                            .frame(width: size, height: size)
                            .clipped()
                    } else {
                        Image(systemName: item.kind.placeholderSystemImage)
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(AppTheme.textTertiary)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
                Text(item.title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.text)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .frame(width: size)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(item.kind.label): \(item.title)")
    }

    /// Fotószerű demókép a kategória kockában (Ajánlások) — ~20%-kal nagyobb és szélesebb.
    private func homePhotoTile(title: String, imageName: String, action: @escaping () -> Void) -> some View {
        let tileW: CGFloat = 127
        let tileH: CGFloat = 106
        let corner: CGFloat = 19
        return Button(action: action) {
            VStack(spacing: 8) {
                PartnerCategoryPhotoView(imageName: imageName, width: tileW, height: tileH, corner: corner)
                Text(title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(AppTheme.text)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .frame(width: tileW)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    /// Még nincs fotó: üres kocka, alatta a kategória neve.
    private func homeEmptyTile(title: String, systemImage: String? = nil, action: (() -> Void)? = nil) -> some View {
        let size: CGFloat = 88
        let corner: CGFloat = 16
        return Button {
            action?()
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .fill(Color(red: 0.965, green: 0.969, blue: 0.976))
                    if let systemImage {
                        Image(systemName: systemImage)
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(AppTheme.textTertiary)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.text)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .frame(width: size)
            }
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
        .accessibilityLabel(title)
    }

    private func openHomeRailItem(_ section: HomeFeedSection, category: QuickCategory) {
        switch section {
        case .kiemelt:
            openListing(.newListings)
        case .autokKozel:
            openListing(.nearby)
        default:
            openListing(.category(category))
        }
    }

    /// Keresés kezdő — ugyanaz a kártyás menü, mint a hirdetésfeladáson.
    private var searchVehiclePicker: some View {
        let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)
        let autoTint = AppTheme.accent
        let teherTint = Color(red: 0.85, green: 0.45, blue: 0.12)
        let ingatlanTint = Color(red: 0.18, green: 0.55, blue: 0.34)

        return VStack(spacing: 0) {
            ScreenHeader(
                title: "Keresés",
                subtitle: "Mit keresel?",
                onBack: searchRoot == .searchMenu ? nil : { mode = .landing }
            )
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    searchCategoryCard(
                        section: .auto,
                        title: "Autó keresés",
                        subtitle: "Személyautó és más",
                        photoAsset: QuickCategory.uj.imageName,
                        tint: autoTint
                    ) {
                        VStack(spacing: 0) {
                            ForEach(Array(PostAdCatalog.autoItems.enumerated()), id: \.element.id) { index, item in
                                if index > 0 { Divider().padding(.leading, 74) }
                                searchAutoItemRow(item, tint: autoTint)
                            }
                        }
                    }

                    searchCategoryCard(
                        section: .teher,
                        title: "Teherautó keresés",
                        subtitle: "Kisteher és teherautó",
                        photoAsset: AutoswebCategoryPhoto.assetName(forTeherItemId: "teher-kisteher"),
                        tint: teherTint
                    ) {
                        VStack(spacing: 0) {
                            ForEach(Array(PostAdCatalog.teherItems.enumerated()), id: \.element.id) { index, item in
                                if index > 0 { Divider().padding(.leading, 74) }
                                searchTeherItemRow(item, tint: teherTint)
                            }
                        }
                    }

                    searchCategoryCard(
                        section: .ingatlan,
                        title: "Ingatlan keresés",
                        subtitle: "Lakás, ház, telek",
                        systemImage: "house.fill",
                        tint: ingatlanTint
                    ) {
                        VStack(spacing: 0) {
                            searchSoonRow(title: "Eladó / Kiadó", tint: ingatlanTint)
                            Divider().padding(.leading, 74)
                            searchSoonRow(title: "Kategóriák", tint: ingatlanTint)
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 32)
            }
            .background(pageBg)
        }
        .background(pageBg.ignoresSafeArea())
    }

    private func searchCategoryCard<Content: View>(
        section: SearchTopSection,
        title: String,
        subtitle: String?,
        systemImage: String? = nil,
        photoAsset: String? = nil,
        tint: Color,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let isOpen = openSearchTop == section
        return VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    openSearchTop = isOpen ? nil : section
                }
            } label: {
                HStack(spacing: 14) {
                    if let photoAsset {
                        AutoswebCategoryPhotoView(
                            imageName: photoAsset,
                            size: AutoswebCategoryPhoto.headerSize
                        )
                    } else if let systemImage {
                        ZStack {
                            Circle()
                                .fill(tint)
                                .frame(width: AutoswebCategoryPhoto.headerSize, height: AutoswebCategoryPhoto.headerSize)
                            Image(systemName: systemImage)
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(AppTheme.text)
                        if let subtitle, !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.footnote)
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                    Spacer(minLength: 8)
                    Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(isOpen ? tint : AppTheme.textTertiary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isOpen {
                Divider().padding(.leading, 74)
                content()
                    .padding(.bottom, 6)
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppTheme.border.opacity(0.85), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private func searchAutoItemRow(_ item: PostAdCatalog.Item, tint: Color) -> some View {
        let available = item.id == "auto-szemelyauto"
        return Button {
            if available {
                store.reset()
                store.setVehicleKind(nil)
                listPanel = .simple
                panel = .simple
                mode = .search
            } else {
                toast = "\(item.title) keresés — hamarosan."
            }
        } label: {
            HStack(spacing: 12) {
                if available {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(tint)
                        .frame(width: 3, height: 28)
                } else {
                    Color.clear.frame(width: 3, height: 28)
                }
                AutoswebCategoryPhotoView(
                    imageName: AutoswebCategoryPhoto.assetName(forAutoItemId: item.id),
                    size: AutoswebCategoryPhoto.rowSize,
                    dimmed: !available
                )
                .frame(width: AutoswebCategoryPhoto.rowSize, alignment: .center)
                Text(item.title)
                    .font(.body)
                    .foregroundStyle(available ? tint : AppTheme.text)
                    .fontWeight(available ? .semibold : .regular)
                Spacer(minLength: 8)
                if !available {
                    Text("Hamarosan")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(AppTheme.border.opacity(0.65))
                        .clipShape(Capsule())
                }
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(available ? tint : AppTheme.textTertiary)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .background(available ? tint.opacity(0.06) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func searchTeherItemRow(_ item: PostAdCatalog.Item, tint: Color) -> some View {
        Button {
            if let kind = PostAdCatalog.TruckKind.fromCatalogId(item.id) {
                store.reset()
                store.setVehicleKind(kind.rawValue)
                truckSearchKind = kind
                mode = .truckSearch
            }
        } label: {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(tint)
                    .frame(width: 3, height: 28)
                AutoswebCategoryPhotoView(
                    imageName: AutoswebCategoryPhoto.assetName(forTeherItemId: item.id),
                    size: AutoswebCategoryPhoto.rowSize
                )
                .frame(width: AutoswebCategoryPhoto.rowSize, alignment: .center)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(tint)
                    Text(item.id == "teher-kisteher" ? "Max. 3,5 tonna" : "3,5 tonnától")
                        .font(.caption)
                        .foregroundStyle(AppTheme.textSecondary)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(tint)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 56)
            .background(tint.opacity(0.06))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func searchSoonRow(title: String, tint: Color) -> some View {
        Button {
            toast = "\(title) keresés — hamarosan."
        } label: {
            HStack(spacing: 12) {
                Color.clear.frame(width: 3, height: 28)
                Image(systemName: "house")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(width: 28, alignment: .center)
                Text(title)
                    .font(.body)
                    .foregroundStyle(AppTheme.text)
                Spacer(minLength: 8)
                Text("Hamarosan")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(AppTheme.border.opacity(0.65))
                    .clipShape(Capsule())
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

    private var filterStack: some View {
        VStack(spacing: 0) {
            switch panel {
            case .simple:
                simpleHeader
                simpleList
            case .advanced:
                advancedHeader
                advancedList
            case .brand:
                ScreenHeader(title: "Márka", onBack: goList, rightLabel: "Kész", onRight: goList)
                brandSearchField
                brandList
            case .model(let brand):
                ScreenHeader(
                    title: brand,
                    subtitle: "Típus — több is bekapcsolható",
                    onBack: { panel = .brand },
                    rightLabel: "Kész",
                    onRight: { panel = .brand }
                )
                modelList(for: brand)
            case .fuel:
                ScreenHeader(title: "Üzemanyag", onBack: goList, rightLabel: "Kész", onRight: goList)
                fuelList
            case .price:
                ScreenHeader(title: "Vételár", onBack: goList, rightLabel: "Kész", onRight: goList)
                priceWheels
            case .year:
                ScreenHeader(title: "Évjárat", onBack: goList, rightLabel: "Kész", onRight: goList)
                yearWheels
            case .km:
                ScreenHeader(title: "Futott km", onBack: goList, rightLabel: "Kész", onRight: goList)
                kmWheels
            case .allapot:
                ScreenHeader(title: "Állapot", onBack: goList, rightLabel: "Kész", onRight: goList)
                allapotList
            case .kivitel:
                ScreenHeader(title: "Kivitel", onBack: goList, rightLabel: "Kész", onRight: goList)
                singleSelectList(
                    options: DetailedSearchCatalog.kiviteles,
                    keyPath: \.kiviteles
                )
            case .ajtok:
                ScreenHeader(title: "Ajtók száma", onBack: goList, rightLabel: "Kész", onRight: goList)
                singleSelectList(
                    options: DetailedSearchCatalog.ajtok,
                    keyPath: \.ajtok
                )
            case .szemelyek:
                ScreenHeader(title: "Szállítható személyek", onBack: goList, rightLabel: "Kész", onRight: goList)
                singleSelectList(
                    options: DetailedSearchCatalog.szemelyek,
                    keyPath: \.szemelyek
                )
            case .okmanyok:
                ScreenHeader(title: "Okmányok", onBack: goList, rightLabel: "Kész", onRight: goList)
                singleSelectList(
                    options: DetailedSearchCatalog.okmanyok,
                    keyPath: \.okmanyErvenyesseg
                )
            case .hirdeto:
                ScreenHeader(title: "Hirdető", onBack: goList, rightLabel: "Kész", onRight: goList)
                singleSelectList(
                    options: DetailedSearchCatalog.hirdetok,
                    keyPath: \.hirdetok
                )
            case .hengerurtartalom:
                ScreenHeader(title: "Hengerűrtartalom", onBack: goList, rightLabel: "Kész", onRight: goList)
                hengerurtartalomWheels
            }
        }
        .background(AppTheme.bgGrouped)
    }

    private var simpleHeader: some View {
        ScreenHeader(
            title: "Keresés",
            onBack: {
                panel = .simple
                listPanel = .simple
                mode = menuRootMode
            },
            rightLabel: "Törlés",
            onRight: store.reset
        )
    }

    private var advancedHeader: some View {
        ScreenHeader(
            title: "Részletes keresés",
            onBack: {
                listPanel = .simple
                panel = .simple
            },
            rightLabel: "Törlés",
            onRight: store.reset
        )
    }

    /// Gyorskeresés (5 mező) VAGY részletes (Alap=10 mező + Műszaki + Extrák + Kevesebb mutatása).
    private var simpleList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if showDetailedSearch {
                    VStack(alignment: .leading, spacing: 12) {
                        accordionBlock(
                            section: .alap,
                            title: "Alap adatok",
                            summary: alapSummary
                        ) {
                            alapAccordionBody
                        }

                        accordionBlock(
                            section: .muszaki,
                            title: "Műszaki adatok",
                            summary: muszakiSummary
                        ) {
                            muszakiAccordionBody
                        }

                        accordionBlock(
                            section: .extrak,
                            title: "Extrák",
                            summary: extrasValue
                        ) {
                            extrakAccordionBody
                        }

                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showDetailedSearch = false
                                openAccordion = nil
                            }
                        } label: {
                            Text("Kevesebb mutatása")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(AppTheme.accent)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16)
                                .frame(minHeight: 52)
                                .background(AppTheme.bgElevated)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    SettingsGroup {
                        quickSearchRows
                    }

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showDetailedSearch = true
                            openAccordion = .alap
                        }
                    } label: {
                        HStack {
                            Text("Részletes keresés")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(AppTheme.accent)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(AppTheme.textTertiary)
                        }
                        .padding(.horizontal, 16)
                        .frame(minHeight: 52)
                        .background(AppTheme.bgElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                activeFilterCard
                searchResultsButton
                saveButton
            }
            .padding(16)
        }
    }

    /// Gyorskeresés mezői (részletes Alap adatok tetején is).
    @ViewBuilder
    private var quickSearchRows: some View {
        SettingsRow(title: "Gyártmány / Típus", value: brandModelRootValue) {
            openSubpanel(.brand)
        }
        Divider().padding(.leading, 16)
        SettingsRow(title: "Évjárat", value: yearValue) {
            openSubpanel(.year)
        }
        Divider().padding(.leading, 16)
        SettingsRow(title: "Futott km", value: kmValue) {
            openSubpanel(.km)
        }
        Divider().padding(.leading, 16)
        SettingsRow(title: "Vételár", value: priceValue) {
            openSubpanel(.price)
        }
        Divider().padding(.leading, 16)
        SettingsRow(title: "Üzemanyag", value: store.filter.fuelLabel) {
            openSubpanel(.fuel)
        }
    }

    /// Részletes: Alap / Műszaki / Extrák — egyszerre egy accordion nyitva
    private var advancedList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                accordionBlock(
                    section: .alap,
                    title: "Alap adatok",
                    summary: alapSummary
                ) {
                    alapAccordionBody
                }

                accordionBlock(
                    section: .muszaki,
                    title: "Műszaki adatok",
                    summary: muszakiSummary
                ) {
                    muszakiAccordionBody
                }

                accordionBlock(
                    section: .extrak,
                    title: "Extrák",
                    summary: extrasValue
                ) {
                    extrakAccordionBody
                }

                activeFilterCard
                searchResultsButton
                saveButton
            }
            .padding(16)
        }
    }

    private func accordionBlock<Content: View>(
        section: AccordionSection,
        title: String,
        summary: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let isOpen = openAccordion == section
        return VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    openAccordion = isOpen ? nil : section
                }
            } label: {
                HStack {
                    Text(title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(AppTheme.text)
                    Spacer()
                    if !isOpen, summary != "Mindegy", !summary.isEmpty {
                        Text(summary)
                            .font(.footnote)
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineLimit(1)
                    }
                    Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                }
                .padding(.horizontal, 16)
                .frame(minHeight: 52)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isOpen {
                Divider().padding(.leading, 16)
                content()
                    .padding(.bottom, 8)
            }
        }
        .background(AppTheme.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    /// Részletes Alap adatok: gyors 5 mező + Hengerűrtartalom + Állapot / …
    private var alapAccordionBody: some View {
        VStack(spacing: 0) {
            quickSearchRows
            Divider().padding(.leading, 16)
            SettingsRow(title: "Hengerűrtartalom", value: hengerurtartalomValue) {
                openSubpanel(.hengerurtartalom)
            }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Állapot", value: allapotValue) {
                openSubpanel(.allapot)
            }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Kivitel", value: kivitelValue) {
                openSubpanel(.kivitel)
            }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Ajtók száma", value: ajtokValue) {
                openSubpanel(.ajtok)
            }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Szállítható személyek", value: szemelyekValue) {
                openSubpanel(.szemelyek)
            }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Okmányok", value: okmanyokValue) {
                openSubpanel(.okmanyok)
            }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Hirdető", value: hirdetoValue) {
                openSubpanel(.hirdeto)
            }
        }
    }

    /// Üzemanyag fent már megvan — itt csak a többi műszaki szűrő.
    private var muszakiAccordionBody: some View {
        VStack(spacing: 0) {
            multiToggleGroup(
                title: "Sebességváltó",
                options: DetailedSearchCatalog.sebessegvaltok,
                keyPath: \.sebessegvaltok
            )
            Divider().padding(.leading, 16)
            Toggle("Felező váltó", isOn: Binding(
                get: { store.filter.felezoValto },
                set: { store.setFelezoValto($0) }
            ))
            .tint(Color.green)
            .padding(.horizontal, 16)
            .frame(minHeight: 48)
            Divider().padding(.leading, 16)
            multiToggleGroup(
                title: "Hajtás",
                options: DetailedSearchCatalog.hajtasok,
                keyPath: \.hajtasok
            )
            Divider().padding(.leading, 16)
            multiToggleGroup(
                title: "Szín",
                options: DetailedSearchCatalog.szinek,
                keyPath: \.szinek
            )
            Divider().padding(.leading, 16)
            Toggle("Metál fényezés", isOn: Binding(
                get: { store.filter.metalfeny },
                set: { store.setMetalfeny($0) }
            ))
            .tint(Color.green)
            .padding(.horizontal, 16)
            .frame(minHeight: 48)
            Divider().padding(.leading, 16)
            multiToggleGroup(
                title: "Töltőcsatlakozó",
                options: DetailedSearchCatalog.toltoCsatlakozok,
                keyPath: \.toltoCsatlakozok
            )
        }
    }

    private var extrakAccordionBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "Klíma")
                .padding(.horizontal, 16)
                .padding(.top, 8)
            ForEach(DetailedSearchCatalog.klimaOptions, id: \.self) { option in
                Toggle(option, isOn: Binding(
                    get: { store.filter.klima == option },
                    set: { on in store.setKlima(on ? option : nil) }
                ))
                .tint(Color.green)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
            }

            Divider().padding(.leading, 16)

            Toggle("Nem dohányzó autó", isOn: Binding(
                get: { store.filter.nemDohanyzo },
                set: { store.setNemDohanyzo($0) }
            ))
            .tint(Color.green)
            .padding(.horizontal, 16)
            .frame(minHeight: 48)

            Toggle("Hölgy tulajdonostól", isOn: Binding(
                get: { store.filter.holgyTulajdonos },
                set: { store.setHolgyTulajdonos($0) }
            ))
            .tint(Color.green)
            .padding(.horizontal, 16)
            .frame(minHeight: 48)

            ForEach(DetailedSearchCatalog.equipmentSections, id: \.id) { section in
                Divider().padding(.leading, 16)
                SectionLabel(text: section.title)
                    .padding(.horizontal, 16)
                    .padding(.top, 6)
                ForEach(section.items, id: \.self) { item in
                    Toggle(item, isOn: Binding(
                        get: { store.isExtraOn(item) },
                        set: { store.setExtra(item, on: $0) }
                    ))
                    .tint(Color.green)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 44)
                }
            }
        }
    }

    private func multiToggleGroup(
        title: String,
        options: [String],
        keyPath: WritableKeyPath<SearchFilter, [String]>
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .padding(.horizontal, 16)
                .padding(.top, 10)
            ForEach(options, id: \.self) { option in
                Toggle(option, isOn: Binding(
                    get: { store.isMultiOn(keyPath, value: option) },
                    set: { store.toggleMulti(keyPath, value: option, on: $0) }
                ))
                .tint(Color.green)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
            }
        }
    }

    private var alapSummary: String {
        var n = 0
        if !store.filter.gyartmanyok.isEmpty { n += 1 }
        if store.filter.evTol != nil || store.filter.evIg != nil { n += 1 }
        if store.filter.kmTol != nil || store.filter.kmIg != nil { n += 1 }
        if store.filter.arTol != nil || store.filter.arIg != nil { n += 1 }
        if !store.filter.fuels.isEmpty { n += 1 }
        if store.filter.hengerCm3Tol != nil || store.filter.hengerCm3Ig != nil { n += 1 }
        n += store.filter.allapotok.isEmpty ? 0 : 1
        n += store.filter.kiviteles.isEmpty ? 0 : 1
        n += store.filter.ajtok.isEmpty ? 0 : 1
        n += store.filter.szemelyek.isEmpty ? 0 : 1
        n += store.filter.okmanyErvenyesseg.isEmpty ? 0 : 1
        n += store.filter.hirdetok.isEmpty ? 0 : 1
        return n == 0 ? "Mindegy" : "\(n) feltétel"
    }

    private var muszakiSummary: String {
        var n = 0
        n += store.filter.sebessegvaltok.isEmpty ? 0 : 1
        if store.filter.felezoValto { n += 1 }
        n += store.filter.hajtasok.isEmpty ? 0 : 1
        n += store.filter.szinek.isEmpty ? 0 : 1
        if store.filter.metalfeny { n += 1 }
        n += store.filter.toltoCsatlakozok.isEmpty ? 0 : 1
        return n == 0 ? "Mindegy" : "\(n) feltétel"
    }

    private var activeFilterCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("AKTÍV SZŰRŐ")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
            Text(store.filter.summary)
                .font(.body)
                .foregroundStyle(AppTheme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(AppTheme.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var hitCount: Int {
        DemoListing.filtered(for: store.filter).count
    }

    private var searchResultsButton: some View {
        Button {
            mode = .filterResults
        } label: {
            Text("Keresés · \(hitCount)+ találat")
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .foregroundStyle(.white)
                .background(AppTheme.accent)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var saveButton: some View {
        Button {
            if let saved = store.saveCurrent() {
                toast = "Ikon a 4. oldalon: \(saved.icon) \(saved.name)"
            } else {
                toast = "Előbb állíts be legalább egy feltételt."
            }
        } label: {
            Text("Mentés")
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .foregroundStyle(.white)
                .background(AppTheme.accent)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private func dismissKeyboard() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
    }

    private func openSubpanel(_ next: Panel) {
        dismissKeyboard()
        panel = next
    }

    private func goList() {
        dismissKeyboard()
        brandQuery = ""
        panel = listPanel
    }

    private var brandSearchField: some View {
        TextField("Keresés…", text: $brandQuery)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(12)
            .background(AppTheme.bgElevated)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
    }

    private var filteredBrands: [String] {
        let q = brandQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return Catalog.brandNames }
        return Catalog.brandNames.filter { $0.lowercased().contains(q) }
    }

    private var brandList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: "Kapcsolók — több márka is")
                Button {
                    store.clearBrands()
                } label: {
                    Text("Összes kikapcsolása")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AppTheme.accent)
                        .padding(.leading, 4)
                }
                .buttonStyle(.plain)

                SettingsGroup {
                    ForEach(Array(filteredBrands.enumerated()), id: \.element) { index, brand in
                        if index > 0 { Divider().padding(.leading, 16) }
                        Toggle(brand, isOn: Binding(
                            get: { store.isBrandOn(brand) },
                            set: { store.setBrand(brand, on: $0) }
                        ))
                        .tint(Color.green)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 52)

                        if store.isBrandOn(brand) {
                            Divider().padding(.leading, 32)
                            SettingsRow(
                                title: "\(brand) típus választása",
                                value: store.modelLabel(for: brand)
                            ) {
                                panel = .model(brand)
                            }
                            .padding(.leading, 16)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private var allapotList: some View {
        singleSelectList(
            options: DetailedSearchCatalog.allapotok,
            keyPath: \.allapotok
        )
    }

    /// Egy választás: állapot, kivitel, ajtók, személyek, okmányok, hirdető.
    private func singleSelectList(
        options: [String],
        keyPath: WritableKeyPath<SearchFilter, [String]>
    ) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: "Csak egy választható")
                if !store.filter[keyPath: keyPath].isEmpty {
                    Button {
                        store.clearMulti(keyPath)
                    } label: {
                        Text("Kiválasztás törlése")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(AppTheme.accent)
                            .padding(.leading, 4)
                    }
                    .buttonStyle(.plain)
                }

                SettingsGroup {
                    ForEach(Array(options.enumerated()), id: \.element) { index, option in
                        if index > 0 { Divider().padding(.leading, 16) }
                        Toggle(option, isOn: Binding(
                            get: { store.isMultiOn(keyPath, value: option) },
                            set: { on in
                                if on {
                                    store.clearMulti(keyPath)
                                    store.toggleMulti(keyPath, value: option, on: true)
                                } else {
                                    store.toggleMulti(keyPath, value: option, on: false)
                                }
                            }
                        ))
                        .tint(Color.green)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 52)
                    }
                }
            }
            .padding(16)
        }
        .onAppear { dismissKeyboard() }
    }

    private func modelList(for brand: String) -> some View {
        let models = Catalog.brands[brand] ?? []
        return ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: "Kapcsolók — több típus is")
                Button {
                    store.clearModels(for: brand)
                } label: {
                    Text("Összes kikapcsolása")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AppTheme.accent)
                        .padding(.leading, 4)
                }
                .buttonStyle(.plain)

                if models.isEmpty {
                    Text("Nincs típus ehhez a gyártmányhoz.")
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.top, 24)
                        .frame(maxWidth: .infinity)
                } else {
                    SettingsGroup {
                        ForEach(Array(models.enumerated()), id: \.element) { index, model in
                            if index > 0 { Divider().padding(.leading, 16) }
                            Toggle(model, isOn: Binding(
                                get: { store.isModelOn(model) },
                                set: { store.setModel(model, on: $0) }
                            ))
                            .tint(Color.green)
                            .padding(.horizontal, 16)
                            .frame(minHeight: 52)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private var brandModelRootValue: String {
        let brands = store.filter.gyartmanyok
        let models = store.filter.modellek
        if brands.isEmpty { return "Mindegy" }
        if models.isEmpty { return store.filter.brandLabel }
        return "\(store.filter.brandLabel) · \(store.filter.modelLabel)"
    }

    private var allapotValue: String {
        let list = store.filter.allapotok
        if list.isEmpty { return "Mindegy" }
        if list.count == 1 { return list[0] }
        if list.count <= 3 { return list.joined(separator: ", ") }
        return "\(list.count) állapot"
    }

    private var kivitelValue: String {
        multiSelectValue(store.filter.kiviteles, singular: "kivitel")
    }

    private var ajtokValue: String {
        multiSelectValue(store.filter.ajtok, singular: "ajtószám")
    }

    private var szemelyekValue: String {
        multiSelectValue(store.filter.szemelyek, singular: "létszám")
    }

    private var okmanyokValue: String {
        multiSelectValue(store.filter.okmanyErvenyesseg, singular: "okmány")
    }

    private var hirdetoValue: String {
        multiSelectValue(store.filter.hirdetok, singular: "hirdető")
    }

    private func multiSelectValue(_ list: [String], singular: String) -> String {
        if list.isEmpty { return "Mindegy" }
        if list.count == 1 { return list[0] }
        if list.count <= 3 { return list.joined(separator: ", ") }
        return "\(list.count) \(singular)"
    }

    private var fuelList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: "Kapcsolók — több is")
                Button {
                    store.clearFuels()
                } label: {
                    Text("Összes kikapcsolása")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AppTheme.accent)
                        .padding(.leading, 4)
                }
                .buttonStyle(.plain)

                SettingsGroup {
                    ForEach(Array(FuelType.allCases.enumerated()), id: \.element.id) { index, fuel in
                        if index > 0 { Divider().padding(.leading, 16) }
                        Toggle(fuel.label, isOn: Binding(
                            get: { store.isFuelOn(fuel) },
                            set: { store.setFuel(fuel, on: $0) }
                        ))
                        .tint(Color.green)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 52)
                    }
                }
            }
            .padding(16)
        }
    }

    /// Minimum + Maximum — mindkettő görgethető lista, 500 000 Ft lépésköz.
    private var priceWheels: some View {
        VStack(spacing: 0) {
            Text("Lépésköz: 500 000 Ft")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 8)

            HStack(alignment: .top, spacing: 0) {
                priceWheelColumn(
                    title: "Minimum",
                    selection: Binding(
                        get: { store.filter.arTol ?? -1 },
                        set: { store.setPriceMin($0 < 0 ? nil : $0) }
                    )
                )
                Divider()
                priceWheelColumn(
                    title: "Maximum",
                    selection: Binding(
                        get: { store.filter.arIg ?? -1 },
                        set: { store.setPriceMax($0 < 0 ? nil : $0) }
                    )
                )
            }
            .frame(maxHeight: .infinity)

            Button {
                store.setPrice(tol: nil, ig: nil)
            } label: {
                Text("Vételár szűrő törlése")
                    .font(.body.weight(.medium))
                    .foregroundStyle(AppTheme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(AppTheme.bgGrouped)
    }

    private func priceWheelColumn(title: String, selection: Binding<Int>) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.text)
                .padding(.top, 8)
            Picker(title, selection: selection) {
                Text("Mindegy").tag(-1)
                ForEach(Catalog.priceSteps, id: \.self) { value in
                    Text(Catalog.priceStepLabel(value)).tag(value)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
        }
        .frame(maxWidth: .infinity)
    }

    private var yearWheels: some View {
        VStack(spacing: 0) {
            Text("Évjárat — tól / ig")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 8)

            HStack(alignment: .top, spacing: 0) {
                yearWheelColumn(
                    title: "Tól",
                    selection: Binding(
                        get: { store.filter.evTol ?? -1 },
                        set: { store.setYearMin($0 < 0 ? nil : $0) }
                    )
                )
                Divider()
                yearWheelColumn(
                    title: "Ig",
                    selection: Binding(
                        get: { store.filter.evIg ?? -1 },
                        set: { store.setYearMax($0 < 0 ? nil : $0) }
                    )
                )
            }
            .frame(maxHeight: .infinity)

            Button {
                store.setYear(tol: nil, ig: nil)
            } label: {
                Text("Évjárat szűrő törlése")
                    .font(.body.weight(.medium))
                    .foregroundStyle(AppTheme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(AppTheme.bgGrouped)
    }

    /// Mint az évjárat: Minimum / Maximum görgető, cm³ — megadott lépéslista.
    private var hengerurtartalomWheels: some View {
        VStack(spacing: 0) {
            Text("Hengerűrtartalom — cm³")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 8)

            HStack(alignment: .top, spacing: 0) {
                hengerWheelColumn(
                    title: "Minimum",
                    steps: Catalog.hengerCm3MinSteps,
                    selection: Binding(
                        get: { store.filter.hengerCm3Tol ?? -1 },
                        set: { store.setHengerCm3Min($0 < 0 ? nil : $0) }
                    )
                )
                Divider()
                hengerWheelColumn(
                    title: "Maximum",
                    steps: Catalog.hengerCm3MaxSteps,
                    selection: Binding(
                        get: { store.filter.hengerCm3Ig ?? -1 },
                        set: { store.setHengerCm3Max($0 < 0 ? nil : $0) }
                    )
                )
            }
            .frame(maxHeight: .infinity)

            Button {
                store.setHengerCm3(tol: nil, ig: nil)
            } label: {
                Text("Hengerűrtartalom szűrő törlése")
                    .font(.body.weight(.medium))
                    .foregroundStyle(AppTheme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(AppTheme.bgGrouped)
    }

    private func hengerWheelColumn(title: String, steps: [Int], selection: Binding<Int>) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.text)
                .padding(.top, 8)
            Picker(title, selection: selection) {
                Text("Mindegy").tag(-1)
                ForEach(steps, id: \.self) { value in
                    Text(Catalog.hengerCm3StepLabel(value)).tag(value)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
        }
        .frame(maxWidth: .infinity)
    }

    private func yearWheelColumn(title: String, selection: Binding<Int>) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.text)
                .padding(.top, 8)
            Picker(title, selection: selection) {
                Text("Mindegy").tag(-1)
                ForEach(Catalog.yearSteps, id: \.self) { year in
                    Text(String(year)).tag(year)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
        }
        .frame(maxWidth: .infinity)
    }

    private var kmWheels: some View {
        VStack(spacing: 0) {
            Text("Lépésköz: 10 000 km")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 8)

            HStack(alignment: .top, spacing: 0) {
                kmWheelColumn(
                    title: "Tól",
                    selection: Binding(
                        get: { store.filter.kmTol ?? -1 },
                        set: { store.setKmMin($0 < 0 ? nil : $0) }
                    )
                )
                Divider()
                kmWheelColumn(
                    title: "Ig",
                    selection: Binding(
                        get: { store.filter.kmIg ?? -1 },
                        set: { store.setKmMax($0 < 0 ? nil : $0) }
                    )
                )
            }
            .frame(maxHeight: .infinity)

            Button {
                store.setKm(tol: nil, ig: nil)
            } label: {
                Text("Km szűrő törlése")
                    .font(.body.weight(.medium))
                    .foregroundStyle(AppTheme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(AppTheme.bgGrouped)
    }

    private func kmWheelColumn(title: String, selection: Binding<Int>) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.text)
                .padding(.top, 8)
            Picker(title, selection: selection) {
                Text("Mindegy").tag(-1)
                ForEach(Catalog.kmSteps, id: \.self) { value in
                    Text(Catalog.kmStepLabel(value)).tag(value)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
        }
        .frame(maxWidth: .infinity)
    }

    private func openListing(_ query: ListingQuery) {
        store.applyListingQuery(query)
        activeQuery = query
        mode = .results
    }

    private func openMessages(from returnMode: Mode, target: ListingMessageTarget?) {
        messagesReturn = returnMode
        messageTarget = target
        mode = .messages
    }

    private var priceValue: String {
        if store.filter.arTol == nil && store.filter.arIg == nil { return "Mindegy" }
        if let tol = store.filter.arTol, let ig = store.filter.arIg {
            return "\(SearchFilter.formatPrice(tol)) – \(SearchFilter.formatPrice(ig))"
        }
        if let ig = store.filter.arIg { return "– \(SearchFilter.formatPrice(ig))" }
        return "\(SearchFilter.formatPrice(store.filter.arTol!)) –"
    }

    private var yearValue: String {
        if store.filter.evTol == nil && store.filter.evIg == nil { return "Mindegy" }
        if let tol = store.filter.evTol, let ig = store.filter.evIg { return "\(tol) – \(ig)" }
        if let tol = store.filter.evTol { return "\(tol) –" }
        return "– \(store.filter.evIg!)"
    }

    private var kmValue: String {
        if store.filter.kmTol == nil && store.filter.kmIg == nil { return "Mindegy" }
        if let ig = store.filter.kmIg, store.filter.kmTol == nil {
            return "– \(ig.formatted()) km"
        }
        if let tol = store.filter.kmTol, store.filter.kmIg == nil {
            return "\(tol.formatted()) km –"
        }
        return "\(store.filter.kmTol!.formatted()) – \(store.filter.kmIg!.formatted())"
    }

    private var hengerurtartalomValue: String {
        if store.filter.hengerCm3Tol == nil && store.filter.hengerCm3Ig == nil { return "Mindegy" }
        if let tol = store.filter.hengerCm3Tol, let ig = store.filter.hengerCm3Ig {
            return "\(tol.formatted()) – \(ig.formatted()) cm³"
        }
        if let ig = store.filter.hengerCm3Ig { return "– \(ig.formatted()) cm³" }
        return "\(store.filter.hengerCm3Tol!.formatted()) cm³ –"
    }

    private var extrasValue: String {
        let n = store.filter.activeExtrasCount
        return n > 0 ? "\(n) bekapcsolva" : "Mindegy"
    }
}
