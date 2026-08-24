import Foundation
import Network
#if canImport(Darwin)
import Darwin
#endif

/// Autosweb / Bymy API gyökér — éles: bymy.vercel.app (nem a telefon localhostja).
enum AutoswebBaseURL {
    static let defaultsKey = "autosweb.baseURL"
    static let defaultProduction = "https://bymy.vercel.app"
    static let port = 3456

    static var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    static var isPhysicalDevice: Bool { !isSimulator }

    static var isLoopbackOnPhysicalDevice: Bool {
        isPhysicalDevice && isLoopback(currentURL())
    }

    static func applyStored() {
        if let stored = UserDefaults.standard.string(forKey: defaultsKey),
           let url = normalizedURL(from: stored),
           isLoopback(url) {
            UserDefaults.standard.removeObject(forKey: defaultsKey)
        }
        _ = currentURL()
    }

    static func currentString() -> String {
        let stored = UserDefaults.standard.string(forKey: defaultsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let url = normalizedURL(from: stored), !isLoopback(url) {
            return url.absoluteString
        }
        return defaultProduction
    }

    static func currentURL() -> URL {
        normalizedURL(from: currentString()) ?? URL(string: defaultProduction)!
    }

    static func isLoopback(_ url: URL) -> Bool {
        let host = (url.host ?? "").lowercased()
        return host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]"
    }

    static func unreachableMessage() -> String {
        "A belépés most nem sikerült. Próbáld újra."
    }

    @discardableResult
    static func set(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = normalizedURL(from: trimmed.isEmpty ? defaultProduction : trimmed) else {
            return nil
        }
        if trimmed.isEmpty || url.absoluteString == defaultProduction || isLoopback(url) {
            UserDefaults.standard.removeObject(forKey: defaultsKey)
            return normalizedURL(from: defaultProduction)
        } else {
            UserDefaults.standard.set(url.absoluteString, forKey: defaultsKey)
        }
        return url
    }

    static func normalizedURL(from raw: String) -> URL? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return URL(string: defaultProduction) }
        if !s.contains("://") { s = "https://\(s)" }
        guard var components = URLComponents(string: s) else { return nil }
        if components.scheme == nil { components.scheme = "https" }
        let hostName = (components.host ?? "").lowercased()
        if components.port == nil, components.scheme == "http",
           hostName == "127.0.0.1" || hostName == "localhost" || AutoswebLAN.isPrivateIPv4(hostName) {
            components.port = port
        }
        if components.path == "/" { components.path = "" }
        guard let url = components.url, let host = components.host, !host.isEmpty else { return nil }
        return url
    }

    @discardableResult
    static func ensureLANBase() async -> URL? {
        await AutoswebLAN.search()
    }

    static func rebasing(_ request: URLRequest, onto newBase: URL) -> URLRequest {
        guard let old = request.url, var comps = URLComponents(url: old, resolvingAgainstBaseURL: false) else {
            return request
        }
        comps.scheme = newBase.scheme
        comps.host = newBase.host
        comps.port = newBase.port
        var req = request
        req.url = comps.url
        return req
    }
}

enum AutoswebLAN {
    private struct Health: Decodable {
        let ok: Bool?
        let service: String?
        let listingsMine: Bool?
    }

    static func search() async -> URL? {
        AutoswebBonjour.shared.start()
        let current = AutoswebBaseURL.currentURL()
        let skipLoopback = AutoswebBaseURL.isPhysicalDevice && AutoswebBaseURL.isLoopback(current)
        if !skipLoopback, await probe(current) {
            return current
        }
        if let bonjour = AutoswebBonjour.shared.lastFoundURL, await probe(bonjour) {
            _ = AutoswebBaseURL.set(bonjour.absoluteString)
            return bonjour
        }
        let wifi = wifiIPv4Addresses()
        if let found = await scanSubnet(wifiIPs: wifi) {
            _ = AutoswebBaseURL.set(found.absoluteString)
            return found
        }
        if let bonjour = AutoswebBonjour.shared.lastFoundURL, await probe(bonjour) {
            _ = AutoswebBaseURL.set(bonjour.absoluteString)
            return bonjour
        }
        return nil
    }

