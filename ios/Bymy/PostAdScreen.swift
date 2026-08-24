import SwiftUI

/// Hirdetés feladás — kategóriaválasztó (1. demó: accordion kártyák ikonokkal).
struct PostAdScreen: View {
    var onClose: (() -> Void)? = nil

    private enum TopSection: String {
        case auto, teher, ingatlan
    }

    private enum SubPanel: Equatable {
        case list
        case tipus
        case kategoria
    }

    @State private var openTop: TopSection? = .auto
    @State private var subPanel: SubPanel = .list
    @State private var selectedTipusok: Set<String> = []
    @State private var selectedKategoriak: Set<String> = []
    @State private var toast: String?
    @State private var showSzemelyautoForm = false
    @State private var truckKind: PostAdCatalog.TruckKind? = nil

    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969) // #F2F4F7
    private let autoTint = AppTheme.accent
    private let teherTint = Color(red: 0.85, green: 0.45, blue: 0.12)
    private let ingatlanTint = Color(red: 0.18, green: 0.55, blue: 0.34)

    var body: some View {
        Group {
            if showSzemelyautoForm {
                PostAdCarScreen(onClose: { showSzemelyautoForm = false })
            } else if let truckKind {
                PostAdTruckScreen(kind: truckKind, onClose: { self.truckKind = nil })
            } else {
                VStack(spacing: 0) {
                    switch subPanel {
                    case .list:
                        ScreenHeader(
                            title: "Hirdetés feladás",
                            subtitle: "Milyen hirdetést adsz fel?",
                            onBack: onClose
                        )
                        mainList
                    case .tipus:
                        ScreenHeader(title: "Típus", onBack: { subPanel = .list }, rightLabel: "Kész", onRight: { subPanel = .list })
                        multiSelectList(
                            sectionTitle: "Típus",
                            options: PostAdCatalog.ingatlanTipusok,
                            selection: $selectedTipusok
                        )
                    case .kategoria:
                        ScreenHeader(title: "Kategória", onBack: { subPanel = .list }, rightLabel: "Kész", onRight: { subPanel = .list })
                        multiSelectList(
                            sectionTitle: "Kategória",
                            options: PostAdCatalog.ingatlanKategoriak,
                            selection: $selectedKategoriak
                        )
                    }
                }
                .background(pageBg.ignoresSafeArea())
            }
        }
        .alert("Hirdetés feladás", isPresented: Binding(
            get: { toast != nil },
            set: { if !$0 { toast = nil } }
        )) {
            Button("OK", role: .cancel) { toast = nil }
        } message: {
            Text(toast ?? "")
        }
    }

    private var mainList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                categoryCard(
                    section: .auto,
                    title: "Autó hirdetés",
                    subtitle: "Személyautó és más",
                    photoAsset: QuickCategory.uj.imageName,
                    tint: autoTint
                ) {
                    autoItemList
                }

                categoryCard(
                    section: .teher,
                    title: "Teherautó hirdetés",
                    subtitle: "Kisteher és teherautó",
                    photoAsset: AutoswebCategoryPhoto.assetName(forTeherItemId: "teher-kisteher"),
                    tint: teherTint
                ) {
                    teherItemList
                }

                categoryCard(
                    section: .ingatlan,
                    title: "Ingatlan hirdetések",
                    subtitle: nil,
                    systemImage: "house.fill",
                    tint: ingatlanTint
                ) {
                    VStack(spacing: 0) {
                        SettingsRow(title: "Típus", value: multiValue(selectedTipusok, from: PostAdCatalog.ingatlanTipusok)) {
                            subPanel = .tipus
                        }
                        Divider().padding(.leading, 16)
                        SettingsRow(title: "Kategória", value: multiValue(selectedKategoriak, from: PostAdCatalog.ingatlanKategoriak)) {
                            subPanel = .kategoria
                        }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 32)
        }
        .background(pageBg)
    }

    // MARK: - Category card

    private func categoryCard<Content: View>(
        section: TopSection,
        title: String,
        subtitle: String?,
        systemImage: String? = nil,
        photoAsset: String? = nil,
        tint: Color,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let isOpen = openTop == section
        return VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    openTop = isOpen ? nil : section
                }
            } label: {
                HStack(spacing: 14) {
                    if let photoAsset {
                        AutoswebCategoryPhotoView(
                            imageName: photoAsset,
                            size: AutoswebCategoryPhoto.headerSize
                        )
                    } else if let systemImage {
                        ZStack {
                            Circle()
                                .fill(tint)
                                .frame(width: AutoswebCategoryPhoto.headerSize, height: AutoswebCategoryPhoto.headerSize)
                            Image(systemName: systemImage)
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(AppTheme.text)
                        if let subtitle, !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.footnote)
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                    Spacer(minLength: 8)
                    Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(isOpen ? tint : AppTheme.textTertiary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isOpen {
                Divider().padding(.leading, 74)
                content()
                    .padding(.bottom, 6)
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppTheme.border.opacity(0.85), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    // MARK: - Autó leaf items

    private var autoItemList: some View {
        VStack(spacing: 0) {
            ForEach(Array(PostAdCatalog.autoItems.enumerated()), id: \.element.id) { index, item in
                if index > 0 { Divider().padding(.leading, 74) }
                autoItemRow(item)
            }
        }
    }

    private func autoItemRow(_ item: PostAdCatalog.Item) -> some View {
        let available = item.id == "auto-szemelyauto"
        return Button {
            if available {
                showSzemelyautoForm = true
            } else {
                toast = "\(item.title) — hamarosan."
            }
        } label: {
            HStack(spacing: 12) {
                if available {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(autoTint)
                        .frame(width: 3, height: 28)
                } else {
                    Color.clear.frame(width: 3, height: 28)
                }

                AutoswebCategoryPhotoView(
                    imageName: AutoswebCategoryPhoto.assetName(forAutoItemId: item.id),
                    size: AutoswebCategoryPhoto.rowSize,
                    dimmed: !available
                )
                .frame(width: AutoswebCategoryPhoto.rowSize, alignment: .center)

                Text(item.title)
                    .font(.body)
                    .foregroundStyle(available ? autoTint : AppTheme.text)
                    .fontWeight(available ? .semibold : .regular)
                    .multilineTextAlignment(.leading)

                Spacer(minLength: 8)

                if !available {
                    Text("Hamarosan")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(AppTheme.border.opacity(0.65))
                        .clipShape(Capsule())
                }

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(available ? autoTint : AppTheme.textTertiary)
            }
            .padding(.leading, 16)
            .padding(.trailing, 16)
            .frame(minHeight: 52)
            .background(available ? autoTint.opacity(0.06) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var teherItemList: some View {
        VStack(spacing: 0) {
            ForEach(Array(PostAdCatalog.teherItems.enumerated()), id: \.element.id) { index, item in
                if index > 0 { Divider().padding(.leading, 74) }
                teherItemRow(item)
            }
        }
    }

    private func teherItemRow(_ item: PostAdCatalog.Item) -> some View {
        Button {
            if let kind = PostAdCatalog.TruckKind.fromCatalogId(item.id) {
                truckKind = kind
            }
        } label: {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(teherTint)
                    .frame(width: 3, height: 28)

                AutoswebCategoryPhotoView(
                    imageName: AutoswebCategoryPhoto.assetName(forTeherItemId: item.id),
                    size: AutoswebCategoryPhoto.rowSize
                )
                .frame(width: AutoswebCategoryPhoto.rowSize, alignment: .center)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(teherTint)
                    Text(item.id == "teher-kisteher" ? "Max. 3,5 tonna" : "3,5 tonnától")
                        .font(.caption)
                        .foregroundStyle(AppTheme.textSecondary)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(teherTint)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 56)
            .background(teherTint.opacity(0.06))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Multi-select (ingatlan)

    private func multiSelectList(
        sectionTitle: String,
        options: [PostAdCatalog.Item],
        selection: Binding<Set<String>>
    ) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: sectionTitle)
                Button {
                    selection.wrappedValue.removeAll()
                } label: {
                    Text("Összes kikapcsolása")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AppTheme.accent)
                        .padding(.leading, 4)
                }
                .buttonStyle(.plain)

                SettingsGroup {
                    ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                        if index > 0 { Divider().padding(.leading, 16) }
                        Toggle(option.title, isOn: Binding(
                            get: { selection.wrappedValue.contains(option.id) },
                            set: { on in
                                if on {
                                    selection.wrappedValue.insert(option.id)
                                } else {
                                    selection.wrappedValue.remove(option.id)
                                }
                            }
                        ))
                        .tint(Color.green)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 52)
                    }
                }
            }
            .padding(16)
        }
    }

    private func multiValue(_ selected: Set<String>, from options: [PostAdCatalog.Item]) -> String {
        let titles = options.filter { selected.contains($0.id) }.map(\.title)
        if titles.isEmpty { return "Mindegy" }
        if titles.count == 1 { return titles[0] }
        if titles.count <= 3 { return titles.joined(separator: ", ") }
        return "\(titles.count) kiválasztva"
    }
}
