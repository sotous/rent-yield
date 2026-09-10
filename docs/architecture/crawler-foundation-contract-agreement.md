# Crawler foundation contract agreement

## Status and scope

Contract design for foundation ticket 1, 2026-09-08. Data Storage agreed to
the directions and assigned Crawlers sole authorship of shared package edits in
this worktree, with Storage reviewing and owning durable providers. Storage
approved the concrete defaults below after four corrections to serialization,
lifecycle, capture identity, and receipt semantics. Tickets 2 through 4 now
implement runtime schemas, candidate-bound access, and bounded mock probes.
Fixture, methodology-service, ingestion, and durable-provider behavior remains
scheduled in later tickets. Existing unversioned storage exports remain a draft
compatibility surface and are not equivalent to the v1 research contracts.
The approved product scope is fixture/mock-only research tooling. Production
fetching, scheduling, and durable infrastructure are separate work.

## Contract matrix

| Boundary          | Producer / consumer                           | Current gap                                                                      | Proposed contract / owner                                                                                                                                   |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Research evidence | Crawler tools / methodology review            | Candidate, assessment, and probe contracts implemented; fixture workflow pending | Versioned runtime schemas, candidate-version-bound assessments, evidence hashes, source/synthetic origin, unknowns; jointly defined, crawler implementation |
| Proposal intake   | Research tools / methodology repository       | No proposal port                                                                 | Immutable declarative manifest plus validation references; no approval capability; joint schema, memory crawler/provider storage                            |
| Review decision   | Authorized reviewer / resolver                | Status is embedded in methodology                                                | Append-only decision referencing manifest and validation report; Data Storage durable owner                                                                 |
| Effective lookup  | Repository / crawler                          | Only source, city and capability query                                           | Listing role, effective time, recorded cutoff and accepted contract version; verified payload/hash and decision; joint schema                               |
| Ingestion         | Crawler / storage                             | No event identity, idempotency key, payload hash or build identity               | Source-scoped key, opaque capture-event key, body and payload digests, manifest/adapter/parser identity; joint schema                                       |
| Receipt progress  | Storage / crawler                             | stored/already_stored/quarantined only                                           | Immutable initial receipt plus separate progress lookup; joint schema, storage persistence                                                                  |
| Observation       | Parser / storage and curated model evidence   | Incomplete ambiguity, area-kind and alias representation                         | Decimal strings, explicit source claims and quality issues; joint schema; storage owns curation                                                             |
| Source health     | Crawler / methodology governance              | No health port                                                                   | Sanitized typed events with policy/methodology references; joint schema                                                                                     |
| Conformance       | Shared vectors / memory and durable providers | Schema and crawler-memory vectors exist; provider suite pending                  | Same contract suite, crawler memory tests and Data Storage provider tests                                                                                   |

Crawlers owns edits to `packages/listing-storage-contracts`, schemas, helpers,
examples and conformance vectors; Storage will not edit that package concurrently. Existing exports are a preliminary
boundary; they must not silently be relabeled as a compatible versioned API.
Freeze the first agreed v1 surface with migration examples for existing callers;
subsequent breaking changes require a new major contract version.

## Manifest and review identity

Hash the immutable declarative payload without its own digest, review decision,
or derived lifecycle state. The payload pins source/city/capability/listing
roles, assessment evidence, fixture and extraction digests, adapter artifact,
compatibility, permitted operations, budgets, and retention/redaction settings.
Validation reports reference that payload hash and exact executable/fixture
artifacts. Append-only review decisions reference payload and report hashes.
The resolved envelope joins payload, digest, and effective decision; approving
or pausing it never changes the payload hash. Corrected payloads get new hashes.

Offline parser development and fixture validation operate on proposals. They
need no active methodology and perform no live I/O. Live execution, when later
implemented, requires approved-effective resolution and source authorization.

## Resolution semantics

Lookup accepts source, canonical city, capability, listing role, effective_at,
recorded_as_of, and accepted contract version. Decisions carry distinct
effective and recording times. Effective intervals are start-inclusive and
end-exclusive. Exactly one approved, compatible, hash-valid, non-paused,
non-revoked candidate may resolve. Zero or overlapping eligible candidates
return typed failure. Decisions recorded after the cutoff cannot influence an
as-of result. Production callers must use a current governance cutoff rather
than historic replay to evade a pause. Clock input is explicit and testable.

## Ingestion and receipts

The caller supplies an opaque capture-event key, not a database identifier.
Idempotency is scoped by source. Canonical request identity includes metadata,
the digest of exact uncompressed response bytes, normalized outcome, and
methodology/adapter/parser identity; it excludes the idempotency key and its own
hash. UTF-8 string encoding, canonical JSON rules and numeric string handling
must be fixed in shared conformance vectors before implementation.

Same key and payload return the immutable original submission receipt. Reusing
the key with changed content returns idempotency_conflict. A new key and new
capture-event key append history even for identical bytes. Reusing an event key
under a different submission must have an explicit conflict/duplicate rule in
the agreed schema; it cannot append the same event twice.

