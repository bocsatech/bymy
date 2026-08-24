import SwiftUI
import UIKit
import CoreImage.CIFilterBuiltins

enum ProfileQRCode {
  /// Profil vCard — telefonnal / e-maillel beolvasható (később publikus profil URL is mehet ide).
  static func payload(for profile: UserProfile) -> String {
    let last = sanitize(profile.lastName)
    let first = sanitize(profile.firstName)
    let fn = sanitize(profile.displayName)
    let email = sanitize(profile.email)
    let phone = sanitize(profile.phone)
    var lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:\(last);\(first);;;",
      "FN:\(fn)",
    ]
    if !email.isEmpty { lines.append("EMAIL;TYPE=INTERNET:\(email)") }
    if !phone.isEmpty { lines.append("TEL;TYPE=CELL:\(phone)") }
    lines.append("NOTE:Bymy profil")
    lines.append("END:VCARD")
    return lines.joined(separator: "\n")
  }

  static func image(for profile: UserProfile, dimension: CGFloat = 160) -> UIImage? {
    let data = Data(payload(for: profile).utf8)
    let filter = CIFilter.qrCodeGenerator()
    filter.message = data
    filter.correctionLevel = "M"
    guard let output = filter.outputImage else { return nil }
    let scale = dimension / output.extent.width
    let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    let context = CIContext()
    guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
    return UIImage(cgImage: cg)
  }

  private static func sanitize(_ value: String) -> String {
    value
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: ";", with: "\\;")
      .replacingOccurrences(of: ",", with: "\\,")
      .replacingOccurrences(of: "\n", with: "\\n")
  }
}

struct ProfileAvatarView: View {
  let image: UIImage?
  let letter: String
  var size: CGFloat = 64

  var body: some View {
    ZStack {
      Circle()
        .fill(AppTheme.accent.opacity(0.15))
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
      } else {
        Text(letter.isEmpty ? "?" : letter)
          .font(size >= 56 ? .title.weight(.semibold) : .subheadline.weight(.semibold))
          .foregroundStyle(AppTheme.accent)
      }
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
    .contentShape(Circle())
  }
}

struct ProfileQRView: View {
  let profile: UserProfile
  var size: CGFloat = 72

  var body: some View {
    Group {
      if let img = ProfileQRCode.image(for: profile, dimension: size * 2) {
        Image(uiImage: img)
          .interpolation(.none)
          .resizable()
          .scaledToFit()
          .frame(width: size, height: size)
          .padding(4)
          .background(Color.white)
          .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
              .stroke(AppTheme.border, lineWidth: 1)
          )
          .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
      } else {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .stroke(AppTheme.border, lineWidth: 1)
          .frame(width: size, height: size)
          .overlay {
            Text("QR")
              .font(.caption2)
              .foregroundStyle(AppTheme.textTertiary)
          }
      }
    }
    .accessibilityLabel("Profil QR-kód")
  }
}
