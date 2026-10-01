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
        var postalCode: String?
        var city: String?
        var phone: String?
        var company: String?
        var accountType: String?
        var avatarDataUrl: String?
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
