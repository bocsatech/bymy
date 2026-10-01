import Foundation

enum MessagesAPI {
    struct ListingInfo: Codable, Equatable, Hashable {
        let id: String
        let title: String
        let priceLabel: String
        let code: String
        let meta: String
    }

    struct Peer: Codable, Equatable, Identifiable, Hashable {
        let id: Int
        let email: String
        let displayName: String
    }

    struct LastMessage: Codable, Equatable, Hashable {
        let id: Int
        let senderId: Int
        let body: String
        let createdAt: String
    }

    struct Conversation: Codable, Equatable, Identifiable, Hashable {
        let id: Int
        let listing: ListingInfo
        let peer: Peer
        let role: String
        let unread: Int
        let updatedAt: String
        let lastMessage: LastMessage?
    }

    struct Message: Codable, Equatable, Identifiable {
        let id: Int
        let conversationId: Int
        let senderId: Int
        let body: String
        let createdAt: String
    }

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
        sellerId: Int? = nil,
        initialBody: String? = nil
    ) async throws -> Conversation {
        var body: [String: Any] = [
            "listing_id": listingId,
            "listing_title": title,
            "listing_price_label": priceLabel,
            "listing_meta": meta,
            "listing_code": "BYMY-\(listingId)",
        ]
        if let sellerId, sellerId > 0 { body["seller_id"] = sellerId }
        let text = initialBody?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !text.isEmpty { body["initial_body"] = text }
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

    static func send(token: String, conversationId: Int, body: String) async throws -> Message {
        let data = try await post(
            path: "api/messages/conversations/\(conversationId)/messages",
            token: token,
            json: ["body": body]
        )
        struct Wrap: Decodable { let message: Message }
        return try JSONDecoder().decode(Wrap.self, from: data).message
    }

    static func markRead(token: String, conversationId: Int) async throws {
        _ = try await post(path: "api/messages/conversations/\(conversationId)/read", token: token, json: [:])
    }

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
        guard !token.isEmpty else { throw MsgError.notLoggedIn }
        var req = URLRequest(url: APIBase.url(path))
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else { throw MsgError.unreachable }
            if http.statusCode == 401 { throw MsgError.notLoggedIn }
            if http.statusCode >= 400 {
                let err = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                throw MsgError.server(err ?? "HTTP \(http.statusCode)")
            }
            return data
        } catch let e as MsgError {
            throw e
        } catch {
            throw MsgError.unreachable
        }
    }

    private static func decodeList<T: Decodable>(_ data: Data, key: String) throws -> [T] {
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let arr = obj?[key] else { return [] }
        let raw = try JSONSerialization.data(withJSONObject: arr)
        return try JSONDecoder().decode([T].self, from: raw)
    }
}
