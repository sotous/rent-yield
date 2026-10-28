---
name: source-candidate-discovery
description: Research public-web evidence for new Colombian, Barranquilla listing-source candidates. Use before source assessment; never collect listings or invoke downstream consumers.
---

# Source Candidate Discovery

Use this skill to produce a short, reviewable set of possible top-of-funnel
listing sources for Colombia, initially Barranquilla. The result is discovery
input only: it is not a candidate registration, access decision, adapter
implementation, or crawler invocation.

## Required boundaries

- Before researching, require a supplied, current candidate-registry export.
  If it is missing, unreadable, or ambiguous, stop and report
  `dedupe_unavailable`; do not return proposed candidates.
- Research only public internet search/index evidence and public pages needed
  to identify an organization and its apparent listing offering. Do not visit
  listing-detail pages, enumerate search results, submit forms, log in, bypass
  controls, call undocumented endpoints, or make any collection/probe request.
- Treat public visibility as discovery evidence only. Do not infer technical or
  contractual permission, robots status, reuse rights, completeness, or
  suitability for a crawler.
- Do not write to a registry, perform an assessment, invoke a builder or
  crawler, or otherwise change external state.

## Workflow

1. Obtain the supplied registry export and retain its read time and reference.
   Limit it to records relevant to `CO`, `barranquilla`, and listing discovery.
2. Search the public web for organizations that appear to publish Colombian
   residential rent or sale listings and show a credible Barranquilla presence.
   Prefer first-party organization, city/category, and public policy/about
   pages. Capture only the minimal page facts needed for attribution.
3. Normalize each discovery to its organization name and canonical HTTPS
   homepage URL. Compare it with registry source keys, normalized hostnames,
   and registrable domains. When a match is plausible but cannot be resolved,
   exclude it as `possible_duplicate` rather than proposing it.
4. Return only candidates absent from the registry. Keep unknowns explicit,
   including whether the public evidence supports long-term, residential,
   rental, sale, or city-specific scope.

## Source-adapter readiness requirements

For every proposed candidate, record the source facts that a later adapter
workflow will require:

- a stable lowercase `sourceKey`;
- display name and canonical HTTPS `sourceUrl`;
- `countryCode: "CO"`, city scope, and supported `rent` and/or `sale`
  operations; and
- explicit unresolved evidence for the response content type, listing collection
  path, and each field mapping. Record those requirements under the candidate's
  `sourceKey`; do not combine requirements from multiple candidates.

The discovery result must distinguish candidate readiness from adapter
readiness. Public discovery evidence can establish the former; a representative
source response or fixture is required for the latter. Do not infer extraction
paths, generate adapter code, or invoke an adapter from public candidate
metadata.

## Output

Return a concise `source_candidate_discovery_report` with:

- `registry_check`: query time, read-only query reference, status, and recorded
  identities considered;
- `proposed_candidates`: one candidate per `sourceKey`, with organization/source
  name, canonical homepage URL, declared country/city/operation scope, inferred
  scope marked `unverified`, public evidence URLs with a brief factual
  observation and access date, discovery rationale, and unknowns;
- `source_adapter_requirements`: keyed by `sourceKey`, with the unresolved
  response/fixture/mapping evidence required before adapter generation;
- `discarded`: recorded or possible duplicates with matching basis; and
- `next_step`: `candidate_review_required` for every proposal.

Do not invent registry fields, claim that a source is allowed, or assign a
candidate ID. A valid empty proposal list is successful when the registry
already contains all plausible findings.
