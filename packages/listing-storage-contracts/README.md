# Listing storage contracts

This package shares research schemas between the crawler workbench and its
future storage provider. The foundation v1 surface exports Zod schemas, inferred
TypeScript DTOs, a `contractSchemas` catalog, `contractJsonSchemas`, synthetic
examples, and canonical JSON helpers. All research envelopes require
`contract_version: "v1"` and reject unknown object keys.

## Consumer example

```ts
import {
  contractSchemas,
  methodologyManifestExample,
} from "@rent-yield/listing-storage-contracts";

const proposal = contractSchemas.methodology_manifest.parse(
  methodologyManifestExample,
);
```

This checks a synthetic proposal's structure. It grants no permission and does
not approve or execute a methodology. Runtime refinements are authoritative;
JSON Schema projections cannot express every date, interval, or cross-field
invariant. Use Zod at application boundaries, even if a consumer also uses the
JSON Schema for forms or documentation.

Probe receipts contain bounded response evidence: sanitized URLs and metadata,
plus the SHA-256 and byte length of either a complete entity body or the partial
bytes received before a budget cutoff. They never carry the response body. An
assessment reference may be absent on a fail-closed result when no current
assessment could be resolved.

`canonicalJson` serializes validated JSON with UTF-16 key ordering, rejecting
unsafe integers and invalid Unicode. It preserves ordinary array order.
`canonicalSet` is only for schema-declared sets and rejects duplicate members.
Neither helper performs source hashing, authorization, or persistence.

## Draft storage compatibility

Existing `SourceMethodology`, `RawCapture`, `NormalizedListingObservation`, and
storage port types remain unversioned draft exports. Do not add a v1 tag to an
old payload and assume compatibility. Research callers should migrate to the
corresponding catalog schema; future ingestion/provider work must adopt the
joint capture, replay, receipt, and provenance agreement explicitly.

Crawlers authors this package; Data Storage reviews the shared boundary and owns
durable providers. Tests here exercise schemas and canonical preimages, not
provider conformance or live-source behavior.
