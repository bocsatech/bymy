import SwiftUI
import WebKit

/// Hitelesített beágyazás: webes `beallitasok.html?szekcio=` — cookie + auth inject.
struct FiokWebEmbed: UIViewRepresentable {
    let szekcio: String
    let token: String
    let userJSON: String

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let uc = config.userContentController

        let inject = """
        (function(){
          try {
            window.Capacitor = window.Capacitor || {
              isNativePlatform: function(){ return true; },
              Plugins: {}
            };
            sessionStorage.setItem('bymy-auth-token-session', \(jsonString(token)));
            localStorage.setItem('bymy-auth-token', \(jsonString(token)));
            sessionStorage.setItem('bymy-auth-user', \(jsonString(userJSON)));
            document.documentElement.setAttribute('data-auth','member');
            document.documentElement.setAttribute('data-bymy-native-embed','1');
          } catch(e) {}
          var s=document.createElement('style');
          s.textContent = `
            html[data-bymy-native-embed="1"] .mw-app-top,
            html[data-bymy-native-embed="1"] .mw-app-tabbar,
            html[data-bymy-native-embed="1"] .mw-app-pages,
            html[data-bymy-native-embed="1"] .fiok-top,
            html[data-bymy-native-embed="1"] .site-desk-header,
            html[data-bymy-native-embed="1"] .mm-side,
            html[data-bymy-native-embed="1"] [data-site-desk-header] {
              display: none !important;
            }
            html[data-bymy-native-embed="1"] body.site-app {
              padding-top: 0 !important;
              padding-bottom: 0 !important;
            }
            html[data-bymy-native-embed="1"] .mm-main,
            html[data-bymy-native-embed="1"] .settings-layout,
            html[data-bymy-native-embed="1"] main {
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
        web.scrollView.contentInsetAdjustmentBehavior = .automatic
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = .white

        let url = URL(string: "https://bymy.hu/beallitasok.html?szekcio=\(szekcio.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? szekcio)&native=1")!
        context.coordinator.load(url: url, token: token, in: web)
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func jsonString(_ raw: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: raw)
        return String(data: data ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private var didLoad = false

        func load(url: URL, token: String, in web: WKWebView) {
            Task { @MainActor in
                await BymyWebSession.syncCookie(token: token)
                guard !didLoad else { return }
                didLoad = true
                web.load(URLRequest(url: url))
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let host = url.host?.lowercased() ?? ""
            if navigationAction.navigationType == .linkActivated,
               !host.isEmpty,
               !host.contains("bymy.hu") {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

struct FiokWebPanelScreen: View {
    let szekcio: String
    @EnvironmentObject private var auth: AuthStore
    @State private var ready = false

    private var userJSON: String {
        guard let user = auth.user,
              let data = try? JSONEncoder().encode(user),
              let s = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return s
    }

    var body: some View {
        Group {
            if let token = auth.token, !token.isEmpty, ready {
                FiokWebEmbed(szekcio: szekcio, token: token, userJSON: userJSON)
                    .ignoresSafeArea(edges: .bottom)
            } else if auth.token == nil {
                Text("Belépés szükséges.")
                    .foregroundStyle(AppTheme.textSecondary)
            } else {
                ProgressView("Betöltés…")
            }
        }
        .task {
            await BymyWebSession.syncCookie(token: auth.token)
            ready = true
        }
    }
}
