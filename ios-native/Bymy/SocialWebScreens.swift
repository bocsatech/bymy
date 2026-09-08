import SwiftUI
import WebKit
import UIKit

enum SocialPageKind {
    case facebookReel
    case youTube

    var title: String {
        switch self {
        case .facebookReel: return "Facebook"
        case .youTube: return "YouTube"
        }
    }

    var subtitle: String {
        switch self {
        case .facebookReel: return "Reel"
        case .youTube: return "Videók"
        }
    }

    var url: URL {
        switch self {
        case .facebookReel:
            return URL(string: "https://www.facebook.com/reel/1514194393830438")!
        case .youTube:
            return URL(string: "https://www.youtube.com")!
        }
    }

    var tint: Color {
        switch self {
        case .facebookReel: return Color(red: 0.09, green: 0.47, blue: 0.95)
        case .youTube: return Color(red: 0.90, green: 0.16, blue: 0.16)
        }
    }
}

/// Csak akkor tölt WebView-t, ha az oldal aktív (ne indítson 2 böngészőt induláskor).
struct SocialWebScreen: View {
    let kind: SocialPageKind
    let isActive: Bool

    @State private var loadWeb = false

    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(title: kind.title, subtitle: kind.subtitle)

            ZStack {
                if isActive && loadWeb {
                    SocialWebView(url: kind.url)
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: kind == .youTube ? "play.rectangle.fill" : "play.circle.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(kind.tint)

                        Text(kind.title)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(AppTheme.text)

                        Text(kind.url.absoluteString)
                            .font(.caption)
                            .foregroundStyle(AppTheme.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)

                        Button {
                            loadWeb = true
                        } label: {
                            Text("Megnyitás az appban")
                                .font(.body.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                                .foregroundStyle(.white)
                                .background(kind.tint)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .padding(.horizontal, 28)

                        Button {
                            UIApplication.shared.open(kind.url)
                        } label: {
                            Text("Megnyitás Safari-ban")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(AppTheme.accent)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppTheme.bg)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(AppTheme.bg)
        .onChange(of: isActive) { _, active in
            if !active { loadWeb = false }
        }
    }
}

private struct SocialWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.allowsBackForwardNavigationGestures = true
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

#Preview {
    SocialWebScreen(kind: .facebookReel, isActive: true)
}
