import Foundation

enum APIClient {
    enum APIError: LocalizedError {
        case unreachable
        case server(String)
        case unauthorized(String)
        case decoding

        var errorDescription: String? {
            switch self {
            case .unreachable: return "Nincs kapcsolat a bymy.hu szerverrel."
            case .server(let msg), .unauthorized(let msg): return msg
            case .decoding: return "Érvénytelen válasz a szervertől."
            }
        }
    }

    static func request(
        _ path: String,
        method: String = "GET",
        token: String? = nil,
        jsonBody: [String: Any]? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        var req = URLRequest(url: APIBase.url(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 30
        if let token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let jsonBody {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: jsonBody)
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else { throw APIError.unreachable }
            return (data, http)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.unreachable
        }
    }
}
