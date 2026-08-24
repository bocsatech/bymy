import Foundation
import Combine
import SwiftUI

/// Fő swipe-lapok azonosítói (sorrend + láthatóság menthető).
enum MainPageID: String, Codable, CaseIterable, Identifiable, Hashable {
    case hirfolyam
    case facebook
    case youtube
    case ajanlasok
    case kiemeltek
    case foOldal
    case mentettKeresesek

    var id: String { rawValue }

    /// Fő oldal nem kapcsolható ki.
    var canDisable: Bool {
        self != .foOldal
    }

    var icon: DemoPageIcons {
        switch self {
        case .hirfolyam: return .hirfolyam
        case .facebook: return .facebook
        case .youtube: return .youtube
        case .ajanlasok: return .ajanlasok
        case .kiemeltek: return .kiemeltek
        case .foOldal: return .foOldal
        case .mentettKeresesek: return .mentettKeresesek
        }
    }

    var title: String { icon.title }
    var assetName: String { icon.assetName }

    static let defaultOrder: [MainPageID] = [
        .hirfolyam, .facebook, .youtube, .ajanlasok, .kiemeltek, .foOldal, .mentettKeresesek,
    ]
}

@MainActor
final class PageLayoutStore: ObservableObject {
    /// Teljes sorrend (ki- és bekapcsolt egyaránt).
    @Published private(set) var order: [MainPageID]
    /// Bekapcsolt lapok.
    @Published private(set) var enabled: Set<MainPageID>

    private let storageKey = "addelautod.pageLayout.v1"
    private let tokenKey = "addelautod.authToken.v1"
    /// Szerver sync közben ne írjunk visszacsatolást.
    private var suppressServerSync = false

    init() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let saved = try? JSONDecoder().decode(Saved.self, from: data) {
            order = Self.normalizedOrder(saved.order)
            var on = Set(saved.enabled.compactMap(MainPageID.init(rawValue:)))
            on.insert(.foOldal)
            // Új (még nem mentett order-beli) lapok alapból be
            for id in MainPageID.allCases where !saved.order.contains(id.rawValue) {
                on.insert(id)
            }
            enabled = on
        } else {
            order = MainPageID.defaultOrder
            enabled = Set(MainPageID.allCases)
        }
    }

    /// Látható lapok a mentett sorrendben.
    var visible: [MainPageID] {
        order.filter { enabled.contains($0) }
    }

    func isEnabled(_ id: MainPageID) -> Bool {
        enabled.contains(id)
    }

    func setEnabled(_ id: MainPageID, _ on: Bool) {
        var next = enabled
        if id.canDisable {
            if on {
                next.insert(id)
            } else {
                next.remove(id)
            }
        }
        next.insert(.foOldal)
        enabled = next
        persist()
    }

    func move(from source: IndexSet, to destination: Int) {
        var next = order
        next.move(fromOffsets: source, toOffset: destination)
        order = next
        persist()
    }

    func index(of id: MainPageID) -> Int? {
        visible.firstIndex(of: id)
    }

    /// Belépés / session restore: szerver beállítás felülírja a helyit (ha van).
    func applyFromRemote(_ dto: AuthAPI.PageLayoutDTO?) {
        let remoteOrder = Self.normalizedOrder(dto?.order ?? [])
        let remoteEnabled = dto?.enabled ?? []
        if remoteOrder.isEmpty && remoteEnabled.isEmpty {
            // Szerveren még nincs — feltöltjük a helyi beállítást
            syncToServer()
            return
        }
        suppressServerSync = true
        defer { suppressServerSync = false }
        if !remoteOrder.isEmpty {
            order = remoteOrder
        }
        var on = Set(remoteEnabled.compactMap(MainPageID.init(rawValue:)))
        on.insert(.foOldal)
        if on.isEmpty {
            on = Set(MainPageID.allCases)
        }
        enabled = on
        persistLocalOnly()
    }

    private func persist() {
        persistLocalOnly()
        guard !suppressServerSync else { return }
        syncToServer()
    }

    private func persistLocalOnly() {
        enabled.insert(.foOldal)
        let saved = Saved(
            order: order.map(\.rawValue),
            enabled: enabled.map(\.rawValue)
        )
        if let data = try? JSONEncoder().encode(saved) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
        objectWillChange.send()
    }

    private func syncToServer() {
        guard let token = UserDefaults.standard.string(forKey: tokenKey), !token.isEmpty else { return }
        let dto = AuthAPI.PageLayoutDTO(
            order: order.map(\.rawValue),
            enabled: enabled.map(\.rawValue)
        )
        Task {
            _ = try? await AuthAPI.savePrefs(token: token, pageLayout: dto)
        }
    }

    private static func normalizedOrder(_ raw: [String]) -> [MainPageID] {
        var seen = Set<MainPageID>()
        var result: [MainPageID] = []
        for s in raw {
            guard let id = MainPageID(rawValue: s), !seen.contains(id) else { continue }
            seen.insert(id)
            result.append(id)
        }
        for id in MainPageID.defaultOrder where !seen.contains(id) {
            result.append(id)
        }
        return result
    }

    private struct Saved: Codable {
        var order: [String]
        var enabled: [String]
    }
}
