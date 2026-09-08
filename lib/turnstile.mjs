import { clientIp } from "./rate-limit.mjs";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey() {
  return String(process.env.TURNSTILE_SITE_KEY ?? "").trim();
}

export function turnstileSecretKey() {
  return String(process.env.TURNSTILE_SECRET_KEY ?? "").trim();
}

export function isTurnstileEnabled() {
  return Boolean(turnstileSiteKey() && turnstileSecretKey());
}

export function turnstilePublicConfig() {
  if (!isTurnstileEnabled()) return { enabled: false, siteKey: "" };
  return { enabled: true, siteKey: turnstileSiteKey() };
}

/**
 * @param {string} token
 * @param {import("http").IncomingMessage | null} [req]
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function verifyTurnstileToken(token, req = null) {
  if (!isTurnstileEnabled()) return { ok: true };

  const response = String(token ?? "").trim();
  if (!response) {
    return { ok: false, error: "Biztonsági ellenőrzés hiányzik. Frissítsd az oldalt, és próbáld újra." };
  }

  const body = new URLSearchParams();
  body.set("secret", turnstileSecretKey());
  body.set("response", response);
  if (req) {
    const ip = clientIp(req);
    if (ip && ip !== "unknown") body.set("remoteip", ip);
  }

  let data;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    data = await res.json();
  } catch {
    return { ok: false, error: "A biztonsági ellenőrzés most nem érhető el. Próbáld újra később." };
  }

  if (data?.success) return { ok: true };
  return { ok: false, error: "A biztonsági ellenőrzés sikertelen. Próbáld újra." };
}
