const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC_ROOT = path.join(__dirname, "..", "src");

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}

function moduleSpecifiers(source) {
  const specifiers = [];
  const pattern = /(?:require\s*\(\s*|from\s+)["']([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  return specifiers;
}

function assertLayerDoesNotImport(layer, forbidden) {
  const layerRoot = path.join(SRC_ROOT, layer);
  const violations = [];

  for (const file of javascriptFiles(layerRoot)) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of moduleSpecifiers(source)) {
      if (forbidden.some(fragment => specifier.includes(fragment))) {
        violations.push(`${path.relative(SRC_ROOT, file)} -> ${specifier}`);
      }
    }
  }

  assert.deepEqual(violations, [], `Forbidden layer dependencies:\n${violations.join("\n")}`);
}

test("domain layer does not depend on application or infrastructure", () => {
  assertLayerDoesNotImport("domain", ["application", "infrastructure"]);
});

test("domain layer does not import framework or adapter packages", () => {
  assertLayerDoesNotImport("domain", ["express", "pg", "bullmq", "ioredis"]);
});

test("application layer does not depend on infrastructure", () => {
  assertLayerDoesNotImport("application", ["infrastructure"]);
});

test("legacy root code directories remain removed", () => {
  const legacyDirectories = [
    "broker", "config", "consumers", "controllers", "db",
    "middleware", "routes", "services", "store", "utils"
  ];
  const remainingCode = legacyDirectories.flatMap(directory => {
    const directoryPath = path.join(__dirname, "..", directory);
    return fs.existsSync(directoryPath) ? javascriptFiles(directoryPath) : [];
  });
  assert.deepEqual(
    remainingCode.map(file => path.relative(path.join(__dirname, ".."), file)),
    []
  );
});
