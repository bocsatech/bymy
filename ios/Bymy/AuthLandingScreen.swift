import SwiftUI
import UIKit

/// Üdvözlő (csak logo) → belépő módszer választó (fotó szerinti képernyő).
/// E-mail / telefon / regisztráció külön következő oldal — billentyűnél felgörget.
struct AuthLandingScreen: View {
    @EnvironmentObject private var profile: ProfileStore

    private enum Phase: Equatable {
        case splash
        case choose
        case email
        case phone
        case register
    }

    @State private var phase: Phase = .splash
    @State private var busyProvider: SocialAuthProvider?
    @State private var showHelp = false
    @State private var showServerSheet = false

    /// Fotó: krém / off-white háttér
    private let pageBg = Color(red: 0.980, green: 0.965, blue: 0.945)

    var body: some View {
        ZStack {
            pageBg.ignoresSafeArea()

            switch phase {
            case .splash:
                splashView
                    .transition(.opacity)
            case .choose:
                loginChooser
                    .transition(.opacity)
            case .email:
                AuthCredentialScreen(method: .email, onBack: { phase = .choose })
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            case .phone:
                AuthCredentialScreen(method: .phone, onBack: { phase = .choose })
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            case .register:
                AuthRegisterForm(onBack: { phase = .choose })
                    .environmentObject(profile)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.35), value: phase)
        .onAppear {
            profile.authError = nil
            guard phase == .splash else { return }
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(1100))
                phase = .choose
            }
        }
        .alert("Bejelentkezési segítség", isPresented: $showHelp) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Próbáld Apple / Google / Facebook belépést, vagy e-mailt. Ha nem megy, ellenőrizd az internetet, majd próbáld újra.")
        }
        .sheet(isPresented: $showServerSheet) {
            AuthServerSettingsSheet()
        }
    }

    // MARK: - Üdvözlő (NEM a belépő oldal)

    private var splashView: some View {
        Image("BymyLogo")
            .resizable()
            .scaledToFit()
            .padding(.horizontal, 48)
            .accessibilityLabel("Bymy")
    }

    // MARK: - Belépő oldal (fotó)

    private var loginChooser: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button {
                    showServerSheet = true
                } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Color(red: 0.45, green: 0.45, blue: 0.45))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Beállítások")
            }
            .padding(.horizontal, 8)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    Image("BymyLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 240)
                        .padding(.top, 4)
                        .padding(.bottom, 28)
                        .accessibilityLabel("Bymy")

                    Text("Bejelentkezés")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Color(red: 0.07, green: 0.07, blue: 0.07))
                        .padding(.bottom, 8)

                    Text("Válaszd ki, hogyan lépsz be.")
                        .font(.system(size: 16))
                        .foregroundStyle(Color(red: 0.45, green: 0.45, blue: 0.45))
                        .padding(.bottom, 28)

                    VStack(spacing: 10) {
                        methodButton(
                            title: "Tovább Apple-lel",
                            style: .applePrimary,
                            systemImage: "apple.logo",
                            busy: busyProvider == .apple
                        ) {
                            Task { await runSocial(.apple) }
                        }
                        methodRow(
                            title: "Tovább Google-lal",
                            leading: { googleGlyph },
                            busy: busyProvider == .google
                        ) {
                            Task { await runSocial(.google) }
                        }
                        methodRow(
                            title: "Tovább Facebookkal",
                            leading: { facebookGlyph },
                            busy: busyProvider == .facebook
                        ) {
                            Task { await runSocial(.facebook) }
                        }
                        methodRow(
                            title: "Tovább e-maillel",
                            systemImage: "envelope",
                            busy: false
                        ) {
                            profile.authError = nil
                            phase = .email
                        }
                        methodRow(
                            title: "Tovább telefonszámmal",
                            systemImage: "iphone",
                            busy: false
                        ) {
                            profile.authError = nil
                            phase = .phone
                        }
                    }
                    .padding(.horizontal, 32)
                    .disabled(busyProvider != nil)

                    if let err = profile.authError, !err.isEmpty {
                        Text(err)
                            .font(.footnote)
                            .foregroundStyle(Color(red: 0.75, green: 0.12, blue: 0.12))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                            .padding(.top, 16)
                    }

                    Spacer(minLength: 40)

                    Button("Probléma a bejelentkezéssel?") {
                        showHelp = true
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(Color(red: 0.55, green: 0.55, blue: 0.55))
                    .padding(.bottom, 14)

                    HStack(spacing: 18) {
                        Text("Bejelentkezés")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 22)
                            .padding(.vertical, 12)
                            .background(Color(red: 0.12, green: 0.12, blue: 0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                        Button("Regisztráció") {
                            profile.authError = nil
                            phase = .register
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color(red: 0.12, green: 0.12, blue: 0.12))
                    }
                    .padding(.bottom, 28)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Gombok

    private func methodButton(
        title: String,
        style: MethodStyle = .applePrimary,
        systemImage: String? = nil,
        busy: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if busy {
                    ProgressView().tint(.white).frame(width: 22, height: 22)
                } else if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 17, weight: .medium))
                        .frame(width: 22, height: 22)
                }
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    /// Fotó: Apple alatt sima sorok (nem keretes kártyák).
    private func methodRow(
        title: String,
        systemImage: String? = nil,
        leading: (() -> AnyView)? = nil,
        busy: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                if busy {
                    ProgressView().frame(width: 22, height: 22)
                } else if let leading {
                    leading()
                } else if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(Color(red: 0.12, green: 0.12, blue: 0.12))
                        .frame(width: 22, height: 22)
                }
                Text(title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color(red: 0.07, green: 0.07, blue: 0.07))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private enum MethodStyle {
        case applePrimary
    }

    private var googleGlyph: AnyView {
        AnyView(
            Text("G")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color(red: 0.26, green: 0.52, blue: 0.96),
                            Color(red: 0.22, green: 0.73, blue: 0.33),
                            Color(red: 0.98, green: 0.74, blue: 0.02),
                            Color(red: 0.92, green: 0.26, blue: 0.21),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 22, height: 22)
        )
    }

    private var facebookGlyph: AnyView {
        AnyView(
            Text("f")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color(red: 0.09, green: 0.47, blue: 0.95))
                .frame(width: 22, height: 22)
        )
    }

    @MainActor
    private func runSocial(_ provider: SocialAuthProvider) async {
        busyProvider = provider
        defer { busyProvider = nil }
        _ = await profile.signInSocial(provider: provider)
    }
}

