import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import UIKit

/// Hirdetés Üzenet gombja: egyből a beszélgetés (nincs inbox köztes képernyő).
struct StartChatScreen: View {
  @EnvironmentObject private var profile: ProfileStore
  let target: ListingMessageTarget
  var onClose: () -> Void

  @State private var conversation: MessagesAPI.Conversation?
  @State private var errorText: String?

  var body: some View {
    Group {
      if let conversation {
        ChatThreadScreen(conversation: conversation, onClose: onClose)
      } else if let errorText {
        VStack(spacing: 14) {
          ScreenHeader(title: "Üzenet", subtitle: nil, onBack: onClose)
          Spacer()
          Text(errorText)
            .font(.subheadline)
            .foregroundStyle(.red)
            .multilineTextAlignment(.center)
            .padding(.horizontal)
          Button("Újra") { Task { await start() } }
          Spacer()
        }
        .background(AppTheme.bgGrouped)
      } else {
        VStack(spacing: 0) {
          ScreenHeader(title: "Üzenet", subtitle: nil, onBack: onClose)
          ProgressView("Üzenet megnyitása…")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(AppTheme.bgGrouped)
      }
    }
    .task { await start() }
  }

  private func start() async {
    guard let token = profile.token else {
      errorText = "Jelentkezz be az üzenetekhez."
      return
    }
    errorText = nil
    do {
      conversation = try await MessagesAPI.startConversation(
        token: token,
        listingId: target.listingId,
        title: target.title,
        priceLabel: target.priceLabel,
        meta: target.meta,
        code: target.code,
        sellerId: target.sellerId
      )
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }
}

/// Összesített üzenetek + chat (willhaben-szerű, magyarul). Csak az inbox menüből.
struct MessagesScreen: View {
  @EnvironmentObject private var profile: ProfileStore
  var onClose: (() -> Void)? = nil

  @State private var conversations: [MessagesAPI.Conversation] = []
  @State private var loading = true
  @State private var errorText: String?
  @State private var openChat: MessagesAPI.Conversation?
  @State private var editing = false

  var body: some View {
    VStack(spacing: 0) {
      ScreenHeader(
        title: "Üzenetek",
        subtitle: unreadLabel,
        onBack: onClose,
        rightLabel: editing ? "Kész" : "Szerkesztés",
        onRight: { editing.toggle() }
      )

      if loading {
        ProgressView("Betöltés…")
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else if let errorText {
        VStack(spacing: 12) {
          Text(errorText)
            .font(.subheadline)
            .foregroundStyle(.red)
            .multilineTextAlignment(.center)
          Button("Újra") { Task { await reload() } }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else if conversations.isEmpty {
        VStack(spacing: 10) {
          Image(systemName: "bubble.left.and.bubble.right")
            .font(.system(size: 40))
            .foregroundStyle(AppTheme.textTertiary)
          Text("Nincs még üzeneted.")
            .font(.subheadline)
            .foregroundStyle(AppTheme.textSecondary)
          Text("Egy hirdetésnél kattints az Üzenet gombra.")
            .font(.caption)
            .foregroundStyle(AppTheme.textTertiary)
            .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        List {
          ForEach(conversations) { conv in
            Button {
              openChat = conv
            } label: {
              conversationRow(conv)
            }
            .buttonStyle(.plain)
          }
          .onDelete(perform: editing ? deleteConversations : nil)
        }
        .listStyle(.plain)
        .environment(\.editMode, .constant(editing ? .active : .inactive))
      }
    }
    .background(AppTheme.bgGrouped)
    .task { await reload() }
    .fullScreenCover(item: $openChat) { conv in
      ChatThreadScreen(conversation: conv, onClose: {
        openChat = nil
        Task { await reload() }
      })
      .environmentObject(profile)
    }
  }

  private var unreadLabel: String {
    let n = conversations.reduce(0) { $0 + $1.unread }
    if n == 0 { return "Nincs olvasatlan" }
    return "\(n) olvasatlan"
  }

  private func conversationRow(_ conv: MessagesAPI.Conversation) -> some View {
    HStack(alignment: .top, spacing: 12) {
      ZStack(alignment: .bottomTrailing) {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .fill(Color(.tertiarySystemFill))
          .frame(width: 56, height: 56)
          .overlay {
            Image(systemName: "car.fill")
              .foregroundStyle(.secondary)
          }
        Circle()
          .fill(AppTheme.accent.opacity(0.15))
          .frame(width: 22, height: 22)
          .overlay {
            Text(String(conv.peer.displayName.prefix(1)).uppercased())
              .font(.caption2.weight(.bold))
              .foregroundStyle(AppTheme.accent)
          }
          .offset(x: 4, y: 4)
      }

      VStack(alignment: .leading, spacing: 3) {
        HStack {
          Text(conv.peer.displayName)
            .font(.subheadline.weight(conv.unread > 0 ? .semibold : .regular))
            .foregroundStyle(AppTheme.text)
          Spacer()
          Text(shortDate(conv.updatedAt))
            .font(.caption2)
            .foregroundStyle(AppTheme.textTertiary)
        }
        Text(conv.listing.title)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(AppTheme.text)
          .lineLimit(1)
        HStack {
          Text(conv.lastMessage?.body ?? "Új beszélgetés")
            .font(.caption)
            .foregroundStyle(AppTheme.textSecondary)
            .lineLimit(1)
          Spacer()
          if conv.unread > 0 {
            Text("\(conv.unread)")
              .font(.caption2.weight(.bold))
              .foregroundStyle(.white)
              .padding(.horizontal, 6)
              .padding(.vertical, 2)
              .background(AppTheme.accent)
              .clipShape(Capsule())
          } else if conv.lastMessage != nil {
            Image(systemName: "checkmark")
              .font(.caption2)
              .foregroundStyle(AppTheme.textTertiary)
          }
        }
      }
    }
    .padding(.vertical, 4)
  }

  private func reload() async {
    guard let token = profile.token else {
      errorText = "Jelentkezz be az üzenetekhez."
      loading = false
      return
    }
    loading = true
    errorText = nil
    defer { loading = false }
    do {
      conversations = try await MessagesAPI.listConversations(token: token)
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }

  private func deleteConversations(at offsets: IndexSet) {
    guard let token = profile.token else { return }
    let toDelete = offsets.map { conversations[$0] }
    Task {
      for c in toDelete {
        try? await MessagesAPI.deleteConversation(token: token, conversationId: c.id)
      }
      await reload()
    }
  }

  private func shortDate(_ iso: String) -> String {
    String(iso.prefix(10)).replacingOccurrences(of: "-", with: ".")
  }
}

// MARK: - Chat

struct ChatThreadScreen: View {
  @EnvironmentObject private var profile: ProfileStore
  let conversation: MessagesAPI.Conversation
  var onClose: () -> Void

  @State private var conv: MessagesAPI.Conversation
  @State private var messages: [MessagesAPI.Message] = []
  @State private var draft = ""
  @State private var busy = false
  @State private var errorText: String?
  @State private var showMenu = false
  @State private var photoItem: PhotosPickerItem?
  @State private var showFileImporter = false

  init(conversation: MessagesAPI.Conversation, onClose: @escaping () -> Void) {
    self.conversation = conversation
    self.onClose = onClose
    _conv = State(initialValue: conversation)
  }

  var body: some View {
    VStack(spacing: 0) {
      chatHeader
      listingBar
      Divider()
      messageList
      if let errorText {
        Text(errorText)
          .font(.caption)
          .foregroundStyle(.red)
          .padding(.horizontal)
      }
      inputBar
    }
    .background(AppTheme.bgGrouped)
    .task { await reload(markRead: true) }
    .confirmationDialog("Műveletek", isPresented: $showMenu, titleVisibility: .visible) {
      Button("Olvasatlanként jelölés") {
        Task { await markUnread() }
      }
      Button("Feladó blokkolása", role: .destructive) {
        Task { await blockPeer() }
      }
      Button("Beszélgetés törlése", role: .destructive) {
        Task { await deleteChat() }
      }
      Button("Mégse", role: .cancel) {}
    }
    .onChange(of: photoItem) { _, item in
      guard let item else { return }
      Task { await sendPickedPhoto(item) }
    }
    .fileImporter(
      isPresented: $showFileImporter,
      allowedContentTypes: [
        .pdf,
        .jpeg,
        .png,
        UTType(filenameExtension: "doc") ?? .data,
        UTType(filenameExtension: "docx") ?? .data,
      ],
      allowsMultipleSelection: false
    ) { result in
      if case .success(let urls) = result, let url = urls.first {
        Task { await sendFile(url) }
      }
    }
  }

  private var chatHeader: some View {
    HStack {
      Button { onClose() } label: {
        Image(systemName: "chevron.left")
          .font(.body.weight(.semibold))
          .foregroundStyle(AppTheme.accent)
          .padding(8)
          .background(Circle().fill(Color(.tertiarySystemFill)))
      }
      VStack(spacing: 2) {
        Text(conv.peer.displayName)
          .font(.headline)
        Text("Bymy üzenet")
          .font(.caption2)
          .foregroundStyle(AppTheme.textSecondary)
      }
      .frame(maxWidth: .infinity)
      Button { showMenu = true } label: {
        Image(systemName: "ellipsis")
          .font(.body.weight(.semibold))
          .foregroundStyle(AppTheme.text)
          .padding(8)
          .background(Circle().fill(Color(.tertiarySystemFill)))
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .background(Color.white)
  }

  private var listingBar: some View {
    HStack(spacing: 10) {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(Color(.tertiarySystemFill))
        .frame(width: 48, height: 48)
        .overlay { Image(systemName: "car.fill").foregroundStyle(.secondary) }
      VStack(alignment: .leading, spacing: 2) {
        Text(conv.listing.title)
          .font(.subheadline.weight(.semibold))
          .lineLimit(1)
        Text(conv.listing.priceLabel)
          .font(.subheadline.weight(.bold))
          .foregroundStyle(AppTheme.accent)
        Text("Bymy kód: \(conv.listing.code)")
          .font(.caption2)
          .foregroundStyle(AppTheme.textTertiary)
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .background(Color.white)
  }

  private var messageList: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(spacing: 10) {
          ForEach(groupedByDay, id: \.day) { group in
            Text(group.day)
              .font(.caption)
              .foregroundStyle(AppTheme.textTertiary)
              .padding(.top, 8)
            ForEach(group.items) { msg in
              bubble(msg)
                .id(msg.id)
            }
          }
        }
        .padding(12)
      }
      .onChange(of: messages.count) { _, _ in
        if let last = messages.last {
          withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
        }
      }
    }
  }

  private func bubble(_ msg: MessagesAPI.Message) -> some View {
    let mine = msg.senderId == profile.userId
    return HStack(alignment: .bottom, spacing: 8) {
      if mine { Spacer(minLength: 40) }
      if !mine {
        Circle()
          .fill(AppTheme.accent.opacity(0.15))
          .frame(width: 28, height: 28)
          .overlay {
            Text(String(conv.peer.displayName.prefix(1)).uppercased())
              .font(.caption2.weight(.bold))
              .foregroundStyle(AppTheme.accent)
          }
      }
      VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
        VStack(alignment: .leading, spacing: 6) {
          if !msg.body.isEmpty {
            Text(msg.body)
              .font(.body)
              .foregroundStyle(mine ? .white : AppTheme.text)
          }
          if let att = msg.attachment {
            Label(att.name, systemImage: "paperclip")
              .font(.caption.weight(.medium))
              .foregroundStyle(mine ? .white.opacity(0.9) : AppTheme.accent)
          }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(mine ? AppTheme.accent : Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

        HStack(spacing: 4) {
          Text(timeOnly(msg.createdAt))
            .font(.caption2)
            .foregroundStyle(AppTheme.textTertiary)
          if mine {
            Image(systemName: "checkmark")
              .font(.caption2)
              .foregroundStyle(AppTheme.textTertiary)
          }
        }
      }
      if !mine { Spacer(minLength: 40) }
    }
  }

  private var inputBar: some View {
    HStack(spacing: 10) {
      Menu {
        PhotosPicker(selection: $photoItem, matching: .images) {
          Label("Fotó", systemImage: "photo")
        }
        Button {
          showFileImporter = true
        } label: {
          Label("Fájl (PDF / DOC, max 10 MB)", systemImage: "doc")
        }
      } label: {
        Image(systemName: "paperclip")
          .font(.title3)
          .foregroundStyle(AppTheme.accent)
      }
      TextField("Üzenet…", text: $draft, axis: .vertical)
        .textFieldStyle(.roundedBorder)
        .lineLimit(1...4)
      Button {
        Task { await sendText() }
      } label: {
        Image(systemName: "paperplane.fill")
          .font(.title3)
          .foregroundStyle(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy ? AppTheme.textTertiary : AppTheme.accent)
      }
      .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy)
    }
    .padding(10)
    .background(Color.white)
  }

  private var groupedByDay: [(day: String, items: [MessagesAPI.Message])] {
    var map: [String: [MessagesAPI.Message]] = [:]
    var order: [String] = []
    for m in messages {
      let day = String(m.createdAt.prefix(10))
      if map[day] == nil { order.append(day) }
      map[day, default: []].append(m)
    }
    return order.map { (day: $0.replacingOccurrences(of: "-", with: "."), items: map[$0] ?? []) }
  }

  private func reload(markRead: Bool) async {
    guard let token = profile.token else { return }
    do {
      let result = try await MessagesAPI.messages(token: token, conversationId: conv.id)
      conv = result.0
      messages = result.1
      if markRead {
        try await MessagesAPI.markRead(token: token, conversationId: conv.id)
      }
      errorText = nil
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }

  private func sendText() async {
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty, let token = profile.token else { return }
    busy = true
    defer { busy = false }
    do {
      _ = try await MessagesAPI.send(token: token, conversationId: conv.id, body: text, attachment: nil)
      draft = ""
      await reload(markRead: true)
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }

  private func sendPickedPhoto(_ item: PhotosPickerItem) async {
    guard let token = profile.token,
          let data = try? await item.loadTransferable(type: Data.self) else { return }
    busy = true
    defer {
      busy = false
      photoItem = nil
    }
    guard assertAttachmentSize(data) else { return }
    do {
      _ = try await MessagesAPI.send(
        token: token,
        conversationId: conv.id,
        body: draft,
        attachment: (filename: "foto.jpg", mime: "image/jpeg", data: data)
      )
      draft = ""
      await reload(markRead: true)
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }

  private func sendFile(_ url: URL) async {
    guard let token = profile.token else { return }
    guard url.startAccessingSecurityScopedResource() else { return }
    defer { url.stopAccessingSecurityScopedResource() }
    guard let data = try? Data(contentsOf: url) else { return }
    guard assertAttachmentSize(data) else { return }
    let name = url.lastPathComponent
    let ext = url.pathExtension.lowercased()
    let mime: String
    switch ext {
    case "pdf": mime = "application/pdf"
    case "doc": mime = "application/msword"
    case "docx": mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    case "png": mime = "image/png"
    case "jpg", "jpeg": mime = "image/jpeg"
    case "webp": mime = "image/webp"
    case "gif": mime = "image/gif"
    default:
      errorText = "Csak kép, PDF vagy DOC/DOCX csatolható."
      return
    }
    busy = true
    defer { busy = false }
    do {
      _ = try await MessagesAPI.send(
        token: token,
        conversationId: conv.id,
        body: draft,
        attachment: (filename: name, mime: mime, data: data)
      )
      draft = ""
      await reload(markRead: true)
    } catch {
      errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }

  private func markUnread() async {
    guard let token = profile.token else { return }
    try? await MessagesAPI.markUnread(token: token, conversationId: conv.id)
    onClose()
  }

  private func blockPeer() async {
    guard let token = profile.token else { return }
    try? await MessagesAPI.block(token: token, userId: conv.peer.id)
    onClose()
  }

  private func deleteChat() async {
    guard let token = profile.token else { return }
    try? await MessagesAPI.deleteConversation(token: token, conversationId: conv.id)
    onClose()
  }

  private func timeOnly(_ iso: String) -> String {
    if iso.count >= 16 { return String(iso.dropFirst(11).prefix(5)) }
    return iso
  }

  private func assertAttachmentSize(_ data: Data) -> Bool {
    if data.count > MessagesAPI.maxAttachmentBytes {
      errorText = "A csatolmány maximum 10 MB lehet."
      return false
    }
    return true
  }
}

/// Listázó kártyákon: „Üzenet” CTA
struct MessageListingButton: View {
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Label("Üzenet", systemImage: "bubble.left.fill")
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(AppTheme.accent)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
    .buttonStyle(.plain)
  }
}
