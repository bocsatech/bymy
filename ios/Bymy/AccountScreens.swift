import SwiftUI
import UIKit

enum FiokSection: String, Hashable, Identifiable {
    case partnerProfil
    case nyomtatasok
    case ertekelesek
    case kedvencek
    case sajatHirdetesek
    case mentettKeresesek
    case szemelyes
    case keresesiKorzet
    case ajanlasokKorzet
    case jelszo
    case notify
    case megjelenes

    var id: String { rawValue }

    var title: String {
        switch self {
        case .partnerProfil: return "Partneri profil"
        case .nyomtatasok: return "Nyomtatások"
        case .ertekelesek: return "Értékelések"
        case .kedvencek: return "Kedvencek"
        case .sajatHirdetesek: return "Saját hirdetések"
        case .mentettKeresesek: return "Mentett kereséseim"
        case .szemelyes: return "Személyes adatok"
        case .keresesiKorzet: return "Keresési körzet"
        case .ajanlasokKorzet: return "Ajánlások körzete"
        case .jelszo: return "Jelszó módosítása"
        case .notify: return "Hírlevél és értesítések"
        case .megjelenes: return "Megjelenés"
        }
    }
}

/// Profilkép: data URL vagy betű.
struct ProfileAvatarView: View {
    let letter: String
    var dataURL: String? = nil
    var size: CGFloat = 32

    var body: some View {
        ZStack {
            Circle().fill(AppTheme.avatarBg)
            if let image = decodedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            } else {
                Text(letter)
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundStyle(AppTheme.text)
            }
        }
        .frame(width: size, height: size)
        .overlay(Circle().stroke(AppTheme.border, lineWidth: 1.5))
    }

    private var decodedImage: UIImage? {
        guard let raw = dataURL?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if raw.hasPrefix("data:"), let comma = raw.firstIndex(of: ",") {
            let b64 = String(raw[raw.index(after: comma)...])
            if let data = Data(base64Encoded: b64) {
                return UIImage(data: data)
            }
        }
        if let data = Data(base64Encoded: raw) {
            return UIImage(data: data)
        }
        return nil
    }
}

