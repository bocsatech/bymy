import Foundation

enum AuthAPI {
    struct RemoteUser: Decodable, Equatable {
        let id: Int
        let email: String
        let displayName: String
        let profile: RemoteProfile
    }

    struct RemoteProfile: Codable, Equatable {
        var firstName: String?
        var lastName: String?
        var street: String?
        var postalCode: String?
        var city: String?
        var country: String?
        var phone: String?
        var company: String?
        var accountType: String?
        var avatarDataUrl: String?
        var searchRadiusKm: Int?
        var recommendationsRadiusKm: Int?
        var notifyMessages: Bool?
        var notifyFavorites: Bool?
        var notifyInterests: Bool?
        var notifyNewsletter: Bool?
    }

    private struct AuthResponse: Decodable {
        let ok: Bool?
        let token: String?
        let user: RemoteUser?
        let error: String?
    }

    private struct MeResponse: Decodable {
        let ok: Bool?
        let user: RemoteUser?
        let error: String?
    }

    static func login(email: String, password: String) async throws -> (token: String, user: RemoteUser) {
        try await authPost(path: "api/auth/login", body: [
            "email": email,
            "password": password,
        ])
    }

    static func register(email: String, password: String, passwordConfirm: String) async throws -> (token: String, user: RemoteUser) {
        try await authPost(path: "api/auth/register", body: [
            "email": email,
            "password": password,
            "password_confirm": passwordConfirm,
        ])
    }

    static func me(token: String) async throws -> RemoteUser {
        let (data, http) = try await APIClient.request("api/auth/me", token: token)
        let decoded = try JSONDecoder().decode(MeResponse.self, from: data)
        if http.statusCode == 401 {
            throw APIClient.APIError.unauthorized(decoded.error ?? "Nem vagy bejelentkezve.")
        }
        guard http.statusCode < 400, let user = decoded.user else {
            throw APIClient.APIError.server(decoded.error ?? "Session érvénytelen.")
        }
        return user
    }

    static func oauthNativeApple(identityToken: String, fullName: String) async throws -> (token: String, user: RemoteUser) {
        var body: [String: Any] = [
            "provider": "apple",
            "identityToken": identityToken,
        ]
        if !fullName.isEmpty { body["fullName"] = fullName }
        return try await authPost(path: "api/auth/oauth/native", body: body)
    }

    static func logout(token: String) async {
        _ = try? await APIClient.request("api/auth/logout", method: "POST", token: token)
    }

    private struct ProfileResponse: Decodable {
        let ok: Bool?
        let user: RemoteUser?
        let profile: RemoteProfile?
        let error: String?
    }

    static func saveProfile(token: String, profile: RemoteProfile) async throws -> RemoteUser {
        let enc = try JSONEncoder().encode(profile)
        let obj = try JSONSerialization.jsonObject(with: enc) as? [String: Any] ?? [:]
        let (data, http) = try await APIClient.request(
            "api/auth/profile",
            method: "PUT",
            token: token,
            jsonBody: ["profile": obj]
        )
        let decoded = try JSONDecoder().decode(ProfileResponse.self, from: data)
        if http.statusCode == 401 {
            throw APIClient.APIError.unauthorized(decoded.error ?? "Nem vagy bejelentkezve.")
        }
        guard http.statusCode < 400 else {
            throw APIClient.APIError.server(decoded.error ?? "Profil mentése sikertelen.")
        }
        if let user = decoded.user {
            return user
        }
        // Ha csak profile jön vissza, frissítsük a meglévő me-t
        let me = try await me(token: token)
        return me
    }

    static func changePassword(
        token: String,
        currentPassword: String,
        newPassword: String,
        newPasswordConfirm: String
    ) async throws {
        let (data, http) = try await APIClient.request(
            "api/auth/password",
            method: "POST",
            token: token,
            jsonBody: [
                "currentPassword": currentPassword,
                "newPassword": newPassword,
                "newPasswordConfirm": newPasswordConfirm,
            ]
        )
        struct PassResponse: Decodable { let ok: Bool?; let error: String? }
        let decoded = try? JSONDecoder().decode(PassResponse.self, from: data)
        if http.statusCode == 401 {
            throw APIClient.APIError.unauthorized(decoded?.error ?? "Hibás jelenlegi jelszó.")
        }
        guard http.statusCode < 400 else {
            throw APIClient.APIError.server(decoded?.error ?? "Jelszó módosítása sikertelen.")
        }
    }

    private static func authPost(path: String, body: [String: Any]) async throws -> (token: String, user: RemoteUser) {
        let (data, http) = try await APIClient.request(path, method: "POST", jsonBody: body)
        let decoded = try JSONDecoder().decode(AuthResponse.self, from: data)
        if http.statusCode == 401 {
            throw APIClient.APIError.unauthorized(decoded.error ?? "Hibás email vagy jelszó.")
        }
        guard http.statusCode < 400, let token = decoded.token, let user = decoded.user else {
            throw APIClient.APIError.server(decoded.error ?? "Belépés sikertelen.")
        }
        return (token, user)
    }
}
