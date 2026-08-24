import Foundation
import LocalAuthentication
import SwiftUI
import UIKit

/// Face ID / Touch ID — a mentett bymy session feloldása (nem helyettesíti a belépést).
@MainActor
final class BiometricLock: ObservableObject {
    static let shared = BiometricLock()

    @Published private(set) var isUnlocked = false
    @Published var isEnabled: Bool {
        didSet { UserDefaults.standard.set(isEnabled, forKey: Self.enabledKey) }
    }
    @Published private(set) var lastError: String?

    /// OAuth / rendszerlap közben ne zárjon (ASWebAuthenticationSession → background).
    private var suppressLockUntil: Date?
    /// Futó Face ID kérés — képernyő-ki kapcsoláskor ne indítsunk újat.
    private var authInFlight = false

    private static let enabledKey = "bymy.biometricLock.enabled.v1"

    private init() {
        if UserDefaults.standard.object(forKey: Self.enabledKey) == nil {
            isEnabled = Self.canAuthenticate()
        } else {
            isEnabled = UserDefaults.standard.bool(forKey: Self.enabledKey)
        }
    }

    var isAvailable: Bool { Self.canAuthenticate() }

    var biometryTitle: String {
        switch Self.biometryType() {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "Készülék feloldás"
        }
    }

    var settingsSubtitle: String {
        if !isAvailable {
            return "Ezen az eszközön nincs Face ID / Touch ID."
        }
        return "App nyitásakor \(biometryTitle) kell a bymy fiókodhoz."
    }

    func unlockAfterLogin() {
        isUnlocked = true
        lastError = nil
        suppressLockUntil = nil
    }

    /// Social / rendszer UI alatt ne zárjon (pl. Apple web OAuth).
    func suppressLock(for seconds: TimeInterval = 120) {
        suppressLockUntil = Date().addingTimeInterval(seconds)
    }

    func clearSuppressLock() {
        suppressLockUntil = nil
    }

    private var isSuppressed: Bool {
        guard let until = suppressLockUntil else { return false }
        if Date() < until { return true }
        suppressLockUntil = nil
        return false
    }

    /// Csak csendben zárol — Face ID-t NE indítson háttérben (hang / „Felhasználói beavatkozás”).
    func lockIfNeeded() {
        if isSuppressed { return }
        guard isEnabled, isAvailable else {
            isUnlocked = true
            return
        }
        isUnlocked = false
        lastError = nil
    }

    func reset() {
        isUnlocked = false
        lastError = nil
        suppressLockUntil = nil
    }

    func needsLock(isLoggedIn: Bool) -> Bool {
        isLoggedIn && isEnabled && isAvailable && !isUnlocked && !isSuppressed
    }

    /// Az app előtérben van-e (képernyő be, nem háttér).
    private var isAppActive: Bool {
        UIApplication.shared.applicationState == .active
    }

    @discardableResult
    func authenticate(reason: String? = nil) async -> Bool {
        lastError = nil
        guard isAvailable else {
            isUnlocked = true
            return true
        }
        // Képernyő kikapcsolva / háttér: ne hívjuk a Face ID-t → nincs hang, nincs hibaüzenet.
        guard isAppActive else {
            return false
        }
        guard !authInFlight else { return false }
        authInFlight = true
        defer { authInFlight = false }

        // Rövid várakozás: active átmenet után stabilabb a prompt.
        try? await Task.sleep(nanoseconds: 200_000_000)
        guard isAppActive else { return false }

        let context = LAContext()
        context.localizedCancelTitle = "Mégsem"
        context.localizedFallbackTitle = "Készülék kód"
        var error: NSError?
        let policy: LAPolicy = .deviceOwnerAuthentication
        guard context.canEvaluatePolicy(policy, error: &error) else {
            lastError = error?.localizedDescription ?? "A feloldás nem elérhető."
            return false
        }
        let prompt = reason ?? "Oldd fel a bymy fiókodat."
        do {
            let ok = try await context.evaluatePolicy(policy, localizedReason: prompt)
            if ok {
                isUnlocked = true
                lastError = nil
            }
            return ok
        } catch let err as LAError {
            switch err.code {
            case .userCancel, .appCancel, .systemCancel:
                lastError = nil
            case .notInteractive:
                // Képernyő le / nincs UI — ne jelezzünk, ne próbáljuk újra automatikusan.
                lastError = nil
            case .userFallback:
                lastError = "Használd a készülék kódját."
            case .biometryLockout:
                lastError = "\(biometryTitle) zárolva — használd a készülék kódját."
            case .biometryNotAvailable, .biometryNotEnrolled:
                lastError = "\(biometryTitle) nincs beállítva. Használd a készülék kódját."
            default:
                // „Felhasználói beavatkozás szükséges” stb. — csak ha tényleg előtérben vagyunk.
                let msg = err.localizedDescription
                if msg.localizedCaseInsensitiveContains("beavatkozás")
                    || msg.localizedCaseInsensitiveContains("interaction") {
                    lastError = nil
                } else {
                    lastError = msg
                }
            }
            return false
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func setEnabled(_ on: Bool) async -> Bool {
        if on {
            let ok = await authenticate(reason: "Kapcsold be a \(biometryTitle) feloldást.")
            if ok {
                isEnabled = true
                isUnlocked = true
            }
            return ok
        }
        isEnabled = false
        isUnlocked = true
        return true
    }

    private static func canAuthenticate() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    }

    private static func biometryType() -> LABiometryType {
        let context = LAContext()
        var error: NSError?
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return context.biometryType
    }
}

/// Zárképernyő — Face ID csak gombnyomásra / előtérbe jövetelkor (nem képernyő-ki-nél).
struct BiometricLockScreen: View {
    @ObservedObject var lock: BiometricLock
    @EnvironmentObject private var profile: ProfileStore
    @Environment(\.scenePhase) private var scenePhase
    var displayName: String

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image("BymyLogo")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 200)
                .padding(.horizontal, 40)

            Text("bymy zárolva")
                .font(.title3.weight(.semibold))
                .foregroundStyle(AppTheme.text)

            Text(displayName.isEmpty ? "Oldd fel a fiókodat." : displayName)
                .font(.subheadline)
                .foregroundStyle(AppTheme.textSecondary)

            if let err = lock.lastError, !err.isEmpty {
                Text(err)
                    .font(.footnote)
                    .foregroundStyle(Color(red: 0.75, green: 0.12, blue: 0.12))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
            }

            Button {
                Task { await lock.authenticate() }
            } label: {
                Label("Feloldás", systemImage: lockIcon)
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(Color.black)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 32)
            .padding(.top, 8)

            Button("Kijelentkezés") {
                Task {
                    await profile.logout()
                    lock.reset()
                }
            }
            .font(.subheadline)
            .foregroundStyle(AppTheme.textSecondary)
            .padding(.top, 4)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.933, green: 0.941, blue: 0.953).ignoresSafeArea())
        // Automatikus Face ID csak ha az app ÉLŐBEN előtérben van — képernyő-ki-nél NEM.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, lock.needsLock(isLoggedIn: profile.isLoggedIn) else { return }
            Task { await lock.authenticate() }
        }
    }

    private var lockIcon: String {
        switch BiometricLock.shared.biometryTitle {
        case "Face ID": return "faceid"
        case "Touch ID": return "touchid"
        default: return "lock.open"
        }
    }
}