// MARK: - Regisztráció

struct AuthRegisterForm: View {
    @EnvironmentObject private var profile: ProfileStore
    var onBack: () -> Void

    private enum Field: Hashable { case email, password, passwordConfirm }

    @State private var email = ""
    @State private var password = ""
    @State private var passwordConfirm = ""
    @State private var busy = false
    @FocusState private var focused: Field?

    private let pageBg = Color(red: 0.980, green: 0.965, blue: 0.945)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Vissza", action: onBack)
                    .font(.body.weight(.medium))
                    .foregroundStyle(AppTheme.accent)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Regisztráció")
                            .font(.system(size: 26, weight: .bold))
                        Text("Hozz létre fiókot e-mail címmel.")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.textSecondary)

                        field("Email") {
                            TextField("pelda@email.hu", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focused, equals: .email)
                        }
                        field("Jelszó") {
                            SecureField("", text: $password)
                                .textContentType(.newPassword)
                                .focused($focused, equals: .password)
                        }
                        field("Jelszó megerősítése") {
                            SecureField("", text: $passwordConfirm)
                                .textContentType(.newPassword)
                                .focused($focused, equals: .passwordConfirm)
                        }

                        if let err = profile.authError, !err.isEmpty {
                            Text(err)
                                .font(.footnote)
                                .foregroundStyle(Color(red: 0.75, green: 0.12, blue: 0.12))
                        }

                        Button {
                            focused = nil
                            Task { await submit() }
                        } label: {
                            Group {
                                if busy {
                                    ProgressView().tint(.white)
                                } else {
                                    Text("Regisztráció")
                                        .font(.body.weight(.semibold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .foregroundStyle(.white)
                            .background(Color.black)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .disabled(busy || !canSubmit)
                        .padding(.top, 6)
                        .id("submitButton")
                    }
                    .padding(20)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .padding(16)

                    Color.clear.frame(height: 40).id("scrollBottom")
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: focused) { _, v in
                    guard v != nil else { return }
                    scrollToSubmit(proxy)
                }
                .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                    scrollToSubmit(proxy)
                }
            }
        }
        .background(pageBg.ignoresSafeArea())
        .onAppear { profile.authError = nil }
    }

    private func scrollToSubmit(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo("submitButton", anchor: .bottom)
            }
        }
    }

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !password.isEmpty
            && !passwordConfirm.isEmpty
    }

    private func field<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
            content()
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
        }
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        let mail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = await profile.register(email: mail, password: password, passwordConfirm: passwordConfirm)
    }
}

// MARK: - Fogaskerék

