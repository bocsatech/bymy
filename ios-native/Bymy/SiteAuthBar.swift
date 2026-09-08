import SwiftUI

/// Autosweb header: Belépés | Regisztráció (vendég), vagy avatar → fiókmenü.
struct SiteAuthBar: View {
    @EnvironmentObject private var profile: ProfileStore

    /// Vendégnél melyik oldal aktív (kiemelt gomb).
    var selectedPage: AuthPage? = nil
    var onLogin: () -> Void
    var onRegister: () -> Void
    var onAccount: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 8) {
            Text("Bymy")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(AppTheme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Spacer(minLength: 6)

            if profile.isLoggedIn {
                Button {
                    onAccount?()
                } label: {
                    ProfileAvatarView(
                        image: profile.avatarImage,
                        letter: profile.profile.avatarLetter,
                        size: 36
                    )
                    .frame(width: 36, height: 36)
                    .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Fiók menü")
                // Újraindításkor / sync után biztosan betöltődik a helyi kép
                .onAppear { profile.loadAvatarFromDisk() }
            } else {
                menuButton("Belépés", selected: selectedPage == .login, action: onLogin)
                menuButton("Regisztráció", selected: selectedPage == .register, action: onRegister)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white)
        .overlay(alignment: .bottom) {
            Rectangle().fill(AppTheme.border).frame(height: 1)
        }
    }

    private func menuButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(selected ? Color.white : Color(red: 0.067, green: 0.067, blue: 0.067))
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(selected ? Color(red: 0.067, green: 0.067, blue: 0.067) : Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(
                            selected ? Color(red: 0.067, green: 0.067, blue: 0.067) : AppTheme.border,
                            lineWidth: 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }

}
