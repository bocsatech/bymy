import { ensureJsonRequestBody } from "../lib/read-json-body.mjs";

export default async function handler(req, res) {
  try {
    await ensureJsonRequestBody(req);
    const { handleHttpRequest } = await import("../server.mjs");
    await handleHttpRequest(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: error.message ?? String(error) }));
    }
  }
}
