import assert from "node:assert/strict";
import test from "node:test";
import { createOutboundPlaybackTracker } from "../src/playback.js";

// G.711 mu-law: 8 bytes per millisecond
const msAudio = (ms: number) => 8 * ms;

test("audio_end_ms never exceeds item audio length after repeated barge-ins", () => {
  const playback = createOutboundPlaybackTracker();

  // Item X: 3 chunks of 300ms each = 900ms total
  playback.onInboundMedia(0);
  const xMark1 = playback.onOutboundAudio("itemX", msAudio(300));
  const xMark2 = playback.onOutboundAudio("itemX", msAudio(300));
  playback.onOutboundAudio("itemX", msAudio(300));

  // Ack first two marks: 600ms of X have been fully played
  playback.onInboundMedia(300);
  playback.onMark(xMark1.name);
  playback.onInboundMedia(600);
  playback.onMark(xMark2.name);

  // Caller barges in while third chunk is mid-play
  playback.onInboundMedia(750);
  const interruption1 = playback.interruption();
  assert.ok(interruption1.truncation, "first barge-in must produce a truncation");
  assert.equal(interruption1.truncation!.itemId, "itemX");
  // 600ms acked + 150ms into chunk 3 = 750ms, capped at 300ms max within chunk
  assert.ok(
    interruption1.truncation!.audioEndMs <= 900,
    `first truncation audio_end_ms (${interruption1.truncation!.audioEndMs}) must not exceed itemX's 900ms total`,
  );
  playback.clear(); // simulate syncInterruptedPlayback + clearPlayback

  // Late Twilio mark for itemX chunk 3 arrives after the clear — must be ignored
  const staleXMark3Name = `vox-3`;
  playback.onMark(staleXMark3Name); // should be a no-op since pending is empty

  // Verify no state corruption: truncation() must return null since pending is empty
  assert.equal(playback.truncation(), null, "after clear, no truncation until new audio arrives");

  // New response: item Y, 2 chunks of 200ms = 400ms total
  // The Twilio media clock is at 750ms and keeps advancing while Y plays
  playback.onInboundMedia(800); // 50ms of caller audio since barge-in
  const yMark1 = playback.onOutboundAudio("itemY", msAudio(200));
  playback.onOutboundAudio("itemY", msAudio(200));

  // Ack first Y mark: 200ms played
  playback.onInboundMedia(1000);
  playback.onMark(yMark1.name);

  // Caller barges in again while second Y chunk plays — media clock far ahead
  playback.onInboundMedia(2000); // much further than Y's total 400ms
  const interruption2 = playback.interruption();
  assert.ok(interruption2.truncation, "second barge-in must produce a truncation");
  assert.equal(interruption2.truncation!.itemId, "itemY");
  assert.ok(
    interruption2.truncation!.audioEndMs <= 400,
    `second truncation audio_end_ms (${interruption2.truncation!.audioEndMs}) must not exceed itemY's 400ms total`,
  );
});

test("playedMsByItem is fully reset on clear so repeated barge-ins start fresh", () => {
  const playback = createOutboundPlaybackTracker();

  // Item X: 1000ms, partially acked
  playback.onInboundMedia(0);
  const xMark = playback.onOutboundAudio("itemX", msAudio(1000));
  playback.onInboundMedia(1000);
  playback.onMark(xMark.name);

  playback.clear();

  // Item X comes back (same item id) after a model retry
  playback.onInboundMedia(1200);
  playback.onOutboundAudio("itemX", msAudio(500));
  playback.onInboundMedia(1700);

  const t = playback.truncation();
  assert.ok(t, "should have truncation for retried itemX");
  // playedMsByItem was cleared; 500ms total from the new chunk
  assert.ok(
    t!.audioEndMs <= 500,
    `retried item's audio_end_ms (${t!.audioEndMs}) must not include pre-clear play history`,
  );
});
