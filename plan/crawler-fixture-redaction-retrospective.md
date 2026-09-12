# Crawler fixture redaction retrospective

## Outcome

Foundation ticket 5 met its plan. Fixture capture now produces a separate
redacted payload and strict envelope, retains canonical source provenance,
detects artifact tampering, supports append-only corrections, and supplies a
repository scanner with sanitized diagnostics. A committed synthetic fixture
proves the bundle layout without introducing source-derived content.

## Changes from the initial contract

The original envelope tried to reference a future methodology proposal. That
created a lifecycle cycle because fixture capture precedes proposal creation.
The implementation and specification now use `research_session_id`; the later
proposal pins the fixture digest.

Lineage now points backward with `supersedes_fixture_id`. This keeps the prior
fixture immutable and prevents a predecessor from being edited to name its
successor. The envelope also gained `envelope_sha256`, which covers policy,
retention, lineage, provenance, and classification metadata in addition to the
existing payload and redaction digests.

## TDD and ergonomics

The work advanced through focused failing tests for capture, lifecycle,
integrity, redaction categories, hostile input, and repository scanning. The
API returns typed, sanitized failures and keeps source bytes only long enough
to hash and redact them. Exact retries are idempotent; conflicting identifiers
and forked successor chains fail closed.

The current redactor is intentionally deterministic and conservative. New
source shapes may require new versioned rules and successor fixtures rather
than silent mutation of the existing policy.

## Follow-up

Ticket 6 should consume these immutable fixture artifacts and produce
normalized observations or typed quarantine results with field provenance and
versioned URL-quality scoring. Live transport remains outside this ticket.
