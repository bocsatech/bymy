import Foundation
import WebKit

/// Éles `membersOnly` gate: HTML oldalakhoz `autosweb_session` cookie kell (nem elég a Bearer).
enum BymyWebSession {
    static let cookieName = "autosweb_session"

    @MainActor
    static func syncCookie(token: String?) async {
        let store = WKWebsiteDataStore.default().httpCookieStore
        if let token, !token.isEmpty {
            await setCookie(token: token, store: store, domain: "bymy.hu")
            await setCookie(token: token, store: store, domain: "www.bymy.hu")
        } else {
            await clearCookie(store: store, domain: "bymy.hu")
            await clearCookie(store: store, domain: "www.bymy.hu")
        }
    }

    @MainActor
    private static func setCookie(token: String, store: WKHTTPCookieStore, domain: String) async {
        var props: [HTTPCookiePropertyKey: Any] = [
            .domain: domain,
            .path: "/",
            .name: cookieName,
            .value: token,
            .secure: "TRUE",
            .expires: Date().addingTimeInterval(60 * 60 * 24 * 40),
        ]
        // SameSite=Lax — iOS 13+
        props[HTTPCookiePropertyKey("SameSite")] = "Lax"
        guard let cookie = HTTPCookie(properties: props) else { return }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            store.setCookie(cookie) { cont.resume() }
        }
    }

    @MainActor
    private static func clearCookie(store: WKHTTPCookieStore, domain: String) async {
        let cookies: [HTTPCookie] = await withCheckedContinuation { cont in
            store.getAllCookies { cont.resume(returning: $0) }
        }
        for c in cookies where c.name == cookieName && (c.domain == domain || c.domain == ".\(domain)") {
            await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                store.delete(c) { cont.resume() }
            }
        }
    }
}
