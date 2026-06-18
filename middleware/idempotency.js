const idempotencyRecords = new Map();

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortValue(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

function requestSignature(body) {
  return JSON.stringify(sortValue(body));
}

function idempotency(req, res, next) {
  const key = req.header("x-idempotency-key");

  if (!key) {
    return next();
  }

  const signature = requestSignature(req.body);
  const existing = idempotencyRecords.get(key);

  if (existing) {
    if (existing.signature !== signature) {
      return res.status(409).json({
        status: "CONFLICT",
        reason: "Idempotency key already used with a different request body"
      });
    }

    res.set("x-idempotent-replay", "true");
    return res.status(existing.statusCode).json(existing.body);
  }

  const sendJson = res.json.bind(res);
  res.json = body => {
    idempotencyRecords.set(key, {
      signature,
      statusCode: res.statusCode,
      body
    });
    return sendJson(body);
  };

  return next();
}

module.exports = { idempotency };
