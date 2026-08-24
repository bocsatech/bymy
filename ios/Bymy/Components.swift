import SwiftUI

struct PageDots: View {
    let count: Int
    let index: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(i == index ? AppTheme.accent : AppTheme.pageDot)
                    .frame(width: i == index ? 18 : 8, height: 8)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: index)
    }
}

/// Alsó menü — rögzített sorrend, nem szerkeszthető.
enum BottomTab: Int, CaseIterable, Hashable {
    case fooldal
    case kereses
    case hirdetesFeladas
    case uzenetek
    case hirfolyam

    /// Hely a lebegő sziget alatt, hogy a lista ne takaródjon.
    static let islandClearance: CGFloat = 96

    var title: String {
        switch self {
        case .fooldal: return "Főoldal"
        case .kereses: return "Keresés"
        case .hirdetesFeladas: return "Hirdetés feladás"
        case .uzenetek: return "Üzenetek"
        case .hirfolyam: return "Hírfolyam"
        }
    }

    /// Asset a ház+ gombhoz / hírfolyamhoz; a többi SF Symbol.
    var assetName: String? {
        switch self {
        case .hirdetesFeladas: return "demo-fo-oldal"
        case .hirfolyam: return "demo-hirfolyam"
        default: return nil
        }
    }

    var systemImage: String? {
        switch self {
        case .fooldal: return "house.fill"
        case .kereses: return "magnifyingglass"
        case .uzenetek: return "bubble.left.and.bubble.right.fill"
        default: return nil
        }
    }
}

/// Lebegő, áttetsző alsó ikonsziget — a tartalom mögötte látszik.
struct PageIconBar: View {
    @Binding var selection: BottomTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(BottomTab.allCases, id: \.self) { tab in
                let selected = tab == selection
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = tab
                    }
                } label: {
                    VStack(spacing: 2) {
                        ZStack {
                            Circle()
                                .fill(selected ? AppTheme.accent.opacity(0.28) : Color.clear)
                                .frame(width: 42, height: 42)
                            tabIcon(tab, selected: selected)
                                .frame(width: 22, height: 22)
                        }
                        Text(tab.title)
                            .font(.system(size: 8, weight: selected ? .semibold : .regular))
                            .foregroundStyle(selected ? AppTheme.accent : AppTheme.text.opacity(0.9))
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.title)
                .accessibilityAddTraits(selected ? [.isSelected] : [])
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background {
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay {
                    Capsule(style: .continuous)
                        .fill(Color.white.opacity(0.38))
                }
                .overlay {
                    Capsule(style: .continuous)
                        .strokeBorder(Color.white.opacity(0.75), lineWidth: 1)
                }
                .shadow(color: Color.black.opacity(0.16), radius: 20, y: 8)
        }
        .padding(.horizontal, 18)
        .padding(.bottom, 10)
        .animation(.easeInOut(duration: 0.2), value: selection)
    }

    @ViewBuilder
    private func tabIcon(_ tab: BottomTab, selected: Bool) -> some View {
        if let asset = tab.assetName {
            Image(asset)
                .resizable()
                .scaledToFit()
                .opacity(selected ? 1 : 0.8)
        } else if let systemImage = tab.systemImage {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: selected ? .semibold : .regular))
                .foregroundStyle(selected ? AppTheme.accent : AppTheme.text)
        }
    }
}

struct ScreenHeader: View {
    let title: String
    var subtitle: String? = nil
    var onBack: (() -> Void)? = nil
    var rightLabel: String? = nil
    var onRight: (() -> Void)? = nil

    var body: some View {
        HStack {
            Group {
                if let onBack {
                    Button("‹ Vissza", action: onBack)
                        .foregroundStyle(AppTheme.accent)
                        .font(.body.weight(.medium))
                } else {
                    Color.clear.frame(width: 72, height: 1)
                }
            }
            .frame(width: 88, alignment: .leading)

            VStack(spacing: 2) {
                Text(title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(AppTheme.text)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            .frame(maxWidth: .infinity)

            Group {
                if let rightLabel, let onRight {
                    Button(rightLabel, action: onRight)
                        .foregroundStyle(AppTheme.accent)
                        .font(.body.weight(.medium))
                } else {
                    Color.clear.frame(width: 72, height: 1)
                }
            }
            .frame(width: 88, alignment: .trailing)
        }
        .padding(.horizontal, 8)
        .padding(.bottom, 8)
    }
}

struct SettingsRow: View {
    let title: String
    var value: String? = nil
    var showChevron: Bool = true
    var action: (() -> Void)? = nil

    var body: some View {
        Button {
            action?()
        } label: {
            HStack {
                Text(title)
                    .foregroundStyle(AppTheme.text)
                    .font(.body)
                Spacer()
                if let value {
                    Text(value)
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(1)
                }
                if showChevron, action != nil {
                    Text("›")
                        .foregroundStyle(AppTheme.textTertiary)
                        .font(.title2)
                }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}

struct SettingsGroup<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .background(AppTheme.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct SectionLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.textSecondary)
            .tracking(0.4)
            .padding(.leading, 4)
            .padding(.bottom, 6)
    }
}
