# Bounded Detail-Observation Canary

## Status

Draft — created 2026-10-16. This is the follow-up to the merged first
discovery canary. It needs approval and a Notion task breakdown before code or
another live request.

## Why

The successful Ciencuadras discovery canary persisted 20 safe candidate URLs.
They prove the top-of-funnel boundary, but they are not yet listing
observations, rental evidence, or Rent Model input. This slice proves the next
smallest boundary: one reviewed candidate URL can become one safe, typed
detail observation without retaining a source page.

## Goal

For one explicitly selected candidate URL from a persisted Ciencuadras
discovery observation, perform a bounded robots-first detail request and
produce either:

- one schema-valid normalized rental listing observation, eligible or
  ineligible for later Storage admission; or
- a body-free typed stop, quarantine, or parse-drift result.

The run is a single-source, single-city, single-candidate canary. It does not
schedule crawling, page through results, collect a portfolio, or calculate
yield.

## Product decisions

| Decision                 | Choice                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input                    | A persisted discovery observation plus one candidate URL chosen from its canonical candidate set. A caller cannot invent or widen the URL.                                                                                                         |
| Request sequence         | One robots-policy request, then at most one HTTPS detail request. No discovery request, redirect beyond the profile limit, retry, browser automation, login, cookie, or custom header.                                                             |
| Detail scope             | Storage owns the declarative candidate host/path rule. The crawler verifies the selected URL against it before DNS or HTTP.                                                                                                                        |
| Extraction boundary      | The crawler extracts an allowlisted set of listing fields in memory and discards source bytes/DOM immediately. It never writes HTML, JSON-LD, scripts, contact data, exact address, tokens, cookies, headers, rejected links, or raw body content. |
| Source-specific behavior | Ciencuadras field mapping is a reviewed, hashed extraction contract/configuration. Generic crawler code must not contain Ciencuadras selectors or route logic.                                                                                     |
| Normalization            | Reuse the shared normalized-observation and listing-quality contracts. Never infer missing currency, rent frequency, residential status, availability, or built area. Ambiguity is a typed non-normalized result.                                  |
| Persistence              | Store a safe detail observation/receipt and normalized outcome only. Storage accepts a durable submission only for a complete, quality-passing normalized result; all other outcomes are transient.                                                |
| Live authority           | The user has standing authorization for bounded live commands needed by this approved plan. Each command is still robots-first and limited to the one configured detail request; no automatic repeat follows a stop.                               |

## Proposed delivery slices

1. **Selection contract and provenance** — Define the strict input that binds
   a detail run to one stored discovery observation and one member of its
   canonical candidate set. RED-test forged URLs, mismatched source/scope,
   unknown observations, and duplicate identity behavior.
2. **Storage-owned detail profile** — Extend the profile/config repository with
   exact detail-request scope, response budget, media policy, and the hashed
   extraction-contract identity. Keep it declarative; it contains no selector,
   HTML, or candidate result.
3. **Generic bounded transport orchestration** — Implement a robots-first,
   one-detail-request flow that consumes the selected candidate only after
   local scope validation. Prove request count, byte/time cap, DNS/TLS
   binding, redirect, robots, auth/challenge, and stop behavior with fakes.
4. **Allowlisted in-memory detail extraction** — Introduce a source-configured,
   hash-pinned extraction adapter that emits only permitted fields and their
   field provenance. Add scanner/disposal tests demonstrating that source
   content cannot cross the output boundary.
5. **Normalize and hand off** — Map the extracted result through existing
   listing-quality and rental-evidence rules. Submit only complete eligible
   normalized outcomes through the existing Storage port; return body-free
   quarantine/parse-drift outcomes otherwise.
6. **Offline review and live verification** — Review the exact Ciencuadras
   extraction contract against a redacted fixture; run dry preflight, then one
   bounded live command. Record only the safe observation/receipt and update
   runbook and retrospective.

## Acceptance criteria

- The selected URL is demonstrably a member of the persisted discovery
  observation and within reviewed detail scope before any network call.
- One run issues at most robots plus one detail request and has no fallback
  discovery request or retry.
- Success yields one deterministic, schema-valid normalized observation with
  source URL, capture/provenance identities, and explicit field provenance.
- Success never claims eligibility unless it has observed active long-term
  residential base monthly COP rent and explicit positive built area.
- Every non-success is a typed, body-free result with no durable receipt where
  Storage admission is ineligible.
- No persisted or logged value contains raw response bytes, HTML, DOM, script,
  contact detail, exact address, cookie, header, token, or rejected URL.
- Unit/integration tests exercise all new boundary rules before any live run;
  package typecheck, lint, format, and relevant test suites pass.

## Risks and open review inputs

- A detail page may not expose the required rental fields in a stable,
  non-sensitive representation. The run must report parse drift or quarantine,
  not guess.
- The existing Ciencuadras route rule identifies listing candidates, not a
  reusable field schema. An extraction contract and redacted fixture require a
  separate offline review.
- A single detail response demonstrates only one shape; it does not authorize
  bulk collection, source activation, or a production schedule.

## Expected modules

- `packages/discovery-profile-storage/`
- `packages/listing-storage-contracts/`
- `apps/crawlers/src/application/`
- `apps/crawlers/src/adapters/transport/`
- `apps/crawlers/src/ports/`
- `apps/crawlers/src/cli/`
- `specs/crawler-runtime-spec.md`
- `docs/architecture/` and `docs/reviews/`

## Validation sequence

```text
selection/profile tests -> transport/orchestration tests -> extraction tests
-> normalization and Storage-boundary tests -> dry preflight
-> one bounded robots-first live detail command -> retrospective
```
