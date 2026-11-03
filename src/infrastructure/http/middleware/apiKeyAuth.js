const crypto = require("crypto");

const DEFAULT_CLIENT_API_KEY = "dev-client-key";
const DEFAULT_ADMIN_API_KEY = "dev-admin-key";

function keysMatch(providedKey, expectedKey) {
  if (!providedKey || !expectedKey) {
    return false;
  }

  const provided = Buffer.from(providedKey);
  const expected = Buffer.from(expectedKey);

  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function requireApiKey({ headerName, environmentName, developmentDefault }) {
  return (req, res, next) => {
    const expectedKey =
      process.env[environmentName] ||
      (process.env.NODE_ENV === "production" ? null : developmentDefault);

    if (!keysMatch(req.header(headerName), expectedKey)) {
      return res.status(401).json({
        status: "UNAUTHORIZED",
        reason: `Valid ${headerName} header required`
      });
    }

    return next();
  };
}

const clientApiKeyAuth = requireApiKey({
  headerName: "x-api-key",
  environmentName: "CLIENT_API_KEY",
  developmentDefault: DEFAULT_CLIENT_API_KEY
});

const adminApiKeyAuth = requireApiKey({
  headerName: "x-admin-api-key",
  environmentName: "ADMIN_API_KEY",
  developmentDefault: DEFAULT_ADMIN_API_KEY
});

module.exports = {
  DEFAULT_ADMIN_API_KEY,
  DEFAULT_CLIENT_API_KEY,
  adminApiKeyAuth,
  clientApiKeyAuth,
  keysMatch
};
