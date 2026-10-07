import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const fromFastify = createRequire(import.meta.resolve("fastify"));
const fromCompiler = createRequire(fromFastify.resolve("@fastify/ajv-compiler"));
const fromAjv = createRequire(fromCompiler.resolve("ajv"));

// Fastify's compiler and Ajv resolve separate fast-uri majors; both need the fix.
for (const [name, require] of [
  ["Fastify compiler", fromCompiler],
  ["Ajv", fromAjv],
] as const) {
  test(`${name} normalizes percent-encoded host case in scheme-relative URIs`, () => {
    const uri = require("fast-uri");
    assert.equal(uri.parse("//%41.example").host, "a.example");
    assert.equal(uri.equal("//%41.example", "//a.example"), true);
  });
}
