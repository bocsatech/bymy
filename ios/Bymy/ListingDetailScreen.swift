import SwiftUI

struct ListingDetailScreen: View {
    let listingId: String
    var onMessage: ((ListingsAPI.Detail) -> Void)? = nil

    @EnvironmentObject private var auth: AuthStore

    @State private var detail: ListingsAPI.Detail?
    @State private var loading = true
    @State private var errorText: String?
    @State private var imageIndex = 0

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
        .background(AppTheme.bg)
        .navigationTitle("Hirdetés")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(false)
        .task { await load() }
        .safeAreaInset(edge: .bottom) {
            if let detail {
                messageBar(detail)
            }
        }
    }

    private func content(_ detail: ListingsAPI.Detail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if !detail.imageURLs.isEmpty {
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
                    .tabViewStyle(.page(indexDisplayMode: detail.imageURLs.count > 1 ? .automatic : .never))
                    .frame(height: 260)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                Text(detail.title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AppTheme.text)

                Text(detail.priceLabel)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(AppTheme.text)

                if !detail.meta.isEmpty {
                    Text(detail.meta)
                        .font(.system(size: 14))
                        .foregroundStyle(AppTheme.textSecondary)
                }

                if !detail.rows.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(detail.rows.enumerated()), id: \.offset) { _, row in
                            HStack {
                                Text(row.label)
                                    .foregroundStyle(AppTheme.textSecondary)
                                Spacer()
                                Text(row.value)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(AppTheme.text)
                                    .multilineTextAlignment(.trailing)
                            }
                            .font(.system(size: 14))
                            .padding(.vertical, 10)
                            Divider()
                        }
                    }
                    .padding(.horizontal, 4)
                }

                if !detail.description.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Leírás")
                            .font(.system(size: 16, weight: .bold))
                        Text(detail.description)
                            .font(.system(size: 14))
                            .foregroundStyle(AppTheme.text)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Eladó")
                        .font(.system(size: 16, weight: .bold))
                    Text(detail.sellerName)
                        .foregroundStyle(AppTheme.textSecondary)
                    if let phone = detail.sellerPhone, !phone.isEmpty {
                        Text(phone)
                            .foregroundStyle(AppTheme.accent)
                    }
                }

                Color.clear.frame(height: 24)
            }
            .padding(16)
        }
    }

    private func messageBar(_ detail: ListingsAPI.Detail) -> some View {
        Button {
            if auth.isLoggedIn {
                onMessage?(detail)
            }
        } label: {
            Text("Üzenet")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AppTheme.brandYellow)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(AppTheme.bg.shadow(color: .black.opacity(0.06), radius: 8, y: -2))
    }

    private func load() async {
        loading = true
        errorText = nil
        do {
            detail = try await ListingsAPI.fetchDetail(id: listingId, token: auth.token)
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }
}
