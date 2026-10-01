import Foundation
import Combine

@MainActor
final class AuthStore: ObservableObject {
    private static let tokenKey = "bymy.auth.token"

    @Published private(set) var token: String?
    @Published private(set) var user: AuthAPI.RemoteUser?
    @Published private(set) var isRestoring = true

    var isLoggedIn: Bool { token != nil && user != nil }

    var displayFirstName: String {
        if let first = user?.profile.firstName?.trimmingCharacters(in: .whitespacesAndNewlines), !first.isEmpty {
            return first
        }
        if let name = user?.displayName.trimmingCharacters(in: .whitespacesAndNewlines),
           !name.isEmpty, !name.contains("@") {
            return name.split(separator: " ").first.map(String.init) ?? name
        }
        if let email = user?.email, let local = email.split(separator: "@").first {
            let s = String(local)
            return s.prefix(1).uppercased() + s.dropFirst()
        }
        return "Fiók"
    }

    var avatarLetter: String {
        String(displayFirstName.prefix(1)).uppercased()
    }

    init() {
        Task { await restore() }
    }

    func restore() async {
        defer { isRestoring = false }
        guard let stored = UserDefaults.standard.string(forKey: Self.tokenKey), !stored.isEmpty else {
            token = nil
            user = nil
            return
        }
        do {
            let me = try await AuthAPI.me(token: stored)
            token = stored
            user = me
        } catch {
            UserDefaults.standard.removeObject(forKey: Self.tokenKey)
            token = nil
            user = nil
        }
    }

    func apply(token: String, user: AuthAPI.RemoteUser) {
        UserDefaults.standard.set(token, forKey: Self.tokenKey)
        self.token = token
        self.user = user
    }

    func logout() async {
        if let token {
            await AuthAPI.logout(token: token)
        }
        clearSession()
    }

    func clearSession() {
        UserDefaults.standard.removeObject(forKey: Self.tokenKey)
        token = nil
        user = nil
    }
}
