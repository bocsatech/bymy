import Foundation
import Combine

/// Adásvételi / szerződéses adatok — csak a telefonon (UserDefaults), soha nem a Bymy szerveren.
struct DeviceContractIdentity: Codable, Equatable {
    var fullName: String = ""
    var birthName: String = ""
    var birthPlace: String = ""
    var birthDate: String = ""
    var motherName: String = ""
    var idDocType: String = ""
    var idDocNumber: String = ""
    var homeAddress: String = ""
    var citizenship: String = ""
    var companyName: String = ""
    var companySeat: String = ""
    var companyRegistry: String = ""
    var representative: String = ""
    /// Legacy / alias a web `street` mezőhöz
    var street: String = ""

    var resolvedHomeAddress: String {
        let home = homeAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        if !home.isEmpty { return home }
        return street.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    mutating func normalize() {
        if homeAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           !street.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            homeAddress = street
        }
        if street.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           !homeAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            street = homeAddress
        }
    }
}

@MainActor
final class DeviceContractIdentityStore: ObservableObject {
    static let shared = DeviceContractIdentityStore()

    @Published var identity = DeviceContractIdentity()

    private let keyPrefix = "bymy.deviceContractIdentity."
    private var loadedEmail: String = ""

    private func storageKey(email: String) -> String {
        keyPrefix + email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    func load(email: String) {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else {
            identity = DeviceContractIdentity()
            loadedEmail = ""
            return
        }
        if normalized == loadedEmail { return }
        loadedEmail = normalized
        let key = storageKey(email: normalized)
        if let data = UserDefaults.standard.data(forKey: key),
           var decoded = try? JSONDecoder().decode(DeviceContractIdentity.self, from: data) {
            decoded.normalize()
            identity = decoded
            return
        }
        identity = DeviceContractIdentity()
    }

    @discardableResult
    func save(email: String) -> Bool {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return false }
        identity.normalize()
        loadedEmail = normalized
        guard let data = try? JSONEncoder().encode(identity) else { return false }
        UserDefaults.standard.set(data, forKey: storageKey(email: normalized))
        return true
    }

    func clear(email: String) {
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return }
        UserDefaults.standard.removeObject(forKey: storageKey(email: normalized))
        if loadedEmail == normalized {
            identity = DeviceContractIdentity()
        }
    }

    /// Hirdetés megtekintési cím / szerződés — privátnál csak helyi lakcím.
    static func listingStreet(profile: UserProfile, identity: DeviceContractIdentity) -> String {
        let type = profile.accountType.lowercased()
        if type == "business" || type == "dealer" {
            let seat = identity.companySeat.trimmingCharacters(in: .whitespacesAndNewlines)
            if !seat.isEmpty { return seat }
            return profile.street.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return identity.resolvedHomeAddress
    }
}
