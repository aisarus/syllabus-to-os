import assert from "node:assert/strict";
import {
  IntakeCancelledError,
  isIntakeCancellation,
  throwIfIntakeCancelled,
} from "../src/lib/intake-cancellation.ts";

const active = new AbortController();
assert.doesNotThrow(() => throwIfIntakeCancelled(active.signal));

const cancelled = new AbortController();
cancelled.abort();
assert.throws(
  () => throwIfIntakeCancelled(cancelled.signal),
  (error) => isIntakeCancellation(error, cancelled.signal),
);

let published = false;
const running = new AbortController();
const work = (async () => {
  await Promise.resolve();
  running.abort();
  throwIfIntakeCancelled(running.signal);
  published = true;
})();
await assert.rejects(work, (error) => isIntakeCancellation(error, running.signal));
assert.equal(published, false);
assert.equal(isIntakeCancellation(new IntakeCancelledError()), true);

console.log("Running intake cancellation prevents post-cancel publication.");
