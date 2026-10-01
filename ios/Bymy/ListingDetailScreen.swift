import SwiftUI

/// Mobil web `hirdetes.html` / `hirdetes-detail.js` — galéria + `.hd-side` gombok + adatok.
struct ListingDetailScreen: View {
    let listingId: String
    var onMessage: ((ListingsAPI.Detail) -> Void)? = nil

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    @State private var detail: ListingsAPI.Detail?
    @State private var related: [ListingsAPI.Listing] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var imageIndex = 0
    @State private var showFullPhone = false
    @State private var showFullDescription = false
    @State private var expandedExtras: Set<String> = []
    @State private var showRelated = false
    @State private var isFavorite = false
    @State private var sharePayload: SharePayload?
    @State private var revealPhoneBusy = false

    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.969)
    private let softFill = Color(red: 0.965, green: 0.969, blue: 0.976)

    private var isOwn: Bool {
        guard let detail, let oid = detail.ownerUserId, let me = auth.user?.id else { return false }
        return oid == me
    }

    private var canMessage: Bool { !isOwn }

    var body: some View {
        Group {
            if loading && detail == nil {
                ProgressView("Betöltés…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorText, detail == nil {
                VStack(spacing: 12) {
                    Text(errorText)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(AppTheme.textSecondary)
                    Button("Újra") { Task { await load() } }
                        .fontWeight(.semibold)
                        .foregroundStyle(AppTheme.accent)
                }
                .padding()
            } else if let detail {
                content(detail)
            }
        }
        .background(pageBg.ignoresSafeArea())
        .navigationTitle("Hirdetés")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: listingId) { await load() }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
    }

    private func content(_ detail: ListingsAPI.Detail) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    gallery(detail)
                    sideCard(detail, scrollProxy: proxy)
                    specs(detail)
                    if !detail.perks.isEmpty {
                        perksBlock(detail.perks)
                    }
                    if !detail.equipmentGroups.isEmpty {
                        extrasBlock(detail.equipmentGroups)
                    }
                    descriptionBlock(detail)
                    if showRelated, !related.isEmpty, !isOwn {
                        relatedBlock
                            .id("hd-related")
                    }
                    if let q = detail.mapQuery, !q.isEmpty {
                        mapBlock(q)
                    }
                    Color.clear.frame(height: 28)
                }
                .padding(16)
            }
        }
    }

    // MARK: - Gallery (web .hd-gallery)

    private func gallery(_ detail: ListingsAPI.Detail) -> some View {
        VStack(spacing: 0) {
            ZStack(alignment: .bottomTrailing) {
                if detail.imageURLs.isEmpty {
                    Color(red: 0.93, green: 0.94, blue: 0.96)
                        .frame(height: 260)
                } else {
                    TabView(selection: $imageIndex) {
                        ForEach(Array(detail.imageURLs.enumerated()), id: \.offset) { idx, url in
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().scaledToFill()
                                default:
                                    Color(red: 0.93, green: 0.94, blue: 0.96)
                                }
                            }
                            .tag(idx)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .frame(height: 260)
                    .clipped()
                }

                Text("\(min(imageIndex + 1, max(detail.imageURLs.count, 1))) / \(max(detail.imageURLs.count, 0))")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.black.opacity(0.55))
                    .clipShape(Capsule())
                    .padding(10)
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            if let promo = detail.promoText, !promo.isEmpty {
                Text(promo)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 10)
            }

            if detail.imageURLs.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(detail.imageURLs.enumerated()), id: \.offset) { idx, url in
                            Button { imageIndex = idx } label: {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image.resizable().scaledToFill()
                                    default:
                                        Color(red: 0.9, green: 0.91, blue: 0.93)
                                    }
                                }
                                .frame(width: 64, height: 48)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(idx == imageIndex ? AppTheme.accent : Color.clear, lineWidth: 2)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 10)
                }
            }

            if !detail.highlights.isEmpty {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(detail.highlights.prefix(4)) { row in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.label)
                                .font(.system(size: 11))
                                .foregroundStyle(AppTheme.textSecondary)
                            Text(row.value)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(AppTheme.text)
                                .lineLimit(2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(softFill)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
                .padding(.top, 12)
            }
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: - Side card (web .hd-side)

    private func sideCard(_ detail: ListingsAPI.Detail, scrollProxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(detail.title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AppTheme.text)

            if !detail.subtitle.isEmpty {
                Text(detail.subtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(AppTheme.textSecondary)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(detail.priceLabel)
                    .font(.system(size: 24, weight: .heavy))
                    .foregroundStyle(AppTheme.text)
                if let old = detail.salePriceLabel, !old.isEmpty {
                    Text("Korábbi ár: \(old)")
                        .font(.system(size: 13))
                        .foregroundStyle(AppTheme.textSecondary)
                        .strikethrough()
                }
            }

            HStack(spacing: 12) {
                sellerAvatar(detail)
                VStack(alignment: .leading, spacing: 2) {
                    Text(detail.sellerName)
                        .font(.system(size: 16, weight: .semibold))
                    if let since = detail.sellerSince, !since.isEmpty {
                        Text("Felhasználó ezóta: \(since)")
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }
                Spacer(minLength: 0)
            }

            if !detail.addressLines.isEmpty {
                Text(detail.addressLines.joined(separator: "\n"))
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.textSecondary)
            }

            // Primary CTA — Üzenet / Hirdető kapcsolata
            if canMessage {
                Button {
                    onMessage?(detail)
                } label: {
                    Label(
                        auth.isLoggedIn ? "Üzenet küldése" : "Hirdető kapcsolata",
                        systemImage: "envelope.fill"
                    )
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }

            // Icon row: Kedvenc / Megosztás / FB / Nyomtatás
            HStack(spacing: 8) {
                if !isOwn {
                    iconAction(
                        systemImage: isFavorite ? "heart.fill" : "heart",
                        tint: isFavorite ? .red : AppTheme.text,
                        label: "Kedvenc"
                    ) {
                        toggleFavorite(detail.id)
                    }
                }
                iconAction(systemImage: "square.and.arrow.up", tint: AppTheme.text, label: "Megosztás") {
                    share(detail)
                }
                iconAction(systemImage: "f.square.fill", tint: Color(red: 0.23, green: 0.35, blue: 0.60), label: "Facebook") {
                    shareFacebook(detail)
                }
                iconAction(systemImage: "printer", tint: AppTheme.text, label: "Nyomtatás") {
                    share(detail)
                }
            }

            if detail.hasPhone {
                softButton(
                    title: phoneButtonTitle(detail),
                    systemImage: "phone.fill"
                ) {
                    Task { await handlePhoneTap(detail) }
                }
                .disabled(revealPhoneBusy)
            }

            if let q = detail.mapQuery, !q.isEmpty,
               let url = mapsURL(query: q) {
                softLink(title: "Navigáció", systemImage: "mappin.and.ellipse", url: url)
            }

            if !isOwn {
                softButton(
                    title: related.isEmpty
                        ? "Kereskedés többi hirdetései …"
                        : "Kereskedés többi hirdetései \(related.count + 1)",
                    systemImage: "rectangle.stack"
                ) {
                    showRelated = true
                    withAnimation {
                        scrollProxy.scrollTo("hd-related", anchor: .top)
                    }
                }
            }

            if let url = URL(string: "https://bymy.hu/adasveteli-szerzodes.html?id=\(detail.id)") {
                softLink(title: "Adásvételi szerződés", systemImage: "doc.text", url: url)
            }

            if let web = detail.website, let url = URL(string: web.hasPrefix("http") ? web : "https://\(web)") {
                softLink(title: "Céges weboldal", systemImage: "globe", url: url)
            }

            if isOwn {
                HStack(spacing: 8) {
                    if let url = URL(string: "https://bymy.hu/hirdetesfeladas.html?id=\(detail.id)") {
                        softLink(title: "Szerkesztés", systemImage: "pencil", url: url)
                    }
                }
            }
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func sellerAvatar(_ detail: ListingsAPI.Detail) -> some View {
        ZStack {
            ProfileAvatarView(
                letter: String(detail.sellerName.prefix(1)).uppercased(),
                dataURL: nil,
                size: 48
            )
            if let url = detail.sellerAvatarURL {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    }
                }
                .frame(width: 48, height: 48)
                .clipShape(Circle())
            }
        }
    }

    private func iconAction(systemImage: String, tint: Color, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(tint)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func softButton(title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppTheme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(softFill)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func softLink(title: String, systemImage: String, url: URL) -> some View {
        Link(destination: url) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppTheme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(softFill)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    // MARK: - Specs / extras / desc / related

    private func specs(_ detail: ListingsAPI.Detail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(detail.specBlocks) { block in
                VStack(alignment: .leading, spacing: 0) {
                    Text(block.title)
                        .font(.system(size: 16, weight: .bold))
                        .padding(.bottom, 8)
                    ForEach(block.rows) { row in
                        HStack(alignment: .top) {
                            Text(row.label)
                                .foregroundStyle(AppTheme.textSecondary)
                            Spacer(minLength: 12)
                            Text(row.value)
                                .fontWeight(.semibold)
                                .multilineTextAlignment(.trailing)
                        }
                        .font(.system(size: 14))
                        .padding(.vertical, 8)
                        Divider()
                    }
                }
                .padding(14)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private func perksBlock(_ perks: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("További előnyök")
                .font(.system(size: 16, weight: .bold))
            FlowWrap(items: perks)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func extrasBlock(_ groups: [ListingsAPI.EquipmentGroup]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Extrák")
                .font(.system(size: 16, weight: .bold))
            ForEach(groups) { group in
                let expanded = expandedExtras.contains(group.id)
                let visible = expanded ? group.items : Array(group.items.prefix(5))
                VStack(alignment: .leading, spacing: 6) {
                    Text(group.title)
                        .font(.system(size: 14, weight: .semibold))
                    ForEach(visible, id: \.self) { item in
                        HStack(alignment: .top, spacing: 8) {
                            Text("•")
                            Text(item)
                                .font(.system(size: 14))
                        }
                        .foregroundStyle(AppTheme.text)
                    }
                    if group.items.count > 5 {
                        Button(expanded ? "Kevesebb megjelenítése −" : "Több megjelenítése +") {
                            if expanded { expandedExtras.remove(group.id) }
                            else { expandedExtras.insert(group.id) }
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func descriptionBlock(_ detail: ListingsAPI.Detail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Leírás")
                .font(.system(size: 16, weight: .bold))
            Text(detail.description.isEmpty ? "Nincs leírás." : detail.description)
                .font(.system(size: 14))
                .foregroundStyle(AppTheme.text)
                .lineLimit(showFullDescription ? nil : 6)
            if !detail.description.isEmpty, detail.description.count > 180 {
                Button(showFullDescription ? "Kevesebb megjelenítése −" : "Több megjelenítése +") {
                    showFullDescription.toggle()
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var relatedBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Kereskedés többi hirdetései")
                .font(.system(size: 16, weight: .bold))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(related) { item in
                        Button {
                            router.openListingId = item.id
                        } label: {
                            ListingTileCard(listing: item, width: 160)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func mapBlock(_ query: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Térkép")
                .font(.system(size: 16, weight: .bold))
            if let url = mapsURL(query: query) {
                Link("Navigáció / megnyitás a Térképekben", destination: url)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AppTheme.accent)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: - Actions

    private func phoneButtonTitle(_ detail: ListingsAPI.Detail) -> String {
        if showFullPhone, let phone = detail.sellerPhone, !phone.isEmpty {
            return phone
        }
        return "\(detail.phoneMasked ?? "Telefonszám") mutatása"
    }

    private func handlePhoneTap(_ detail: ListingsAPI.Detail) async {
        if showFullPhone {
            let raw = detail.sellerPhone ?? detail.phoneMasked ?? ""
            let digits = raw.filter { $0.isNumber || $0 == "+" }
            if digits.count >= 7, let url = URL(string: "tel:\(digits)") {
                await MainActor.run { UIApplication.shared.open(url) }
            }
            return
        }
        if let phone = detail.sellerPhone, !phone.isEmpty {
            showFullPhone = true
            return
        }
        // Web: POST /api/listings/:id/reveal-contact (+ Turnstile). Natívan: ha a detail
        // már tartalmazza a számot, mutatjuk; különben a maszkolt szöveg jelenik meg.
        revealPhoneBusy = true
        defer { revealPhoneBusy = false }
        if let revealed = try? await ListingsAPI.revealContact(id: detail.id, token: auth.token) {
            self.detail = patched(detail, phone: revealed.phone, address: revealed.addressLines, mapQuery: revealed.mapQuery)
        }
        showFullPhone = true
    }

    private func patched(
        _ d: ListingsAPI.Detail,
        phone: String?,
        address: [String]?,
        mapQuery: String?
    ) -> ListingsAPI.Detail {
        ListingsAPI.Detail(
            id: d.id,
            title: d.title,
            subtitle: d.subtitle,
            priceLabel: d.priceLabel,
            salePriceLabel: d.salePriceLabel,
            meta: d.meta,
            imageURLs: d.imageURLs,
            highlights: d.highlights,
            promoText: d.promoText,
            specBlocks: d.specBlocks,
            perks: d.perks,
            equipmentGroups: d.equipmentGroups,
            description: d.description,
            sellerName: d.sellerName,
            sellerPhone: phone ?? d.sellerPhone,
            phoneMasked: d.phoneMasked,
            hasPhone: true,
            sellerAvatarURL: d.sellerAvatarURL,
            sellerSince: d.sellerSince,
            addressLines: (address?.isEmpty == false) ? (address ?? d.addressLines) : d.addressLines,
            mapQuery: mapQuery ?? d.mapQuery,
            website: d.website,
            ownerUserId: d.ownerUserId,
            code: d.code,
            vertical: d.vertical
        )
    }

    private func toggleFavorite(_ id: String) {
        var set = Set(UserDefaults.standard.stringArray(forKey: "bymy.favorites") ?? [])
        if set.contains(id) { set.remove(id) } else { set.insert(id) }
        UserDefaults.standard.set(Array(set), forKey: "bymy.favorites")
        isFavorite = set.contains(id)
    }

    private func share(_ detail: ListingsAPI.Detail) {
        let url = URL(string: "https://bymy.hu/hirdetes.html?id=\(detail.id)")!
        sharePayload = SharePayload(items: ["\(detail.title) — \(detail.priceLabel)", url])
    }

    private func shareFacebook(_ detail: ListingsAPI.Detail) {
        let link = "https://bymy.hu/hirdetes.html?id=\(detail.id)"
        if let enc = link.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: "https://www.facebook.com/sharer/sharer.php?u=\(enc)") {
            UIApplication.shared.open(url)
        }
    }

    private func mapsURL(query: String) -> URL? {
        let enc = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return URL(string: "https://maps.apple.com/?q=\(enc)")
    }

    private func load() async {
        loading = true
        errorText = nil
        showRelated = false
        showFullPhone = false
        imageIndex = 0
        do {
            let d = try await ListingsAPI.fetchDetail(id: listingId, token: auth.token)
            detail = d
            let favs = Set(UserDefaults.standard.stringArray(forKey: "bymy.favorites") ?? [])
            isFavorite = favs.contains(d.id)
            related = (try? await ListingsAPI.fetchRelated(id: listingId, token: auth.token)) ?? []
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }
}

// Egyszerű wrap a perk chip-ekhez
private struct FlowWrap: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(items, id: \.self) { item in
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(AppTheme.accent)
                        .font(.system(size: 14))
                    Text(item)
                        .font(.system(size: 14))
                }
            }
        }
    }
}

struct SharePayload: Identifiable {
    let id = UUID()
    let items: [Any]
}

struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
