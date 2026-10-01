import Foundation
import UIKit

/// Mobil web `device-contract-identity.js` — csak eszközön, email kulccsal.
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
    var street: String = ""

    mutating func normalize() {
        fullName = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        birthName = birthName.trimmingCharacters(in: .whitespacesAndNewlines)
        birthPlace = birthPlace.trimmingCharacters(in: .whitespacesAndNewlines)
        birthDate = birthDate.trimmingCharacters(in: .whitespacesAndNewlines)
        motherName = motherName.trimmingCharacters(in: .whitespacesAndNewlines)
        idDocType = idDocType.trimmingCharacters(in: .whitespacesAndNewlines)
        idDocNumber = idDocNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        homeAddress = homeAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        citizenship = citizenship.trimmingCharacters(in: .whitespacesAndNewlines)
        companyName = companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        companySeat = companySeat.trimmingCharacters(in: .whitespacesAndNewlines)
        companyRegistry = companyRegistry.trimmingCharacters(in: .whitespacesAndNewlines)
        representative = representative.trimmingCharacters(in: .whitespacesAndNewlines)
        street = street.trimmingCharacters(in: .whitespacesAndNewlines)
        if homeAddress.isEmpty, !street.isEmpty { homeAddress = street }
        if street.isEmpty, !homeAddress.isEmpty { street = homeAddress }
    }
}

enum DeviceContractIdentityStore {
    private static let identityPrefix = "bymy.deviceContractIdentity."
    private static let legacyStreetPrefix = "bymy.privateStreet."

    static func storageKey(email: String) -> String {
        "\(identityPrefix)\(email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
    }

    static func load(email: String) -> DeviceContractIdentity {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return DeviceContractIdentity()
        }
        let key = storageKey(email: email)
        if let raw = UserDefaults.standard.string(forKey: key),
           let data = raw.data(using: .utf8),
           var decoded = try? JSONDecoder().decode(DeviceContractIdentity.self, from: data) {
            decoded.normalize()
            return decoded
        }
        let legacyKey = "\(legacyStreetPrefix)\(email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
        let legacy = String(UserDefaults.standard.string(forKey: legacyKey) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if legacy.isEmpty { return DeviceContractIdentity() }
        var id = DeviceContractIdentity(homeAddress: legacy, street: legacy)
        id.normalize()
        return id
    }

    static func save(email: String, identity: DeviceContractIdentity) {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        var next = identity
        next.normalize()
        let key = storageKey(email: email)
        if let data = try? JSONEncoder().encode(next),
           let raw = String(data: data, encoding: .utf8) {
            UserDefaults.standard.set(raw, forKey: key)
        }
        let legacyKey = "\(legacyStreetPrefix)\(email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
        let street = next.homeAddress.isEmpty ? next.street : next.homeAddress
        if street.isEmpty {
            UserDefaults.standard.removeObject(forKey: legacyKey)
        } else {
            UserDefaults.standard.set(street, forKey: legacyKey)
        }
    }

    /// Web: `identityForAccountKind`
    static func forAccountKind(_ identity: DeviceContractIdentity, company: Bool) -> DeviceContractIdentity {
        var src = identity
        src.normalize()
        var out = DeviceContractIdentity()
        if company {
            out.companyName = src.companyName
            out.companySeat = src.companySeat
            out.companyRegistry = src.companyRegistry
            out.representative = src.representative
        } else {
            out.fullName = src.fullName
            out.birthName = src.birthName
            out.birthPlace = src.birthPlace
            out.birthDate = src.birthDate
            out.motherName = src.motherName
            out.idDocType = src.idDocType
            out.idDocNumber = src.idDocNumber
            out.homeAddress = src.homeAddress
            out.citizenship = src.citizenship
            out.street = src.homeAddress.isEmpty ? src.street : src.homeAddress
        }
        return out
    }
}

enum BymyAccountTypeLabels {
    static func lockedLabel(_ type: String?) -> String {
        let raw = String(type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch raw {
        case "business": return "Céges fiók"
        case "dealer": return "Autókereskedő"
        case "private": return "Privát fiók"
        default: return "—"
        }
    }

    static func isCompany(_ type: String?) -> Bool {
        let raw = String(type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return raw == "business" || raw == "dealer"
    }
}

enum AvatarImageProcessing {
    private static let side: CGFloat = 256

    static func jpegDataURL(from image: UIImage) -> String? {
        let sideLen = min(image.size.width, image.size.height)
        let originX = (image.size.width - sideLen) / 2
        let originY = (image.size.height - sideLen) / 2
        let cropRect = CGRect(x: originX * image.scale, y: originY * image.scale, width: sideLen * image.scale, height: sideLen * image.scale)
        guard let cg = image.cgImage?.cropping(to: cropRect) else { return nil }
        let cropped = UIImage(cgImage: cg, scale: image.scale, orientation: image.imageOrientation)

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        let square = renderer.image { _ in
            cropped.draw(in: CGRect(origin: .zero, size: CGSize(width: side, height: side)))
        }
        guard let jpeg = square.jpegData(compressionQuality: 0.88) else { return nil }
        return "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
    }
}
