import SwiftUI

/// Mobil web `belepes.html` / `auth-gate` kinézet.
struct LoginScreen: View {
    enum Mode {
        case login
        case register
    }

    let mode: Mode
    var isGate: Bool = false

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var passwordConfirm = ""
    @State private var busy = false
    @State private var errorText: String?

    private let pageBg = Color(red: 0.945, green: 0.961, blue: 0.976) // #f1f5f9

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                card
                    .padding(.horizontal, 20)
                    .padding(.vertical, 28)
            }
            .frame(maxWidth: .infinity)
        }
        .background(pageBg.ignoresSafeArea())
        .interactiveDismissDisabled(isGate)
    }

    private var card: some View {
        VStack(spacing: 0) {
            Image("BymyLogo")
                .resizable()
                .scaledToFit()
                .frame(height: 36)
                .padding(.bottom, 16)

            Text(mode == .login ? "Belépés" : "Regisztráció")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AppTheme.text)
                .padding(.bottom, 6)

            Text(mode == .login
                 ? "A Bymy csak regisztrált felhasználóknak érhető el. Jelentkezz be a folytatáshoz."
                 : "Hozz létre fiókot a folytatáshoz.")
                .font(.system(size: 14))
                .foregroundStyle(Color(red: 0.392, green: 0.455, blue: 0.545))
                .multilineTextAlignment(.center)
                .padding(.bottom, 16)

            SocialAuthButtons(style: .gate) {
                finish()
            }
            .padding(.bottom, 14)

            HStack {
                Rectangle().fill(AppTheme.border).frame(height: 1)
                Text("vagy emaillel")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(red: 0.6, green: 0.6, blue: 0.6))
                    .textCase(.uppercase)
                Rectangle().fill(AppTheme.border).frame(height: 1)
            }
            .padding(.bottom, 14)

            VStack(alignment: .leading, spacing: 12) {
                labeledField("Email vagy felhasználónév", text: $email, placeholder: "pelda@email.hu", secure: false)
                labeledField(mode == .register ? "Jelszó (8–12 karakter)" : "Jelszó", text: $password, placeholder: "", secure: true)
                if mode == .register {
                    labeledField("Jelszó újra", text: $passwordConfirm, placeholder: "", secure: true)
                }

                if let errorText {
                    Text(errorText)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        Spacer()
                        if busy {
                            ProgressView().tint(.white)
                        } else {
                            Text(mode == .login ? "Belépés" : "Regisztráció")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 14)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(busy || email.isEmpty || password.isEmpty)
            }

            HStack(spacing: 4) {
                if mode == .login {
                    Text("Nincs még fiókod?")
                        .foregroundStyle(Color(red: 0.392, green: 0.455, blue: 0.545))
                    Button("Regisztráció") {
                        if isGate {
                            router.showRegister = true
                        } else {
                            dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                router.showRegister = true
                            }
                        }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(AppTheme.accent)
                } else {
                    Text("Van már fiókod?")
                        .foregroundStyle(Color(red: 0.392, green: 0.455, blue: 0.545))
                    Button("Belépés") {
                        if isGate {
                            router.showRegister = false
                            router.showLogin = false
                        } else {
                            dismiss()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                router.showLogin = true
                            }
                        }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(AppTheme.accent)
                }
            }
            .font(.system(size: 14))
            .padding(.top, 16)
        }
        .padding(22)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(red: 0.886, green: 0.910, blue: 0.941), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.08), radius: 20, y: 8)
        .frame(maxWidth: 420)
    }

    private func labeledField(_ title: String, text: Binding<String>, placeholder: String, secure: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AppTheme.text)
            Group {
                if secure {
                    SecureField(placeholder.isEmpty ? "••••••••" : placeholder, text: text)
                } else {
                    TextField(placeholder, text: text)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                }
            }
            .padding(12)
            .background(Color(red: 0.973, green: 0.980, blue: 0.988))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(AppTheme.border, lineWidth: 1)
            )
        }
    }

    private func finish() {
        if isGate {
            router.showLogin = false
            router.showRegister = false
        } else {
            dismiss()
        }
    }

    private func submit() async {
        busy = true
        errorText = nil
        defer { busy = false }
        do {
            let result: (token: String, user: AuthAPI.RemoteUser)
            if mode == .login {
                result = try await AuthAPI.login(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password
                )
            } else {
                if password.count < 8 || password.count > 12 {
                    errorText = "A jelszó 8–12 karakter legyen."
                    return
                }
                result = try await AuthAPI.register(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password,
                    passwordConfirm: passwordConfirm
                )
            }
            auth.apply(token: result.token, user: result.user)
            finish()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
