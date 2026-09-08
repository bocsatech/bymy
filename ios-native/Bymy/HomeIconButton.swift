import SwiftUI

/// iOS kezdőképernyő-méretű app ikon + felirat
struct HomeIconButton: View {
    let systemName: String
    let label: String
    let tint: Color
    let action: () -> Void

    private let iconSize: CGFloat = 60
    private let corner: CGFloat = 14

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [tint.opacity(0.95), tint.opacity(0.75)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: iconSize, height: iconSize)
                        .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
                    Image(systemName: systemName)
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Text(label)
                    .font(.system(size: 11))
                    .foregroundStyle(AppTheme.text)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .frame(width: 76)
            }
            .frame(width: 76)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
