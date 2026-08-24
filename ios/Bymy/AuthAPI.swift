import Foundation

/// Közös Autosweb fiók API (`/api/auth/*`) — ugyanaz a SQLite users tábla, mint a weben.
enum AuthAPI {
  static var baseURL: URL { PartnerRecommendationsClient.baseURL }

  struct RemoteUser: Decodable {
    let id: Int
    let email: String
    let displayName: String
    let profile: RemoteProfile
  }

  struct RemoteProfile: Codable {
    var salutation: String?
    var firstName: String?
    var lastName: String?
    var street: String?
    var postalCode: String?
    var city: String?
    var country: String?
    var phone: String?
    var company: String?
    var accountType: String?
    /// data:image/jpeg;base64,... — közös a weben és az appban
    var avatarDataUrl: String?
    /// iOS megjelenített lapok (szerveren tárolva)
    var pageLayout: PageLayoutDTO?
  }

  struct PageLayoutDTO: Codable, Equatable {
    var order: [String]?
    var enabled: [String]?
  }

  struct AuthResponse: Decodable {
    let ok: Bool?
    let token: String?
    let user: RemoteUser?
    let error: String?
  }

  static func oauthNativeApple(identityToken: String, fullName: String) async throws -> (token: String, user: RemoteUser) {
    var body: [String: String] = [
      "provider": "apple",
      "identityToken": identityToken,
    ]
    if !fullName.isEmpty { body["fullName"] = fullName }
    return try await authPost(path: "api/auth/oauth/native", body: body)
  }

  struct MeResponse: Decodable {
    let ok: Bool?
    let user: RemoteUser?
    let error: String?
  }

  enum AuthError: LocalizedError {
    case server(String)
    case unauthorized(String)
    case unreachable
    case decoding

    var errorDescription: String? {
      switch self {
      case .server(let msg): return msg
      case .unauthorized(let msg): return msg
      case .unreachable:
        return AutoswebBaseURL.unreachableMessage()
      case .decoding: return "Érvénytelen válasz a szervertől."
      }
    }

    /// Login 401 — a szerver nem árulja el, hogy a fiók létezik-e.
    var isWrongEmailOrPassword: Bool {
      switch self {
      case .server(let msg), .unauthorized(let msg):
        return msg.localizedCaseInsensitiveContains("Hibás email")
          || msg.localizedCaseInsensitiveContains("Hibás jelszó")
      default:
        return false
      }
    }

    var isEmailAlreadyRegistered: Bool {
      switch self {
      case .server(let msg):
        return msg.localizedCaseInsensitiveContains("már regisztrálva")
      default:
        return false
      }
    }
  }

  static func register(email: String, password: String, passwordConfirm: String) async throws -> (token: String, user: RemoteUser) {
    try await authPost(
      path: "api/auth/register",
      body: [
        "email": email,
        "password": password,
        "password_confirm": passwordConfirm,
      ]
    )
  }

  static func login(email: String, password: String) async throws -> (token: String, user: RemoteUser) {
    try await authPost(
      path: "api/auth/login",
      body: [
        "email": email,
        "password": password,
      ]
    )
  }

  static func me(token: String) async throws -> RemoteUser {
    var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/me"))
    req.httpMethod = "GET"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    let (data, response) = try await perform(req)
    guard let http = response as? HTTPURLResponse else { throw AuthError.unreachable }
    let decoded = try JSONDecoder().decode(MeResponse.self, from: data)
    if http.statusCode == 401 { throw AuthError.unauthorized(decoded.error ?? "Nem vagy bejelentkezve.") }
    guard http.statusCode < 400, let user = decoded.user else {
      throw AuthError.server(decoded.error ?? "Session érvénytelen.")
    }
    return user
  }

  static func saveAvatar(token: String, jpegData: Data) async throws -> RemoteUser {
    let b64 = jpegData.base64EncodedString()
    let dataUrl = "data:image/jpeg;base64,\(b64)"
    var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/avatar"))
    req.httpMethod = "PUT"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    req.httpBody = try JSONSerialization.data(withJSONObject: ["avatarDataUrl": dataUrl])
    let (data, response) = try await perform(req)
    guard let http = response as? HTTPURLResponse else { throw AuthError.unreachable }
    let decoded = try JSONDecoder().decode(AuthResponse.self, from: data)
    guard http.statusCode < 400, let user = decoded.user else {
      throw AuthError.server(decoded.error ?? "Profilkép mentése sikertelen.")
    }
    return user
  }

