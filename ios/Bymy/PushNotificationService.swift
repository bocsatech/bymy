import Foundation
import UserNotifications
import UIKit

/// Helyi értesítés most; device token a szerveren — később APNs.
@MainActor
final class PushNotificationService: ObservableObject {
  static let shared = PushNotificationService()

  private var pollTask: Task<Void, Never>?
  private var lastUnreadTotal = 0

  func requestPermissionAndRegister(authToken: String?) async {
    let center = UNUserNotificationCenter.current()
    _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    // Valódi APNs tokenhez AppDelegate / remote notifications kell — ideiglenes eszközazonosító:
    let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
    if let authToken {
      try? await MessagesAPI.registerDeviceToken(token: authToken, deviceToken: "sim-\(deviceId)")
    }
  }

  func startPolling(authTokenProvider: @escaping () -> String?) {
    pollTask?.cancel()
    pollTask = Task {
      while !Task.isCancelled {
        if let token = authTokenProvider() {
          await poll(token: token)
        }
        try? await Task.sleep(nanoseconds: 12_000_000_000)
      }
    }
  }

  func stopPolling() {
    pollTask?.cancel()
    pollTask = nil
  }

  private func poll(token: String) async {
    do {
      let pending = try await MessagesAPI.pendingPush(token: token)
      for item in pending {
        await postLocal(title: item.title, body: item.body, id: "push-\(item.id)")
      }
      let convs = try await MessagesAPI.listConversations(token: token)
      let unread = convs.reduce(0) { $0 + $1.unread }
      try? await UNUserNotificationCenter.current().setBadgeCount(unread)
      if unread > lastUnreadTotal, pending.isEmpty {
        await postLocal(
          title: "Új üzenet érkezett",
          body: "\(unread) olvasatlan beszélgetés",
          id: "unread-\(unread)-\(Date().timeIntervalSince1970)"
        )
      }
      lastUnreadTotal = unread
    } catch {
      /* offline */
    }
  }

  private func postLocal(title: String, body: String, id: String) async {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    let req = UNNotificationRequest(
      identifier: id,
      content: content,
      trigger: nil
    )
    try? await UNUserNotificationCenter.current().add(req)
  }
}
