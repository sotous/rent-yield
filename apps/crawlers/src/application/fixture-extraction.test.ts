import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  extractionOutcomeSchema,
  type ExtractionContract,
} from "@rent-yield/listing-storage-contracts";
import {
  MemoryFixtureCapture,
  type FixtureArtifact,
} from "./fixture-capture.js";
import {
  inferExtractionContract,
  replayFixture,
} from "./fixture-extraction.js";

const at = "2026-09-12T12:00:00.000Z";
const scope = {
  source_key: "example-source",
  country_code: "CO",
  city_key: "barranquilla",
  capability: "detail",
  listing_roles: ["for_rent", "for_sale"],
} as const;
const listing = {
  id: "rent-123",
  url: "https://example.com/listing/rent-123",
  operation: "rent",
  price: "1800000.00",
  currency: "COP",
  frequency: "monthly",
  feeScope: "base",
  administrationFee: "250000",
  builtArea: "72.50",
  privateArea: "68",
  interiorArea: "65",
  city: "Barranquilla",
  neighborhood: "El Prado",
  propertyType: "apartment",
  rentalBasis: "long_term",
  status: "active",
  publishedAt: "2026-09-01",
  alias: "ref-123",
};
function fixture(
  payload: unknown = { listing },
  observed = false,
): FixtureArtifact {
  const captured = new MemoryFixtureCapture().captureRedactedFixture({
    fixture_id: "extraction-fixture",
    supersedes_fixture_id: null,
    origin: observed
      ? {
          kind: "permitted_source",
          source_key: scope.source_key,
          source_url: "https://example.com/discovery",
          collected_at: at,
          assessment_sha256: "a".repeat(64),
        }
      : { kind: "synthetic", scenario: "offline extraction", generated_at: at },
    created_at: at,
    content_type: "application/json",
    payload: JSON.stringify(payload),
    permitted_use: ["parser_replay"],
    retention_policy_key: "synthetic",
    research_session_id: "offline-tests",
    parser_compatibility: ["parser-v1"],
    expected_classification: "normalized",
  });
  if (!captured.ok) throw new Error(captured.error.code);
  return captured.artifact;
}
function contract(artifact: FixtureArtifact): ExtractionContract {
  const result = inferExtractionContract({
    artifact,
    scope,
    created_at: at,
    extraction_contract_id: "extraction-v1",
  });
  if (!result.ok) throw new Error(result.error.code);
  return result.contract;
}
function replay(payload: unknown = { listing }, observed = false) {
  const artifact = fixture(payload, observed);
  return replayFixture({ artifact, contract: contract(artifact) });
}

