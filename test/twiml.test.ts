import assert from "node:assert/strict";
import test from "node:test";
import { escapeXml, twimlForStream, wsUrlFromPublicBase } from "../src/twiml.js";

test("escapeXml escapes special characters", () => {
  assert.equal(escapeXml(`a&b<c>d"e'f`), "a&amp;b&lt;c&gt;d&quot;e&apos;f");
});

test("wsUrlFromPublicBase maps https->wss and http->ws", () => {
  assert.equal(
    wsUrlFromPublicBase(new URL("https://example.com"), "/twilio"),
    "wss://example.com/twilio",
  );
  assert.equal(
    wsUrlFromPublicBase(new URL("http://example.com"), "/twilio"),
    "ws://example.com/twilio",
  );
});

test("twimlForStream includes escaped stream url", () => {
  const xml = twimlForStream(`wss://example.com/twilio?x="y"&z=<1>`);
  assert.ok(
    xml.includes(`<Stream url="wss://example.com/twilio?x=&quot;y&quot;&amp;z=&lt;1&gt;" />`),
  );
});
