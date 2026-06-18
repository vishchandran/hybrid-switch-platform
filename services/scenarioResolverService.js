function resolveScenario(transaction) {
  const { channel, atmOwnership, cardEntryMode } = transaction;

  if (channel === "ATM" && atmOwnership === "NON_ISSUER_ATM") {
    return "SHARED_ATM_NETWORK";
  }

  if (channel === "ATM" && atmOwnership === "ISSUER_ATM") {
    return "ISSUER_ATM";
  }

  if (channel === "POS" && cardEntryMode === "CHIP") {
    return "INTERAC_POS_PHYSICAL";
  }

  if (channel === "POS" && cardEntryMode === "NFC") {
    return "INTERAC_POS_WALLET";
  }

  return "UNKNOWN_SCENARIO";
}

module.exports = {
  resolveScenario
};