describe("offline extraction replay", () => {
  it("replays deterministically with field paths, raw claims, dates and immutable trace", () => {
    const artifact = fixture();
    const input = { artifact, contract: contract(artifact) };
    const result = replayFixture(input);
    expect(result.kind).toBe("normalized");
    expect(extractionOutcomeSchema.safeParse(result).success).toBe(true);
    expect(canonicalJson(replayFixture(input))).toBe(canonicalJson(result));
    expect(result.trace).toMatchObject({
      envelope_sha256: artifact.envelope.envelope_sha256,
      payload_sha256: artifact.envelope.payload_sha256,
      origin: artifact.envelope.origin,
    });
    expect(result.observations[0]).toMatchObject({
      asking_amount: "1800000",
      built_area_sqm: "72.5",
      private_area_sqm: "68",
      interior_area_sqm: "65",
      collected_at: null,
      source_published_at: {
        raw_text: "2026-09-01",
        precision: "day",
        value: "2026-09-01",
      },
      source_updated_at: { raw_text: "", precision: "unknown" },
      field_provenance: expect.arrayContaining([
        {
          field: "asking_amount",
          raw_path: "/listing/price",
          raw_value: "1800000.00",
          transforms: ["parse_decimal"],
          transform_version: "transforms-v1",
          quality_issue_codes: [],
        },
      ]),
      identity_candidates: expect.arrayContaining([
        { kind: "alias", source_key: "example-source", value: "ref-123" },
      ]),
    });
    expect(result.rental_evidence).toEqual([]);
  });
  it("qualifies observed rent without including fees in the base asking amount", () => {
    const result = replay({ listing }, true);
    expect(result.kind).toBe("normalized");
    expect(result.rental_evidence).toHaveLength(1);
    expect(result.rental_evidence[0]?.evidence).toMatchObject({
      asking_amount: "1800000",
      built_area_sqm: "72.5",
      collected_at: at,
    });
    expect(result.observations[0]?.administration_amount).toBe("250000");
  });
  it("penalizes a missing stable URL without quarantining a stable source ID", () => {
    const withUrl = replay();
    const withoutUrl = replay({ listing: { ...listing, url: null } });
    expect(withoutUrl.kind).toBe("normalized");
    expect(withoutUrl.observations[0]?.listing_url).toBeNull();
    expect(withoutUrl.observations[0]?.quality.issues).toContainEqual({
      code: "missing_stable_listing_url",
      field: "listing_url",
      severity: "warning",
    });
    expect(withoutUrl.observations[0]!.quality.index).toBe(
      withUrl.observations[0]!.quality.index - 10,
    );
    expect(replay({ listing: { ...listing, id: null, url: null } }).kind).toBe(
      "quarantined",
    );
    expect(replay({ listing: { ...listing, id: null } }).kind).toBe(
      "normalized",
    );
  });
});

