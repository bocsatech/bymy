import SwiftUI
import WebKit

/// Fő tartalomoldalak webről (index/auto/teher/ingatlan/ajanlasok) — 100% funkció.
struct NativeWebPage: View {
    enum Page: String {
        case hub = "index.html"
        case auto = "auto.html"
        case teherauto = "teherauto.html"
        case ingatlan = "ingatlan.html"
        case ajanlasok = "ajanlasok.html"
        case post = "hirdetesfeladas.html"
    }

    let page: Page
    var query: String = ""

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var router: AppRouter

    private var url: URL {
        var s = "https://bymy.hu/\(page.rawValue)?native=1"
        if !query.isEmpty {
            s += "&" + query
        }
        return URL(string: s)!
    }

    private var userJSON: String {
        guard let user = auth.user,
              let data = try? JSONEncoder().encode(user),
              let str = String(data: data, encoding: .utf8) else { return "{}" }
        return str
    }

    var body: some View {
        AuthenticatedPageWebView(
            url: url,
            token: auth.token,
            userJSON: userJSON,
            onOpenListing: { id in
                router.openListingId = id
            }
        )
        .id("\(page.rawValue)|\(auth.token ?? "")|\(query)")
    }
}
