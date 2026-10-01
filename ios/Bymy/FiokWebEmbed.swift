import SwiftUI
import WebKit

/// Hitelesített beágyazás: a webes `beallitasok.html?szekcio=` panel 1:1 funkcióval.
/// A natív héj (vissza gomb) megmarad; a webes oldalsáv / tabbar elrejtve.
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

        let url = URL(string: "https://bymy.hu/beallitasok.html?szekcio=\(szekcio.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? szekcio)&native=1")!
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func jsonString(_ raw: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: raw)
        return String(data: data ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            // Külső linkek / hirdetés → Safari, hogy ne szálljon ki a fiók panelből véletlenül
            let host = url.host?.lowercased() ?? ""
            if navigationAction.navigationType == .linkActivated,
               host.contains("bymy.hu") == false,
               host.isEmpty == false {
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
            if let token = auth.token, !token.isEmpty {
                FiokWebEmbed(szekcio: szekcio, token: token, userJSON: userJSON)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                Text("Belépés szükséges.")
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
    }
}
