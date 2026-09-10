# Colombian Listings Crawlers

This workspace will develop fixture-backed, permitted Colombian residential
listing crawlers. It is deliberately separate from the frontend, backend
prototype, and Rent Model: crawlers do not calculate yield or invoke the model.
Durable database and object storage are owned by the **Data Storage** task;
this package works through mocked storage ports until that implementation is
available.

## Planned boundary

```text
source research -> approved methodology -> source adapter -> parser
                -> normalizer -> mocked ingestion-sink port
                -> Data Storage (durable evidence and model snapshots)
```

The crawler must preserve both for-sale and for-rent observations. Rental
evidence is independently collected; a sale asking price never becomes a rent
model input.

No live source adapter is enabled by this scaffold. Before one is added, its
terms, robots policy, licensing, rate limits, data-retention policy, and
applicable privacy obligations must be approved. CAPTCHA bypassing, account
sharing, and evasive access techniques are out of scope.

The source-of-truth behavior is in
[the crawler research specification](../../specs/crawler-research-spec.md).
Foundation execution is tracked in
[the approved foundation plan](../../plan/crawler-research-and-methodology-foundation.md),
and the downstream crawler plan is
[plan/colombian-listing-crawlers-and-ingestion.md](../../plan/colombian-listing-crawlers-and-ingestion.md).
The data architecture is documented in
[docs/architecture/crawler-ingestion-data-lake.md](../../docs/architecture/crawler-ingestion-data-lake.md).

## Offline contract workbench

The foundation starts with strict, versioned research envelopes exported by
`@rent-yield/listing-storage-contracts`. The package provides candidate,
assessment, probe, fixture, extraction, methodology, validation, review, lookup,
and source-health schemas, synthetic examples, JSON Schema projections, and
canonical JSON primitives. `src/workbench.ts` validates an envelope and returns
validated data or a typed, sanitized validation failure.

Run from the repository root:

```sh
pnpm --filter @rent-yield/listing-storage-contracts test
pnpm --filter @rent-yield/crawlers test
pnpm --filter @rent-yield/crawlers typecheck
```

Tests use in-process synthetic examples; no source requests, credentials,
database, or object storage are required. Passing schema validation proves the
shape of an input, not source permission, successful redaction, valid hashes,
fixture fidelity, or methodology approval. Those workflows are later tickets.
JSON Schema describes structural constraints; the Zod runtime additionally
checks refinements such as real calendar dates and review intervals.

The existing unversioned storage DTO exports remain draft compatibility types.
They are not aliases for these v1 research contracts. Ingestion receipts,
provider implementations, and model evidence schemas are introduced in their
corresponding execution slices. See the joint boundary decisions in
[the contract agreement](../../docs/architecture/crawler-foundation-contract-agreement.md).

## Candidate and access workflow

`MemorySourceResearch` provides the first fixture-only application workflow:

1. `registerSourceCandidate` validates and appends a source candidate. An exact
   retry is idempotent. A correction requires a new ID and an explicit
   `supersedes_candidate_id`; prior versions remain available.
2. `inspectSourceAccess` references the exact candidate version and accepts
   technical and contractual findings, evidence, unknowns, issues, and review
   dates. It derives the access result itself, so a caller cannot inject
   `allowed_for_probe`.
3. `probeAccess` reads the latest unexpired assessment for the exact source,
   city, capability, and listing-role scope. Only `allowed_for_probe` returns
   permission. Unknown, approval-required, blocked, expired, absent, or
   ambiguous assessments fail closed.

This workflow stores synthetic objects in process memory. It does not read a
website, interpret terms, make a legal decision, or persist durable records.
Recording a later policy assessment changes subsequent access checks while
retaining the earlier assessment for audit. Registering a corrected candidate
invalidates inherited access until that candidate version receives its own
assessment. Declared-set ordering does not change retry identity.

## Bounded probe simulation

`probeListingDiscovery` exercises the network boundary through an injected mock
transport. The access gate supplies the authoritative assessment ID and digest,
host/path scope, and maximum budgets. Callers may narrow those constraints but
cannot widen them. Before every simulated request the probe checks current
access, HTTPS host/path scope, and globally routable resolved addresses.
Redirect targets repeat those checks before another request.

The shared memory budget caps per-probe requests, bytes, elapsed time,
redirects, source-wide requests, and concurrent source requests. Responses stop
without retry on `401`, `403`, `429`, challenge, authentication, policy, robots,
scope, address, or budget failures. Receipts contain counts, sanitized reason
codes, response metadata, and complete or partial entity-body digests; raw
response bodies are never returned.

### Mock transport obligations

`ProbeTransport.resolve` receives the remaining deadline and must return either
resolved addresses or explicit budget exhaustion. `ProbeTransport.request`
receives the validated address set, remaining response-byte allowance, and
remaining timeout. A conforming adapter must:

- connect only to one of the validated addresses while retaining the URL host
  for TLS verification, SNI, and HTTP host handling;
- stop response streaming at the supplied byte or time limit;
- identify the connected address in every response outcome; and
- return only partial received bytes when a streaming limit is reached.

The memory access gate temporarily derives its allowed host and path from the
current candidate's `homepage_url` and uses the conservative fixture defaults
recorded in the crawler specification. Approved methodology `access_scope` and
budgets must replace that bridge before any production adapter exists.

The transport used by tests is an in-process fake. This module supplies no HTTP
client, DNS client, browser, proxy, scheduler, credentials, or live-site access.
Its response classification fields stand in for later adapter behavior; they do
not prove that a real source has a compatible response shape.