An accepted receipt is not a commit. Separate receipt-status lookup exposes
staged progress without changing the original retry response. Commit and
quarantine are distinguishable terminal outcomes; failures and unavailable
storage use typed errors. Duplicate delivery is separate metadata, never a persistence stage. A new
submission may reinterpret the same capture with a new extraction version;
it must not invent another fetch. Reused capture identity with changed capture
metadata or body conflicts regardless of submission key.

## Source facts and model projection

Preserve source raw values and paths, transform versions, quality issues,
unknown currency/frequency/fee scope, separate fee claims, built/private/interior
area-kind claims, source date text and parsed dates, collection/recording times,
source-qualified IDs and aliases. Do not invent observation dates or coerce
unknown monetary values into zero. Shared money and measurements use decimal
strings; a model-specific number conversion is a separate validated boundary.

Sale and rental offers remain distinct. Dedicated rental-evidence DTOs exclude
sale price and admit only positive observed base monthly COP asking rent with
explicit built area. Ambiguity stays available as source evidence with quality
issues but cannot qualify as clean rental evidence. Durable identity resolution,
deduplication, retention and model snapshots remain Data Storage responsibilities.

## Validation and completion

Ticket 1 is documentation/contract design only, so executable TDD begins in
ticket 2. Agreement must record Data Storage corrections and shared-file
ownership before ticket 1 closes. Shared vectors must cover version rejection,
hash independence from review state, lookup time boundaries and overlap,
idempotency conflict/replay, distinct same-body captures, receipt progress,
ambiguity quarantine, and sale-price exclusion. Provider validation remains a
Data Storage deliverable and must not be claimed by passing memory tests alone.

## Concrete v1 defaults for final review

- Canonicalization: object keys sort lexicographically by UTF-16 code units;
  arrays preserve order except schema-declared sets, which sort by their
  canonical representation and reject duplicates. No Unicode normalization.
  Canonical JSON uses recursive direct serialization with no whitespace, encoded
  as UTF-8; never insert sorted keys into an object and stringify the object,
  because integer-like keys reorder. Use JSON.stringify only for individual
  strings and permitted scalar numbers. Reject unpaired UTF-16 surrogates.
  Numeric schema fields are bounded safe integers; money/measurements use
  decimal strings. Undefined, unsafe integers and negative zero are invalid. Optional
  absent keys are omitted; null is distinct and allowed only by schema.
- Decimal strings: optional minus, integer part 0 or nonzero digit followed by
  digits, optional fraction ending in a nonzero digit. No exponent, plus sign,
  leading zeros, trailing fractional zeros, or negative zero. Examples: 0,
  12.5, -74.8; reject 01, 12.50, 1e3 and -0. Positive eligibility is separate
  from claim storage, so invalid economic facts remain representable as raw
  claims and typed issues.
- Instants: valid UTC calendar timestamps with exactly millisecond precision
  YYYY-MM-DDTHH:mm:ss.sssZ; reject impossible dates and leap-second input.
  Source date claims retain raw text and a discriminated precision
  (instant/day/month/year/unknown), parsed calendar value when known, and
  timezone assumption when applicable. A day-only claim never invents midnight
  as an observed instant. Collection instants are explicit; recorded_at is
  provider assigned.
- Manifest digest preimage is the canonical manifest payload. Validation report
  includes the exact manifest/fixture/adapter digests. Review event references
  that report and manifest; no reverse approval link enters the payload hash.
- Body digest hashes exact supplied entity bytes after HTTP content decoding,
  before text decoding or redaction. Representation is original_entity or
  redacted_fixture. Redacted bytes have their own digest; retain original digest
  only when known and permitted. Never reconstruct original identity by JSON
  reserialization. Provider verifies all supplied body/payload digests.
- Submission preimage includes contract version, source, capture identity and
  metadata, body representation/digest, policy reference, methodology/adapter/
  parser identities and normalization outcome. Exclude submission key, its own
  hash, receipt IDs, provider recorded_at and derived lifecycle state. Capture
  fingerprint includes exactly source, capture_event_id, collected_at, request
  identity, response metadata, body representation/digest, and acquisition
  methodology/policy identity. Exclude parser/normalizer/extraction versions,
  normalized outcome, submission keys, receipts, and provider recorded_at.
  Acquisition authorization is immutable; replay can name a new interpretation
  adapter/parser. A new key with identical capture fingerprint and interpretation
  payload returns a new receipt referencing the existing interpretation, never
  duplicate observations. A distinct interpretation appends once.
- Outcome union: normalized with one or more observations; quarantined with
  typed issues and zero or more partial observations; parse_failed with typed
  issues and no fabricated observations; capture_only for discovery with no
  listing observations. Mixed-quality observations carry per-observation
  issues; clean observations never erase rejected source claims.
