import assert from "node:assert/strict";
import test from "node:test";
import { base64ByteLength, createPlaybackTimeline } from "../src/playback.js";

test("base64ByteLength matches the decoded buffer length", () => {
  for (const sample of ["", "AA==", "AAA=", "AAAA", Buffer.alloc(8 * 1234).toString("base64")]) {
    assert.equal(base64ByteLength(sample), Buffer.from(sample, "base64").length);
  }
});

// G.711 mu-law on the Twilio leg is 8 kHz mono => 8 bytes per millisecond.
const msAudio = (ms: number) => 8 * ms;

test("truncation uses the Twilio media-stream clock, not wall time", () => {
  const tl = createPlaybackTimeline();
  tl.onInboundMedia(200); // stream clock at 200ms when the assistant starts speaking
  tl.onAssistantAudio("itemA", msAudio(5000)); // 5s of audio generated in a burst
  tl.onInboundMedia(1200); // caller has now heard ~1000ms of it

  assert.deepEqual(tl.truncation(), { itemId: "itemA", audioEndMs: 1000 });
});

test("truncation survives after all audio is delivered (not nulled on done)", () => {
  const tl = createPlaybackTimeline();
  tl.onInboundMedia(0);
  // whole response arrives as one burst, as the Realtime API does
  tl.onAssistantAudio("itemA", msAudio(5000));
  tl.onInboundMedia(1000); // barge-in 1s into a 5s reply, after the burst finished

  const t = tl.truncation();
  assert.notEqual(t, null);
  assert.equal(t?.itemId, "itemA");
  assert.equal(t?.audioEndMs, 1000);
});

test("audio_end_ms is clamped to the audio actually generated", () => {
  const tl = createPlaybackTimeline();
  tl.onInboundMedia(0);
  tl.onAssistantAudio("itemA", msAudio(300)); // only 300ms generated
  tl.onInboundMedia(5000); // caller barges in long after playback finished

  assert.equal(tl.truncation()?.audioEndMs, 300);
});

test("a new assistant item resets the response start", () => {
  const tl = createPlaybackTimeline();
  tl.onInboundMedia(100);
  tl.onAssistantAudio("itemA", msAudio(2000));
  tl.onInboundMedia(500);
  tl.onAssistantAudio("itemB", msAudio(2000)); // rolls to a new item at clock=500

  tl.onInboundMedia(900);
  assert.deepEqual(tl.truncation(), { itemId: "itemB", audioEndMs: 400 });
});

test("clear() prevents a second truncation of the same item", () => {
  const tl = createPlaybackTimeline();
  tl.onInboundMedia(0);
  tl.onAssistantAudio("itemA", msAudio(2000));
  tl.onInboundMedia(500);
  assert.notEqual(tl.truncation(), null);

  tl.clear();
  assert.equal(tl.truncation(), null);
});

test("no truncation before any assistant audio", () => {
  const tl = createPlaybackTimeline();
  tl.onInboundMedia(500);
  assert.equal(tl.truncation(), null);
});
