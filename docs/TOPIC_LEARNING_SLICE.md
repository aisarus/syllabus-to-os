# Topic learning slice

The course page exposes one bounded `understand → recall → verify` path for topics that have a linked concept with a short explanation.

Persistence invariant:

- progress is written only after deterministic verification;
- the same normalized response for the same concept maps to one stable `sourceId`;
- repeating verification or reloading the page must not duplicate the evidence event;
- a meaningfully different response remains a new attempt;
- the browser proof must finish without uncaught exceptions, error-level browser logs, or non-cancelled failed network requests.

New verified events use the backward-compatible `deterministic_recall` source type plus a stable `topic-recall:*` source identifier. Existing `manual` events remain valid and unchanged during normalization.
