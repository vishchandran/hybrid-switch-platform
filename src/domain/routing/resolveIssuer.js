const ISSUER_ROUTING_TABLE = { "400001": "IssuerHost", "400002": "PartnerIssuerA", "400003": "PartnerIssuerB", "400004": "PartnerIssuerC" };

function resolveIssuer(transaction) {
  const bin = transaction.cardNumber?.substring(0, 6);
  return { bin, routedIssuer: ISSUER_ROUTING_TABLE[bin] || "UNKNOWN_ISSUER" };
}

module.exports = { resolveIssuer };
