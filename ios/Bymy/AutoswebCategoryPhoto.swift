import SwiftUI

/// Autosweb `/images/categories/*.png` — menüikon méretben (nem nagyobb, mint a régi kék kör / SF ikon).
enum AutoswebCategoryPhoto {
    /// Autó keresés / Autó hirdetés fejléc — max. a korábbi kék kör.
    static let headerSize: CGFloat = 44
    /// Alkategória sor — kicsit nagyobb a fehér autók olvashatóságához, de ≤ header.
    static let rowSize: CGFloat = 36

    /// Autó menüpont → asset név (`uj`, `leasing`, `berelheto`, …).
    static func assetName(forAutoItemId id: String) -> String {
        switch id {
        case "auto-szemelyauto":
            return QuickCategory.uj.imageName
        case "auto-leasing":
            return QuickCategory.leasing.imageName
        case "auto-berauto":
            return QuickCategory.berelheto.imageName
        case "auto-berlakokocsi":
            return "lakokocsi"
        default:
            return QuickCategory.uj.imageName
        }
    }

    /// Teher menüpont → asset név.
    static func assetName(forTeherItemId id: String) -> String {
        switch id {
        case "teher-kisteher":
            return "kisteher"
        case "teher-teherauto":
            return "teherauto"
        default:
            return "kisteher"
        }
    }
}

/// Ugyanaz a képstílus, mint a főoldali Autókeresés kategóriakártyákon.
/// Világosszürke lap: a fehér autók (leasing / bérelhető) ne tűnjenek el.
struct AutoswebCategoryPhotoView: View {
    let imageName: String
    var size: CGFloat = AutoswebCategoryPhoto.rowSize
    var dimmed: Bool = false

    private var corner: CGFloat { max(4, size * 0.18) }
    /// Web `.home-category-icon` háttérhez közel (#eef0f3).
    private let plate = Color(red: 0.933, green: 0.941, blue: 0.953)

    var body: some View {
        Image(imageName)
            .resizable()
            .scaledToFit()
            .padding(size * 0.08)
            .frame(width: size, height: size)
            .background(plate)
            .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .stroke(AppTheme.border.opacity(0.85), lineWidth: 0.5)
            )
            .opacity(dimmed ? 0.55 : 1)
            .accessibilityHidden(true)
    }
}
