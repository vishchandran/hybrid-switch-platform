const REQUIRED_PRODUCTION_ENV = [
  "CLIENT_API_KEY",
  "ADMIN_API_KEY",
  "DATABASE_URL",
  "ALLOWED_ORIGINS"
];

function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const missing = REQUIRED_PRODUCTION_ENV.filter(name => !env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`
    );
  }

  if (env.CLIENT_API_KEY === "dev-client-key") {
    throw new Error("CLIENT_API_KEY must not use the development default in production");
  }

  if (env.ADMIN_API_KEY === "dev-admin-key") {
    throw new Error("ADMIN_API_KEY must not use the development default in production");
  }
}

function buildCorsOptions(env = process.env) {
  if (env.NODE_ENV !== "production") {
    return {};
  }

  const allowedOrigins = new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map(origin => origin.trim())
      .filter(Boolean)
  );

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    }
  };
}

module.exports = {
  buildCorsOptions,
  validateProductionConfig
};
