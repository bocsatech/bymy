import SwiftUI

struct SavedSearchesScreen: View {
    @EnvironmentObject private var store: SearchStore
    var onOpenSearch: () -> Void
    var onBack: (() -> Void)? = nil

    @State private var alertTitle = ""
    @State private var alertMessage = ""
    @State private var showAlert = false

    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(
                title: "Mentett kereséseim",
                subtitle: "Feltételek ikonokra",
                onBack: onBack
            )
            ScrollView {
                if store.saved.isEmpty {
                    VStack(spacing: 12) {
                        Text("📌").font(.system(size: 48))
                        Text("Még nincs mentett keresés")
                            .font(.headline)
                        Text("A 3. oldalon állítsd be a szűrőt, majd „Mentés ikonra”. Nem a hirdetés mentődik, hanem a keresési feltételek.")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.textSecondary)
                            .multilineTextAlignment(.center)
                        Button("Ugrás a keresőre", action: onOpenSearch)
                            .font(.body.weight(.semibold))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .foregroundStyle(.white)
                            .background(AppTheme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .padding(24)
                    .padding(.top, 40)
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        ForEach(store.saved) { item in
                            Button {
                                store.apply(item)
                                alertTitle = "Alkalmazva"
                                alertMessage = item.filter.summary
                                showAlert = true
                            } label: {
                                VStack(spacing: 8) {
                                    Text(item.icon)
                                        .font(.system(size: 32))
                                        .frame(width: 72, height: 72)
                                        .background(AppTheme.bgElevated)
                                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                                .stroke(AppTheme.border, lineWidth: 0.5)
                                        )
                                    Text(item.name)
                                        .font(.caption)
                                        .foregroundStyle(AppTheme.text)
                                        .multilineTextAlignment(.center)
                                        .lineLimit(2)
                                }
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button("Törlés", role: .destructive) {
                                    store.remove(item.id)
                                }
                            }
                        }
                    }
                    .padding(16)
                }

                Text("Hosszú nyomás / menü: törlés · Koppintás: szűrő alkalmazása")
                    .font(.footnote)
                    .foregroundStyle(AppTheme.textTertiary)
                    .multilineTextAlignment(.center)
                    .padding()
            }
        }
        .background(AppTheme.bg)
        .alert(alertTitle, isPresented: $showAlert) {
            Button("OK", role: .cancel) {}
            Button("Kereső") { onOpenSearch() }
        } message: {
            Text(alertMessage)
        }
    }
}
