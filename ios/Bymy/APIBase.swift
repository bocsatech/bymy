import Foundation

/// Éles API — mindig bymy.hu (online-only).
enum APIBase {
    static let production = URL(string: "https://bymy.hu")!

    static var current: URL { production }

    static func url(_ path: String) -> URL {
        let cleaned = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return current.appendingPathComponent(cleaned)
    }
}
