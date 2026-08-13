import { handleHttpRequest } from "../server.mjs";

export default async function handler(req, res) {
  try {
    await handleHttpRequest(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: error.message ?? String(error) }));
    }
  }
}