describe("qualification and quarantine", () => {
  it.each([
    [{ currency: "$" }, "unknown_currency"],
    [{ currency: "USD" }, "unknown_currency"],
    [{ frequency: "weekly" }, "unknown_frequency"],
    [{ feeScope: "includes_admin" }, "ambiguous_fee_scope"],
    [{ feeScope: null }, "ambiguous_fee_scope"],
    [{ price: "1.800.000,50" }, "invalid_asking_amount"],
    [{ price: "0" }, "invalid_asking_amount"],
    [{ price: "-1" }, "invalid_asking_amount"],
    [{ builtArea: null }, "missing_built_area"],
    [{ status: "inactive" }, "inactive_listing"],
    [{ status: null }, "unknown_listing_status"],
    [{ rentalBasis: "short_stay" }, "unknown_rental_basis"],
    [{ propertyType: "office" }, "non_residential"],
    [{ city: "Bogota" }, "out_of_scope"],
    [{ operation: "lease-or-buy" }, "invalid_field"],
  ])("quarantines ambiguous or ineligible source claims %j", (patch, code) => {
    const result = replay({ listing: { ...listing, ...patch } }, true);
    expect(result.kind).toBe("quarantined");
    expect(result.rental_evidence).toEqual([]);
    expect(result.observations[0]?.quality).toMatchObject({
      blocking: true,
      issues: expect.arrayContaining([
        expect.objectContaining({ code, severity: "error" }),
      ]),
    });
    expect(extractionOutcomeSchema.safeParse(result).success).toBe(true);
  });
  it("retains unknown date text without inventing collection time or midnight", () => {
    const result = replay({
      listing: {
        ...listing,
        publishedAt: "yesterday",
        updatedAt: "2026-02-30",
      },
    });
    expect(result.kind).toBe("normalized");
    expect(result.observations[0]).toMatchObject({
      collected_at: null,
      source_published_at: { raw_text: "yesterday", precision: "unknown" },
      source_updated_at: { raw_text: "2026-02-30", precision: "unknown" },
    });
    expect(result.observations[0]?.quality.issues).toContainEqual({
      code: "missing_source_date",
      field: "source_published_at",
      severity: "warning",
    });
  });
  it("preserves explicit built claims and quarantines conflicting area measures", () => {
    const accepted = replay(
      {
        listing: {
          ...listing,
          builtArea: null,
          areaValue: "72.5",
          areaKind: "built",
        },
      },
      true,
    );
    expect(accepted.rental_evidence).toHaveLength(1);
    expect(accepted.observations[0]?.built_area_sqm).toBe("72.5");
    const conflict = replay(
      { listing: { ...listing, areaValue: "80", areaKind: "built" } },
      true,
    );
    expect(conflict.kind).toBe("quarantined");
    expect(conflict.observations[0]).toMatchObject({
      built_area_sqm: "72.5",
      area_value: "80",
      area_kind: "built",
    });
    expect(conflict.observations[0]?.quality.issues).toContainEqual({
      code: "area_conflict",
      field: "area_value",
      severity: "error",
    });
  });
  it("keeps sale-only and dual offers independent from rental evidence", () => {
    const sale = {
      operation: "sale",
      price: "500000000",
      currency: "COP",
      frequency: "one_time",
      feeScope: "base",
    };
    const rent = {
      operation: "rent",
      price: "1800000",
      currency: "COP",
      frequency: "monthly",
      feeScope: "base",
    };
    expect(
      replay({ listing: { ...listing, ...sale } }, true).rental_evidence,
    ).toEqual([]);
    const dual = replay(
      { listing: { ...listing, offers: [sale, rent] } },
      true,
    );
    const changed = replay(
      {
        listing: {
          ...listing,
          offers: [{ ...sale, price: "800000000" }, rent],
        },
      },
      true,
    );
    expect(dual.kind).toBe("normalized");
    expect(dual.observations).toHaveLength(2);
    expect(dual.rental_evidence).toEqual(changed.rental_evidence);
    expect(dual.rental_evidence[0]?.observation_index).toBe(1);
    expect(dual.observations[1]?.field_provenance).toContainEqual(
      expect.objectContaining({
        field: "asking_amount",
        raw_path: "/listing/offers/1/price",
      }),
    );
    const missingRent = replay(
      {
        listing: {
          ...listing,
          ...sale,
          offers: [sale, { ...rent, price: null }],
        },
      },
      true,
    );
    expect(missingRent.kind).toBe("quarantined");
    expect(missingRent.rental_evidence).toEqual([]);
    expect(missingRent.observations[1]?.asking_amount).toBeNull();
  });
  it("retains good and rejected observations without hiding issues in mixed payloads", () => {
    const result = replay(
      {
        listings: [
          listing,
          { ...listing, id: "ambiguous", feeScope: "unknown" },
        ],
      },
      true,
    );
    expect(result.kind).toBe("quarantined");
    expect(result.observations).toHaveLength(2);
    expect(result.rental_evidence).toHaveLength(1);
    expect(result.rental_evidence[0]?.observation_index).toBe(0);
  });
  it("distinguishes explicit pagination end from missing content and drift", () => {
    const artifact = fixture({ listings: [], pagination: { end: true } });
    const discoveryContract = contract(artifact);
    discoveryContract.scope.capability = "discovery";
    expect(replayFixture({ artifact, contract: discoveryContract }).kind).toBe(
      "capture_only",
    );
    for (const payload of [
      {},
      { listings: [] },
      { listings: [null] },
      { listing: { unexpected: "shape" } },
      { listing: { ...listing, offers: [] } },
    ]) {
      expect(replay(payload).kind).toBe("parse_failed");
    }
  });
});

