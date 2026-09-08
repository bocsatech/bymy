import SwiftUI

/// Autosweb kategóriaikon — vízszintes görgethető sorban
struct CategoryIconButton: View {
    let category: QuickCategory
    let action: () -> Void

    private let iconSize: CGFloat = 88
    private let corner: CGFloat = 16

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(category.imageName)
                    .resizable()
                    .scaledToFit()
                    .frame(width: iconSize, height: iconSize)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: corner, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 0.5)
                    )
                    .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
                Text(category.title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.text)
                    .lineLimit(1)
                    .frame(width: iconSize)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(category.title)
        .accessibilityHint(category.subtitle)
    }
}
