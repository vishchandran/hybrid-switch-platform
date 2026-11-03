function definePort(name, methods) {
  return Object.freeze({ name, methods: Object.freeze([...methods]) });
}

module.exports = { definePort };
