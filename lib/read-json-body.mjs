/** JSON body olvasás Node/Vercel kérésekből — stream timeout-tal. */

const BODY_TIMEOUT_MS = 12_000;

function parseJsonRaw(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  return JSON.parse(text);
}

function readNodeStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      req.destroy?.();
      finish(reject, new Error("Kérés törzs olvasása túllépte az időkorlátot."));
    }, BODY_TIMEOUT_MS);

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        finish(resolve, parseJsonRaw(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        finish(reject, error);
      }
    });
    req.on("error", (error) => finish(reject, error));

    // Ha a stream már lezárult / szünetel, indítsuk el az olvasást.
    req.resume?.();
  });
}

/**
 * @param {import("http").IncomingMessage & { body?: unknown; json?: () => Promise<unknown> }} req
 */
export async function readJsonBody(req) {
  if (req.body != null) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    try {
      return parseJsonRaw(String(req.body));
    } catch (error) {
      throw error;
    }
  }

  if (typeof req.json === "function") {
    try {
      const parsed = await req.json();
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  return readNodeStream(req);
}

/**
 * Vercel handler: bufferelje a body-t, mielőtt a stream máshol elveszne.
 * @param {import("http").IncomingMessage & { body?: unknown; json?: () => Promise<unknown> }} req
 */
export async function ensureJsonRequestBody(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return;
  req.body = await readJsonBody(req);
}
