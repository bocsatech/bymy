import SwiftUI

/// Hirdetés feladás — kategóriaválasztó (mobil web `category-picker` accordion).
struct PostAdScreen: View {
    @EnvironmentObject private var router: AppRouter
    @State private var selected: PostAdCatalog.Category?
    @State private var openGroupId: String? = "auto"

    private let pageBg = Color(red: 0.910, green: 0.933, blue: 0.953) // --cp-bg

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
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Hirdetés feladás")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(Color(red: 0.102, green: 0.114, blue: 0.141))
                        Text("Milyen hirdetést adsz fel?")
                            .font(.system(size: 15))
                            .foregroundStyle(Color(red: 0.420, green: 0.447, blue: 0.502))
                    }
                    .padding(.horizontal, 4)

                    VStack(spacing: 12) {
                        ForEach(PostAdCatalog.groups) { group in
                            groupCard(group)
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 32)
            }
        }
        .background(pageBg.ignoresSafeArea())
    }

    private func groupCard(_ group: PostAdCatalog.Group) -> some View {
        let open = openGroupId == group.id
        return VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    openGroupId = open ? nil : group.id
                }
            } label: {
                HStack(spacing: 14) {
                    AsyncImage(url: URL(string: group.thumbURL)) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            accentSoft(group.accent)
                        }
                    }
                    .frame(width: 52, height: 52)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(group.title)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color(red: 0.102, green: 0.114, blue: 0.141))
                        Text(group.subtitle)
                            .font(.system(size: 13))
                            .foregroundStyle(Color(red: 0.420, green: 0.447, blue: 0.502))
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.down")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(open ? accentColor(group.accent) : Color(red: 0.420, green: 0.447, blue: 0.502))
                        .rotationEffect(.degrees(open ? 180 : 0))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if open {
                Divider()
                VStack(spacing: 4) {
                    ForEach(group.options) { opt in
                        optionRow(opt, accent: group.accent)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.black.opacity(0.04), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.06), radius: 10, y: 4)
    }

    private func optionRow(_ opt: PostAdCatalog.Category, accent: PostAdCatalog.Group.Accent) -> some View {
        let isOn = selected?.id == opt.id
        return Button {
            selected = opt
        } label: {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(accentColor(accent))
                    .frame(width: 4, height: 36)
                    .opacity(isOn ? 1 : 0)

                optionIcon(opt, accent: accent)

                Text(opt.label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(isOn ? accentColor(accent) : Color(red: 0.102, green: 0.114, blue: 0.141))
                    .multilineTextAlignment(.leading)

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(isOn ? accentColor(accent) : Color(red: 0.620, green: 0.639, blue: 0.686))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(isOn ? accentSoft(accent) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func optionIcon(_ opt: PostAdCatalog.Category, accent: PostAdCatalog.Group.Accent) -> some View {
        if !opt.imagePath.isEmpty {
            AsyncImage(url: URL(string: "https://bymy.hu\(opt.imagePath)")) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    accentSoft(accent)
                }
            }
            .frame(width: 40, height: 40)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else {
            Image(systemName: opt.systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(accentColor(accent))
                .frame(width: 40, height: 40)
        }
    }

    private func accentColor(_ accent: PostAdCatalog.Group.Accent) -> Color {
        switch accent {
        case .car: return Color(red: 0.145, green: 0.388, blue: 0.922) // #2563eb
        case .truck: return Color(red: 0.918, green: 0.345, blue: 0.047) // #ea580c
        case .immo: return Color(red: 0.020, green: 0.588, blue: 0.412) // #059669
        }
    }

    private func accentSoft(_ accent: PostAdCatalog.Group.Accent) -> Color {
        switch accent {
        case .car: return Color(red: 0.937, green: 0.965, blue: 1.0)
        case .truck: return Color(red: 1.0, green: 0.969, blue: 0.929)
        case .immo: return Color(red: 0.925, green: 0.992, blue: 0.961)
        }
    }
}
