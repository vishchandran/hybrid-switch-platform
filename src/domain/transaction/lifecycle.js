function createLifecycle() {
  return [{ state: "RECEIVED", at: new Date().toISOString() }];
}

function addLifecycleState(lifecycle, state) {
  lifecycle.push({ state, at: new Date().toISOString() });
}

module.exports = { addLifecycleState, createLifecycle };
