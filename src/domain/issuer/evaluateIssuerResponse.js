const DEFAULT_MAX_RETRIES = 2;

function evaluateIssuerResponse({ timeoutAttempts = 0, maxRetries = DEFAULT_MAX_RETRIES }) {
  const exhausted = timeoutAttempts >= maxRetries;
  return {
    status: exhausted ? "TIMEOUT" : "SUCCESS",
    attempts: exhausted ? maxRetries : timeoutAttempts + 1,
    timedOutAttempts: Math.min(timeoutAttempts, maxRetries)
  };
}

module.exports = { DEFAULT_MAX_RETRIES, evaluateIssuerResponse };
