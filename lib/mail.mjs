/** Gmail SMTP (vagy más) — config: ~/.autosweb/smtp.json */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import nodemailer from "nodemailer";

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

export function loadSmtpConfig() {
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

export function isSmtpConfigured() {
  return Boolean(loadSmtpConfig());
}

export async function sendMail({ to, subject, text, html }) {
  const cfg = loadSmtpConfig();
  if (!cfg) {
    const err = new Error(
      `Nincs SMTP beállítás. Másold: ${join(homedir(), ".autosweb", "smtp.example.json")} → smtp.json (Gmail app jelszó).`
    );
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const info = await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });
  return { messageId: info.messageId, from: cfg.user };
}
