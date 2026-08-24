import SwiftUI
import UIKit

/// Autosweb `/belepes.html` — külön Belépés képernyő.
struct LoginScreen: View {
    @EnvironmentObject private var profile: ProfileStore

    var onClose: (() -> Void)? = nil
    var onGoRegister: (() -> Void)? = nil
    /// Sikeres belépés után (pl. Beállítások megnyitása)
    var onSuccess: (() -> Void)? = nil

    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @FocusState private var focused: Field?

    private enum Field: Hashable { case email, password }

    var body: some View {
        VStack(spacing: 0) {
            if onClose != nil {
                authNavBar(title: "Belépés")
            }

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        authCard {
                            Text("Belépés")
                                .font(.title2.weight(.bold))
                                .foregroundStyle(AppTheme.text)
                                .padding(.bottom, 6)

                            Text("Lépj be a fiókodba e-mail címmel és jelszóval, vagy Apple / Google / Facebook fiókkal.")
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
                                .focused($focused, equals: .email)
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
                                .textContentType(.password)
                                .focused($focused, equals: .password)
                                .padding(.bottom, 12)

                            if let err = profile.authError, !err.isEmpty {
                                Text(err)
                                    .font(.footnote)
                                    .foregroundStyle(Color(red: 0.75, green: 0.12, blue: 0.12))
                                    .padding(.bottom, 10)
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
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                            .disabled(busy || email.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty)
                            .padding(.top, 4)
                            .id("submitButton")

                            HStack(spacing: 4) {
                                Text("Nincs még fiókod?")
                                    .foregroundStyle(AppTheme.textSecondary)
                                Button("Regisztráció") {
                                    profile.authError = nil
                                    onGoRegister?()
                                }
                                .fontWeight(.medium)
                                .foregroundStyle(AppTheme.accent)
                            }
                            .font(.footnote)
                            .padding(.top, 16)
                        }
                        .padding(16)

                        Color.clear.frame(height: 32).id("scrollBottom")
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: focused) { _, newValue in
                    guard newValue != nil else { return }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo("submitButton", anchor: .bottom)
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo("submitButton", anchor: .bottom)
                        }
                    }
                }
            }
        }
        .background(Color(red: 0.965, green: 0.969, blue: 0.976).ignoresSafeArea())
        .onAppear { profile.authError = nil }
    }

    @ViewBuilder
    private func authNavBar(title: String) -> some View {
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
        let ok = await profile.login(email: email, password: password)
        if ok {
            password = ""
            onSuccess?()
            onClose?()
        }
    }
}

#Preview {
    LoginScreen(onClose: {}, onGoRegister: {})
        .environmentObject(ProfileStore())
}
