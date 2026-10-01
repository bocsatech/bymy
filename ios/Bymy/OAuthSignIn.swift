import AuthenticationServices
import SwiftUI
import UIKit

enum SocialAuthProvider: String, CaseIterable {
    case apple, google, facebook

    var title: String {
        switch self {
        case .apple: return "Folytatás Apple-lel"
        case .google: return "Folytatás Google-lal"
        case .facebook: return "Folytatás Facebookkal"
        }
    }

    var iconLabel: String {
        switch self {
        case .apple: return ""
        case .google: return "G"
        case .facebook: return "f"
        }
    }
}

enum SocialAuthError: LocalizedError, Equatable {
    case canceled
    case missingToken
    case server(String)

    var errorDescription: String? {
        switch self {
        case .canceled: return nil
        case .missingToken: return "A social belépés nem adott vissza fiókot. Próbáld újra."
        case .server(let msg): return msg
        }
    }
}

enum SocialAuth {
    static func signIn(provider: SocialAuthProvider) async throws -> (token: String, user: AuthAPI.RemoteUser) {
        try await signInWithWeb(provider: provider.rawValue)
    }

    private static func signInWithWeb(provider: String) async throws -> (token: String, user: AuthAPI.RemoteUser) {
        let start = APIBase.url("api/auth/oauth/start/\(provider)")
        guard var comps = URLComponents(url: start, resolvingAgainstBaseURL: false) else {
            throw SocialAuthError.server("Érvénytelen OAuth cím.")
        }
        comps.queryItems = [
            URLQueryItem(name: "mobile", value: "1"),
            URLQueryItem(name: "next", value: "bymy://oauth-complete"),
        ]
        guard let url = comps.url else { throw SocialAuthError.server("Érvénytelen OAuth cím.") }
        let callback = try await WebAuthSession.start(url: url, scheme: "bymy")
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if let err = items.first(where: { $0.name == "error" })?.value, !err.isEmpty {
            throw SocialAuthError.server(err.removingPercentEncoding ?? err)
        }
        guard let token = items.first(where: { $0.name == "token" })?.value, !token.isEmpty else {
            throw SocialAuthError.missingToken
        }
        let user = try await AuthAPI.me(token: token)
        return (token, user)
    }
}

enum WebAuthSession {
    private final class Presenter: NSObject, ASWebAuthenticationPresentationContextProviding {
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }

    private static var session: ASWebAuthenticationSession?
    private static let presenter = Presenter()

    @MainActor
    static func start(url: URL, scheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { cont in
            let web = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, error in
                session = nil
                if let error {
                    let webErr = error as? ASWebAuthenticationSessionError
                    if webErr?.code == .canceledLogin {
                        cont.resume(throwing: SocialAuthError.canceled)
                    } else {
                        cont.resume(throwing: error)
                    }
                    return
                }
                guard let callback else {
                    cont.resume(throwing: SocialAuthError.missingToken)
                    return
                }
                cont.resume(returning: callback)
            }
            web.presentationContextProvider = presenter
            web.prefersEphemeralWebBrowserSession = false
            session = web
            if !web.start() {
                session = nil
                cont.resume(throwing: SocialAuthError.server("Nem indult el a social belépés."))
            }
        }
    }
}

struct SocialAuthButtons: View {
    enum Style { case plain, gate }

    @EnvironmentObject private var auth: AuthStore
    var style: Style = .plain
    var onSuccess: () -> Void = {}

    @State private var busyProvider: SocialAuthProvider?
    @State private var errorText: String?

    /// Web sorrend: Google, Apple, Facebook
    private let order: [SocialAuthProvider] = [.google, .apple, .facebook]

    var body: some View {
        VStack(spacing: 9) {
            ForEach(order, id: \.rawValue) { provider in
                Button {
                    Task { await run(provider) }
                } label: {
                    HStack(spacing: 10) {
                        icon(for: provider)
                        if busyProvider == provider {
                            ProgressView()
                        } else {
                            Text(provider.title)
                                .font(.system(size: 15, weight: .semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(AppTheme.text)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Color(red: 0.835, green: 0.851, blue: 0.878), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(busyProvider != nil)
            }
            if let errorText {
                Text(errorText)
                    .font(.system(size: 13))
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
    }

    @ViewBuilder
    private func icon(for provider: SocialAuthProvider) -> some View {
        ZStack {
            Circle()
                .fill(iconBg(provider))
                .overlay(Circle().stroke(provider == .google ? AppTheme.border : Color.clear, lineWidth: 1))
            if provider == .apple {
                Image(systemName: "apple.logo")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
            } else {
                Text(provider.iconLabel)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(provider == .google ? Color(red: 0.26, green: 0.52, blue: 0.96) : .white)
            }
        }
        .frame(width: 22, height: 22)
    }

    private func iconBg(_ provider: SocialAuthProvider) -> Color {
        switch provider {
        case .google: return .white
        case .apple: return .black
        case .facebook: return Color(red: 0.094, green: 0.467, blue: 0.949)
        }
    }

    private func run(_ provider: SocialAuthProvider) async {
        busyProvider = provider
        errorText = nil
        defer { busyProvider = nil }
        do {
            let result = try await SocialAuth.signIn(provider: provider)
            auth.apply(token: result.token, user: result.user)
            onSuccess()
        } catch let err as SocialAuthError where err == .canceled {
            // ignore
        } catch {
            errorText = error.localizedDescription
        }
    }
}
