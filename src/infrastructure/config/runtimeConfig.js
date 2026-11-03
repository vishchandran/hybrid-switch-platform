const REQUIRED_PRODUCTION_ENV = [
  "CLIENT_API_KEY",
  "ADMIN_API_KEY",
  "DATABASE_URL",
  "ALLOWED_ORIGINS",
  "BROKER_MODE",
  "PIN_SECURITY_MODE",
  "HSM_ENDPOINT"
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

  if (env.PIN_SECURITY_MODE !== "EXTERNAL_HSM") {
    throw new Error("PIN_SECURITY_MODE must be EXTERNAL_HSM in production");
  }

  if (env.BROKER_MODE !== "BULLMQ") {
    throw new Error("BROKER_MODE must be BULLMQ in production");
  }

  if (!env.REDIS_URL && !env.REDIS_HOST) {
    throw new Error("REDIS_URL or REDIS_HOST must be set when BROKER_MODE=BULLMQ in production");
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
