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
        switch provider {
        case .apple:
            return try await signInWithWeb(provider: "apple")
        case .google:
            return try await signInWithWeb(provider: "google")
        case .facebook:
            return try await signInWithWeb(provider: "facebook")
        }
    }

    private static func signInWithAppleNative() async throws -> (token: String, user: AuthAPI.RemoteUser) {
        let credential = try await AppleSignInController.shared.perform()
        guard let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8),
              !identityToken.isEmpty
        else {
            throw SocialAuthError.missingToken
        }
        var nameParts: [String] = []
        if let name = credential.fullName {
            if let given = name.givenName, !given.isEmpty { nameParts.append(given) }
            if let family = name.familyName, !family.isEmpty { nameParts.append(family) }
        }
        return try await AuthAPI.oauthNativeApple(
            identityToken: identityToken,
            fullName: nameParts.joined(separator: " ")
        )
    }

    private static func signInWithWeb(provider: String) async throws -> (token: String, user: AuthAPI.RemoteUser) {
        await MainActor.run { BiometricLock.shared.suppressLock(for: 180) }
        defer {
            Task { @MainActor in BiometricLock.shared.clearSuppressLock() }
        }
        let start = AutoswebBaseURL.currentURL().appendingPathComponent("api/auth/oauth/start/\(provider)")
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

final class AppleSignInController: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = AppleSignInController()

    private var continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>?

    @MainActor
    func perform() async throws -> ASAuthorizationAppleIDCredential {
        try await withCheckedThrowingContinuation { cont in
            continuation = cont
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        Self.keyWindow() ?? ASPresentationAnchor()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            continuation?.resume(throwing: SocialAuthError.missingToken)
            continuation = nil
            return
        }
        continuation?.resume(returning: credential)
        continuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let auth = error as? ASAuthorizationError
        if auth?.code == .canceled {
            continuation?.resume(throwing: SocialAuthError.canceled)
        } else {
            continuation?.resume(throwing: error)
        }
        continuation = nil
    }

    static func keyWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
    }
}

enum WebAuthSession {
    private final class Presenter: NSObject, ASWebAuthenticationPresentationContextProviding {
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            AppleSignInController.keyWindow() ?? ASPresentationAnchor()
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

/// Apple / Google / Facebook — belépés és új fiók ugyanazzal a gombbal.
struct SocialAuthButtons: View {
    @EnvironmentObject private var profile: ProfileStore
    var onSuccess: () -> Void = {}

    @State private var busyProvider: SocialAuthProvider?

    var body: some View {
        VStack(spacing: 9) {
            socialButton(provider: .google)
            socialButton(provider: .apple)
            socialButton(provider: .facebook)
        }
        .disabled(busyProvider != nil)
    }

    private func socialButton(provider: SocialAuthProvider) -> some View {
        Button {
            Task { await run(provider) }
        } label: {
            HStack(spacing: 9) {
                if busyProvider == provider {
                    ProgressView()
                        .frame(width: 20, height: 20)
                } else {
                    socialIcon(provider)
                }
                Text(provider.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(red: 0.067, green: 0.067, blue: 0.067))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color(red: 0.835, green: 0.851, blue: 0.878), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func socialIcon(_ provider: SocialAuthProvider) -> some View {
        switch provider {
        case .google:
            Text("G")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(red: 0.259, green: 0.522, blue: 0.957))
                .frame(width: 20, height: 20)
                .background(Color.white)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color(red: 0.855, green: 0.863, blue: 0.878), lineWidth: 1))
        case .apple:
            Image(systemName: "apple.logo")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(Color(red: 0.067, green: 0.067, blue: 0.067))
                .clipShape(Circle())
        case .facebook:
            Text("f")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(Color(red: 0.094, green: 0.467, blue: 0.949))
                .clipShape(Circle())
        }
    }

    @MainActor
    private func run(_ provider: SocialAuthProvider) async {
        busyProvider = provider
        defer { busyProvider = nil }
        if await profile.signInSocial(provider: provider) {
            onSuccess()
        }
    }
}