- Initial receipt has contract version, submission receipt ID, source/event/key,
  payload hash, and stage accepted, committed or quarantined. No normalized DB
  ID is required. Retries return this exact receipt. Progress lookup returns
  receipt ID, stage accepted/committed/quarantined/failed, provider recorded_at,
  and typed failure if failed. Initial accepted means a durable provider can
  recover the complete permitted submission; memory fakes simulate this only.
  Committed means durable linkage is complete, not that facts qualify for rental
  evidence: parse_failed, capture_only and mixed-quality outcomes can commit.
  Quarantined means durably retained but withheld from normal publication; no
  retry is needed without corrective action. Transient provider retries may
  progress accepted; failed is terminal for the submission key.
  Duplicate delivery metadata is outside the immutable receipt and references
  its original ID. A failed progress state requires a new submission key for a
  controlled retry; the original receipt remains unchanged.
- Decision precedence: each manifest has a provider-assigned monotonically
  increasing event sequence. Among events known at recorded_as_of and effective
  at effective_at, highest sequence controls; timestamp ties are unambiguous.
  Events carry half-open effective intervals. Paused, revoked, rejected and
  retired events must be open-ended so expiry cannot expose an older approval.
  Revoked/retired versions require a new manifest; paused/rejected versions
  require a subsequent privileged approval/reactivation. Expired approval fails
  closed. Approval/reactivation requires
  a privileged review and matching successful validation. Lookup considers
  exact scope only; different eligible manifest hashes produce ambiguity.
- Typed errors: not_found, ambiguous_methodology, unsupported_contract_version,
  invalid_input, hash_mismatch, incompatible_adapter, policy_blocked,
  idempotency_conflict, capture_event_conflict, storage_unavailable. Detailed
  issues use sanitized paths/codes, never raw sensitive payloads.
- Rental evidence additionally requires observed origin and long-term
  residential basis. Runtime schemas reject sale-price keys, modeled rents,
  short-stay basis and ambiguous bundled fees; TypeScript exclusion alone is
  insufficient.

### Schema-declared sets and sequences

Canonical hashing sorts only these schema-declared set paths: research scope
`listing_roles`; fixture `permitted_use` and `parser_compatibility`; extraction
`fixture_sha256s`; manifest `evidence_hashes`, `access_scope.hosts`,
`access_scope.path_prefixes`, `permitted_operations`, `circuit_breaker.stop_on`,
`fixture_hashes`, and `retention.permitted_uses`; validation-report
`fixture_hashes`; and source-health `issue_codes`. Each set rejects duplicate
members before hashing.

All other arrays preserve semantic order. In particular, extraction `mappings`
and each mapping's `transforms`, research `evidence`, `unknowns`, and `issues`,
and validation `issues` are sequences. Adding another set requires a contract
change plus canonicalization vectors; callers must never infer set semantics
from the element type alone.

## Required executable vector seeds (ticket 2 and later)

- Differently inserted object keys canonicalize identically; reversed semantic
  arrays differ; reversed declared sets match; duplicate set members reject.
- Absent and null differ; invalid numeric/decimal/date encodings reject;
  equivalent accepted inputs have byte-identical UTF-8 preimages.
- Review changes leave manifest digest stable; adapter/fixture/report mismatch
  rejects; recorded cutoffs and interval edges select the expected decision.
- Same submission retry preserves accepted receipt; progress may independently
  become committed. Changed payload conflicts; same immutable capture can
  receive a new interpretation; changed capture bytes conflict.
- Two distinct capture events with identical bodies remain distinct; discovery,
  parse failure and multi-listing payloads need no fabricated observation IDs.

These are contract specifications, not claims of passing tests. Executable
vectors and schemas must be introduced RED-first in the approved build tickets.

## Storage review corrections and closure

Storage approved closure after the four corrections above were incorporated on
2026-09-08, without another review round. Additional required vectors:

- Integer-like object keys 2 and 10 sort lexicographically, supplementary
  Unicode is stable, lone surrogates and unsafe integers reject.
- A pause never expires back into an old approval; later recorded cutoffs stay
  paused until explicit reactivation. Revoked/retired versions stay ineligible.
- New submission key with identical capture and interpretation creates a
  receipt reference only; a changed interpretation appends once; changed
  acquisition metadata conflicts.
- Committed parse_failed/capture_only/mixed-quality outcomes are distinct from
  rental eligibility; quarantined storage stage is durable and withheld.
- Overlapping methodology scope and unsupported versions fail explicitly;
  modeled rent, short-stay rates, ambiguous fees and forbidden sale-price keys
  cannot cross the runtime rental-evidence boundary.

Ticket 1 met its scope through plan reconciliation, the ownership/contract
matrix and joint semantic agreement. The storage review improved byte identity,
non-reactivating suspensions and replay semantics. No executable behavior was
changed. The next iteration is ticket 2's RED-first schema/vector work; durable
provider execution remains a later Storage responsibility.
