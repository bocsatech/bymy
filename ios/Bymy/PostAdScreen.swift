import SwiftUI

/// Hirdetés feladás — kategóriaválasztó (mobil web `category-picker` 1:1 lista).
struct PostAdScreen: View {
    @EnvironmentObject private var router: AppRouter
    @State private var selected: PostAdCatalog.Category?

    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)

    var body: some View {
        Group {
            if let selected {
                PostAdFormScreen(category: selected) {
                    self.selected = nil
                } onPosted: {
                    self.selected = nil
                    router.selectBottom(.home, isLoggedIn: true)
                }
            } else {
                categoryPicker
            }
        }
    }

    private var categoryPicker: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Bezárás") {
                    router.selectBottom(.home, isLoggedIn: true)
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)

            VStack(alignment: .leading, spacing: 4) {
                Text("Hirdetés feladás")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(AppTheme.text)
                Text("Milyen hirdetést adsz fel?")
                    .font(.system(size: 15))
                    .foregroundStyle(AppTheme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 12)

            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(PostAdCatalog.categories) { cat in
                        Button {
                            selected = cat
                        } label: {
                            HStack(spacing: 14) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(tint(for: cat).opacity(0.12))
                                    Image(systemName: cat.systemImage)
                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundStyle(tint(for: cat))
                                }
                                .frame(width: 48, height: 48)

                                Text(cat.label)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(AppTheme.text)
                                    .multilineTextAlignment(.leading)

                                Spacer(minLength: 0)

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(AppTheme.tabInactive)
                            }
                            .padding(14)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(AppTheme.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
        .background(pageBg.ignoresSafeArea())
    }

    private func tint(for cat: PostAdCatalog.Category) -> Color {
        switch cat.vertical {
        case "teher": return Color(red: 0.85, green: 0.45, blue: 0.12)
        case "ingatlan": return Color(red: 0.18, green: 0.55, blue: 0.34)
        default: return AppTheme.accent
        }
    }
}
