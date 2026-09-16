/** Mobil / könyvjelző kliensek kérhetnek session tokent; a web csak HttpOnly cookie-t használ. */
export function wantsSessionTokenInResponse(req) {
  const client = String(req.headers["x-bymy-client"] ?? req.headers["X-Bymy-Client"] ?? "")
    .trim()
    .toLowerCase();
  return client === "mobile" || client === "ios" || client === "android";
}

export function withOptionalSessionToken(req, payload, token) {
  if (!token || !wantsSessionTokenInResponse(req)) return payload;
  return { ...payload, token };
}