describe("replay boundaries and hostile claims", () => {
  it("enforces integrity, pinning, parser compatibility, permitted use and source scope", () => {
    const artifact = fixture(undefined, true);
    const proposal = contract(artifact);
    expect(
      replayFixture({
        artifact: { ...artifact, payload: artifact.payload + " " },
        contract: proposal,
      }).issues[0]?.code,
    ).toBe("invalid_fixture");
    expect(
      replayFixture({
        artifact,
        contract: { ...proposal, fixture_sha256s: ["b".repeat(64)] },
      }).issues[0]?.code,
    ).toBe("fixture_not_pinned");
    expect(
      replayFixture({
        artifact,
        contract: {
          ...proposal,
          scope: { ...proposal.scope, source_key: "other-source" },
        },
      }).issues[0]?.code,
    ).toBe("out_of_scope");
    expect(
      replayFixture({
        artifact,
        contract: { ...proposal, contract_version: "v2" },
      }).kind,
    ).toBe("parse_failed");
    const original = readFileSync(
      new URL(
        "../../fixtures/synthetic-rent-separate-admin-v1/envelope.json",
        import.meta.url,
      ),
      "utf8",
    );
    const frozen: FixtureArtifact = {
      envelope: JSON.parse(original),
      payload: readFileSync(
        new URL(
          "../../fixtures/synthetic-rent-separate-admin-v1/payload.json",
          import.meta.url,
        ),
        "utf8",
      ),
    };
    // Capture-era expected classification is metadata, not permission to assume base rent.
    expect(
      replayFixture({ artifact: frozen, contract: contract(frozen) }).kind,
    ).toBe("quarantined");
  });
  it.each([
    "https://example.com/",
    "https://example.com/search",
    "https://example.com/listing",
    "https://unrelated.example/listing/123",
  ])("does not treat an unstable or unrelated locator as stable: %s", (url) => {
    const result = replay({ listing: { ...listing, url } }, true);
    expect(result.observations[0]?.listing_url).toBeNull();
    expect(result.kind).toBe("normalized");
  });
  it("does not treat redaction placeholders or aliases as stable identity", () => {
    const result = replay({
      listing: { ...listing, url: null, id: "[REDACTED:identity_number]" },
    });
    expect(result.kind).toBe("quarantined");
    expect(result.observations[0]?.source_listing_id).toBeNull();
  });
  it("preserves a lower URL score even when other blocking issues saturate penalties", () => {
    const bad = {
      ...listing,
      operation: "unknown",
      price: "0",
      currency: "?",
      status: "inactive",
      propertyType: "office",
      city: "Bogota",
      builtArea: null,
      rentalBasis: null,
      frequency: null,
    };
    const withUrl = replay({ listing: bad }).observations[0]!;
    const withoutUrl = replay({ listing: { ...bad, url: null } })
      .observations[0]!;
    expect(withUrl.quality.blocking).toBe(true);
    expect(withoutUrl.quality.index).toBe(withUrl.quality.index - 10);
  });
  it("rejects malformed mapping programs and missing core mappings", () => {
    const artifact = fixture();
    const proposal = contract(artifact);
    for (const mappings of [
      [
        {
          field: "asking_amount",
          locator: { kind: "dom_path", segments: ["script"] },
          transforms: ["identity"],
          required: true,
        },
      ],
      [...proposal.mappings, proposal.mappings[0]],
      proposal.mappings.filter((mapping) => mapping.field !== "listing_role"),
      proposal.mappings.map((mapping) =>
        mapping.field === "asking_amount"
          ? { ...mapping, transforms: ["execute_script"] }
          : mapping,
      ),
    ])
      expect(
        replayFixture({ artifact, contract: { ...proposal, mappings } }).kind,
      ).toBe("parse_failed");
  });
  it("keeps failed decimal raw claims and rejects nested amounts rather than losing them", () => {
    const result = replay({ listing: { ...listing, price: "123abc" } });
    expect(result.observations[0]?.field_provenance).toContainEqual(
      expect.objectContaining({
        field: "asking_amount",
        raw_value: "123abc",
        quality_issue_codes: expect.arrayContaining([
          "invalid_field",
          "invalid_asking_amount",
        ]),
      }),
    );
    expect(
      replay({ listing: { ...listing, price: { amount: "1800000" } } }).kind,
    ).toBe("parse_failed");
  });
  it("does not allow conflicting area claims or negative separate fees into clean evidence", () => {
    expect(
      replay({ listing: { ...listing, privateArea: "90" } }, true).kind,
    ).toBe("quarantined");
    expect(
      replay({ listing: { ...listing, administrationFee: "-250000" } }, true)
        .rental_evidence,
    ).toEqual([]);
  });
  it("rejects forged quality scores and synthetic or mislinked evidence at the runtime boundary", () => {
    const result = replay({ listing }, true);
    const forged = structuredClone(result);
    forged.observations[0]!.quality.issues.push({
      code: "ambiguous_fee_scope",
      field: "fee_scope",
      severity: "error",
    });
    expect(extractionOutcomeSchema.safeParse(forged).success).toBe(false);
    const wrongIndex = structuredClone(result);
    wrongIndex.rental_evidence[0]!.observation_index = 10;
    expect(extractionOutcomeSchema.safeParse(wrongIndex).success).toBe(false);
    const synthetic = structuredClone(result);
    synthetic.trace!.origin = {
      kind: "synthetic",
      scenario: "fake",
      generated_at: at,
    };
    expect(extractionOutcomeSchema.safeParse(synthetic).success).toBe(false);
  });
});

