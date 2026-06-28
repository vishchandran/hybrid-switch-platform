const crypto = require("crypto");
const {
  getIdempotencyRecord,
  saveIdempotencyRecord
} = require("../store/idempotencyStore");

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

function requestHash(body) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortValue(body)))
    .digest("hex");
}

async function idempotency(req, res, next) {
  const key = req.header("x-idempotency-key");

  if (!key) {
    return next();
  }

  const hash = requestHash(req.body);
  const existing = await getIdempotencyRecord(key);

  if (existing) {
    if (existing.requestHash !== hash) {
      return res.status(409).json({
        status: "CONFLICT",
        reason: "Idempotency key already used with a different request body"
      });
    }

    res.set("x-idempotent-replay", "true");
    return res.status(existing.statusCode).json(existing.response);
  }

  const sendJson = res.json.bind(res);
  res.json = async body => {
    await saveIdempotencyRecord(key, {
      requestHash: hash,
      statusCode: res.statusCode,
      response: body
    });
    return sendJson(body);
  };

  return next();
}

module.exports = { idempotency, requestHash };
