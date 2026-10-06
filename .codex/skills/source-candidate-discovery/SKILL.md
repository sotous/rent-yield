---
name: source-candidate-discovery
description: Research public-web evidence for new Colombian, Barranquilla listing-source candidates while excluding candidates already recorded in the repository registry. Use before source assessment; never collect listings.
---

# Source Candidate Discovery

Use this skill to produce a short, reviewable set of possible top-of-funnel
listing sources for Colombia, initially Barranquilla. The result is research
input for the source-candidate lifecycle, not a candidate registration,
access decision, methodology proposal, or canary.

## Required boundaries

- Before researching, require either a supplied, current candidate-registry
  export or read-only enumeration of the live in-process registry. There is no
  durable candidate database, CLI, or API in this repository. If neither is
  available, is unreadable, or has an ambiguous result, stop and report
  `dedupe_unavailable`; do not return proposed candidates.
- Research only public internet search/index evidence and public pages needed
  to identify an organization and its apparent listing offering. Do not visit
  listing-detail pages, enumerate search results, submit forms, log in, bypass
  controls, call undocumented endpoints, or make any collection/probe request.
- Treat public visibility as discovery evidence only. Do not infer technical or
  contractual permission, robots status, reuse rights, completeness, or
  suitability for a canary.
- Do not write to the registry, create candidates, perform an assessment,
  trigger a canary, or change external state.

## Workflow

1. Read `specs/crawler-research-spec.md`. Obtain the supplied registry export
   or live in-process `MemorySourceResearch.candidates()` enumeration, and
   retain its read time and reference. Limit it to records relevant to `CO`,
   `barranquilla`, and listing discovery.
2. Search the public web for organizations that appear to publish Colombian
   residential rent or sale listings and show a credible Barranquilla presence.
   Prefer first-party organization, city/category, and public policy/about
   pages. Capture only the minimal page facts needed for attribution.
3. Normalize each discovery to its organization name and canonical HTTPS
   homepage URL. Compare it with registry `source_key`, normalized hostname,
   and registrable domain. A `candidate_id` is a version identity, not a source
   deduplication key. When a match is plausible but cannot be resolved,
   exclude it as `possible_duplicate` rather than proposing it.
4. Return only candidates that are absent from the registry. Keep unknowns
   explicit, especially whether the public evidence supports long-term,
   residential, rental, sale, or city-specific scope.

## Output

Return a concise `source_candidate_discovery_report` with:

- `registry_check`: query time, read-only query reference, status, and recorded
  identities considered;
- `proposed_candidates`: each with organization/source name, canonical homepage
  URL, inferred scope marked as `unverified`, public evidence URLs with a brief
  factual observation and access date, discovery rationale, and unknowns;
- `discarded`: recorded or possible duplicates, with the registry source key,
  normalized domain, or matching basis; and
- `next_step`: `candidate_review_required` for every proposal.

Do not invent registry fields, claim that a source is allowed, or assign a
candidate ID. A valid empty proposal list is a successful result when the
registry already contains all plausible findings. If the registry check fails,
return only the fail-closed status and what prevented the read; do not include
research findings.