    static func probe(_ base: URL) async -> Bool {
        let url = base.appendingPathComponent("api/health")
        var req = URLRequest(url: url)
        req.timeoutInterval = 1.2
        req.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<500).contains(code), isAutosweb(data) else { return false }
            return true
        } catch {
            return false
        }
    }

    static func isAutosweb(_ data: Data) -> Bool {
        guard let h = try? JSONDecoder().decode(Health.self, from: data) else { return false }
        if h.service == "bymy-autosweb" { return true }
        if h.ok == true, h.listingsMine == true { return true }
        return h.ok == true
    }

    static func scanSubnet(wifiIPs: [String]? = nil) async -> URL? {
        let mine = wifiIPs ?? wifiIPv4Addresses()
        var candidates: [String] = []
        var seen = Set<String>()
        for ip in mine {
            let parts = ip.split(separator: ".").compactMap { Int($0) }
            guard parts.count == 4 else { continue }
            let prefix = "\(parts[0]).\(parts[1]).\(parts[2])"
            var ordered: [Int] = Array(1...40) + Array(41...254)
            ordered.removeAll { $0 == parts[3] }
            for last in ordered {
                let cand = "\(prefix).\(last)"
                if seen.insert(cand).inserted {
                    candidates.append(cand)
                }
            }
        }
        guard !candidates.isEmpty else { return nil }

        return await withTaskGroup(of: URL?.self) { group in
            var iterator = candidates.makeIterator()
            let workers = min(24, candidates.count)
            for _ in 0..<workers {
                guard let ip = iterator.next() else { break }
                group.addTask {
                    await probeIP(ip)
                }
            }
            while let result = await group.next() {
                if let url = result {
                    group.cancelAll()
                    return url
                }
                if let ip = iterator.next() {
                    group.addTask {
                        await probeIP(ip)
                    }
                }
            }
            return nil
        }
    }

    private static func probeIP(_ ip: String) async -> URL? {
        guard let url = URL(string: "http://\(ip):\(AutoswebBaseURL.port)") else { return nil }
        return await probe(url) ? url : nil
    }

    /// Csak Wi‑Fi (`en0`…), nem VPN / mobilnet.
    static func wifiIPv4Addresses() -> [String] {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return [] }
        defer { freeifaddrs(ifaddr) }
        var out: [String] = []
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let name = String(cString: p.pointee.ifa_name)
            let flags = Int32(p.pointee.ifa_flags)
            if name.hasPrefix("en"),
               (flags & IFF_UP) != 0,
               (flags & IFF_LOOPBACK) == 0,
               let addr = p.pointee.ifa_addr,
               addr.pointee.sa_family == UInt8(AF_INET) {
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                getnameinfo(
                    addr,
                    socklen_t(addr.pointee.sa_len),
                    &host,
                    socklen_t(host.count),
                    nil,
                    0,
                    NI_NUMERICHOST
                )
                let ip = String(cString: host)
                if isPrivateIPv4(ip), !out.contains(ip) {
                    out.append(ip)
                }
            }
            ptr = p.pointee.ifa_next
        }
        return out
    }

    static func isPrivateIPv4(_ ip: String) -> Bool {
        let parts = ip.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4 else { return false }
        if parts[0] == 10 { return true }
        if parts[0] == 192, parts[1] == 168 { return true }
        if parts[0] == 172, (16...31).contains(parts[1]) { return true }
        return false
    }
}