it("preserves remaining model inputs and rejects invalid integer and coordinate claims", () => {
  const payload = {
    listing: {
      ...listing,
      bedrooms: "3",
      bathrooms: "2",
      socialStratum: "4",
      latitude: "10.98",
      longitude: "-74.80",
    },
  };
  const result = replay(payload);
  expect(result.observations[0]).toMatchObject({
    bedrooms: 3,
    bathrooms: 2,
    social_stratum: 4,
    latitude: "10.98",
    longitude: "-74.8",
  });
  expect(result.trace).toHaveProperty("normalizer_version", "normalizer-v1");
  expect(result.observations[0]?.field_provenance).toContainEqual(
    expect.objectContaining({
      field: "bedrooms",
      raw_path: "/listing/bedrooms",
      raw_value: "3",
    }),
  );
  const invalid = replay({
    listing: {
      ...listing,
      bedrooms: "2.5",
      latitude: "100",
      socialStratum: "7",
    },
  });
  expect(invalid.kind).toBe("quarantined");
});

it("replays the committed explicit-base-rent fixture as synthetic normalized facts", () => {
  const folder = new URL(
    "../../fixtures/synthetic-explicit-base-rent-v1/",
    import.meta.url,
  );
  const artifact: FixtureArtifact = {
    envelope: JSON.parse(
      readFileSync(new URL("envelope.json", folder), "utf8"),
    ),
    payload: readFileSync(new URL("payload.json", folder), "utf8"),
  };
  const result = replayFixture({ artifact, contract: contract(artifact) });
  expect(result.kind).toBe(artifact.envelope.expected_classification);
  expect(result.observations[0]?.quality.index).toBe(100);
  expect(result.rental_evidence).toEqual([]);
  expect(extractionOutcomeSchema.safeParse(result).success).toBe(true);
});

it("honors offer-specific status and rental basis while preserving their exact paths", () => {
  const rent = {
    operation: "rent",
    price: "1800000",
    currency: "COP",
    frequency: "monthly",
    feeScope: "base",
    status: "inactive",
    rentalBasis: "short_stay",
  };
  const result = replay({ listing: { ...listing, offers: [rent] } }, true);
  expect(result.kind).toBe("quarantined");
  expect(result.rental_evidence).toEqual([]);
  expect(result.observations[0]?.field_provenance).toContainEqual(
    expect.objectContaining({
      field: "rental_basis",
      raw_path: "/listing/offers/0/rentalBasis",
      raw_value: "short_stay",
    }),
  );
});

it("fails explicitly on numeric tokens that cannot retain exact canonical provenance", () => {
  for (const price of [1800000.5, 9007199254740992]) {
    const result = replay({ listing: { ...listing, price } });
    expect(result.kind).toBe("parse_failed");
    expect(() => canonicalJson(result)).not.toThrow();
  }
});