  /// Megjelenített lapok / prefs — szerveren a profilban.
  @discardableResult
  static func savePrefs(token: String, pageLayout: PageLayoutDTO) async throws -> RemoteUser {
    var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/prefs"))
    req.httpMethod = "PUT"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    let body: [String: Any] = [
      "pageLayout": [
        "order": pageLayout.order ?? [],
        "enabled": pageLayout.enabled ?? [],
      ],
    ]
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, response) = try await perform(req)
    guard let http = response as? HTTPURLResponse else { throw AuthError.unreachable }
    let decoded = try JSONDecoder().decode(AuthResponse.self, from: data)
    guard http.statusCode < 400, let user = decoded.user else {
      throw AuthError.server(decoded.error ?? "Beállítások mentése sikertelen.")
    }
    return user
  }

  static func saveProfile(token: String, profile: [String: String]) async throws -> RemoteUser {
    var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/profile"))
    req.httpMethod = "PUT"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    req.httpBody = try JSONSerialization.data(withJSONObject: profile)
    let (data, response) = try await perform(req)
    guard let http = response as? HTTPURLResponse else { throw AuthError.unreachable }
    let decoded = try JSONDecoder().decode(AuthResponse.self, from: data)
    guard http.statusCode < 400, let user = decoded.user else {
      throw AuthError.server(decoded.error ?? "Profil mentés sikertelen.")
    }
    return user
  }

  static func changePassword(
    token: String,
    current: String,
    newPassword: String,
    confirm: String
  ) async throws {
    var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/password"))
    req.httpMethod = "POST"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    req.httpBody = try JSONSerialization.data(withJSONObject: [
      "current_password": current,
      "new_password": newPassword,
      "new_password_confirm": confirm,
    ])
    let (data, response) = try await perform(req)
    guard let http = response as? HTTPURLResponse else { throw AuthError.unreachable }
    if http.statusCode >= 400 {
      let decoded = try? JSONDecoder().decode(AuthResponse.self, from: data)
      throw AuthError.server(decoded?.error ?? "Jelszó módosítás sikertelen.")
    }
  }

  static func logout(token: String) async {
    var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/logout"))
    req.httpMethod = "POST"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    _ = try? await perform(req)
  }

  static func deleteAccount(token: String) async throws {
    var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/account"))
    req.httpMethod = "DELETE"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    let (data, response) = try await perform(req)
    guard let http = response as? HTTPURLResponse else { throw AuthError.unreachable }
    if http.statusCode >= 400 {
      let decoded = try? JSONDecoder().decode(AuthResponse.self, from: data)
      throw AuthError.server(decoded?.error ?? "Fiók törlés sikertelen.")
    }
  }

  private static func authPost(path: String, body: [String: String]) async throws -> (token: String, user: RemoteUser) {
    var req = URLRequest(url: baseURL.appendingPathComponent(path))
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, response) = try await perform(req)
    guard let http = response as? HTTPURLResponse else { throw AuthError.unreachable }
    let decoded = try JSONDecoder().decode(AuthResponse.self, from: data)
    guard http.statusCode < 400, let token = decoded.token, let user = decoded.user else {
      throw AuthError.server(decoded.error ?? "Belépés sikertelen.")
    }
    return (token, user)
  }

  private static let session: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    // LAN első csatlakozás + helyi hálózat engedély: 3 mp kevés
    config.timeoutIntervalForRequest = 15
    config.timeoutIntervalForResource = 20
    config.waitsForConnectivity = false
    return URLSession(configuration: config)
  }()

  private static func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
    let req = AutoswebBaseURL.rebasing(request, onto: AutoswebBaseURL.currentURL())
    do {
      return try await session.data(for: req)
    } catch {
      throw AuthError.unreachable
    }
  }
}

extension UserProfile {
  mutating func apply(remote: AuthAPI.RemoteUser) {
    email = remote.email
    serverDisplayName = remote.displayName
    let p = remote.profile
    if let v = p.salutation { salutation = v }
    if let v = p.firstName { firstName = v }
    if let v = p.lastName { lastName = v }
    if let v = p.street { street = v }
    if let v = p.postalCode { postalCode = v }
    if let v = p.city { city = v }
    if let v = p.country, !v.isEmpty { country = v }
    if let v = p.phone { phone = v }
    if let v = p.company { company = v }
    if let v = p.accountType { accountType = v }
  }

  func remotePayload() -> [String: String] {
    [
      "salutation": salutation,
      "firstName": firstName,
      "lastName": lastName,
      "street": street,
      "postalCode": postalCode,
      "city": city,
      "country": country,
      "phone": phone,
      "company": company,
      "accountType": accountType,
    ]
  }
}
