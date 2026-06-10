import assert from "node:assert/strict";
import test from "node:test";
import { base64ByteLength, createOutboundPlaybackTracker } from "../src/playback.js";

test("base64ByteLength matches the decoded buffer length", () => {
  for (const sample of ["", "AA==", "AAA=", "AAAA", Buffer.alloc(8 * 1234).toString("base64")]) {
    assert.equal(base64ByteLength(sample), Buffer.from(sample, "base64").length);
  }
});

// G.711 mu-law on the Twilio leg is 8 kHz mono => 8 bytes per millisecond.
const msAudio = (ms: number) => 8 * ms;

test("truncation uses the Twilio media clock while a marked chunk is pending", () => {
  const playback = createOutboundPlaybackTracker();
  playback.onInboundMedia(200);
  playback.onOutboundAudio("itemA", msAudio(5000));
  playback.onInboundMedia(1200);

  assert.deepEqual(playback.truncation(), { itemId: "itemA", audioEndMs: 1000 });
});

test("mark acknowledgement proves full playout and prevents late truncation", () => {
  const playback = createOutboundPlaybackTracker();
  playback.onInboundMedia(200);
  const mark = playback.onOutboundAudio("itemA", msAudio(5000));
  playback.onInboundMedia(5200);
  playback.onMark(mark.name);
  playback.onInboundMedia(6000);

  assert.equal(playback.truncation(), null);
});

test("mark acknowledgement advances playback into the next queued chunk", () => {
  const playback = createOutboundPlaybackTracker();
  playback.onInboundMedia(0);
  const first = playback.onOutboundAudio("itemA", msAudio(1000));
  playback.onOutboundAudio("itemA", msAudio(1000));

  playback.onInboundMedia(1000);
  playback.onMark(first.name);
  playback.onInboundMedia(1250);

  assert.deepEqual(playback.truncation(), { itemId: "itemA", audioEndMs: 1250 });
});

test("overlap truncates the item actually playing, not a later queued item", () => {
  const playback = createOutboundPlaybackTracker();
  playback.onInboundMedia(0);
  playback.onOutboundAudio("itemA", msAudio(1000));
  playback.onOutboundAudio("itemB", msAudio(1000));
  playback.onInboundMedia(500);

  assert.deepEqual(playback.truncation(), { itemId: "itemA", audioEndMs: 500 });
});

test("next queued item starts when the previous mark is acknowledged", () => {
  const playback = createOutboundPlaybackTracker();
  playback.onInboundMedia(0);
  const first = playback.onOutboundAudio("itemA", msAudio(500));
  playback.onOutboundAudio("itemB", msAudio(1000));

  playback.onInboundMedia(500);
  playback.onMark(first.name);
  playback.onInboundMedia(800);

  assert.deepEqual(playback.truncation(), { itemId: "itemB", audioEndMs: 300 });
});

test("clear drops pending marks from an interrupted stream", () => {
  const playback = createOutboundPlaybackTracker();
  playback.onInboundMedia(0);
  const mark = playback.onOutboundAudio("itemA", msAudio(1000));
  playback.onInboundMedia(300);
  assert.notEqual(playback.truncation(), null);

  playback.clear();
  playback.onMark(mark.name);
  assert.equal(playback.truncation(), null);
});
