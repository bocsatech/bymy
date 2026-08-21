import Foundation

/// Autosweb `/api/messages/*` — szerveren tárolt chat (később VPS-re költöztethető).
enum MessagesAPI {
  static var baseURL: URL { PartnerRecommendationsClient.baseURL }

  struct ListingInfo: Codable, Equatable {
    let id: String
    let title: String
    let priceLabel: String
    let code: String
    let meta: String
  }

  struct Peer: Codable, Equatable, Identifiable {
    let id: Int
    let email: String
    let displayName: String
  }

  struct LastMessage: Codable, Equatable {
    let id: Int
    let senderId: Int
    let body: String
    let createdAt: String
  }

  struct Conversation: Codable, Equatable, Identifiable {
    let id: Int
    let listing: ListingInfo
    let peer: Peer
    let role: String
    let unread: Int
    let updatedAt: String
    let lastMessage: LastMessage?
  }

  struct Attachment: Codable, Equatable {
    let name: String
    let mime: String
    let size: Int?
    let url: String?
  }

  struct Message: Codable, Equatable, Identifiable {
    let id: Int
    let conversationId: Int
    let senderId: Int
    let body: String
    let createdAt: String
    let attachment: Attachment?
  }

  struct PushItem: Codable, Equatable, Identifiable {
    let id: Int
    let title: String
    let body: String
    let createdAt: String
  }

  static let maxAttachmentBytes = 10 * 1024 * 1024

  enum MsgError: LocalizedError {
    case server(String)
    case unreachable
    case notLoggedIn

    var errorDescription: String? {
      switch self {
      case .server(let m): return m
      case .unreachable: return "A szerver most nem elérhető. Próbáld újra."
      case .notLoggedIn: return "Jelentkezz be az üzenetekhez."
      }
    }
  }

  static func listConversations(token: String) async throws -> [Conversation] {
    let data = try await get(path: "api/messages/conversations", token: token)
    return try decodeList(data, key: "conversations")
  }

  static func startConversation(
    token: String,
    listingId: String,
    title: String,
    priceLabel: String,
    meta: String,
    code: String? = nil,
    sellerId: Int? = nil
  ) async throws -> Conversation {
    var body: [String: Any] = [
      "listing_id": listingId,
      "listing_title": title,
      "listing_price_label": priceLabel,
      "listing_meta": meta,
      "listing_code": code ?? "AEA-\(listingId)",
    ]
    if let sellerId, sellerId > 0 {
      body["seller_id"] = sellerId
    }
    let data = try await post(path: "api/messages/conversations", token: token, json: body)
    struct Wrap: Decodable { let conversation: Conversation }
    return try JSONDecoder().decode(Wrap.self, from: data).conversation
  }

  static func messages(token: String, conversationId: Int) async throws -> (Conversation, [Message]) {
    let data = try await get(path: "api/messages/conversations/\(conversationId)/messages", token: token)
    struct Wrap: Decodable {
      let conversation: Conversation
      let messages: [Message]
    }
    let wrap = try JSONDecoder().decode(Wrap.self, from: data)
    return (wrap.conversation, wrap.messages)
  }

  static func send(
    token: String,
    conversationId: Int,
    body: String,
    attachment: (filename: String, mime: String, data: Data)?
  ) async throws -> Message {
    var json: [String: Any] = ["body": body]
    if let attachment {
      json["attachment"] = [
        "filename": attachment.filename,
        "mime": attachment.mime,
        "data_base64": attachment.data.base64EncodedString(),
      ]
    }
    let data = try await post(
      path: "api/messages/conversations/\(conversationId)/messages",
      token: token,
      json: json
    )
    struct Wrap: Decodable { let message: Message }
    return try JSONDecoder().decode(Wrap.self, from: data).message
  }

  static func markRead(token: String, conversationId: Int) async throws {
    _ = try await post(path: "api/messages/conversations/\(conversationId)/read", token: token, json: [:])
  }

  static func markUnread(token: String, conversationId: Int) async throws {
    _ = try await post(path: "api/messages/conversations/\(conversationId)/unread", token: token, json: [:])
  }

  static func deleteConversation(token: String, conversationId: Int) async throws {
    _ = try await request(path: "api/messages/conversations/\(conversationId)", method: "DELETE", token: token)
  }

  static func block(token: String, userId: Int) async throws {
    _ = try await post(path: "api/messages/block", token: token, json: ["user_id": userId])
  }

  static func registerDeviceToken(token: String, deviceToken: String) async throws {
    _ = try await post(
      path: "api/messages/device-token",
      token: token,
      json: ["token": deviceToken, "platform": "ios"]
    )
  }

  static func pendingPush(token: String) async throws -> [PushItem] {
    let data = try await get(path: "api/messages/push-pending", token: token)
    return try decodeList(data, key: "notifications")
  }

  // MARK: - HTTP

  private static let session: URLSession = {
    let c = URLSessionConfiguration.ephemeral
    c.timeoutIntervalForRequest = 30
    c.timeoutIntervalForResource = 60
    c.waitsForConnectivity = false
    return URLSession(configuration: c)
  }()

  private static func get(path: String, token: String) async throws -> Data {
    try await request(path: path, method: "GET", token: token)
  }

  private static func post(path: String, token: String, json: [String: Any]) async throws -> Data {
    try await request(path: path, method: "POST", token: token, json: json)
  }

  private static func request(
    path: String,
    method: String,
    token: String,
    json: [String: Any]? = nil
  ) async throws -> Data {
    guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
      throw MsgError.unreachable
    }
    var req = URLRequest(url: url)
    req.httpMethod = method
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    if let json {
      req.setValue("application/json", forHTTPHeaderField: "Content-Type")
      req.httpBody = try JSONSerialization.data(withJSONObject: json)
    }
    do {
      let (data, response) = try await session.data(for: req)
      guard let http = response as? HTTPURLResponse else { throw MsgError.unreachable }
      if http.statusCode >= 400 {
        let err = (try? JSONDecoder().decode(ErrBody.self, from: data))?.error
        if err == "Ismeretlen API." {
          throw MsgError.server("Az üzenetek most nem elérhetők. Próbáld újra.")
        }
        throw MsgError.server(err ?? "HTTP \(http.statusCode)")
      }
      return data
    } catch let e as MsgError {
      throw e
    } catch {
      throw MsgError.unreachable
    }
  }

  private struct ErrBody: Decodable { let error: String? }

  private static func decodeList<T: Decodable>(_ data: Data, key: String) throws -> [T] {
    let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    guard let arr = obj?[key] else { return [] }
    let raw = try JSONSerialization.data(withJSONObject: arr)
    return try JSONDecoder().decode([T].self, from: raw)
  }
}

struct ListingMessageTarget: Identifiable, Equatable {
  var id: String { listingId }
  let listingId: String
  let title: String
  let priceLabel: String
  let meta: String
  var sellerId: Int? = nil
  var code: String { "AEA-\(listingId)" }
}

extension DemoListing {
  var messageTarget: ListingMessageTarget {
    ListingMessageTarget(
      listingId: id,
      title: title,
      priceLabel: priceLabel,
      meta: meta,
      sellerId: nil
    )
  }
}

extension FeaturedAd {
  var messageTarget: ListingMessageTarget {
    ListingMessageTarget(
      listingId: id,
      title: title,
      priceLabel: priceLabel,
      meta: meta,
      sellerId: nil
    )
  }
}
