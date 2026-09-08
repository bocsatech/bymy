import SwiftUI

/// Teherautó / kisteher kereső — ugyanaz a mezőlista, tól–ig tartományokkal.
struct SearchTruckScreen: View {
    @EnvironmentObject private var store: SearchStore
    let kind: PostAdCatalog.TruckKind
    var onBack: () -> Void
    var onResults: () -> Void

    @State private var openAccordion: AccordionSection? = .alap
    @State private var panel: Panel = .list

    private enum AccordionSection: String, Hashable {
        case alap, muszaki, akku, rakter, extrak
    }

    private enum Panel: Equatable {
        case list
        case brand, fuel, allapot, kivitel, ajtok, szemelyek
        case okmanyok, okmanyErvenyesseg, hirdeto
        case sebessegvalto, hajtas, klima, acTolto, dcTolto
        case equipment(String)
    }

    private var isMain: Bool {
        if case .list = panel { return true }
        return false
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                ScreenHeader(
                    title: "\(kind.title) keresés",
                    subtitle: kind.subtitle,
                    onBack: onBack,
                    rightLabel: "Törlés",
                    onRight: {
                        store.reset()
                        store.setVehicleKind(kind.rawValue)
                    }
                )
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        accordion(.alap, "Alapadatok") { alapBody }
                        accordion(.muszaki, "Műszaki adatok") { muszakiBody }
                        accordion(.akku, "Akkumulátor és hatótáv") { akkuBody }
                        accordion(.rakter, "Raktér adatok") { rakterBody }
                        accordion(.extrak, "Extrák") { extrakBody }

                        Button(action: onResults) {
                            Text("Találatok")
                                .font(.body.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .foregroundStyle(.white)
                                .background(AppTheme.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 8)
                    }
                    .padding(16)
                }
            }
            .opacity(isMain ? 1 : 0)
            .allowsHitTesting(isMain)