final class AutoswebBonjour: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
    static let shared = AutoswebBonjour()

    private let browser = NetServiceBrowser()
    private var resolving: [NetService] = []
    private var nwBrowser: NWBrowser?
    private var connections: [NWConnection] = []
    private(set) var lastFoundURL: URL?
    var onFound: ((URL) -> Void)?

    func start() {
        DispatchQueue.main.async {
            AutoswebBonjour.shared.browser.delegate = AutoswebBonjour.shared
            AutoswebBonjour.shared.browser.searchForServices(ofType: "_autosweb._tcp.", inDomain: "local.")
            AutoswebBonjour.shared.startNWBrowser()
        }
    }

    private func startNWBrowser() {
        guard nwBrowser == nil else { return }
        let params = NWParameters()
        params.includePeerToPeer = true
        let b = NWBrowser(for: .bonjour(type: "_autosweb._tcp", domain: "local."), using: params)
        b.stateUpdateHandler = { _ in }
        b.browseResultsChangedHandler = { results, _ in
            let endpoints = results.map(\.endpoint)
            DispatchQueue.main.async {
                for endpoint in endpoints {
                    AutoswebBonjour.shared.resolve(endpoint)
                }
            }
        }
        b.start(queue: .main)
        nwBrowser = b
    }

    private func resolve(_ endpoint: NWEndpoint) {
        if case .hostPort(let host, let port) = endpoint {
            if let url = url(host: host, port: port) {
                found(url)
            }
            return
        }
        let conn = NWConnection(to: endpoint, using: .tcp)
        conn.stateUpdateHandler = { state in
            guard case .ready = state else { return }
            let remote = conn.currentPath?.remoteEndpoint
            conn.cancel()
            DispatchQueue.main.async {
                if case .hostPort(let host, let port) = remote,
                   let url = AutoswebBonjour.shared.url(host: host, port: port) {
                    AutoswebBonjour.shared.found(url)
                }
            }
        }
        connections.append(conn)
        conn.start(queue: .main)
    }

    private func url(host: NWEndpoint.Host, port: NWEndpoint.Port) -> URL? {
        let hostStr: String
        switch host {
        case .ipv4(let addr):
            hostStr = "\(addr)"
        case .ipv6:
            return nil
        case .name(let name, _):
            hostStr = name
        @unknown default:
            hostStr = "\(host)"
        }
        let cleaned = hostStr.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        guard !cleaned.isEmpty, cleaned != "127.0.0.1", cleaned != "localhost" else { return nil }
        let p = port.rawValue == 0 ? UInt16(AutoswebBaseURL.port) : port.rawValue
        return URL(string: "http://\(cleaned):\(p)")
    }

    private func found(_ url: URL) {
        lastFoundURL = url
        if AutoswebBaseURL.isLoopbackOnPhysicalDevice {
            _ = AutoswebBaseURL.set(url.absoluteString)
        }
        let handler = onFound
        DispatchQueue.main.async {
            handler?(url)
        }
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        service.delegate = self
        service.resolve(withTimeout: 4)
        resolving.append(service)
    }

    func netServiceDidResolveAddress(_ sender: NetService) {
        guard let url = url(from: sender) else { return }
        found(url)
    }

    private func url(from service: NetService) -> URL? {
        let port = service.port > 0 ? service.port : AutoswebBaseURL.port
        if let ip = ipv4(from: service) {
            return URL(string: "http://\(ip):\(port)")
        }
        if let host = service.hostName, !host.isEmpty {
            let h = host.hasSuffix(".") ? String(host.dropLast()) : host
            if h == "localhost" { return nil }
            return URL(string: "http://\(h):\(port)")
        }
        return nil
    }

    private func ipv4(from service: NetService) -> String? {
        guard let addrs = service.addresses else { return nil }
        for data in addrs {
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let ok: Bool = data.withUnsafeBytes { raw in
                guard let sa = raw.baseAddress?.assumingMemoryBound(to: sockaddr.self) else { return false }
                guard sa.pointee.sa_family == sa_family_t(AF_INET) else { return false }
                return getnameinfo(sa, socklen_t(data.count), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0
            }
            if ok {
                let s = String(cString: host)
                if !s.isEmpty, s != "0.0.0.0", s != "127.0.0.1" { return s }
            }
        }
        return nil
    }
}

extension AutoswebBonjour: @unchecked Sendable {}
