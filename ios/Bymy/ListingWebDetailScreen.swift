import SwiftUI
import WebKit

/// Mobil web `hirdetes.html?id=` — 100% ugyanaz a megjelenés és funkció.
struct ListingWebDetailScreen: View {
    let listingId: String
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    private var userJSON: String {
        guard let user = auth.user,
              let data = try? JSONEncoder().encode(user),
              let s = String(data: data, encoding: .utf8) else { return "{}" }
        return s
    }

    var body: some View {
        AuthenticatedPageWebView(
            url: URL(string: "https://bymy.hu/hirdetes.html?id=\(listingId)&native=1")!,
            token: auth.token,
            userJSON: userJSON,
            onOpenListing: { id in
                if id != listingId {
                    router.openListingId = id
                }
            }
        )
        .navigationTitle("Hirdetés")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .id(listingId)
    }
}

/// Általános hitelesített oldalbetöltő + native chrome elrejtés + listing intercept.
struct AuthenticatedPageWebView: UIViewRepresentable {
    let url: URL
    let token: String?
    let userJSON: String
    var onOpenListing: ((String) -> Void)? = nil
    var onCloseChrome: Bool = true

    func makeCoordinator() -> Coordinator {
        Coordinator(onOpenListing: onOpenListing)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let uc = config.userContentController
        let tok = token ?? ""
        let inject = """
        (function(){
          try {
            window.Capacitor = window.Capacitor || {
              isNativePlatform: function(){ return true; },
              Plugins: {}
            };
            if (\(jsonString(tok))) {
              sessionStorage.setItem('bymy-auth-token-session', \(jsonString(tok)));
              localStorage.setItem('bymy-auth-token', \(jsonString(tok)));
              sessionStorage.setItem('bymy-auth-user', \(jsonString(userJSON)));
              document.documentElement.setAttribute('data-auth','member');
            } else {
              document.documentElement.setAttribute('data-auth','guest');
            }
            document.documentElement.setAttribute('data-bymy-native-embed','1');
          } catch(e) {}
          var s=document.createElement('style');
          s.id='bymy-native-embed-css';
          s.textContent = `
            html[data-bymy-native-embed="1"] .mw-app-top,
            html[data-bymy-native-embed="1"] .mw-app-tabbar,
            html[data-bymy-native-embed="1"] .mw-app-pages,
            html[data-bymy-native-embed="1"] .site-desk-header,
            html[data-bymy-native-embed="1"] [data-site-desk-header],
            html[data-bymy-native-embed="1"] .fiok-top {
              display: none !important;
            }
            html[data-bymy-native-embed="1"] body,
            html[data-bymy-native-embed="1"] body.site-app,
            html[data-bymy-native-embed="1"] body.mw-app {
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              margin-top: 0 !important;
            }
            html[data-bymy-native-embed="1"] .mm-side {
              display: none !important;
            }
            html[data-bymy-native-embed="1"] .mm-main {
              margin: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
            }
          `;
          document.documentElement.appendChild(s);
        })();
        """
        uc.addUserScript(WKUserScript(source: inject, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInsetAdjustmentBehavior = .automatic
        context.coordinator.parentURL = url
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onOpenListing = onOpenListing
    }

    private func jsonString(_ raw: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: raw)
        return String(data: data ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var onOpenListing: ((String) -> Void)?
        var parentURL: URL?

        init(onOpenListing: ((String) -> Void)?) {
            self.onOpenListing = onOpenListing
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if let listingId = Self.listingId(from: url) {
                // Initial load of this detail page must be allowed
                if navigationAction.navigationType == .other,
                   parentURL.map({ Self.listingId(from: $0) == listingId }) == true {
                    decisionHandler(.allow)
                    return
                }
                if navigationAction.navigationType == .linkActivated
                    || navigationAction.navigationType == .formSubmitted
                    || navigationAction.targetFrame == nil {
                    onOpenListing?(listingId)
                    decisionHandler(.cancel)
                    return
                }
            }

            let host = url.host?.lowercased() ?? ""
            if navigationAction.navigationType == .linkActivated,
               !host.isEmpty,
               !host.contains("bymy.hu"),
               !host.contains("hasznaltautocdn"),
               !host.contains("google."),
               !host.contains("gstatic"),
               !host.contains("facebook."),
               !host.contains("maps.") {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        static func listingId(from url: URL) -> String? {
            let path = url.path.lowercased()
            guard path.contains("hirdetes.html") || path.hasSuffix("/hirdetes") else { return nil }
            return URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "id" })?
                .value
        }
    }
}
