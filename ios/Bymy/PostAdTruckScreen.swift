import SwiftUI
import PhotosUI
import UIKit

/// Kisteher / Teherautó feladás — felépítés mint a személyautónál (lista mezőkkel).
struct PostAdTruckScreen: View {
    @EnvironmentObject private var profile: ProfileStore
    let kind: PostAdCatalog.TruckKind
    var onClose: () -> Void
    var editingListingId: Int? = nil
    var onSaved: (() -> Void)? = nil

    @StateObject private var store = SearchStore(persistSavedSearches: false)
    @StateObject private var photoStore = PostAdPhotoStore()

    @State private var openAccordion: AccordionSection? = .kepek
    @State private var panel: Panel = .list
    @State private var brandQuery = ""
    @State private var leiras = ""
    @State private var contactName = ""
    @State private var contactPhone = ""
    @State private var toast: String?
    @State private var posting = false
    @State private var loadingEdit = false
    @State private var editBaseline: [String: String]?
    @State private var libraryItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @FocusState private var focusedField: FormFocus?

    private var isEditing: Bool { editingListingId != nil }

    private enum AccordionSection: String, Hashable {
        case kepek, alap, muszaki, akku, rakter, extrak
    }

    private enum Panel: Equatable {
        case list
        case brand, model(String), fuel, allapot, kivitel, ajtok, szemelyek
        case okmanyok, okmanyErvenyesseg, hirdeto
        case sebessegvalto, hajtas, klima
        case acTolto, dcTolto
        case equipment(String)
    }

    private enum FormFocus: Hashable {
        case year, km, price, henger, kw, nyomatek, sajatTomeg, osszTomeg
        case akku, akkuJelen, acKw, dcKw, wltp, autopalya, teli
        case rakterTerf, rakterH, rakterSz, rakterM, doblemez
        case leiras, brandSearch, contactName, contactPhone
    }

    private var isShowingMainForm: Bool {
        if case .list = panel { return true }
        return false
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                ScreenHeader(
                    title: isEditing ? "Szerkesztés" : kind.title,
                    subtitle: isEditing
                        ? "Gyártmány és típus nem módosítható"
                        : "\(kind.subtitle) · Hirdetés feladás",
                    onBack: onClose,
                    rightLabel: isEditing ? nil : "Törlés",
                    onRight: isEditing ? nil : resetDraft
                )
                mainScroll
            }
            .opacity(isShowingMainForm ? 1 : 0)
            .allowsHitTesting(isShowingMainForm)
            .disabled(!isShowingMainForm)

            if !isShowingMainForm {
                VStack(spacing: 0) {
                    subpanelStack
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(AppTheme.bgGrouped)
                .onAppear { dismissKeyboard() }
            }

            if loadingEdit {
                ZStack {
                    Color.black.opacity(0.12).ignoresSafeArea()
                    ProgressView("Betöltés…")
                        .padding(20)
                        .background(AppTheme.bgElevated, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .background(AppTheme.bgGrouped)
        .task {
            store.filter.vehicleKind = kind.rawValue
            if isEditing {
                await loadForEdit()
            } else {
                prefillContactFromProfile()
            }
        }
        .onChange(of: panel) { _, _ in dismissKeyboard() }
        .onChange(of: openAccordion) { _, _ in dismissKeyboard() }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Kész") { dismissKeyboard() }.fontWeight(.semibold)
            }
        }
        .alert(isEditing ? "Szerkesztés" : kind.title, isPresented: Binding(
            get: { toast != nil },
            set: { if !$0 { toast = nil } }
        )) {
            Button("OK", role: .cancel) { toast = nil }
        } message: {
            Text(toast ?? "")
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(
                onImage: { image in
                    showCamera = false
                    do { try photoStore.addImage(image) }
                    catch { toast = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription }
                },
                onCancel: { showCamera = false }
            )
            .ignoresSafeArea()
        }
        .onChange(of: libraryItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await importLibraryItems(items) }
        }
    }

