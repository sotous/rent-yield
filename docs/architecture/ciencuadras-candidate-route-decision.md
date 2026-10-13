# Ciencuadras candidate-route decision

**Decision date:** 2026-10-13
**Status:** blocked pending offline review

## Decision

Keep the Ciencuadras discovery profile's extraction state as `unreviewed`.
Do not run the dry preflight or the bounded live canary, and do not create a
listing-candidate allowlist from the discovery route.

The only reviewed operational facts are the discovery host
`www.ciencuadras.com` and the bounded discovery path
`/arriendo/barranquilla`. Neither identifies a listing-detail URL. The prior
bounded run is transport evidence only; it deliberately retained no page or
route evidence and cannot be repurposed as extraction evidence.

## Why this fails closed

The generic extractor retains only HTTPS, credential-free, query-free,
fragment-free anchor URLs whose host and path match the reviewed rule. A
same-host rule, or the discovery path used as a detail prefix, could retain
navigation, search, category, account, or other non-listing URLs. It therefore
does not meet the runbook's exact nonempty-prefix requirement.

## Required review evidence

An authorized reviewer must provide a retention-safe offline record that
establishes all of the following:

- one representative canonical for-rent listing-detail URL and its exact
  candidate path prefix;
- the canonical host and any redirect/alternate-host decision;
- why the prefix excludes discovery, search, and navigation routes; and
- a dated approval record referring to evidence hashes only, without page body
  retention.

## Storage update request after approval

Create a versioned profile update containing a reviewed
`html_anchor_href` extraction rule with the approved host and path prefix. The
reviewed variant must include `extractor_artifact_sha256` equal to
`bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb`, plus an
explicit, non-empty `allow_no_candidates` rationale. The `unreviewed` variant
contains no extractor, host, or path rule. Storage will include the complete
reviewed configuration in canonical profile hashing and emit both rule-config
and extractor-artifact provenance. The exact path remains intentionally
unresolved in this record.

After that update is reviewed and merged, run the network-free preflight and
then one bounded live invocation. No live response may be used to discover or
widen the rule.
