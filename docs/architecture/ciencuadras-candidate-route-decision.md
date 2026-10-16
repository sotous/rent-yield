# Ciencuadras candidate-route decision

**Decision date:** 2026-10-13
**Status:** reviewed route rule; awaiting Storage profile update

## Decision

Use `www.ciencuadras.com` with the exact listing-candidate path prefix
`/inmueble/`. Do not create candidates from the discovery route.

The reviewed decision is supported by three independently indexed Barranquilla
rental detail URLs in the `/inmueble/` namespace and a separate indexed
discovery page in `/arriendo/`. Record only those URLs' metadata and evidence
hashes; do not retain page bodies. The rule identifies listing candidates, not
their downstream rental/residential eligibility.

## Why this fails closed

The generic extractor retains only HTTPS, credential-free, query-free,
fragment-free anchor URLs whose host and path match the reviewed rule. A
same-host rule, or the discovery path used as a detail prefix, could retain
navigation, search, category, account, or other non-listing URLs. It therefore
does not meet the runbook's exact nonempty-prefix requirement.

## Required review evidence

The review record establishes all of the following:

- representative canonical for-rent listing-detail URLs and the exact
  `/inmueble/` candidate prefix;
- the canonical host and any redirect/alternate-host decision;
- why the prefix excludes discovery, search, and navigation routes; and
- a dated approval record referring to evidence hashes only, without page body
  retention.

## Storage update request after approval

Create the pending versioned profile update containing a reviewed
`html_anchor_href` extraction rule with the approved host and path prefix. The
reviewed variant must include `extractor_artifact_sha256` equal to
`bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb`, plus an
explicit, non-empty `allow_no_candidates` rationale. The `unreviewed` variant
contains no extractor, host, or path rule. Storage will include the complete
reviewed configuration in canonical profile hashing and emit both rule-config
and extractor-artifact provenance. The exact path remains intentionally
unresolved in this record.

After that update is merged, run the network-free preflight and
then one bounded live invocation. No live response may be used to discover or
widen the rule.

## Canary result

On 2026-10-16, the reviewed profile passed network-free preflight. The first
authorized robots-first live invocation stopped with `budget_exhausted`; its
sanitized receipt showed that the 65,536-byte cap was below the discovery
response size. Storage then reviewed and versioned a narrowly increased
524,288-byte cap, with all request, route, and extraction limits unchanged.

The separately authorized v3 robots-first invocation succeeded. It wrote one
schema-valid observation with a response digest and byte length, profile and
extractor provenance, and 20 sorted canonical `/inmueble/` candidate URLs. The
observation contains no response body, HTML, DOM, rejected URL, header, cookie,
token, contact detail, or exact address. No additional source request follows
from this result.