            if !isMain {
                VStack(spacing: 0) { subpanels }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .background(AppTheme.bgGrouped)
            }
        }
        .background(AppTheme.bgGrouped)
        .onAppear { store.setVehicleKind(kind.rawValue) }
    }

    private func accordion<Content: View>(
        _ section: AccordionSection,
        _ title: String,
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
                    Text(title).font(.body.weight(.semibold)).foregroundStyle(AppTheme.text)
                    Spacer()
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
    }

    private var alapBody: some View {
        VStack(spacing: 0) {
            SettingsRow(title: "Márka", value: store.filter.brandLabel) { panel = .brand }
            Divider().padding(.leading, 16)
            rangeRow("Évjárat", \.evTol, \.evIg)
            Divider().padding(.leading, 16)
            rangeRow("Futott km", \.kmTol, \.kmIg)
            Divider().padding(.leading, 16)
            rangeRow("Vételár", \.arTol, \.arIg)
            Divider().padding(.leading, 16)
            SettingsRow(title: "Üzemanyag", value: store.filter.fuelLabel) { panel = .fuel }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Állapot", value: label(store.filter.allapotok)) { panel = .allapot }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Kivitel", value: label(store.filter.kiviteles)) { panel = .kivitel }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Ajtók száma", value: label(store.filter.ajtok)) { panel = .ajtok }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Szállítható személyek", value: label(store.filter.szemelyek)) { panel = .szemelyek }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Okmányok", value: label(store.filter.okmanyJellegek)) { panel = .okmanyok }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Okmányok érvényessége", value: label(store.filter.okmanyErvenyesseg)) { panel = .okmanyErvenyesseg }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Hirdető", value: label(store.filter.hirdetok)) { panel = .hirdeto }
        }
    }

    private var muszakiBody: some View {
        VStack(spacing: 0) {
            rangeRow("Hengerűrtartalom", \.hengerCm3Tol, \.hengerCm3Ig)
            Divider().padding(.leading, 16)
            rangeRow("Motor teljesítménye (kW)", \.kwTol, \.kwIg)
            Divider().padding(.leading, 16)
            rangeRow("Nyomaték (Nm)", \.nyomatekNmTol, \.nyomatekNmIg)
            Divider().padding(.leading, 16)
            rangeRow("Saját tömeg (kg)", \.sajatTomegTol, \.sajatTomegIg)
            Divider().padding(.leading, 16)
            rangeRow("Össztömeg (kg)", \.osszTomegTol, \.osszTomegIg)
            Divider().padding(.leading, 16)
            SettingsRow(title: "Sebességváltó", value: label(store.filter.sebessegvaltok)) { panel = .sebessegvalto }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Hajtás", value: label(store.filter.hajtasok)) { panel = .hajtas }
            Divider().padding(.leading, 16)
            SettingsRow(title: "Klíma fajtája", value: store.filter.klima ?? "Mindegy") { panel = .klima }
        }
    }

    private var akkuBody: some View {
        VStack(spacing: 0) {
            rangeRow("Akkukapacitás (kWh)", \.akkumulatorKwhTol, \.akkumulatorKwhIg)
            Divider().padding(.leading, 16)
            rangeRow("Jelenlegi akkukapacitás", \.jelenlegiAkkukapacitasTol, \.jelenlegiAkkukapacitasIg)
            Divider().padding(.leading, 16)
            SettingsRow(title: "AC töltőcsatlakozó", value: label(store.filter.acToltoCsatlakozok)) { panel = .acTolto }
            Divider().padding(.leading, 16)
            rangeRow("AC töltési teljesítmény", \.acToltoTeljesitmenyTol, \.acToltoTeljesitmenyIg)
            Divider().padding(.leading, 16)
            SettingsRow(title: "DC töltőcsatlakozó", value: label(store.filter.dcToltoCsatlakozok)) { panel = .dcTolto }
            Divider().padding(.leading, 16)
            rangeRow("DC töltési teljesítmény", \.dcToltoTeljesitmenyTol, \.dcToltoTeljesitmenyIg)
            Divider().padding(.leading, 16)
            rangeRow("WLTP hatótáv", \.hatotavTol, \.hatotavIg)
            Divider().padding(.leading, 16)
            rangeRow("Autópálya hatótáv", \.autopalyaHatotavTol, \.autopalyaHatotavIg)
            Divider().padding(.leading, 16)
            rangeRow("Téli hatótáv", \.teliHatotavTol, \.teliHatotavIg)
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
            rangeRow("Raktér térfogata (m³)", \.rakterTerfogatTol, \.rakterTerfogatIg)
            Divider().padding(.leading, 16)
            rangeRow("Raktér hossza (m)", \.rakterHosszTol, \.rakterHosszIg)
            Divider().padding(.leading, 16)
            rangeRow("Raktér szélessége (m)", \.rakterSzelessegTol, \.rakterSzelessegIg)
            Divider().padding(.leading, 16)
            rangeRow("Raktér magassága (m)", \.rakterMagassagTol, \.rakterMagassagIg)
            Divider().padding(.leading, 16)
            rangeRow("Doblemez-távolság (m)", \.doblemezTavolsagTol, \.doblemezTavolsagIg)
        }
    }

    private var extrakBody: some View {
        VStack(spacing: 0) {
            ForEach(Array(DetailedSearchCatalog.teherEquipmentSections.enumerated()), id: \.element.id) { index, section in
                if index > 0 { Divider().padding(.leading, 16) }
                SettingsRow(title: section.title, value: teherEquipmentValue(section)) {
                    panel = .equipment(section.id)
                }
            }
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

    private func rangeRow(
        _ title: String,
        _ tol: WritableKeyPath<SearchFilter, Int?>,
        _ ig: WritableKeyPath<SearchFilter, Int?>
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(AppTheme.text)
                .padding(.horizontal, 16)
                .padding(.top, 8)
            HStack(spacing: 10) {
                TextField("tól", text: intText(tol, ig, isTol: true))
                    .keyboardType(.numberPad)
                    .padding(10)
                    .background(AppTheme.bgGrouped)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                TextField("ig", text: intText(tol, ig, isTol: false))
                    .keyboardType(.numberPad)
                    .padding(10)
                    .background(AppTheme.bgGrouped)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
    }

    private func intText(
        _ tol: WritableKeyPath<SearchFilter, Int?>,
        _ ig: WritableKeyPath<SearchFilter, Int?>,
        isTol: Bool
    ) -> Binding<String> {
        Binding(
            get: {
                let v = isTol ? store.filter[keyPath: tol] : store.filter[keyPath: ig]
                return v.map(String.init) ?? ""
            },
            set: { raw in
                let digits = raw.filter(\.isNumber)
                let value = digits.isEmpty ? nil : Int(digits)
                let t = isTol ? value : store.filter[keyPath: tol]
                let i = isTol ? store.filter[keyPath: ig] : value
                store.setIntRange(tol, ig, tol: t, ig: i)
            }
        )
    }

    private func label(_ list: [String]) -> String {
        if list.isEmpty { return "Mindegy" }
        if list.count == 1 { return list[0] }
        return "\(list.count) kiválasztva"
    }

    @ViewBuilder
    private var subpanels: some View {
        switch panel {
        case .list: EmptyView()
        case .brand:
            ScreenHeader(title: "Márka", onBack: { panel = .list }, rightLabel: "Kész", onRight: { panel = .list })
            brandList
        case .fuel:
            ScreenHeader(title: "Üzemanyag", onBack: { panel = .list }, rightLabel: "Kész", onRight: { panel = .list })
            multiFuel
        case .allapot:
            header("Állapot")
            multi(\.allapotok, DetailedSearchCatalog.allapotok)
        case .kivitel:
            header("Kivitel")
            multi(\.kiviteles, DetailedSearchCatalog.teherKiviteles)
        case .ajtok:
            header("Ajtók száma")
            multi(\.ajtok, DetailedSearchCatalog.ajtok)
        case .szemelyek:
            header("Szállítható személyek")
            multi(\.szemelyek, DetailedSearchCatalog.szemelyek)
        case .okmanyok:
            header("Okmányok")
            multi(\.okmanyJellegek, DetailedSearchCatalog.okmanyJellegek)
        case .okmanyErvenyesseg:
            header("Okmányok érvényessége")
            multi(\.okmanyErvenyesseg, DetailedSearchCatalog.okmanyErvenyessegOnly)
        case .hirdeto:
            header("Hirdető")
            multi(\.hirdetok, DetailedSearchCatalog.hirdetok)
        case .sebessegvalto:
            header("Sebességváltó")
            multi(\.sebessegvaltok, DetailedSearchCatalog.sebessegvaltok)
        case .hajtas:
            header("Hajtás")
            multi(\.hajtasok, DetailedSearchCatalog.hajtasok)
        case .klima:
            header("Klíma")
            klimaList
        case .acTolto:
            header("AC töltőcsatlakozó")
            multi(\.acToltoCsatlakozok, DetailedSearchCatalog.acToltoCsatlakozok)
        case .dcTolto:
            header("DC töltőcsatlakozó")
            multi(\.dcToltoCsatlakozok, DetailedSearchCatalog.dcToltoCsatlakozok)
        case .equipment(let sectionId):
            if let section = DetailedSearchCatalog.teherEquipmentSections.first(where: { $0.id == sectionId }) {
                header(section.title)
                teherEquipmentList(section.items)
            } else {
                header("Extrák")
                Text("Ismeretlen szekció").padding()
            }
        }
    }

    private func teherEquipmentList(_ items: [String]) -> some View {
        ScrollView {
            SettingsGroup {
                ForEach(Array(items.enumerated()), id: \.element) { index, item in
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
            .padding(16)
        }
    }

    private func header(_ title: String) -> some View {
        ScreenHeader(title: title, onBack: { panel = .list }, rightLabel: "Kész", onRight: { panel = .list })
    }

    private func multi(_ keyPath: WritableKeyPath<SearchFilter, [String]>, _ options: [String]) -> some View {
        ScrollView {
            SettingsGroup {
                ForEach(Array(options.enumerated()), id: \.element) { index, option in
                    if index > 0 { Divider().padding(.leading, 16) }
                    Toggle(option, isOn: Binding(
                        get: { store.isMultiOn(keyPath, value: option) },
                        set: { store.toggleMulti(keyPath, value: option, on: $0) }
                    ))
                    .tint(Color.green)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 52)
                }
            }
            .padding(16)
        }
    }

    private var multiFuel: some View {
        ScrollView {
            SettingsGroup {
                ForEach(Array(FuelType.allCases.enumerated()), id: \.element.id) { index, fuel in
                    if index > 0 { Divider().padding(.leading, 16) }
                    Toggle(fuel.label, isOn: Binding(
                        get: { store.filter.fuels.contains(fuel) },
                        set: { store.setFuel(fuel, on: $0) }
                    ))
                    .tint(Color.green)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 52)
                }
            }
            .padding(16)
        }
    }

    private var klimaList: some View {
        ScrollView {
            SettingsGroup {
                ForEach(Array(DetailedSearchCatalog.klimaOptions.enumerated()), id: \.element) { index, option in
                    if index > 0 { Divider().padding(.leading, 16) }
                    Toggle(option, isOn: Binding(
                        get: { store.filter.klima == option },
                        set: { on in store.setKlima(on ? option : nil) }
                    ))
                    .tint(Color.green)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 52)
                }
            }
            .padding(16)
        }
    }

    private var brandList: some View {
        ScrollView {
            SettingsGroup {
                ForEach(Array(Catalog.brandNames.enumerated()), id: \.element) { index, brand in
                    if index > 0 { Divider().padding(.leading, 16) }
                    Toggle(brand, isOn: Binding(
                        get: { store.filter.gyartmanyok.contains(brand) },
                        set: { store.setBrand(brand, on: $0) }
                    ))
                    .tint(Color.green)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 52)
                }
            }
            .padding(16)
        }
    }
}
