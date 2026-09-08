import SwiftUI
import PhotosUI
import UIKit

/// Autosweb /beallitasok.html?szekcio=fiok — Fiók szerkesztése
struct SettingsScreen: View {
    @EnvironmentObject private var profile: ProfileStore
    var onClose: () -> Void

    private enum Accordion: String {
        case personal, contract, searchArea, recommendationsArea, password, notify, haImport
    }

    @State private var openAccordion: Accordion? = nil
    @State private var toast: String?
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var newPasswordConfirm = ""
    @State private var cityLookupBusy = false
    @State private var lastLookedUpPostal = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var showHaImport = false
    @State private var showDealerImport = false
    @ObservedObject private var biometricLock = BiometricLock.shared
    @ObservedObject private var contractIdentity = DeviceContractIdentityStore.shared

    private var isPrivateAccount: Bool {
        profile.profile.accountType.lowercased() == "private"
    }

    private var isBusinessLike: Bool {
        let t = profile.profile.accountType.lowercased()
        return t == "business" || t == "dealer"
    }

    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(title: "Beállítások", subtitle: "Fiók szerkesztése", onBack: onClose)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    profileHeader

                    faceIdCard

                    accordion(.personal, title: "Személyes adatok") {
                        personalFields
                    }
                    accordion(.contract, title: "Szerződéses adatok") {
                        contractFields
                    }
                    accordion(.searchArea, title: "Keresési körzet") {
                        searchAreaFields
                    }
                    accordion(.recommendationsArea, title: "Ajánlások körzete") {
                        recommendationsAreaFields
                    }
                    accordion(.password, title: "Jelszó módosítása") {
                        passwordFields
                    }
                    accordion(.notify, title: "Hírlevél és értesítések") {
                        notifyFields
                    }
                    accordion(.haImport, title: "Autóimport") {
                        haImportFields
                    }
                }
                .padding(16)
                .padding(.bottom, 32)
            }
        }
        .background(AppTheme.bgGrouped)
        .onAppear {
            contractIdentity.load(email: profile.profile.email)
            prefillContractDefaults()
        }
        .onChange(of: profile.profile.email) { _, email in
            contractIdentity.load(email: email)
            prefillContractDefaults()
        }
        .alert("Beállítások", isPresented: Binding(
            get: { toast != nil },
            set: { if !$0 { toast = nil } }
        )) {
            Button("OK", role: .cancel) { toast = nil }
        } message: {
            Text(toast ?? "")
        }
        .fullScreenCover(isPresented: $showHaImport) {
            HasznaltautoImportScreen(mode: .standard, onClose: { showHaImport = false })
        }
        .fullScreenCover(isPresented: $showDealerImport) {
            HasznaltautoImportScreen(mode: .dealer, onClose: { showDealerImport = false })
        }
    }

    // MARK: - Profil fejléc (mindig látszik)

    private var hasAvatar: Bool { profile.avatarImage != nil }

    private var profileHeader: some View {
        HStack(alignment: .center, spacing: 14) {
            ProfileAvatarView(
                image: profile.avatarImage,
                letter: profile.profile.avatarLetter,
                size: 72
            )

            VStack(alignment: .leading, spacing: 8) {
                Text(profile.profile.displayName)
                    .font(.body.weight(.semibold))
                if profile.profile.firstName.isEmpty || profile.profile.lastName.isEmpty {
                    Text("Töltsd ki a neved a Személyes adatoknál, majd Mentés.")
                        .font(.caption)
                        .foregroundStyle(AppTheme.textSecondary)
                } else if !profile.profile.email.isEmpty {
                    Text(profile.profile.email)
                        .font(.caption)
                        .foregroundStyle(AppTheme.textSecondary)
                }

                HStack(spacing: 8) {
                    PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                        Text(hasAvatar ? "Csere" : "Feltöltés")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .foregroundStyle(.white)
                            .background(AppTheme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    if hasAvatar {
                        Button("Törlés") {
                            profile.clearAvatar()
                            toast = "Profilkép törölve."
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.red)
                    }
                }
            }

            Spacer(minLength: 8)

            VStack(spacing: 4) {
                ProfileQRView(profile: profile.profile, size: 72)
                Text("Profil QR")
                    .font(.caption2)
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    profile.setAvatar(image)
                    toast = "Profilkép mentve."
                } else {
                    toast = "A kép betöltése sikertelen."
                }
                photoItem = nil
            }
        }
    }

    // MARK: - Accordion

    private func accordion<Content: View>(
        _ section: Accordion,
        title: String,
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
                    .padding(16)
            }
        }
        .background(AppTheme.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Személyes adatok

    private var personalFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("Vezetéknév")
                    TextField("", text: $profile.profile.lastName)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.familyName)
                }
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("Keresztnév")
                    TextField("", text: $profile.profile.firstName)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.givenName)
                }
            }

            if isBusinessLike {
                fieldLabel("Utca, házszám")
                TextField("", text: $profile.profile.street)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.streetAddressLine1)
            }

            postalAndCityRow

            fieldLabel("Ország")
            TextField("", text: $profile.profile.country)
                .textFieldStyle(.roundedBorder)
                .textContentType(.countryName)

            fieldLabel("Telefon")
            TextField("+36 …", text: $profile.profile.phone)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)

            fieldLabel("Email")
            TextField("email@pelda.hu", text: $profile.profile.email)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textContentType(.emailAddress)
                .disabled(true)

            fieldLabel("Fióktípus")
            Text(accountTypeLabel(profile.profile.accountType))
                .font(.body)
                .foregroundStyle(AppTheme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text("A fióktípus regisztrációkor rögzül, később nem módosítható.")
                .font(.caption)
                .foregroundStyle(AppTheme.textTertiary)

            if isBusinessLike {
                fieldLabel(profile.profile.accountType == "dealer" ? "Kereskedés neve" : "Cégnév")
                TextField("", text: $profile.profile.company)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.organizationName)
            }

            Button {
                Task { await savePersonalAndContract() }
            } label: {
                Text("Adatok mentése")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            Button(role: .destructive) {
                Task {
                    if let err = await profile.deleteAccount() {
                        toast = err
                    } else {
                        contractIdentity.clear(email: profile.profile.email)
                        onClose()
                    }
                }
            } label: {
                Text("Fiók törlése")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 8)
            }
            .buttonStyle(.plain)
        }
    }

    private var contractFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Adásvételi szerződéshez. Ezek az adatok csak a telefonon tárolódnak, a Bymy szerverre nem kerülnek.")
                .font(.footnote)
                .foregroundStyle(AppTheme.textSecondary)

            if isPrivateAccount {
                fieldLabel("Név (családi és utónév)")
                TextField("", text: $contractIdentity.identity.fullName)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.name)

                fieldLabel("Születéskori név (családi és utónév)")
                TextField("", text: $contractIdentity.identity.birthName)
                    .textFieldStyle(.roundedBorder)

                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 6) {
                        fieldLabel("Születési hely")
                        TextField("", text: $contractIdentity.identity.birthPlace)
                            .textFieldStyle(.roundedBorder)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        fieldLabel("Születési idő")
                        TextField("ÉÉÉÉ-HH-NN", text: $contractIdentity.identity.birthDate)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.numbersAndPunctuation)
                    }
                }

                fieldLabel("Anyja neve (családi és utónév)")
                TextField("", text: $contractIdentity.identity.motherName)
                    .textFieldStyle(.roundedBorder)

                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 6) {
                        fieldLabel("Személyi okmány típusa")
                        TextField("pl. személyi igazolvány", text: $contractIdentity.identity.idDocType)
                            .textFieldStyle(.roundedBorder)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        fieldLabel("Okmány száma")
                        TextField("", text: $contractIdentity.identity.idDocNumber)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                fieldLabel("Lakcíme")
                TextField("", text: $contractIdentity.identity.homeAddress)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.fullStreetAddress)

                fieldLabel("Állampolgársága")
                TextField("magyar", text: $contractIdentity.identity.citizenship)
                    .textFieldStyle(.roundedBorder)
            } else {
                fieldLabel("Név")
                TextField("", text: $contractIdentity.identity.companyName)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.organizationName)

                fieldLabel("Székhely")
                TextField("", text: $contractIdentity.identity.companySeat)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.fullStreetAddress)

                fieldLabel("Cégjegyzék vagy nyilvántartási szám")
                TextField("", text: $contractIdentity.identity.companyRegistry)
                    .textFieldStyle(.roundedBorder)

                fieldLabel("Képviselő neve")
                TextField("", text: $contractIdentity.identity.representative)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.name)
            }

            Button {
                Task { await savePersonalAndContract() }
            } label: {
                Text("Szerződéses adatok mentése")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    private func accountTypeLabel(_ type: String) -> String {
        switch type.lowercased() {
        case "business": return "Vállalkozás (nem kereskedő)"
        case "dealer": return "Autókereskedő"
        default: return "Magánszemély"
        }
    }

    private func prefillContractDefaults() {
        if isPrivateAccount {
            if contractIdentity.identity.fullName.trimmingCharacters(in: .whitespaces).isEmpty {
                let composed = "\(profile.profile.lastName) \(profile.profile.firstName)"
                    .trimmingCharacters(in: .whitespaces)
                if !composed.isEmpty {
                    contractIdentity.identity.fullName = composed
                }
            }
            if contractIdentity.identity.citizenship.trimmingCharacters(in: .whitespaces).isEmpty {
                contractIdentity.identity.citizenship = "magyar"
            }
        } else {
            if contractIdentity.identity.companyName.trimmingCharacters(in: .whitespaces).isEmpty,
               !profile.profile.company.isEmpty {
                contractIdentity.identity.companyName = profile.profile.company
            }
            if contractIdentity.identity.companySeat.trimmingCharacters(in: .whitespaces).isEmpty,
               !profile.profile.street.isEmpty {
                let parts = [profile.profile.postalCode, profile.profile.city, profile.profile.street]
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
                if !parts.isEmpty {
                    contractIdentity.identity.companySeat = parts.joined(separator: ", ")
                }
            }
            if contractIdentity.identity.representative.trimmingCharacters(in: .whitespaces).isEmpty {
                let composed = "\(profile.profile.lastName) \(profile.profile.firstName)"
                    .trimmingCharacters(in: .whitespaces)
                if !composed.isEmpty {
                    contractIdentity.identity.representative = composed
                }
            }
        }
    }

    private func savePersonalAndContract() async {
        _ = contractIdentity.save(email: profile.profile.email)
        if let err = await profile.saveProfileToServer() {
            toast = err
        } else {
            toast = "Adatok mentve. Szerződéses mezők csak a telefonon."
        }
    }

    // MARK: - Keresési körzet

    private var searchAreaFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("A gyorsikonok (Diesel, Benzin…) ezzel az irányítószámmal és km-sugárral szűrnek.")
                .font(.footnote)
                .foregroundStyle(AppTheme.textSecondary)

            postalAndCityRow

            fieldLabel("Sugár (km)")
            Picker("Sugár", selection: $profile.profile.searchRadiusKm) {
                ForEach([5, 10, 15, 20, 30, 50, 75, 100], id: \.self) { km in
                    Text("\(km) km").tag(km)
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 120)

            Button {
                profile.save()
                toast = "Keresési körzet mentve."
            } label: {
                Text("Körzet mentése")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    // MARK: - Ajánlások körzete

    private var recommendationsAreaFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Az Ajánlások oldal ezzel az irányítószámmal és km-sugárral listázza a szolgáltatókat.")
                .font(.footnote)
                .foregroundStyle(AppTheme.textSecondary)

            postalAndCityRow

            fieldLabel("Sugár (km)")
            Picker("Sugár", selection: $profile.profile.recommendationsRadiusKm) {
                ForEach([5, 10, 15, 20, 30], id: \.self) { km in
                    Text("\(km) km").tag(km)
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 120)

            Text("Maximum 30 km (Autosweb).")
                .font(.caption)
                .foregroundStyle(AppTheme.textTertiary)

            Button {
                let digits = String(profile.profile.postalCode.filter(\.isNumber).prefix(4))
                if digits.count == 4 {
                    profile.profile.postalCode = digits
                }
                if profile.profile.recommendationsRadiusKm > 30 {
                    profile.profile.recommendationsRadiusKm = 30
                }
                profile.save()
                toast = "Ajánlások körzete mentve."
            } label: {
                Text("Körzet mentése")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    // MARK: - Jelszó

    private var passwordFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            SecureField("Jelenlegi jelszó", text: $currentPassword)
                .textFieldStyle(.roundedBorder)
            SecureField("Új jelszó", text: $newPassword)
                .textFieldStyle(.roundedBorder)
            SecureField("Új jelszó mégegyszer", text: $newPasswordConfirm)
                .textFieldStyle(.roundedBorder)
            Button {
                Task {
                    if let err = await profile.changePassword(
                        current: currentPassword,
                        newPassword: newPassword,
                        confirm: newPasswordConfirm
                    ) {
                        toast = err
                        return
                    }
                    currentPassword = ""
                    newPassword = ""
                    newPasswordConfirm = ""
                    toast = "Jelszó mentve (web + app)."
                }
            } label: {
                Text("Jelszó mentése")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    // MARK: - Face ID

    private var faceIdCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: Binding(
                get: { biometricLock.isEnabled },
                set: { on in
                    Task {
                        let ok = await biometricLock.setEnabled(on)
                        if !ok, on {
                            toast = biometricLock.lastError ?? "\(biometricLock.biometryTitle) sikertelen."
                        }
                    }
                }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(biometricLock.biometryTitle)
                        .font(.body.weight(.semibold))
                    Text(biometricLock.settingsSubtitle)
                        .font(.caption)
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            .tint(.green)
            .disabled(!biometricLock.isAvailable)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.bg)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Hírlevél

    private var notifyFields: some View {
        VStack(alignment: .leading, spacing: 4) {
            Toggle("Üzenetek e-mailben", isOn: $profile.profile.notifyMessages)
                .tint(.green)
            Toggle("Kedvencek: árváltozás", isOn: $profile.profile.notifyFavorites)
                .tint(.green)
            Toggle("Érdeklődések", isOn: $profile.profile.notifyInterests)
                .tint(.green)
            Toggle("Hírlevél / tippek (marketing)", isOn: $profile.profile.notifyNewsletter)
                .tint(.green)

            Button {
                profile.save()
                toast = "Értesítési beállítások mentve."
            } label: {
                Text("Értesítések mentése")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Autóimport

    private var haImportFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Hirdetéseid átvétele a hasznaltauto.hu-ról. Jelentkezz be az oldalon, nyisd meg a hirdetést vagy a listát, majd importálj.")
                .font(.footnote)
                .foregroundStyle(AppTheme.textSecondary)

            Button {
                showHaImport = true
            } label: {
                Text("Használtautó import")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)

            Button {
                showDealerImport = true
            } label: {
                Text("Kereskedői import")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(AppTheme.text)
                    .background(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Shared

    private var postalAndCityRow: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("Irányítószám")
                TextField("7083", text: $profile.profile.postalCode)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.postalCode)
                    .keyboardType(.numberPad)
                    .frame(width: 96)
                    .onChange(of: profile.profile.postalCode) { _, newValue in
                        let digits = String(newValue.filter(\.isNumber).prefix(4))
                        if digits != newValue {
                            profile.profile.postalCode = digits
                            return
                        }
                        Task { await lookupCityFromPostal() }
                    }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    fieldLabel("Település")
                    if cityLookupBusy {
                        ProgressView()
                            .scaleEffect(0.7)
                    }
                }
                TextField("automatikus", text: $profile.profile.city)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.addressCity)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .task {
            await lookupCityFromPostal()
        }
    }

    private func lookupCityFromPostal() async {
        let digits = String(profile.profile.postalCode.filter(\.isNumber).prefix(4))
        guard digits.count == 4 else { return }
        guard digits != lastLookedUpPostal else { return }
        cityLookupBusy = true
        defer { cityLookupBusy = false }
        if let city = await PartnerRecommendationsClient.lookupCity(postalCode: digits) {
            lastLookedUpPostal = digits
            profile.profile.city = city
            profile.profile.postalCode = digits
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.textSecondary)
    }
}
