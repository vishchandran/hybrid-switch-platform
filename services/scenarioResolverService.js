function resolveScenario(transaction) {
  const { channel, atmOwnership, cardEntryMode } = transaction;

  if (channel === "ATM" && atmOwnership === "NON_ISSUER_ATM") {
    return "SHARED_ATM_NETWORK";
  }

  if (channel === "POS" && cardEntryMode === "CHIP") {
    return "INTERAC_POS_PHYSICAL";
  }

  if (channel === "POS" && cardEntryMode === "NFC_WALLET") {
    return "INTERAC_POS_WALLET";
  }

  return "UNKNOWN_SCENARIO";
}

module.exports = {
  resolveScenario
};