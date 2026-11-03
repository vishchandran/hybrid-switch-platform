function getPinSecurityMode() {
  return process.env.PIN_SECURITY_MODE || "SIMULATED_PIN";
}

function isExternalHsmConfigured(env = process.env) {
  return env.PIN_SECURITY_MODE === "EXTERNAL_HSM" && Boolean(env.HSM_ENDPOINT);
}

module.exports = {
  getPinSecurityMode,
  isExternalHsmConfigured
};
