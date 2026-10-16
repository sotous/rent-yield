# Allowlisted Discovery Capture

## Status

Draft for approval — 2026-10-13. This plan replaces whole-page fixture
retention in the real-world discovery canary with a small, structured,
allowlisted discovery observation. The user granted standing authorization on
2026-10-13 for the bounded live commands required to execute this plan.

## Goal

For one configured source discovery page, read the bounded response only in
memory, extract canonical listing-candidate URLs under a Storage-owned rule,
and persist only those URLs plus sanitized receipt/provenance metadata. Never
persist HTML, DOM fragments, titles, prices, addresses, contacts, rejected
links, or raw response bytes.

## Why

The Ciencuadras canary proved the request, transport, and profile boundaries,
but whole-page retention failed when the redaction scanner found data it could
not safely retain. A discovery canary needs a top-of-funnel candidate set, not
a replayable copy of an entire page. An allowlist makes the retained data match
that purpose and eliminates the fragile page-wide redact-and-scan boundary.

## Product and domain decision

The first discovery output is a **discovery observation**, not a listing,
fixture, normalized observation, or methodology input. Its only source-derived
payload is a deterministic list of canonical listing-candidate URLs.

Each persisted observation contains:

- `contract_version`, observation/capture identity, source key, scope, and
  collection timestamp;
- active discovery-profile provenance and extractor version/hash;
- sanitized discovery response URL, media type, SHA-256, and byte length;
- a sorted, unique list of canonical HTTPS candidate URLs; and
- aggregate candidate counts only, never rejected URL values or HTML.

Candidate URLs must have no credentials, query string, or fragment and must
match the configured candidate host and path-prefix allowlist. Empty output is
an explicit successful `no_candidates` observation, not a guessed failure.

## Ownership boundary

| Owner               | Responsibility                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Storage contracts   | Versioned discovery-observation schema and Storage-owned extraction profile/configuration.                                         |
| Crawler application | Generic, in-memory HTML anchor extraction, canonicalization, validation, deduplication, and byte disposal.                         |
| Storage adapter     | Persist only the validated structured observation. The first adapter may be a JSON-file implementation behind the repository port. |
| CLI                 | Compose profile, bounded transport, extractor, and observation writer; print only sanitized receipt/result.                        |

The crawler must not contain a `ciencuadras` selector or business-specific
parser. Source-specific host/path matching belongs in versioned Storage
configuration.

## Proposed approach

1. Define `DiscoveryObservationV1` and a repository port. Keep it separate
   from `DurableSubmissionV2`, which represents full methodology
   interpretation, and separate from fixture replay tooling.
2. Extend the active discovery profile with a declarative extraction rule:
   `html_anchor_href`, extractor version, allowed candidate hosts, and exact
   candidate path prefixes. Validate it strictly and include it in profile
   provenance.
3. Add a pure discovery-response extractor. It decodes bounded UTF-8 bytes,
   parses HTML, considers only anchor `href` values, resolves them against the
   discovery URL, canonicalizes allowed URLs, sorts/deduplicates them, and
   zeroes original bytes in every exit path. It never serializes or returns the
   source HTML.
4. Replace the fixture-specific live capture handoff with a
   `DiscoveryResponseProcessor`. The bounded probe retains its sanitized
   receipt, receives extracted canonical URLs for its completed outcome, and
   emits constrained extraction failures instead of generic transport errors.
5. Replace manual fixture materialization/writing/quarantine composition with
   a manual discovery-observation writer. Its first JSON-file adapter writes a
   single validated observation atomically to an explicitly supplied safe
   output location.
6. Update the CLI from fixture-specific arguments to a safe observation-output
   argument. Dry run remains network-free and prints the extractor/profile
   provenance but no body content.
7. Update specs, the canary plan/runbook, and the two remaining Notion tasks.
   Record the existing `prohibited_data` run as the reason for the design
   change; do not treat it as a retained fixture.

## TDD plan

1. **RED:** Storage-contract tests reject missing provenance, unsafe candidate
   URLs, duplicates, non-deterministic ordering, and accidental body fields.
   **GREEN:** implement the observation schema and JSON-file repository.
