import SwiftUI

struct LoginScreen: View {
    enum Mode {
        case login
        case register
    }

    let mode: Mode

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var passwordConfirm = ""
    @State private var busy = false
    @State private var errorText: String?

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                SecureField("Jelszó", text: $password)
                if mode == .register {
                    SecureField("Jelszó újra", text: $passwordConfirm)
                }
            }

            if let errorText {
                Section {
                    Text(errorText)
                        .foregroundStyle(.red)
                        .font(.system(size: 14))
                }
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        Spacer()
                        if busy {
                            ProgressView()
                        } else {
                            Text(mode == .login ? "Belépés" : "Regisztráció")
                                .fontWeight(.semibold)
                        }
                        Spacer()
                    }
                }
                .disabled(busy || email.isEmpty || password.isEmpty)
            }

            Section {
                if mode == .login {
                    Button("Nincs fiókod? Regisztráció") {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            router.showRegister = true
                        }
                    }
                } else {
                    Button("Van már fiókod? Belépés") {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            router.showLogin = true
                        }
                    }
                }
            }
        }
        .navigationTitle(mode == .login ? "Belépés" : "Regisztráció")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Bezárás") { dismiss() }
            }
        }
    }

    private func submit() async {
        busy = true
        errorText = nil
        defer { busy = false }
        do {
            let result: (token: String, user: AuthAPI.RemoteUser)
            if mode == .login {
                result = try await AuthAPI.login(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            } else {
                result = try await AuthAPI.register(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password,
                    passwordConfirm: passwordConfirm
                )
            }
            auth.apply(token: result.token, user: result.user)
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
