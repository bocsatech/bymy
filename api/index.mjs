export default async function handler(req, res) {
  const pathname = req.url?.split("?")[0] || "/";

  if (pathname === "/api/health" && req.method === "GET" && process.env.BYMY_STUB_HEALTH === "1") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, stub: true, backend: "stub" }));
    return;
  }

  try {
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
