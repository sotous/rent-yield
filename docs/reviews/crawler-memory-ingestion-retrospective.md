# Crawler memory ingestion retrospective

## Outcome

Ticket 9 adds shared v1 ingestion, receipt, and progress contracts plus an
offline memory reference provider and reusable provider-neutral vectors.

## What met the plan

- Submission identity excludes the idempotency key while binding capture metadata,
  body digest, methodology/policy identity, and interpretation.
- Exact retries return the same receipt; changed payloads conflict; capture-event
  reuse conflicts; distinct capture events remain distinct with matching bytes.
- Quarantined outcomes receive immutable quarantined receipts, while progress
  advances separately from an accepted receipt.
- Shared vectors run against the crawler memory provider and are exported for
  Data Storage's durable-provider suite.

## Next iteration

Durable storage must run these vectors without changing the contract semantics.
