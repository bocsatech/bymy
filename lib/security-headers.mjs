/** Biztonsági HTTP válaszfejlécek. */

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  // OAuth / Google Fonts / Maps / YouTube / saját API — Report-Only helyett engedő, de keretes
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https:",
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  ].join("; "),
};

export function applySecurityHeaders(res) {
  if (!res || res.headersSent) return;
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!res.getHeader?.(key) && !res.getHeader?.(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    if (!res.getHeader?.("Strict-Transport-Security")) {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
  }
}
