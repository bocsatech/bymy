import SwiftUI
import PhotosUI
import UIKit

/// Hirdetésfeladás fényképei — max 12, max 5 MB, min. 800×600.
enum PostAdPhotoRules {
    static let maxCount = 12
    static let maxBytes = 5 * 1024 * 1024
    static let minWidth = 800
    static let minHeight = 600
}

struct PostAdPhoto: Identifiable, Equatable {
    let id: UUID
    let image: UIImage
    /// Ellenőrzött JPEG (feltöltéshez).
    let jpegData: Data

    init(id: UUID = UUID(), image: UIImage, jpegData: Data) {
        self.id = id
        self.image = image
        self.jpegData = jpegData
    }

    static func == (lhs: PostAdPhoto, rhs: PostAdPhoto) -> Bool {
        lhs.id == rhs.id
    }
}

enum PostAdPhotoError: LocalizedError {
    case tooMany
    case tooLarge
    case tooSmall
    case invalid
    case cameraUnavailable

    var errorDescription: String? {
        switch self {
        case .tooMany:
            return "Maximum \(PostAdPhotoRules.maxCount) fénykép tölthető fel."
        case .tooLarge:
            return "Egy fénykép maximum 5 MB lehet."
        case .tooSmall:
            return "A kép legalább \(PostAdPhotoRules.minWidth)×\(PostAdPhotoRules.minHeight) pixel legyen."
        case .invalid:
            return "A kép betöltése sikertelen."
        case .cameraUnavailable:
            return "A kamera ezen az eszközön nem elérhető."
        }
    }
}

@MainActor
final class PostAdPhotoStore: ObservableObject {
    @Published private(set) var photos: [PostAdPhoto] = []

    var remainingSlots: Int {
        max(0, PostAdPhotoRules.maxCount - photos.count)
    }

    var summary: String {
        if photos.isEmpty { return "Nincs kép" }
        return "\(photos.count)/\(PostAdPhotoRules.maxCount)"
    }

    func clear() {
        photos = []
    }

    func remove(id: UUID) {
        photos.removeAll { $0.id == id }
    }

    func move(from offsets: IndexSet, to destination: Int) {
        photos.move(fromOffsets: offsets, toOffset: destination)
    }

    func moveUp(id: UUID) {
        guard let i = photos.firstIndex(where: { $0.id == id }), i > 0 else { return }
        photos.swapAt(i, i - 1)
    }

    func moveDown(id: UUID) {
        guard let i = photos.firstIndex(where: { $0.id == id }), i < photos.count - 1 else { return }
        photos.swapAt(i, i + 1)
    }

    /// Az adott képet teszi főképnek (első helyre).
    func makePrimary(id: UUID) {
        guard let i = photos.firstIndex(where: { $0.id == id }), i > 0 else { return }
        let item = photos.remove(at: i)
        photos.insert(item, at: 0)
    }

    @discardableResult
    func addImage(_ image: UIImage, sourceByteCount: Int? = nil) throws -> PostAdPhoto {
        guard remainingSlots > 0 else { throw PostAdPhotoError.tooMany }
        if let n = sourceByteCount, n > PostAdPhotoRules.maxBytes {
            throw PostAdPhotoError.tooLarge
        }
        let prepared = try Self.prepare(image)
        if prepared.jpegData.count > PostAdPhotoRules.maxBytes {
            throw PostAdPhotoError.tooLarge
        }
        let photo = PostAdPhoto(image: prepared.image, jpegData: prepared.jpegData)
        photos.append(photo)
        return photo
    }

    func addImages(_ images: [UIImage]) throws {
        for image in images {
            try addImage(image)
        }
    }

    /// Feltöltéshez: base64 JPEG lista, sorrend = megjelenési sorrend (első = főkép).
    func base64Payloads() -> [String] {
        photos.map { $0.jpegData.base64EncodedString() }
    }

    static func prepare(_ image: UIImage) throws -> (image: UIImage, jpegData: Data) {
        let pixel = image.normalizedOrientation()
        let w = Int(pixel.size.width.rounded())
        let h = Int(pixel.size.height.rounded())
        guard w >= PostAdPhotoRules.minWidth, h >= PostAdPhotoRules.minHeight else {
            throw PostAdPhotoError.tooSmall
        }
        // Feltöltéshez kicsinyítünk, hogy a Vercel 4.5 MB body limit alá férjen.
        let maxSide: CGFloat = 1280
        var scaled = pixel.resized(maxSide: maxSide)
        var quality: CGFloat = 0.72
        guard var data = scaled.jpegData(compressionQuality: quality) else {
            throw PostAdPhotoError.invalid
        }
        let limit = 280_000
        while data.count > limit, quality > 0.42 {
            quality -= 0.08
            guard let next = scaled.jpegData(compressionQuality: quality) else { break }
            data = next
        }
        if data.count > limit {
            scaled = pixel.resized(maxSide: 1024)
            quality = 0.62
            guard let next = scaled.jpegData(compressionQuality: quality) else {
                throw PostAdPhotoError.invalid
            }
            data = next
        }
        return (scaled, data)
    }
}

private extension UIImage {
    func normalizedOrientation() -> UIImage {
        guard imageOrientation != .up else { return self }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = scale
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }

    func resized(maxSide: CGFloat) -> UIImage {
        let longest = max(size.width, size.height)
        guard longest > maxSide else { return self }
        let scale = maxSide / longest
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}

// MARK: - Kamera

struct CameraPicker: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void
    var onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.allowsEditing = false
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.onCancel()
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.onImage(image)
            } else {
                parent.onCancel()
            }
        }
    }
}
