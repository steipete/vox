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

  test(`${name} does not turn encoded schemes into executable URLs`, () => {
    const uri = require("fast-uri");
    for (const value of ["%6Aavascript:alert(1)", "%u006Aavascript:alert(1)"]) {
      assert.notEqual(uri.parse(value).scheme, "javascript");
      assert.equal(uri.normalize(value).startsWith("javascript:"), false);
      assert.throws(() => uri.resolve("https://a.example/", value), /URI scheme is malformed/);
    }
    assert.equal(uri.equal("%68ttp://a/", "http://a/"), false);
  });
}