    private func prefillContactFromProfile() {
        if contactName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            contactName = profile.profile.displayName
        }
        if contactPhone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            contactPhone = profile.profile.phone
        }
    }

    @MainActor
    private func loadForEdit() async {
        guard let id = editingListingId else { return }
        loadingEdit = true
        defer { loadingEdit = false }
        do {
            let form = try await ListingsAPI.fetchFormStrings(id: String(id), token: profile.token)
            let state = PostAdListingMapper.loadEditState(from: form)
            store.filter = state.filter
            store.filter.vehicleKind = kind.rawValue
            leiras = state.leiras
            contactName = state.contactName
            contactPhone = state.contactPhone
            prefillContactFromProfile()
            editBaseline = form
            openAccordion = .alap
        } catch {
            toast = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Main form

    private var mainScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    accordion(.kepek, title: "Képek", summary: photoStore.summary) { photosBody }
                    accordion(.alap, title: "Alapadatok", summary: alapSummary) { alapBody }
                    accordion(.muszaki, title: "Műszaki adatok", summary: muszakiSummary) { muszakiBody }
                    accordion(.akku, title: "Akkumulátor és hatótáv", summary: akkuSummary) { akkuBody }
                    accordion(.rakter, title: "Raktér adatok", summary: rakterSummary) { rakterBody }
                    accordion(.extrak, title: "Extrák", summary: extrakSummary) { extrakBody }
                    leirasAndPost
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.immediately)
            .onChange(of: openAccordion) { _, section in
                guard let section else { return }
                DispatchQueue.main.async {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(section, anchor: .top)
                    }
                }
            }
        }
    }

    private func accordion<Content: View>(
        _ section: AccordionSection,
        title: String,
        summary: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let isOpen = openAccordion == section
        return VStack(spacing: 0) {
            Button {
                dismissKeyboard()
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
                content().padding(.bottom, 8)
            }
        }
        .background(AppTheme.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .id(section)
    }

    // MARK: - Bodies

    private var photosBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Max. \(PostAdPhotoRules.maxCount) kép · max. 5 MB. Az első a főkép.")
                .font(.caption)
                .foregroundStyle(AppTheme.textSecondary)
                .padding(.horizontal, 16)
                .padding(.top, 10)

            HStack(spacing: 12) {
                Button { showCamera = true } label: {
                    Label("Kamera", systemImage: "camera.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(AppTheme.accent.opacity(0.12))
                        .foregroundStyle(AppTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)

                PhotosPicker(
                    selection: $libraryItems,
                    maxSelectionCount: max(1, photoStore.remainingSlots),
                    matching: .images
                ) {
                    Label("Galéria", systemImage: "photo.on.rectangle")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(AppTheme.accent.opacity(0.12))
                        .foregroundStyle(AppTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
    }

    private var alapBody: some View {
        VStack(spacing: 0) {
            if isEditing {
                SettingsRow(title: "Márka / Modell", value: brandModelLockedValue, showChevron: false, action: nil)
            } else {
                SettingsRow(title: "Márka", value: store.filter.brandLabel) { open(.brand) }
            }
            Divider().padding(.leading, 16)
            numberRow("Évjárat", placeholder: "pl. 2018", focus: .year, binding: intBinding(\.evTol, \.evIg))
            Divider().padding(.leading, 16)
            numberRow("Futott km", placeholder: "pl. 120000", focus: .km, binding: intBinding(\.kmTol, \.kmIg, grouped: true))
            Divider().padding(.leading, 16)
            numberRow("Vételár", placeholder: "Ft", focus: .price, binding: intBinding(\.arTol, \.arIg, grouped: true))
            Divider().padding(.leading, 16)
            SettingsRow(title: "Üzemanyag", value: store.filter.fuelLabel) { open(.fuel) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Állapot", value: multiLabel(store.filter.allapotok)) { open(.allapot) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Kivitel", value: multiLabel(store.filter.kiviteles)) { open(.kivitel) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Ajtók száma", value: multiLabel(store.filter.ajtok)) { open(.ajtok) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Szállítható személyek", value: multiLabel(store.filter.szemelyek)) { open(.szemelyek) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Okmányok", value: multiLabel(store.filter.okmanyJellegek)) { open(.okmanyok) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Okmányok érvényessége", value: multiLabel(store.filter.okmanyErvenyesseg)) { open(.okmanyErvenyesseg) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Hirdető", value: multiLabel(store.filter.hirdetok)) { open(.hirdeto) }
        }
    }

    private var muszakiBody: some View {
        VStack(spacing: 0) {
            numberRow("Hengerűrtartalom", placeholder: "cm³", focus: .henger, binding: intBinding(\.hengerCm3Tol, \.hengerCm3Ig))
            Divider().padding(.leading, 16)
            numberRow("Motor teljesítménye", placeholder: "kW", focus: .kw, binding: intBinding(\.kwTol, \.kwIg))
            Divider().padding(.leading, 16)
            numberRow("Nyomaték", placeholder: "Nm", focus: .nyomatek, binding: intBinding(\.nyomatekNmTol, \.nyomatekNmIg))
            Divider().padding(.leading, 16)
            numberRow("Saját tömeg", placeholder: "kg", focus: .sajatTomeg, binding: intBinding(\.sajatTomegTol, \.sajatTomegIg, grouped: true))
            Divider().padding(.leading, 16)
            numberRow("Össztömeg", placeholder: "kg", focus: .osszTomeg, binding: intBinding(\.osszTomegTol, \.osszTomegIg, grouped: true))
            Divider().padding(.leading, 16)
            SettingsRow(title: "Sebességváltó", value: multiLabel(store.filter.sebessegvaltok)) { open(.sebessegvalto) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Hajtás", value: multiLabel(store.filter.hajtasok)) { open(.hajtas) }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Klíma fajtája", value: store.filter.klima ?? "Mindegy") { open(.klima) }
        }
    }

    private var akkuBody: some View {
        VStack(spacing: 0) {
            numberRow("Akkukapacitás", placeholder: "kWh", focus: .akku, binding: intBinding(\.akkumulatorKwhTol, \.akkumulatorKwhIg))
            Divider().padding(.leading, 16)
            numberRow("Jelenlegi akkukapacitás", placeholder: "kWh", focus: .akkuJelen, binding: intBinding(\.jelenlegiAkkukapacitasTol, \.jelenlegiAkkukapacitasIg))
            Divider().padding(.leading, 16)
            SettingsRow(title: "AC töltőcsatlakozó típusa", value: multiLabel(store.filter.acToltoCsatlakozok)) { open(.acTolto) }
            Divider().padding(.leading, 16)
            numberRow("AC töltési teljesítmény", placeholder: "kW", focus: .acKw, binding: intBinding(\.acToltoTeljesitmenyTol, \.acToltoTeljesitmenyIg))
            Divider().padding(.leading, 16)
            SettingsRow(title: "DC töltőcsatlakozó típusa", value: multiLabel(store.filter.dcToltoCsatlakozok)) { open(.dcTolto) }
            Divider().padding(.leading, 16)
            numberRow("DC töltési teljesítmény", placeholder: "kW", focus: .dcKw, binding: intBinding(\.dcToltoTeljesitmenyTol, \.dcToltoTeljesitmenyIg))
            Divider().padding(.leading, 16)
            numberRow("WLTP hatótáv", placeholder: "km", focus: .wltp, binding: intBinding(\.hatotavTol, \.hatotavIg))
            Divider().padding(.leading, 16)
            numberRow("Autópálya hatótáv", placeholder: "km", focus: .autopalya, binding: intBinding(\.autopalyaHatotavTol, \.autopalyaHatotavIg))
            Divider().padding(.leading, 16)
            numberRow("Téli hatótáv", placeholder: "km", focus: .teli, binding: intBinding(\.teliHatotavTol, \.teliHatotavIg))
            Divider().padding(.leading, 16)
            Toggle("Villámtöltés", isOn: Binding(
                get: { store.filter.villamToltes },
                set: { store.setVillamToltes($0) }
            ))
            .tint(Color.green)
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            Divider().padding(.leading, 16)
            Toggle("Zöld rendszám", isOn: Binding(
                get: { store.filter.zoldRendszam },
                set: { store.setZoldRendszam($0) }
            ))
            .tint(Color.green)
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
        }
    }

    private var rakterBody: some View {
        VStack(spacing: 0) {
            numberRow("Raktér térfogata", placeholder: "m³", focus: .rakterTerf, binding: intBinding(\.rakterTerfogatTol, \.rakterTerfogatIg))
            Divider().padding(.leading, 16)
            numberRow("Raktér hossza", placeholder: "m", focus: .rakterH, binding: intBinding(\.rakterHosszTol, \.rakterHosszIg, grouped: true))
            Divider().padding(.leading, 16)
            numberRow("Raktér szélessége", placeholder: "m", focus: .rakterSz, binding: intBinding(\.rakterSzelessegTol, \.rakterSzelessegIg, grouped: true))
            Divider().padding(.leading, 16)
            numberRow("Raktér magassága", placeholder: "m", focus: .rakterM, binding: intBinding(\.rakterMagassagTol, \.rakterMagassagIg, grouped: true))
            Divider().padding(.leading, 16)
            numberRow("Doblemez-távolság", placeholder: "m", focus: .doblemez, binding: intBinding(\.doblemezTavolsagTol, \.doblemezTavolsagIg, grouped: true))
        }
    }

    private var extrakBody: some View {
        VStack(spacing: 0) {
            ForEach(Array(activeEquipmentSections.enumerated()), id: \.element.id) { index, section in
                if index > 0 { Divider().padding(.leading, 16) }
                SettingsRow(title: section.title, value: teherEquipmentValue(section)) {
                    open(.equipment(section.id))
                }
            }
        }
    }

    private var activeEquipmentSections: [(id: String, title: String, items: [String])] {
        kind == .kisteher
            ? DetailedSearchCatalog.kisteherEquipmentSections
            : DetailedSearchCatalog.teherEquipmentSections
    }

    private var brandModelLockedValue: String {
        let brand = store.filter.brandLabel
        let model = store.filter.modelLabel
        if brand == "Mindegy" || brand.isEmpty { return "—" }
        if model == "Mindegy" || model.isEmpty { return brand }
        return "\(brand) · \(model)"
    }

    private var leirasAndPost: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(text: "Elérhetőség")
            Text("Beállításokból előtöltve — módosíthatod.")
                .font(.caption)
                .foregroundStyle(AppTheme.textTertiary)
            SettingsGroup {
                contactRow(title: "Név", placeholder: "Kapcsolattartó neve", text: $contactName, focus: .contactName, phone: false)
                Divider().padding(.leading, 16)
                contactRow(title: "Telefon", placeholder: "+36 …", text: $contactPhone, focus: .contactPhone, phone: true)
            }

            SectionLabel(text: "Leírás")
            Group {
                if isShowingMainForm {
                    TextEditor(text: Binding(
                        get: { leiras },
                        set: { leiras = String($0.prefix(PostAdListingMapper.maxLeirasLength)) }
                    ))
                    .focused($focusedField, equals: .leiras)
                } else {
                    Text(leiras.isEmpty ? " " : leiras)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
            .frame(minHeight: 100)
            .padding(8)
            .background(AppTheme.bgElevated)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            if isEditing {
                Text("Új kép opcionális — ha nem választasz, a meglévők megmaradnak.")
                    .font(.caption)
                    .foregroundStyle(AppTheme.textTertiary)
            }

            Button {
                Task { await submit() }
            } label: {
                Text(posting
                     ? "Mentés…"
                     : (isEditing ? "Módosítások mentése" : "Hirdetés feladás"))
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent.opacity(posting || loadingEdit ? 0.45 : 1))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(posting || loadingEdit)
            .buttonStyle(.plain)
        }
    }

    private func contactRow(
        title: String,
        placeholder: String,
        text: Binding<String>,
        focus: FormFocus,
        phone: Bool
    ) -> some View {
        HStack(spacing: 12) {
            Text(title)
                .foregroundStyle(AppTheme.text)
                .font(.body)
            if isShowingMainForm {
                TextField(placeholder, text: text)
                    .keyboardType(phone ? .phonePad : .default)
                    .textContentType(phone ? .telephoneNumber : .name)
                    .textInputAutocapitalization(phone ? .never : .words)
                    .focused($focusedField, equals: focus)
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(AppTheme.textSecondary)
            } else {
                Text(text.wrappedValue.isEmpty ? placeholder : text.wrappedValue)
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 52)
    }

    // MARK: - Subpanels

    @ViewBuilder
    private var subpanelStack: some View {
        switch panel {
        case .list:
            EmptyView()
        case .brand:
            ScreenHeader(title: "Márka", onBack: goList, rightLabel: "Kész", onRight: goList)
            TextField("Keresés…", text: $brandQuery)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focusedField, equals: .brandSearch)
                .padding(12)
                .background(AppTheme.bgElevated)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.horizontal, 16)
            brandList
        case .model(let brand):
            ScreenHeader(title: brand, onBack: { panel = .brand }, rightLabel: "Kész", onRight: goList)
            modelList(brand)
        case .fuel:
            ScreenHeader(title: "Üzemanyag", onBack: goList, rightLabel: "Kész", onRight: goList)
            singleSelectStrings(FuelType.allCases.map(\.label), selected: store.filter.fuels.first?.label) { label in
                store.clearFuels()
                if let f = FuelType.allCases.first(where: { $0.label == label }) {
                    store.setFuel(f, on: true)
                }
            }
        case .allapot:
            ScreenHeader(title: "Állapot", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.allapotok, DetailedSearchCatalog.allapotok)
        case .kivitel:
            ScreenHeader(title: "Kivitel", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.kiviteles, DetailedSearchCatalog.teherKiviteles)
        case .ajtok:
            ScreenHeader(title: "Ajtók száma", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.ajtok, DetailedSearchCatalog.ajtok)
        case .szemelyek:
            ScreenHeader(title: "Szállítható személyek", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.szemelyek, DetailedSearchCatalog.szemelyek)
        case .okmanyok:
            ScreenHeader(title: "Okmányok", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.okmanyJellegek, DetailedSearchCatalog.okmanyJellegek)
        case .okmanyErvenyesseg:
            ScreenHeader(title: "Okmányok érvényessége", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.okmanyErvenyesseg, DetailedSearchCatalog.okmanyErvenyessegOnly)
        case .hirdeto:
            ScreenHeader(title: "Hirdető", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.hirdetok, DetailedSearchCatalog.hirdetok)
        case .sebessegvalto:
            ScreenHeader(title: "Sebességváltó", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.sebessegvaltok, DetailedSearchCatalog.sebessegvaltok)
        case .hajtas:
            ScreenHeader(title: "Hajtás", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.hajtasok, DetailedSearchCatalog.hajtasok)
        case .klima:
            ScreenHeader(title: "Klíma fajtája", onBack: goList, rightLabel: "Kész", onRight: goList)
            singleSelectStrings(DetailedSearchCatalog.klimaOptions, selected: store.filter.klima) { label in
                store.setKlima(label.isEmpty ? nil : label)
            }
        case .acTolto:
            ScreenHeader(title: "AC töltőcsatlakozó", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.acToltoCsatlakozok, DetailedSearchCatalog.acToltoCsatlakozok)
        case .dcTolto:
            ScreenHeader(title: "DC töltőcsatlakozó", onBack: goList, rightLabel: "Kész", onRight: goList)
            exclusiveMulti(\.dcToltoCsatlakozok, DetailedSearchCatalog.dcToltoCsatlakozok)
        case .equipment(let sectionId):
            if let section = activeEquipmentSections.first(where: { $0.id == sectionId }) {
                ScreenHeader(title: section.title, onBack: goList, rightLabel: "Kész", onRight: goList)
                teherEquipmentPanel(section)
            } else {
                ScreenHeader(title: "Extrák", onBack: goList, rightLabel: "Kész", onRight: goList)
                Text("Ismeretlen szekció").padding()
            }
        }
    }

    private func teherEquipmentPanel(
        _ section: (id: String, title: String, items: [String])
    ) -> some View {
        let selectedCount = section.items.filter { store.isExtraOn($0) }.count
        return ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: "Több is választható")
                if selectedCount > 0 {
                    Button {
                        for item in section.items { store.setExtra(item, on: false) }
                    } label: {
                        Text("Összes kikapcsolása")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(AppTheme.accent)
                            .padding(.leading, 4)
                    }
                    .buttonStyle(.plain)
                }
                SettingsGroup {
                    ForEach(Array(section.items.enumerated()), id: \.element) { index, item in
                        if index > 0 { Divider().padding(.leading, 16) }
                        Toggle(item, isOn: Binding(
                            get: { store.isExtraOn(item) },
                            set: { store.setExtra(item, on: $0) }
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

    private func teherEquipmentValue(
        _ section: (id: String, title: String, items: [String])
    ) -> String {
        let n = section.items.filter { store.isExtraOn($0) }.count
        if n == 0 { return "Mindegy" }
        if n == 1, let one = section.items.first(where: { store.isExtraOn($0) }) { return one }
        return "\(n) bekapcsolva"
    }

    private func exclusiveMulti(
        _ keyPath: WritableKeyPath<SearchFilter, [String]>,
        _ options: [String]
    ) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: "Csak egy választható")
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
    }

    private func singleSelectStrings(
        _ options: [String],
        selected: String?,
        onPick: @escaping (String) -> Void
    ) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: "Csak egy választható")
                SettingsGroup {
                    ForEach(Array(options.enumerated()), id: \.element) { index, option in
                        if index > 0 { Divider().padding(.leading, 16) }
                        Toggle(option, isOn: Binding(
                            get: { selected == option },
                            set: { on in onPick(on ? option : "") }
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

    private var brandList: some View {
        let q = brandQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let brands = q.isEmpty ? Catalog.brandNames : Catalog.brandNames.filter { $0.lowercased().contains(q) }
        return ScrollView {
            SettingsGroup {
                ForEach(Array(brands.enumerated()), id: \.element) { index, brand in
                    if index > 0 { Divider().padding(.leading, 16) }
                    Toggle(brand, isOn: Binding(
                        get: { store.filter.gyartmanyok.contains(brand) },
                        set: { on in
                            store.clearBrands()
                            if on { store.setBrand(brand, on: true) }
                        }
                    ))
                    .tint(Color.green)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 52)
                    if store.filter.gyartmanyok.contains(brand) {
                        Divider().padding(.leading, 32)
                        SettingsRow(title: "\(brand) modell", value: store.filter.modelLabel) {
                            panel = .model(brand)
                        }
                        .padding(.leading, 16)
                    }
                }
            }
            .padding(16)
        }
    }

    private func modelList(_ brand: String) -> some View {
        let models = Catalog.brands[brand] ?? []
        return ScrollView {
            SettingsGroup {
                ForEach(Array(models.enumerated()), id: \.element) { index, model in
                    if index > 0 { Divider().padding(.leading, 16) }
                    Toggle(model, isOn: Binding(
                        get: { store.isModelOn(model) },
                        set: { on in
                            store.clearModels(for: brand)
                            if on { store.setModel(model, on: true) }
                        }
                    ))
                    .tint(Color.green)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 52)
                }
            }
            .padding(16)
        }
    }

    // MARK: - Helpers

    private func open(_ next: Panel) {
        dismissKeyboard()
        panel = next
    }

    private func goList() {
        dismissKeyboard()
        brandQuery = ""
        panel = .list
        openAccordion = .alap
    }

    private func resetDraft() {
        store.reset()
        store.filter.vehicleKind = kind.rawValue
        photoStore.clear()
        leiras = ""
        contactName = ""
        contactPhone = ""
        prefillContactFromProfile()
    }

    private func dismissKeyboard() {
        focusedField = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        for scene in UIApplication.shared.connectedScenes {
            guard let ws = scene as? UIWindowScene else { continue }
            ws.windows.forEach { $0.endEditing(true) }
        }
    }

    private func multiLabel(_ list: [String]) -> String {
        if list.isEmpty { return "Mindegy" }
        if list.count == 1 { return list[0] }
        return "\(list.count) kiválasztva"
    }

    private var alapSummary: String {
        var n = 0
        if !store.filter.gyartmanyok.isEmpty { n += 1 }
        if store.filter.evTol != nil { n += 1 }
        if store.filter.kmTol != nil { n += 1 }
        if store.filter.arTol != nil { n += 1 }
        if !store.filter.fuels.isEmpty { n += 1 }
        n += store.filter.allapotok.isEmpty ? 0 : 1
        n += store.filter.kiviteles.isEmpty ? 0 : 1
        return n == 0 ? "Mindegy" : "\(n) mező"
    }

    private var muszakiSummary: String {
        var n = 0
        if store.filter.hengerCm3Tol != nil { n += 1 }
        if store.filter.kwTol != nil { n += 1 }
        if store.filter.nyomatekNmTol != nil { n += 1 }
        n += store.filter.sebessegvaltok.isEmpty ? 0 : 1
        n += store.filter.hajtasok.isEmpty ? 0 : 1
        if store.filter.klima != nil { n += 1 }
        return n == 0 ? "Mindegy" : "\(n) mező"
    }

    private var akkuSummary: String {
        var n = 0
        if store.filter.akkumulatorKwhTol != nil { n += 1 }
        if !store.filter.acToltoCsatlakozok.isEmpty { n += 1 }
        if !store.filter.dcToltoCsatlakozok.isEmpty { n += 1 }
        if store.filter.villamToltes { n += 1 }
        if store.filter.zoldRendszam { n += 1 }
        return n == 0 ? "Mindegy" : "\(n) mező"
    }

    private var rakterSummary: String {
        var n = 0
        if store.filter.rakterTerfogatTol != nil { n += 1 }
        if store.filter.rakterHosszTol != nil { n += 1 }
        if store.filter.rakterSzelessegTol != nil { n += 1 }
        if store.filter.rakterMagassagTol != nil { n += 1 }
        if store.filter.doblemezTavolsagTol != nil { n += 1 }
        return n == 0 ? "Mindegy" : "\(n) mező"
    }

    private var extrakSummary: String {
        let n = activeEquipmentSections
            .flatMap(\.items)
            .filter { store.isExtraOn($0) }
            .count
        return n == 0 ? "Mindegy" : "\(n) bekapcsolva"
    }

    private func numberRow(
        _ title: String,
        placeholder: String,
        focus: FormFocus,
        binding: Binding<String>
    ) -> some View {
        HStack(spacing: 12) {
            Text(title).font(.body).foregroundStyle(AppTheme.text)
            if isShowingMainForm && openAccordion != nil {
                TextField(placeholder, text: binding)
                    .keyboardType(.numberPad)
                    .focused($focusedField, equals: focus)
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(AppTheme.textSecondary)
            } else {
                Text(binding.wrappedValue.isEmpty ? placeholder : binding.wrappedValue)
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 52)
    }

    private func intBinding(
        _ tol: WritableKeyPath<SearchFilter, Int?>,
        _ ig: WritableKeyPath<SearchFilter, Int?>,
        grouped: Bool = false
    ) -> Binding<String> {
        Binding(
            get: {
                guard let v = store.filter[keyPath: tol] ?? store.filter[keyPath: ig] else { return "" }
                if grouped {
                    let f = NumberFormatter()
                    f.numberStyle = .decimal
                    f.groupingSeparator = " "
                    return f.string(from: NSNumber(value: v)) ?? String(v)
                }
                return String(v)
            },
            set: { raw in
                let digits = raw.filter(\.isNumber)
                let value = digits.isEmpty ? nil : Int(digits)
                store.setIntRange(tol, ig, tol: value, ig: value)
            }
        )
    }

    private func importLibraryItems(_ items: [PhotosPickerItem]) async {
        defer { libraryItems = [] }
        for item in items {
            guard photoStore.remainingSlots > 0 else { break }
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { continue }
                try photoStore.addImage(image, sourceByteCount: data.count)
            } catch {
                toast = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    private func submit() async {
        guard profile.token != nil, profile.isLoggedIn else {
            toast = "A feladáshoz be kell jelentkezned."
            return
        }
        if !isEditing, photoStore.photos.isEmpty {
            openAccordion = .kepek
            toast = "Legalább egy fénykép kell a feladáshoz."
            return
        }
        posting = true
        defer { posting = false }
        store.filter.vehicleKind = kind.rawValue
        var form = PostAdListingMapper.formData(from: store.filter, leiras: leiras, vehicleTitle: kind.title)
        PostAdListingMapper.applyContact(
            to: &form,
            name: contactName,
            phone: contactPhone,
            email: profile.profile.email,
            street: profile.profile.street,
            postalCode: profile.profile.postalCode,
            city: profile.profile.city
        )
        if isEditing, let baseline = editBaseline {
            form = PostAdListingMapper.mergeForEdit(
                base: baseline,
                overlay: form,
                lockBrandAndType: true
            )
        }
        do {
            let photos = photoStore.base64Payloads()
            let id = try await ListingsAPI.saveListing(
                form: form,
                status: "feladott",
                photos: photos,
                token: profile.token,
                listingId: editingListingId
            )
            if isEditing {
                toast = "Módosítások elmentve (#\(id))."
                onSaved?()
                onClose()
            } else {
                toast = "Hirdetés elmentve. Megjelenik a Kiemeltek / Hirdetéseim között."
                resetDraft()
                openAccordion = .kepek
                onSaved?()
            }
        } catch {
            toast = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
