import SwiftUI

struct MessagesInboxScreen: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var conversations: [MessagesAPI.Conversation] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var selected: MessagesAPI.Conversation?

    var body: some View {
        Group {
            if loading && conversations.isEmpty {
                ProgressView("Üzenetek…")
            } else if let errorText, conversations.isEmpty {
                VStack(spacing: 10) {
                    Text(errorText)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(AppTheme.textSecondary)
                    Button("Újra") { Task { await load() } }
                        .foregroundStyle(AppTheme.accent)
                }
                .padding()
            } else if conversations.isEmpty {
                Text("Még nincs üzeneted.")
                    .foregroundStyle(AppTheme.textSecondary)
            } else {
                List(conversations) { conv in
                    Button {
                        selected = conv
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(conv.listing.title)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(AppTheme.text)
                                    .lineLimit(1)
                                Spacer()
                                if conv.unread > 0 {
                                    Text("\(conv.unread)")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(AppTheme.accent)
                                        .clipShape(Capsule())
                                }
                            }
                            Text(conv.peer.displayName)
                                .font(.system(size: 13))
                                .foregroundStyle(AppTheme.textSecondary)
                            if let last = conv.lastMessage?.body, !last.isEmpty {
                                Text(last)
                                    .font(.system(size: 13))
                                    .foregroundStyle(AppTheme.textSecondary)
                                    .lineLimit(2)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Üzenetek")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Kész") { dismiss() }
            }
        }
        .task { await load() }
        .navigationDestination(item: $selected) { conv in
            ChatScreen(conversation: conv)
        }
    }

    private func load() async {
        guard let token = auth.token else {
            errorText = MessagesAPI.MsgError.notLoggedIn.localizedDescription
            loading = false
            return
        }
        loading = true
        errorText = nil
        do {
            conversations = try await MessagesAPI.listConversations(token: token)
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }
}

struct ChatScreen: View {
    @State var conversation: MessagesAPI.Conversation
    @EnvironmentObject private var auth: AuthStore

    @State private var messages: [MessagesAPI.Message] = []
    @State private var draft = ""
    @State private var sending = false
    @State private var errorText: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        ForEach(messages) { msg in
                            bubble(msg)
                                .id(msg.id)
                        }
                    }
                    .padding(14)
                }
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            if let errorText {
                Text(errorText)
                    .font(.system(size: 12))
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }

            HStack(spacing: 10) {
                TextField("Üzenet…", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(10)
                    .background(AppTheme.avatarBg)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "paperplane.fill")
                        .foregroundStyle(.black)
                        .frame(width: 42, height: 42)
                        .background(AppTheme.brandYellow)
                        .clipShape(Circle())
                }
                .disabled(sending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(12)
            .background(AppTheme.bg)
        }
        .navigationTitle(conversation.peer.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func bubble(_ msg: MessagesAPI.Message) -> some View {
        let mine = msg.senderId == auth.user?.id
        return HStack {
            if mine { Spacer(minLength: 40) }
            Text(msg.body)
                .font(.system(size: 15))
                .foregroundStyle(mine ? .white : AppTheme.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(mine ? AppTheme.accent : AppTheme.avatarBg)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            if !mine { Spacer(minLength: 40) }
        }
    }

    private func load() async {
        guard let token = auth.token else { return }
        do {
            if conversation.id == 0 {
                // draft placeholder — nothing to load
                return
            }
            let result = try await MessagesAPI.messages(token: token, conversationId: conversation.id)
            conversation = result.0
            messages = result.1
            try? await MessagesAPI.markRead(token: token, conversationId: conversation.id)
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func send() async {
        guard let token = auth.token else { return }
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        sending = true
        errorText = nil
        defer { sending = false }
        do {
            var convId = conversation.id
            if convId == 0 {
                let started = try await MessagesAPI.startConversation(
                    token: token,
                    listingId: conversation.listing.id,
                    title: conversation.listing.title,
                    priceLabel: conversation.listing.priceLabel,
                    meta: conversation.listing.meta,
                    sellerId: conversation.peer.id > 0 ? conversation.peer.id : nil,
                    initialBody: text
                )
                conversation = started
                convId = started.id
                draft = ""
                let result = try await MessagesAPI.messages(token: token, conversationId: convId)
                messages = result.1
                return
            }
            let msg = try await MessagesAPI.send(token: token, conversationId: convId, body: text)
            messages.append(msg)
            draft = ""
        } catch {
            errorText = error.localizedDescription
        }
    }
}
