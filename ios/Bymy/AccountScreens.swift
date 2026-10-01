import SwiftUI
import UIKit

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

                    VStack(spacing: 0) {
                        if isCompany {
                            menuRow(icon: "building.2.fill", title: "Cégadatok") {}
                        }
                        // Autóimport: spec szerint nincs telefonon
                        menuRow(icon: "doc.text.fill", title: "Nyomtatások") {}
                        menuRow(icon: "star.fill", title: "Értékelések") {}
                        menuRow(icon: "heart.fill", title: "Kedvencek") {}
                        menuRow(icon: "rectangle.stack.fill", title: "Saját hirdetések") {}
                        menuRow(icon: "magnifyingglass", title: "Mentett kereséseim") {}
                        menuRow(icon: "bubble.left.and.bubble.right.fill", title: "Üzenetek") {
                            router.showMessages = true
                        }
                        menuRow(icon: "person.fill", title: "Személyes adatok") {}
                        menuRow(icon: "circle.dotted", title: "Keresési körzet") {}
                        menuRow(icon: "mappin.and.ellipse", title: "Ajánlások körzete") {}
                        menuRow(icon: "lock.fill", title: "Jelszó módosítása") {}
                        menuRow(icon: "bell.fill", title: "Hírlevél és értesítések") {}
                        menuRow(icon: "circle.lefthalf.filled", title: "Megjelenés") {}
                    }
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

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
            }
        }
        .background(pageBg.ignoresSafeArea())
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

            // Balance the back button width
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
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(AppTheme.accent.opacity(0.1))
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)
                }
                .frame(width: 36, height: 36)

                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppTheme.text)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.tabInactive)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .overlay(alignment: .bottom) {
                Rectangle().fill(AppTheme.border).frame(height: 1).padding(.leading, 64)
            }
        }
        .buttonStyle(.plain)
    }
}

struct MessagesPlaceholderScreen: View {
    var body: some View {
        MessagesInboxScreen()
    }
}
