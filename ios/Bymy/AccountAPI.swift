import Foundation

enum AccountAPI {
    static func fetchSellerRatings(token: String?) async throws -> [RatingsScreen.RatingRow] {
        guard let token, !token.isEmpty else {
            throw APIClient.APIError.unauthorized("Belépés szükséges.")
        }
        var req = URLRequest(url: APIBase.url("api/me/seller-ratings"))
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIClient.APIError.unreachable }
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        if http.statusCode == 401 {
            throw APIClient.APIError.unauthorized((obj?["error"] as? String) ?? "Belépés szükséges.")
        }
        guard http.statusCode < 400 else {
            throw APIClient.APIError.server((obj?["error"] as? String) ?? "Értékelések betöltése sikertelen.")
        }
        let arr = (obj?["ratings"] as? [[String: Any]]) ?? []
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "hu_HU")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none

        return arr.enumerated().compactMap { idx, row in
            let score = (row["score"] as? Int)
                ?? (row["rating"] as? Int)
                ?? (row["score"] as? NSNumber)?.intValue
                ?? 0
            let raw = (row["createdAt"] as? String) ?? (row["created_at"] as? String) ?? ""
            var dateLabel = raw
            if let d = ISO8601DateFormatter().date(from: raw) {
                dateLabel = formatter.string(from: d)
            }
            let id = (row["id"] as? String) ?? "\(idx)-\(score)-\(raw)"
            return RatingsScreen.RatingRow(id: id, score: score, dateLabel: dateLabel)
        }
    }
}
