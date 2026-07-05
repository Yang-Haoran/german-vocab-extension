export function requireApiSecret(req, res, next) {
  const expectedSecret = process.env.API_SECRET;

  if (!expectedSecret) {
    return res.status(500).json({ error: "API_SECRET is not configured on the server." });
  }

  const headerSecret = req.header("x-api-secret");

  if (headerSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}
