import PhotosUI
import SwiftUI
import UIKit

/// Feladási űrlap — jármű / ingatlan, fotók + `POST /api/listings`.
struct PostAdFormScreen: View {
    let category: PostAdCatalog.Category
    var onBack: () -> Void
    var onPosted: () -> Void

    @EnvironmentObject private var auth: AuthStore
    @StateObject private var photoStore = PostAdPhotoStore()

    @State private var brand = ""
    @State private var model = ""
    @State private var year = ""
    @State private var km = ""
    @State private var price = ""
    @State private var fuel = ""
    @State private var bodyType = ""
    @State private var transmission = ""
    @State private var condition = ""
    @State private var title = ""
    @State private var immoCategory = ""
    @State private var city = ""
    @State private var postalCode = ""
    @State private var street = ""
    @State private var leiras = ""
    @State private var contactName = ""
    @State private var contactPhone = ""

    @State private var libraryItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var posting = false
    @State private var toast: String?
    @State private var postedId: Int?
    @State private var sheet: SearchSheet?
    @StateObject private var catalog = VehicleCatalogStore()

    private var isVehicle: Bool { category.vertical != "ingatlan" }
    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    photosSection
                    if isVehicle {
                        brandModelCard
                        vehicleFields
                    } else {
                        immoFields
                    }
                    contactFields
                    descriptionField
                    submitButton
                }
                .padding(16)
                .padding(.bottom, 40)
            }
        }
        .background(pageBg.ignoresSafeArea())
        .task {
            if isVehicle {
                await catalog.load(kind: category.subtype == "kisteher" || category.subtype == "teherauto" ? "kisteher" : "szemelyauto")
            }
        }
        .onAppear { prefillContact() }
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
        .onChange(of: libraryItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await importLibraryItems(items) }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(
                onImage: { image in
                    showCamera = false
                    do {
                        try photoStore.addImage(image)
                    } catch {
                        toast = error.localizedDescription
                    }
                },
                onCancel: { showCamera = false }
            )
            .ignoresSafeArea()
        }
        .alert("Hirdetés feladás", isPresented: Binding(
            get: { toast != nil },
            set: { if !$0 { toast = nil } }
        )) {
            Button("OK", role: .cancel) {
                let done = postedId != nil
                toast = nil
                if done { onPosted() }
            }
        } message: {
            Text(toast ?? "")
        }
    }

    private var header: some View {
        HStack {
            Button("Vissza", action: onBack)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
            Spacer()
            Text(category.label)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(AppTheme.text)
                .lineLimit(1)
            Spacer()
            Color.clear.frame(width: 56, height: 1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.white)
        .overlay(alignment: .bottom) {
            Rectangle().fill(AppTheme.border).frame(height: 1)
        }
    }

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Képek", subtitle: photoStore.summary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    PhotosPicker(selection: $libraryItems, maxSelectionCount: photoStore.remainingSlots, matching: .images) {
                        addTile(systemImage: "photo.on.rectangle", label: "Galéria")
                    }
                    .disabled(photoStore.remainingSlots == 0)

                    Button {
                        if UIImagePickerController.isSourceTypeAvailable(.camera) {
                            showCamera = true
                        } else {
                            toast = PostAdPhotoError.cameraUnavailable.localizedDescription
                        }
                    } label: {
                        addTile(systemImage: "camera", label: "Kamera")
                    }
                    .buttonStyle(.plain)
                    .disabled(photoStore.remainingSlots == 0)

                    ForEach(Array(photoStore.photos.enumerated()), id: \.element.id) { index, photo in
                        ZStack(alignment: .topTrailing) {
                            Image(uiImage: photo.image)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 96, height: 72)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            if index == 0 {
                                Text("FŐ")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.black)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(AppTheme.brandYellow)
                                    .clipShape(Capsule())
                                    .padding(4)
                            }
                            Button {
                                photoStore.remove(id: photo.id)
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.white, .black.opacity(0.55))
                                    .font(.system(size: 18))
                            }
                            .offset(x: 4, y: -4)
                        }
                        .contextMenu {
                            if index > 0 {
                                Button("Legyen főkép") { photoStore.makePrimary(id: photo.id) }
                            }
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func addTile(systemImage: String, label: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
            Text(label)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(AppTheme.accent)
        .frame(width: 96, height: 72)
        .background(AppTheme.accent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(AppTheme.accent.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4]))
        )
    }

    private var brandModelCard: some View {
        let empty = brand.isEmpty
        let summary = empty
            ? "Gyártmány / Modell"
            : (model.isEmpty ? brand : "\(brand) · \(model)")
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Text("Gyártmány & Modell:")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(AppTheme.text)
                Text("*")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color(red: 0.86, green: 0.15, blue: 0.15))
            }
            Button {
                sheet = .list(title: "Gyártmány", options: catalog.brands, selected: brand)
            } label: {
                HStack {
                    Text(summary)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(empty ? Color(red: 0.278, green: 0.333, blue: 0.412) : AppTheme.text)
                    Spacer(minLength: 0)
                }
                .padding(.bottom, 8)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(Color(red: 0.81, green: 0.84, blue: 0.87))
                        .frame(height: 1.5)
                }
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var vehicleFields: some View {
        VStack(spacing: 0) {
            sectionTitle("Alapadatok")
                .padding(.horizontal, 14)
                .padding(.top, 14)
                .padding(.bottom, 8)

            sheetRow("Évjárat", value: year.isEmpty ? "Mindegy" : year) {
                sheet = .list(title: "Évjárat", options: SearchCatalog.yearOptions(), selected: year)
            }
            rowDivider
            fieldInline("Km", text: $km, placeholder: "pl. 120000", keyboard: .numberPad)
            rowDivider
            fieldInline("Vételár (Ft)", text: $price, placeholder: "pl. 4500000", keyboard: .numberPad)
            rowDivider
            sheetRow("Üzemanyag", value: fuel.isEmpty ? "Mindegy" : fuel) {
                sheet = .list(title: "Üzemanyag", options: PostAdCatalog.fuels, selected: fuel)
            }
            rowDivider
            sheetRow("Kivitel", value: bodyType.isEmpty ? "Mindegy" : bodyType) {
                sheet = .list(title: "Kivitel", options: PostAdCatalog.kivitels, selected: bodyType)
            }
            rowDivider
            sheetRow("Sebességváltó", value: transmission.isEmpty ? "Mindegy" : transmission) {
                sheet = .list(title: "Sebességváltó", options: PostAdCatalog.transmissions, selected: transmission)
            }
            rowDivider
            sheetRow("Állapot", value: condition.isEmpty ? "Mindegy" : condition) {
                sheet = .list(title: "Állapot", options: PostAdCatalog.conditions, selected: condition)
            }
        }
        .padding(.bottom, 8)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var rowDivider: some View {
        Divider().padding(.leading, 14)
    }

    private func sheetRow(_ title: String, value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                Spacer()
                Text(value)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(value == "Mindegy" ? AppTheme.textSecondary : AppTheme.text)
                    .lineLimit(1)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppTheme.tabInactive)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func fieldInline(
        _ title: String,
        text: Binding<String>,
        placeholder: String,
        keyboard: UIKeyboardType = .default
    ) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AppTheme.text)
            Spacer()
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .multilineTextAlignment(.trailing)
                .font(.system(size: 15, weight: .medium))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    private func applySheet(_ item: SearchSheet, value: SearchSheetValue) {
        switch item {
        case .list(let title, _, _):
            let v = value.single
            switch title {
            case "Gyártmány":
                brand = v
                if !v.isEmpty { model = "" }
                let models = catalog.models(for: v)
                if !v.isEmpty, !models.isEmpty {
                    DispatchQueue.main.async {
                        sheet = .list(title: "Modell", options: models, selected: "")
                    }
                }
            case "Modell": model = v
            case "Évjárat": year = v
            case "Üzemanyag": fuel = v
            case "Kivitel": bodyType = v
            case "Sebességváltó": transmission = v
            case "Állapot": condition = v
            case "Kategória":
                immoCategory = PostAdCatalog.immoKategoriak.first(where: { $0.label == v })?.id ?? ""
            default: break
            }
        case .text(let title, _):
            if title == "Modell" { model = value.single }
        default:
            break
        }
    }

    private var immoFields: some View {
        VStack(spacing: 0) {
            sectionTitle("Ingatlan adatok")
                .padding(.horizontal, 14)
                .padding(.top, 14)
                .padding(.bottom, 8)

            fieldInline("Cím / megnevezés", text: $title, placeholder: "pl. 3 szobás lakás")
            rowDivider
            sheetRow(
                "Kategória",
                value: PostAdCatalog.immoKategoriak.first(where: { $0.id == immoCategory })?.label ?? "Válassz"
            ) {
                sheet = .list(
                    title: "Kategória",
                    options: PostAdCatalog.immoKategoriak.map(\.label),
                    selected: PostAdCatalog.immoKategoriak.first(where: { $0.id == immoCategory })?.label ?? ""
                )
            }
            rowDivider
            fieldInline("Vételár / bérleti díj (Ft)", text: $price, placeholder: "65000000", keyboard: .numberPad)
            rowDivider
            fieldInline("Irányítószám", text: $postalCode, placeholder: "1051", keyboard: .numberPad)
            rowDivider
            fieldInline("Település", text: $city, placeholder: "Budapest")
            rowDivider
            fieldInline("Utca, házszám", text: $street, placeholder: "opcionális")
        }
        .padding(.bottom, 8)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var contactFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Kapcsolat")
            field("Név", text: $contactName, placeholder: "Megjelenő név")
            field("Telefon", text: $contactPhone, placeholder: "+36 …", keyboard: .phonePad)
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var descriptionField: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("Leírás")
            TextField("Írd le a hirdetést…", text: $leiras, axis: .vertical)
                .lineLimit(4...10)
                .padding(12)
                .background(AppTheme.avatarBg)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            Text("\(min(leiras.count, 700))/700")
                .font(.system(size: 12))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var submitButton: some View {
        Button {
            Task { await submit() }
        } label: {
            HStack {
                Spacer()
                if posting {
                    ProgressView()
                        .tint(.black)
                } else {
                    Text("Feladás")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.black)
                }
                Spacer()
            }
            .padding(.vertical, 16)
            .background(AppTheme.brandYellow)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(posting)
    }

    private func sectionTitle(_ title: String, subtitle: String? = nil) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(AppTheme.text)
            Spacer()
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
    }

    private func field(
        _ title: String,
        text: Binding<String>,
        placeholder: String,
        keyboard: UIKeyboardType = .default
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AppTheme.textSecondary)
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .padding(12)
                .background(AppTheme.avatarBg)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func pickerRow(_ title: String, selection: Binding<String>, options: [String]) -> some View {
        Menu {
            ForEach(options, id: \.self) { opt in
                Button(opt) { selection.wrappedValue = opt }
            }
        } label: {
            formValueRow(title: title, value: selection.wrappedValue)
        }
    }

    private func optionalPicker(_ title: String, selection: Binding<String>, options: [String]) -> some View {
        Menu {
            Button("—") { selection.wrappedValue = "" }
            ForEach(options, id: \.self) { opt in
                Button(opt) { selection.wrappedValue = opt }
            }
        } label: {
            formValueRow(title: title, value: selection.wrappedValue.isEmpty ? "—" : selection.wrappedValue)
        }
    }

    private func formValueRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppTheme.text)
            Spacer()
            Text(value)
                .font(.system(size: 14))
                .foregroundStyle(AppTheme.textSecondary)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(AppTheme.tabInactive)
        }
        .padding(12)
        .background(AppTheme.avatarBg)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func prefillContact() {
        if contactName.isEmpty {
            let first = auth.user?.profile.firstName ?? ""
            let last = auth.user?.profile.lastName ?? ""
            let combined = [last, first].filter { !$0.isEmpty }.joined(separator: " ")
            contactName = combined.isEmpty ? auth.displayFirstName : combined
        }
        if contactPhone.isEmpty {
            contactPhone = auth.user?.profile.phone ?? ""
        }
        if city.isEmpty {
            city = auth.user?.profile.city ?? ""
        }
        if postalCode.isEmpty {
            postalCode = auth.user?.profile.postalCode ?? ""
        }
    }

    private func importLibraryItems(_ items: [PhotosPickerItem]) async {
        for item in items {
            do {
                if let data = try await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    try photoStore.addImage(image, sourceByteCount: data.count)
                }
            } catch {
                toast = error.localizedDescription
                break
            }
        }
        libraryItems = []
    }

    private func submit() async {
        posting = true
        defer { posting = false }
        do {
            let form = try buildForm()
            let id = try await ListingsAPI.saveListing(
                form: form,
                status: "feladott",
                photos: photoStore.base64Payloads(),
                token: auth.token
            )
            postedId = id
            toast = "Sikeres feladás (#\(id))."
        } catch {
            toast = error.localizedDescription
        }
    }

    private func buildForm() throws -> [String: Any] {
        var form: [String: Any] = [
            "hirdetes_vertical": category.vertical,
            "hirdetes_alkategoria": category.subtype,
            "jarmu_kategoria": category.subtype,
        ]

        if let immo = category.immoTipus {
            form["ingatlan_tipus"] = immo
        }

        let trimmedLeiras = String(leiras.prefix(700)).trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedLeiras.isEmpty { form["leiras"] = trimmedLeiras }

        let name = contactName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty { form["hirdeto_nev"] = name }
        if let email = auth.user?.email, !email.isEmpty { form["email"] = email }
        let phone = contactPhone.trimmingCharacters(in: .whitespacesAndNewlines)
        if !phone.isEmpty {
            form["telefonszam"] = phone
            form["telefon1_szam"] = phone.filter(\.isNumber)
        }

        let priceDigits = price.filter(\.isNumber)
        if !priceDigits.isEmpty { form["vetelar"] = priceDigits }

        if isVehicle {
            let b = brand.trimmingCharacters(in: .whitespacesAndNewlines)
            let m = model.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !b.isEmpty else { throw FormError.missing("Add meg a gyártmányt.") }
            form["gyartmany"] = b
            if !m.isEmpty { form["modell"] = m }

            let yearDigits = year.filter(\.isNumber)
            guard let y = Int(yearDigits), (1950...Calendar.current.component(.year, from: Date()) + 1).contains(y) else {
                throw FormError.missing("Érvényes évjárat kell.")
            }
            form["gyartasi_ev"] = String(y)

            let kmDigits = km.filter(\.isNumber)
            if !kmDigits.isEmpty { form["km"] = kmDigits }

            if !fuel.isEmpty { form["uzemanyag"] = fuel }
            if !bodyType.isEmpty { form["kivitel"] = bodyType }
            if !transmission.isEmpty { form["sebessegvalto"] = transmission }
            if !condition.isEmpty { form["allapot"] = condition }

            var titleParts = [b, m].filter { !$0.isEmpty }
            if titleParts.isEmpty { titleParts = [category.label] }
            form["hirdetes_cime"] = "\(titleParts.joined(separator: " ")) (\(y))"
        } else {
            let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !t.isEmpty else { throw FormError.missing("Add meg a hirdetés címét.") }
            form["hirdetes_cime"] = t
            if !immoCategory.isEmpty { form["ingatlan_kategoria"] = immoCategory }
            let c = city.trimmingCharacters(in: .whitespacesAndNewlines)
            if !c.isEmpty { form["telepules"] = c }
            let p = postalCode.filter(\.isNumber)
            if !p.isEmpty { form["iranyitoszam"] = p }
            let s = street.trimmingCharacters(in: .whitespacesAndNewlines)
            if !s.isEmpty { form["megtekintesi_cim"] = s }
        }

        return form
    }

    private enum FormError: LocalizedError {
        case missing(String)
        var errorDescription: String? {
            switch self {
            case .missing(let m): return m
            }
        }
    }
}