struct AccountScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var companyExpanded = true
    @State private var settingsExpanded = true

    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)

    private var isCompany: Bool {
        let t = (auth.user?.profile.accountType ?? "").lowercased()
        return t == "business" || t == "dealer"
    }

    var body: some View {
        VStack(spacing: 0) {
            fiokHeader

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    profileHead
                    menuCard
                    logoutButton
                }
            }
        }
        .background(pageBg.ignoresSafeArea())
    }

    private var profileHead: some View {
        HStack(spacing: 14) {
            ProfileAvatarView(
                letter: auth.avatarLetter,
                dataURL: auth.user?.profile.avatarDataUrl,
                size: 56
            )

            VStack(alignment: .leading, spacing: 4) {
                Text("Fiókom")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                Text("Üdv, \(auth.displayFirstName)")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AppTheme.text)
                if isCompany {
                    Text(auth.user?.profile.accountType == "dealer" ? "Kereskedő" : "Cég")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(Color.white)
    }

    private var menuCard: some View {
        VStack(spacing: 0) {
            if isCompany {
                expandRow(
                    icon: "building.2.fill",
                    title: "Cégadatok",
                    expanded: companyExpanded
                ) {
                    companyExpanded.toggle()
                }
                if companyExpanded {
                    subRow(icon: "house.fill", title: "Partneri profil") {
                        router.openFiokSection(.partnerProfil)
                    }
                }
            }

            // Autóimport: spec szerint nincs telefonon
            menuRow(icon: "doc.text.fill", title: "Nyomtatások") {
                router.openFiokSection(.nyomtatasok)
            }
            menuRow(icon: "star.fill", title: "Értékelések") {
                router.openFiokSection(.ertekelesek)
            }
            soonRow(icon: "plus.square.fill", title: "Kiemelések")
            menuRow(icon: "heart.fill", title: "Kedvencek") {
                router.openFiokSection(.kedvencek)
            }
            menuRow(icon: "rectangle.stack.fill", title: "Saját hirdetések") {
                router.openFiokSection(.sajatHirdetesek)
            }
            menuRow(icon: "magnifyingglass", title: "Mentett kereséseim") {
                router.openFiokSection(.mentettKeresesek)
            }
            menuRow(icon: "bubble.left.and.bubble.right.fill", title: "Üzenetek") {
                router.showMessages = true
            }

            expandRow(
                icon: "gearshape.fill",
                title: "Beállítások",
                expanded: settingsExpanded
            ) {
                settingsExpanded.toggle()
            }

            if settingsExpanded {
                subRow(icon: "person.fill", title: "Személyes adatok") {
                    router.openFiokSection(.szemelyes)
                }
                subRow(icon: "circle.dotted", title: "Keresési körzet") {
                    router.openFiokSection(.keresesiKorzet)
                }
                subRow(icon: "mappin.and.ellipse", title: "Ajánlások körzete") {
                    router.openFiokSection(.ajanlasokKorzet)
                }
                subRow(icon: "lock.fill", title: "Jelszó módosítása") {
                    router.openFiokSection(.jelszo)
                }
                subRow(icon: "bell.fill", title: "Hírlevél és értesítések") {
                    router.openFiokSection(.notify)
                }
                subRow(icon: "circle.lefthalf.filled", title: "Megjelenés") {
                    router.openFiokSection(.megjelenes)
                }
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private var logoutButton: some View {
        Button {
            Task {
                await auth.logout()
                router.selectBottom(.home, isLoggedIn: false)
            }
        } label: {
            Text("Kijelentkezés")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 28)
    }

    private var fiokHeader: some View {
        HStack {
            Button {
                router.selectBottom(.home, isLoggedIn: true)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                    Text("Vissza")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(AppTheme.accent)
            }
            .buttonStyle(.plain)

            Spacer()

            Text("Fiókom")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(AppTheme.text)

            Spacer()

            Color.clear.frame(width: 72, height: 1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white)
        .overlay(alignment: .bottom) {
            Rectangle().fill(AppTheme.border).frame(height: 1)
        }
    }

    private func menuRow(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                iconBadge(icon)
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                Spacer()
                chevron
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .overlay(alignment: .bottom) { rowDivider }
        }
        .buttonStyle(.plain)
    }

    private func expandRow(icon: String, title: String, expanded: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                iconBadge(icon)
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                Spacer()
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.tabInactive)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .overlay(alignment: .bottom) { rowDivider }
        }
        .buttonStyle(.plain)
    }

    private func subRow(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                iconBadge(icon, small: true)
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                Spacer()
                chevron
            }
            .padding(.leading, 28)
            .padding(.trailing, 14)
            .padding(.vertical, 11)
            .background(Color(red: 0.973, green: 0.976, blue: 0.98))
            .overlay(alignment: .bottom) { rowDivider.padding(.leading, 78) }
        }
        .buttonStyle(.plain)
    }

    private func soonRow(icon: String, title: String) -> some View {
        HStack(spacing: 14) {
            iconBadge(icon)
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AppTheme.tabInactive)
            Spacer()
            Text("Hamarosan")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(AppTheme.tabInactive)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(red: 0.949, green: 0.957, blue: 0.969))
                .clipShape(Capsule())
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { rowDivider }
    }

    private func iconBadge(_ icon: String, small: Bool = false) -> some View {
        let size: CGFloat = small ? 30 : 36
        return ZStack {
            RoundedRectangle(cornerRadius: small ? 8 : 10, style: .continuous)
                .fill(AppTheme.accent.opacity(0.1))
            Image(systemName: icon)
                .font(.system(size: small ? 13 : 15, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
        }
        .frame(width: size, height: size)
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(AppTheme.tabInactive)
    }

    private var rowDivider: some View {
        Rectangle().fill(AppTheme.border).frame(height: 1).padding(.leading, 64)
    }
}

// MARK: - Section screens

struct FiokSectionScreen: View {
    let section: FiokSection
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        Group {
            switch section {
            case .szemelyes:
                PersonalDataScreen()
            case .jelszo:
                PasswordChangeScreen()
            case .notify:
                NotifyPrefsScreen()
            case .keresesiKorzet:
                RadiusSettingsScreen(kind: .search)
            case .ajanlasokKorzet:
                RadiusSettingsScreen(kind: .recommendations)
            case .megjelenes:
                AppearanceScreen()
            default:
                FiokPlaceholderScreen(title: section.title)
            }
        }
        .navigationTitle(section.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    router.openFiokSection(nil)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Vissza")
                    }
                }
            }
        }
        .toolbar(.visible, for: .navigationBar)
    }
}

struct FiokPlaceholderScreen: View {
    let title: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "rectangle.stack")
                .font(.system(size: 36))
                .foregroundStyle(AppTheme.tabInactive)
            Text(title)
                .font(.system(size: 18, weight: .bold))
            Text("Ez a rész hamarosan elérhető az appban.")
                .font(.system(size: 14))
                .foregroundStyle(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.bg)
    }
}

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
                    Text(flash)
                        .foregroundStyle(flashOk ? .green : .red)
                }
            }

            Section {
                Button {
                    Task { await save() }
                } label: {
                    if busy {
                        ProgressView()
                    } else {
                        Text("Mentés")
                            .fontWeight(.semibold)
                    }
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
                Section {
                    Text(flash).foregroundStyle(flashOk ? .green : .red)
                }
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
                Toggle("Kedvencek", isOn: $favorites)
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
            if !options.contains(radiusKm) {
                radiusKm = kind == .search ? 30 : 30
            }
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

struct MessagesPlaceholderScreen: View {
    var body: some View {
        MessagesInboxScreen()
    }
}
