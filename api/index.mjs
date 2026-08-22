export default async function handler(req, res) {
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ error: "Az oldal átmenetileg nem elérhető (karbantartás)." }));
}
