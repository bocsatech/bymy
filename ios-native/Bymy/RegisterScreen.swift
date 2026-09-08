import SwiftUI

/// Autosweb `/regisztracio.html` — külön Regisztráció képernyő.
struct RegisterScreen: View {
    @EnvironmentObject private var profile: ProfileStore

    var onClose: (() -> Void)? = nil
    var onGoLogin: (() -> Void)? = nil
    var onSuccess: (() -> Void)? = nil

    @State private var email = ""
    @State private var password = ""
    @State private var passwordConfirm = ""
    @State private var busy = false

    var body: some View {
        VStack(spacing: 0) {
            if onClose != nil {
                authNavBar
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    authCard {
                        Text("Regisztráció")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(AppTheme.text)
                            .padding(.bottom, 6)

                        Text("Hozz létre fiókot Apple, Google, Facebook vagy e-mail címmel.")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.textSecondary)
                            .padding(.bottom, 16)

                        SocialAuthButtons {
                            onSuccess?()
                            onClose?()
                        }
                        .padding(.bottom, 16)

                        HStack {
                            Rectangle().fill(AppTheme.border).frame(height: 1)
                            Text("vagy emaillel")
                                .font(.footnote)
                                .foregroundStyle(AppTheme.textSecondary)
                            Rectangle().fill(AppTheme.border).frame(height: 1)
                        }
                        .padding(.bottom, 16)

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
                            .padding(.bottom, 12)

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
                            .textContentType(.newPassword)
                            .padding(.bottom, 12)

                        fieldLabel("Jelszó megerősítése")
                        SecureField("", text: $passwordConfirm)
                            .textFieldStyle(.plain)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 11)
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(AppTheme.border, lineWidth: 1)
                            )
                            .textContentType(.newPassword)
                            .padding(.bottom, 12)

                        if let err = profile.authError, !err.isEmpty {
                            Text(err)
                                .font(.footnote)
                                .foregroundStyle(Color(red: 0.75, green: 0.12, blue: 0.12))
                                .padding(.bottom, 10)
                        }

                        Button {
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
                            .padding(.vertical, 13)
                            .foregroundStyle(.white)
                            .background(Color(red: 0.067, green: 0.067, blue: 0.067))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .disabled(
                            busy
                                || email.trimmingCharacters(in: .whitespaces).isEmpty
                                || password.isEmpty
                                || passwordConfirm.isEmpty
                        )
                        .padding(.top, 4)

                        HStack(spacing: 4) {
                            Text("Már van fiókod?")
                                .foregroundStyle(AppTheme.textSecondary)
                            Button("Belépés") {
                                profile.authError = nil
                                onGoLogin?()
                            }
                            .fontWeight(.medium)
                            .foregroundStyle(AppTheme.accent)
                        }
                        .font(.footnote)
                        .padding(.top, 16)
                    }
                    .padding(16)
                }
            }
        }
        .background(Color(red: 0.965, green: 0.969, blue: 0.976).ignoresSafeArea())
        .onAppear { profile.authError = nil }
    }

    private var authNavBar: some View {
        HStack {
            if let onClose {
                Button("‹ Vissza", action: onClose)
                    .foregroundStyle(AppTheme.accent)
                    .font(.body.weight(.medium))
            }
            Spacer()
            Text("Bymy")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.text)
            Spacer()
            if onClose != nil {
                Color.clear.frame(width: 72, height: 1)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white)
        .overlay(alignment: .bottom) {
            Rectangle().fill(AppTheme.border).frame(height: 1)
        }
    }

    private func authCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            content()
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.textSecondary)
            .padding(.bottom, 4)
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        let ok = await profile.register(
            email: email,
            password: password,
            passwordConfirm: passwordConfirm
        )
        if ok {
            password = ""
            passwordConfirm = ""
            onSuccess?()
            onClose?()
        }
    }
}

#Preview {
    RegisterScreen(onClose: {}, onGoLogin: {})
        .environmentObject(ProfileStore())
}