2. **RED:** profile tests reject missing/ambiguous extraction configuration or
   candidate rules broader than the source profile. **GREEN:** add the
   versioned extraction rule and deterministic provenance.
3. **RED:** pure extractor tests cover allowed anchors; reject/drop foreign
   hosts, bad schemes, credentials, queries/fragments, out-of-prefix URLs,
   non-anchor links, and duplicates; prove original bytes are disposed.
   **GREEN:** implement the generic extractor.
4. **RED:** orchestration/CLI tests prove only observations—not HTML or
   fixtures—reach the writer; output stays body-free; no-candidates is typed;
   write failures are typed; and robots/challenge/media/budget stops remain
   unchanged. **GREEN:** replace the manual fixture path.
5. Run root tests, lint, typecheck, and formatting. Run the network-free dry
   check from merged `main`, then execute the bounded live command under the
   standing authorization recorded above.

## Material decision before implementation

The repository has no retained Ciencuadras page and the current transport
correctly returns no extracted links. We therefore do **not** know a safe,
exact Ciencuadras listing-detail path rule. We must establish and review that
rule as Storage configuration before the final live run; the implementation
must not guess it or use a broad same-host rule that captures navigation links.

## Risks and guardrails

- A broad path rule could turn navigation URLs into false listing candidates;
  fail closed on a missing rule rather than widening it.
- Candidate URLs are source-derived data. Persist only canonical public URLs
  matching the configured route policy; never preserve rejected URLs.
- Do not remove the offline fixture/redaction system. It remains relevant for
  future approved parser-replay workflows, but is no longer the live discovery
  canary's output.
- This plan adds no scheduling, retries, browser automation, detail requests,
  pagination harvesting, listing normalization, or yield calculation.

## Live-test strategy

The live test is a verification step, not a discovery mechanism for the
extraction rule. The candidate host/path allowlist and extractor version must
already be reviewed, versioned, and covered by offline fixtures before it is
authorized.

1. Merge the implementation and profile configuration to `main`.
2. Run the explicit network-free dry command from the merged tree. Confirm the
   active profile identity, two-request budget, output destination, extractor
   version, and candidate host/path allowlist in its sanitized output.
3. Execute the bounded `--live` command under the standing authorization. It
   fetches robots first, then makes at most one configured discovery request.
   There are no automatic retries, redirects beyond the existing limit, detail
   requests, pagination, browser automation, authentication, or source
   substitution.
4. Inspect only the sanitized receipt and structured observation. Confirm the
   observation file contains no HTML/body field and that its candidate URLs
   satisfy the configured canonical host/path rules. Do not log, commit, or
   manually inspect the original response.
5. If the run stops for robots, block, budget, media, extraction, or write
   reasons, retain only the typed receipt/result. Record that evidence in the
   review task; do not retry automatically or widen the rule in response.

## Success criteria

The live test succeeds only when all of the following are true:

- the robots-first sequence completes within the active profile's two-request,
  duration, redirect, concurrency, and byte limits;
- the discovery response is an allowed media type and the extractor completes
  without a typed rejection;
- exactly one schema-valid, append-only discovery observation is written to
  the supplied safe output target;
- the observation carries the matching source scope, active profile provenance,
  extractor identity, sanitized response URL, response hash/byte length, and a
  deterministic sorted/unique candidate URL set;
- every persisted candidate URL is HTTPS, credential-free, query-free,
  fragment-free, and matches the configured host/path allowlist;
- no source HTML, DOM, rejected URL, contact detail, exact address, token,
  cookie, arbitrary header, or raw body bytes appear in the CLI output or
  persisted observation; and
- the review can trace the sanitized receipt to the persisted observation and
  record a clear next action without another source request.

An empty but valid candidate set is a successful extraction only when the
profile explicitly permits `no_candidates`; otherwise it is a typed
`no_candidates` review result, not a reason to broaden the rule or retry.

## Validation and completion

Success is one persisted, schema-valid discovery observation containing only
configured canonical candidate URLs and receipt/provenance hashes, with no
source HTML retained. The review and runbook tasks can then record the result
and be completed.
