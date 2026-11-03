function definePort(name, methods) {
  return Object.freeze({ name, methods: Object.freeze([...methods]) });
}

function assertPortAdapter(port, adapter) {
  const missing = port.methods.filter(method => typeof adapter[method] !== "function");
  if (missing.length > 0) {
    throw new TypeError(`${port.name} adapter is missing: ${missing.join(", ")}`);
  }
  return adapter;
}

module.exports = { assertPortAdapter, definePort };
