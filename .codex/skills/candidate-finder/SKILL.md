---
name: candidate-finder
description: Find and record real listing-source candidates. Use when selecting a source candidate; do not design or invoke its downstream consumers.
---

# Candidate Finder

Use this skill to produce a real source candidate. It ends when the candidate
artifact is complete; it does not know, design, or invoke downstream consumers.

## Output contract

Produce a `SourceCandidate` artifact with these required fields:

```ts
type SourceCandidate = {
  sourceKey: string;
  sourceName: string;
  sourceUrl: string;
  countryCode: "CO";
  cityName: string;
  supportedOperations: Array<"rent" | "sale">;
};
```

The artifact identifies a candidate and its declared scope. It does not claim a
response structure, parser mapping, listing shape, access permission, or
consumer compatibility.

## Workflow

1. Identify a real candidate and establish its source key, display name,
   configured source URL, Colombia city scope, and supported operation(s).
2. Produce the `SourceCandidate` JSON only when every required field is
   explicit and supported by the candidate evidence.
3. Record unknowns rather than extending the candidate artifact with inferred
   parser, fixture, or consumer details.

## Boundaries

- Candidate finding does not generate adapter code, fixtures, parser mappings,
  listing inputs, or crawler behavior.
- Do not add consumer-specific fields merely because a later workflow may need
  them.
- A candidate artifact does not authorize a source request or establish that a
  downstream consumer can use the source.