private struct AuthServerSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var urlText = AutoswebBaseURL.currentString()
    @State private var note: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("API cím") {
                    TextField("https://bymy.vercel.app", text: $urlText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    if let note {
                        Text(note).font(.footnote).foregroundStyle(AppTheme.textSecondary)
                    }
                }
                Section {
                    Button("Mentés") {
                        if AutoswebBaseURL.set(urlText) != nil {
                            note = "Mentve."
                            dismiss()
                        } else {
                            note = "Érvénytelen cím."
                        }
                    }
                    Button("Alapértelmezett (bymy.vercel.app)") {
                        _ = AutoswebBaseURL.set("")
                        urlText = AutoswebBaseURL.currentString()
                        note = "Visszaállítva."
                    }
                }
            }
            .navigationTitle("Beállítások")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kész") { dismiss() }
                }
            }
        }
    }
}

// MARK: - E-mail / telefon (billentyű: felgörget)

struct AuthCredentialScreen: View {
    @EnvironmentObject private var profile: ProfileStore

    enum Method {
        case email, phone
    }

    private enum Field: Hashable { case account, password }

    let method: Method
    var onBack: () -> Void

    @State private var email = ""
    @State private var phone = ""
    @State private var password = ""
    @State private var busy = false
    @FocusState private var focused: Field?

    private let cream = Color(red: 0.980, green: 0.965, blue: 0.945)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Vissza", action: onBack)
                    .font(.body.weight(.medium))
                    .foregroundStyle(AppTheme.accent)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(title)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(AppTheme.text)

                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.textSecondary)

                        if method == .email {
                            fieldLabel("Email")
                            TextField("pelda@email.hu", text: $email)
                                .textFieldStyle(.plain)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 11)
                                .background(Color.white)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(AppTheme.border, lineWidth: 1)
                                )
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focused, equals: .account)
                        } else {
                            fieldLabel("Telefonszám")
                            TextField("+36 30 …", text: $phone)
                                .textFieldStyle(.plain)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 11)
                                .background(Color.white)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(AppTheme.border, lineWidth: 1)
                                )
                                .textContentType(.telephoneNumber)
                                .keyboardType(.phonePad)
                                .focused($focused, equals: .account)
                        }

                        fieldLabel("Jelszó")
                        SecureField("", text: $password)
                            .textFieldStyle(.plain)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 11)
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(AppTheme.border, lineWidth: 1)
                            )
                            .textContentType(.password)
                            .focused($focused, equals: .password)

                        if let err = profile.authError, !err.isEmpty {
                            Text(err)
                                .font(.footnote)
                                .foregroundStyle(Color(red: 0.75, green: 0.12, blue: 0.12))
                        }

                        Button {
                            focused = nil
                            Task { await submit() }
                        } label: {
                            Group {
                                if busy {
                                    ProgressView().tint(.white)
                                } else {
                                    Text("Belépés")
                                        .font(.body.weight(.semibold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .foregroundStyle(.white)
                            .background(Color(red: 0.067, green: 0.067, blue: 0.067))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .disabled(busy || !canSubmit)
                        .padding(.top, 4)
                        .id("submitButton")
                    }
                    .padding(20)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                    .padding(16)

                    Color.clear.frame(height: 40).id("scrollBottom")
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: focused) { _, v in
                    guard v != nil else { return }
                    scrollToSubmit(proxy)
                }
                .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                    scrollToSubmit(proxy)
                }
            }
        }
        .background(cream.ignoresSafeArea())
        .onAppear { profile.authError = nil }
    }

    private func scrollToSubmit(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo("submitButton", anchor: .bottom)
            }
        }
    }

    private var title: String {
        method == .email ? "Belépés e-maillel" : "Belépés telefonszámmal"
    }

    private var subtitle: String {
        method == .email
            ? "Add meg az email címed és a jelszavad. Ha még nincs fiókod, létrehozzuk."
            : "A telefonszám lesz a fiókod azonosítója. Ha még nincs fiókod, létrehozzuk."
    }

    private var canSubmit: Bool {
        if password.isEmpty { return false }
        if method == .email {
            return !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return phone.filter(\.isNumber).count >= 7
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.textSecondary)
    }

    private func phoneAccountEmail(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        return "t\(digits)@phone.bymy.local"
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        let accountEmail: String
        let phoneValue: String
        if method == .email {
            accountEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
            phoneValue = ""
        } else {
            phoneValue = phone.trimmingCharacters(in: .whitespacesAndNewlines)
            accountEmail = phoneAccountEmail(phoneValue)
        }

        let result = await profile.loginOrRegister(email: accountEmail, password: password)
        if result.ok {
            if result.created, method == .phone, !phoneValue.isEmpty {
                profile.profile.phone = phoneValue
                profile.saveLocal()
                _ = await profile.saveProfileToServer()
            }
            password = ""
        }
    }
}
