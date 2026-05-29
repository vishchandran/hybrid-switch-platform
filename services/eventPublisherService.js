function publishEvent(eventType, payload) {
  console.log(
    `[EVENT] ${eventType}`,
    JSON.stringify(payload)
  );
}

module.exports = {
  publishEvent
};