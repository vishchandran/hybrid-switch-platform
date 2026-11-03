function removeSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map(removeSensitiveFields);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((sanitized, [key, child]) => {
    if (key === "pin" || key === "cardNumber") {
      return sanitized;
    }

    sanitized[key] = removeSensitiveFields(child);
    return sanitized;
  }, {});
}

function sanitizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\b\d{12,19}\b/g, "[REDACTED_CARD]")
    .replace(/\bpin\s*[:=]\s*\S+/gi, "[REDACTED_PIN]")
    .replace(/\bcardNumber\s*[:=]\s*\S+/gi, "[REDACTED_CARD]");
}

module.exports = {
  removeSensitiveFields,
  sanitizeText
};
