function createRateLimiter({ windowMs, maxRequests }) {
  const clients = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const clientId = req.ip || req.socket.remoteAddress || "unknown";
    const current = clients.get(clientId);

    if (!current || current.resetAt <= now) {
      clients.set(clientId, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > maxRequests) {
      res.set("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({
        status: "RATE_LIMITED",
        reason: "Too many requests. Please try again later."
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
