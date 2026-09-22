
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import dns from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import nodemailer from "nodemailer";

dns.setDefaultResultOrder("ipv4first");

const EXAMPLE = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  user: "te@gmail.com",
  pass: "xxxx xxxx xxxx xxxx",
  from: "Add el autod.hu <te@gmail.com>",
};

export function smtpConfigPath() {
  if (process.env.AUTOSWEB_SMTP_PATH) return process.env.AUTOSWEB_SMTP_PATH;
  return join(homedir(), ".autosweb", "smtp.json");
}

export function ensureSmtpExample() {
  const dir = join(homedir(), ".autosweb");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const examplePath = join(dir, "smtp.example.json");
  if (!existsSync(examplePath)) {
    writeFileSync(examplePath, JSON.stringify(EXAMPLE, null, 2) + "\n", "utf8");
  }
  return examplePath;
}

function loadSmtpFromEnv() {
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  return {
    host: String(process.env.SMTP_HOST ?? "smtp.gmail.com").trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: String(process.env.SMTP_SECURE ?? "") === "1",
    user,
    pass,
    from: String(process.env.SMTP_FROM ?? user).trim(),
  };
}

export function loadSmtpConfig() {
  const fromEnv = loadSmtpFromEnv();
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL) return null;
  const path = smtpConfigPath();
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!raw?.user || !raw?.pass) return null;
    return {
      host: raw.host || "smtp.gmail.com",
      port: Number(raw.port ?? 587),
      secure: Boolean(raw.secure),
      user: String(raw.user).trim(),
      pass: String(raw.pass).replace(/\s+/g, ""),
      from: String(raw.from || raw.user).trim(),
    };
  } catch {
    return null;
  }
}

function resendApiKey() {
  return String(process.env.RESEND_API_KEY ?? "").trim();
}

function mailRelayConfig() {
  const url = String(process.env.BYMY_MAIL_RELAY_URL ?? "").trim();
  const secret = String(process.env.BYMY_MAIL_RELAY_SECRET ?? "").trim();
  if (!url || !secret) return null;
  return { url, secret };
}

export function mailTransportStatus() {
  const smtp = Boolean(loadSmtpConfig());
  const resend = Boolean(resendApiKey());
  const relay = Boolean(mailRelayConfig());
  let mode = "none";
  if (resend) mode = "resend";
  else if (relay) mode = "relay";
  else if (smtp) mode = "smtp";
  return { configured: resend || relay || smtp, mode, smtp, resend, relay };
}

export function isSmtpConfigured() {
  return mailTransportStatus().configured;
}

function isTransientSmtpError(error) {
  const msg = String(error?.message ?? error ?? "");
  return /EBUSY|ETIMEDOUT|ECONNRESET|ECONNREFUSED|getaddrinfo|EAI_AGAIN|socket hang up|Greeting never received/i.test(
    msg
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveMailHost(host) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await dnsLookup(host, { verbatim: false });
      return;
    } catch (error) {
      lastError = error;
      if (!isTransientSmtpError(error) || attempt >= 4) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError;
}

function smtpTransportOptions(cfg) {
  const secure = Boolean(cfg.secure);
  return {
    host: cfg.host,
    port: cfg.port,
    secure,
    requireTLS: !secure && Number(cfg.port) === 587,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: false,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 18_000,
    dnsTimeout: 12_000,
    tls: { minVersion: "TLSv1.2", servername: cfg.host },
  };
}

async function sendMailSmtpOnce(cfg, { to, subject, text, html }) {
  await resolveMailHost(cfg.host);
  const transporter = nodemailer.createTransport(smtpTransportOptions(cfg));
  const info = await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });
  return { messageId: info.messageId, from: cfg.user, transport: "smtp" };
}

function smtpAttemptConfigs(cfg) {
  const primary = { ...cfg };
  const list = [primary];
  if (Number(primary.port) === 587 && !primary.secure) {
    list.push({ ...primary, port: 465, secure: true });
  }
  return list;
}

/** Közvetlen SMTP (S1 / lokál). */
export async function sendMailSmtp(payload) {
  const cfg = loadSmtpConfig();
  if (!cfg) {
    const err = new Error(
      `Nincs SMTP beállítás. Másold: ${join(homedir(), ".autosweb", "smtp.example.json")} → smtp.json (Gmail app jelszó).`
    );
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }

  let lastError;
  for (const variant of smtpAttemptConfigs(cfg)) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await sendMailSmtpOnce(variant, payload);
      } catch (error) {
        lastError = error;
        if (!isTransientSmtpError(error) || attempt >= 3) break;
        await sleep(400 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

async function sendMailResend({ to, subject, text, html }) {
  const key = resendApiKey();
  if (!key) {
    const err = new Error("RESEND_API_KEY nincs beállítva.");
    err.code = "RESEND_NOT_CONFIGURED";
    throw err;
  }
  const from =
    String(process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? "").trim() ||
    "Bymy <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: html || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.message || data?.error || res.statusText || `HTTP ${res.status}`;
    throw new Error(`Resend: ${detail}`);
  }
  return { messageId: data.id || "", from, transport: "resend" };
}

async function sendMailRelay(payload) {
  const relay = mailRelayConfig();
  if (!relay) {
    const err = new Error("BYMY_MAIL_RELAY_URL / BYMY_MAIL_RELAY_SECRET hiányzik.");
    err.code = "RELAY_NOT_CONFIGURED";
    throw err;
  }
  const res = await fetch(relay.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${relay.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error || data?.smtpWarning || res.statusText || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }
  return { messageId: data.messageId || "", from: data.from || "", transport: "relay" };
}

export async function sendMail(payload) {
  if (resendApiKey()) {
    return sendMailResend(payload);
  }
  if (mailRelayConfig()) {
    return sendMailRelay(payload);
  }
  return sendMailSmtp(payload);
}
