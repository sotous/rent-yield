# Data Storage discovery-profile repository

## Status

Approved on 2026-10-08. This plan authorizes the fixture-only JSON repository
and its tracked execution slices. It does not authorize a live request,
database migration, candidate registration, access assessment, trusted review,
or pull request.

**Progress on 2026-10-08:** the Storage contract, JSON adapter, fixture, tests,
and documentation are complete. Crawler-owned integration remains pending with
the concurrent Crawler implementation.

**Evolution in progress on 2026-10-09:** replace the fixture capture's obsolete
access-assessment hash with deterministic, Storage-derived discovery-profile
provenance. This is a contract-only change; it adds no live access or Crawler
implementation change.

## Goal

Provide the smallest temporary, Storage-owned persistence boundary through
which the fixture-only crawler can read a versioned bounded-discovery profile.
The first adapter reads a validated JSON registry from the repository. It is a
replaceable stand-in for a future Data Storage provider, not a crawler-owned
source-configuration module.

## Sources of truth

- `AGENTS.md`
- `specs/crawler-runtime-spec.md`
- `specs/data-storage-spec.md`
- `docs/architecture/data-storage-port-contracts.md`
- `plan/crawler-first-real-world-canary.md`
- `plan/data-storage-durable-provider.md`

## Decisions

| Decision                   | Proposal                                                                                                                                                                                                               | Reason                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Ownership                  | New `@rent-yield/discovery-profile-storage` package owns the record schema, JSON adapter, fixture, and Storage-facing contract.                                                                                        | Keeps source/business facts out of generic crawler application code.                               |
| Read contract              | `DiscoveryProfileRepository.findActiveBySourceKey({ source_key })` returns one active record or `null`.                                                                                                                | The MVP is Barranquilla-first and starts from a known source; it needs no write or query language. |
| Active uniqueness          | At most one active profile may exist for a `source_key`; ambiguous persisted data fails closed.                                                                                                                        | A crawler must never select a profile arbitrarily.                                                 |
| Record scope               | A profile contains `source_key`, positive `profile_version`, `active`/`inactive` state, `CO` country, city, `discovery` capability, permitted listing roles, hosts, path prefixes, budgets, and permitted media types. | Captures all bounded-discovery facts the runner needs without adding access governance.            |
| Fixture location           | Versioned registry at `packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json`.                                                                                                                        | Makes Storage-owned facts reviewable and replaces ad hoc source modules.                           |
| Validation                 | Strict Zod validation on every registry read; invalid JSON, unknown fields, invalid host/path/media values, invalid budgets, and duplicate active profiles reject before Crawler use.                                  | File-backed configuration must fail closed.                                                        |
| No authorization semantics | `active` is only operational availability in this temporary fixture. It is not source permission, candidate registration, assessment, trusted review, or canary approval.                                              | Prevents a convenience adapter from widening crawler authority.                                    |
| Operational provenance     | An active read adds `discovery_profile_provenance` with `source_key`, `profile_version`, and `profile_sha256`, the SHA-256 digest of the canonical complete V1 record.                                                 | Gives fixture capture deterministic configuration lineage without inventing an access assessment.  |

## Record shape

The JSON document has this logical shape:

```ts
type DiscoveryProfileRegistryV1 = {
  contract_version: "v1";
  profiles: readonly DiscoveryProfileV1[];
};

type DiscoveryProfileV1 = {
  source_key: string;
  profile_version: number;
  state: "active" | "inactive";
  scope: {
    country_code: "CO";
    city_key: string;
    capability: "discovery";
    listing_roles: readonly ("for_rent" | "for_sale")[];
  };
  allowed_hosts: readonly string[];
  allowed_path_prefixes: readonly string[];
  budget: {
    max_requests: number;
    max_bytes: number;
    max_duration_ms: number;
    max_redirects: number;
    max_concurrency: number;
    max_source_requests: number;
  };
  permitted_media_types: readonly (
    "application/json" | "text/html" | "text/plain"
  )[];
};

type ActiveDiscoveryProfileV1 = DiscoveryProfileV1 & {
  discovery_profile_provenance: {
    source_key: string;
    profile_version: number;
    profile_sha256: string;
  };
};
```

Hosts are bare HTTPS hostnames, paths are absolute prefixes, and every numeric
budget limit is a positive safe integer. The registry does not contain a URL to
fetch, credentials, cookies, access decisions, raw bodies, listing data, or
approval status.

## Delivery slices and TDD order

1. **Plan and tracking** — Approve this decision-complete plan and create the
   Notion tasks before implementation.
2. **Contract and RED tests** — Add focused failing tests for active lookup,
   inactive/missing lookup, duplicate-active rejection, strict persisted-schema
   rejection, and the committed JSON fixture.
3. **JSON adapter GREEN** — Implement the strict schema and read-only
   `JsonFileDiscoveryProfileRepository`; return only the active profile for an
   exact source key.
4. **Crawler compatibility** — Have the Crawler integration consume the
   Storage-owned repository contract and map the returned bounded facts without
   importing source-specific profile data from generic application code.
5. **Review and documentation** — Review the fail-closed behavior and update
   the package README and architecture navigation with the fixture location and
   replacement boundary.
6. **Operational provenance evolution** — RED-test and add deterministic
   `discovery_profile_provenance` to active lookup results. The digest covers a
   canonical complete validated V1 profile, rather than any candidate or access
   assessment. Update the contract and replacement documentation.

## Files expected to change

| Path                                                                                    | Responsibility                                                    |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/discovery-profile-storage/package.json`                                       | Package identity and workspace commands.                          |
| `packages/discovery-profile-storage/src/index.ts`                                       | Public read-only Storage contract and exports.                    |
| `packages/discovery-profile-storage/src/json-file-discovery-profile-repository.ts`      | JSON adapter and strict persisted-record validation.              |
| `packages/discovery-profile-storage/src/json-file-discovery-profile-repository.test.ts` | Focused RED/GREEN behavior tests.                                 |
| `packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json`                | Storage-owned temporary registry.                                 |
| `packages/discovery-profile-storage/README.md`                                          | Consumer and replacement-boundary documentation.                  |
| `docs/README.md`                                                                        | Documentation navigation entry, if needed.                        |
| Crawler-owned integration files                                                         | Consume the exported repository without duplicating source facts. |

## Validation

- The initial focused adapter test fails for the missing implementation.
- The adapter returns the one active profile for the requested source and does
  not expose unrelated entries.
- Missing/inactive sources return `null`.
- Multiple active versions for one source and malformed/unsafe persisted data
  fail closed.
- The committed fixture parses through the same production adapter path.
- An active result carries stable profile provenance that changes when a
  bounded profile fact changes and never mentions an access assessment.
- Package test, typecheck, lint, and formatting checks pass.
- No touched code opens a network connection, performs a live request, stores
  candidate/access/review decisions, or introduces a database/object store.

## Risks and follow-up

- This source-key-only lookup is intentionally too small for multiple active
  city/capability profiles per source. A later multi-scope provider must evolve
  the contract with a versioned scope query instead of overloading this lookup.
- `active` must not be interpreted as authorization. Live source and canary
  work remain separately gated.
- PostgreSQL/PostGIS durable-provider work is independent and still requires
  its own approved delivery plan and infrastructure decisions.
