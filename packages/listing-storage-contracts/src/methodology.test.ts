import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  methodologyManifestSchema,
  methodologyValidationReportSchema,
  methodologyReviewDecisionSchema,
  methodologyLookupSchema,
  sourceHealthEventSchema,
  methodologyProposalSchema,
} from "./methodology.js";
import {
  methodologyManifestExample as manifest,
  methodologyValidationReportExample as report,
  methodologyReviewDecisionExample as decision,
  methodologyLookupExample as lookup,
} from "./methodology.examples.js";

describe("methodology v1 declarative contracts", () => {
  it("accepts a synthetic declarative proposal without approval or self hash", () => {
    expect(methodologyManifestSchema.safeParse(manifest).success).toBe(true);
  });
  it.each(["hash", "manifest_hash", "status", "approval", "script"])(
    "rejects injected %s on immutable payload",
    (key) => {
      expect(
        methodologyManifestSchema.safeParse({ ...manifest, [key]: "injected" })
          .success,
      ).toBe(false);
    },
  );
  it("rejects injected executable adapter configuration", () => {
    expect(
      methodologyManifestSchema.safeParse({
        ...manifest,
        adapter: { ...manifest.adapter, script: "fetch(url)" },
      }).success,
    ).toBe(false);
  });
  it("rejects unsupported contracts and duplicated fixture sets", () => {
    expect(
      methodologyManifestSchema.safeParse({
        ...manifest,
        contract_version: "v2",
      }).success,
    ).toBe(false);
    expect(
      methodologyManifestSchema.safeParse({
        ...manifest,
        fixture_hashes: [
          manifest.fixture_hashes[0],
          manifest.fixture_hashes[0],
        ],
      }).success,
    ).toBe(false);
  });
  it("requires artifact identity and positive bounded validation checks", () => {
    expect(methodologyValidationReportSchema.safeParse(report).success).toBe(
      true,
    );
    expect(
      methodologyValidationReportSchema.safeParse({
        ...report,
        adapter_artifact_hash: "missing",
      }).success,
    ).toBe(false);
    expect(
      methodologyValidationReportSchema.safeParse({ ...report, checks_run: 0 })
        .success,
    ).toBe(false);
  });
  it("requires a successful report reference for approval and validates ordered intervals", () => {
    expect(methodologyReviewDecisionSchema.safeParse(decision).success).toBe(
      true,
    );
    expect(
      methodologyReviewDecisionSchema.safeParse({
        ...decision,
        validation_report_hash: null,
      }).success,
    ).toBe(false);
    expect(
      methodologyReviewDecisionSchema.safeParse({
        ...decision,
        effective_to: decision.effective_from,
      }).success,
    ).toBe(false);
    expect(
      methodologyReviewDecisionSchema.safeParse({
        ...decision,
        effective_to: "2026-09-08T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });
  it.each(["paused", "revoked", "rejected", "retired"])(
    "%s cannot expire and reveal an earlier approval",
    (state) => {
      expect(
        methodologyReviewDecisionSchema.safeParse({
          ...decision,
          decision: state,
          validation_report_hash: null,
        }).success,
      ).toBe(true);
      expect(
        methodologyReviewDecisionSchema.safeParse({
          ...decision,
          decision: state,
          effective_to: "2026-09-09T00:00:00.000Z",
        }).success,
      ).toBe(false);
    },
  );
  it("requires exact scope and both independent lookup clocks", () => {
    expect(methodologyLookupSchema.safeParse(lookup).success).toBe(true);
    expect(
      methodologyLookupSchema.safeParse({ ...lookup, listing_role: undefined })
        .success,
    ).toBe(false);
    expect(
      methodologyLookupSchema.safeParse({
        ...lookup,
        accepted_contract_version: "v2",
      }).success,
    ).toBe(false);
    expect(
      methodologyLookupSchema.safeParse({
        ...lookup,
        recorded_as_of: undefined,
      }).success,
    ).toBe(false);
  });
  it("accepts typed sanitized health events without raw response text", () => {
    const event = {
      contract_version: "v1",
      event_id: "health-1",
      source_key: "synthetic-source",
      methodology_hash: "1".repeat(64),
      policy_hash: "0".repeat(64),
      occurred_at: "2026-09-08T12:00:00.000Z",
      code: "parser_drift",
      severity: "error",
      issue_codes: ["missing_price"],
    };
    expect(sourceHealthEventSchema.safeParse(event).success).toBe(true);
    expect(
      sourceHealthEventSchema.safeParse({
        ...event,
        response_body: "sensitive",
      }).success,
    ).toBe(false);
    expect(
      sourceHealthEventSchema.safeParse({ ...event, code: "invented" }).success,
    ).toBe(false);
  });
  it("exports JSON Schema without transforms or custom unrepresentable types", () => {
    for (const schema of [
      methodologyManifestSchema,
      methodologyValidationReportSchema,
      methodologyReviewDecisionSchema,
      methodologyLookupSchema,
      sourceHealthEventSchema,
    ]) {
      expect(z.toJSONSchema(schema)).toHaveProperty("$schema");
    }
  });
});

describe("methodology proposal artifact references", () => {
  const proposal = {
    contract_version: "v1",
    manifest_hash: report.manifest_hash,
    manifest,
    validation_report_hash: "2".repeat(64),
    validation_report: report,
  };
  it("accepts exact pins before any approval exists", () => {
    expect(methodologyProposalSchema.safeParse(proposal).success).toBe(true);
  });
  it.each([
    "manifest_hash",
    "adapter_artifact_hash",
    "extraction_contract_hash",
  ])("rejects a mismatched %s", (field) => {
    expect(
      methodologyProposalSchema.safeParse({
        ...proposal,
        validation_report: { ...report, [field]: "9".repeat(64) },
      }).success,
    ).toBe(false);
  });
  it("rejects mismatched fixtures, including subsets", () => {
    expect(
      methodologyProposalSchema.safeParse({
        ...proposal,
        validation_report: { ...report, fixture_hashes: ["9".repeat(64)] },
      }).success,
    ).toBe(false);
  });
  it("preserves failed validation as a proposal without allowing self approval", () => {
    expect(
      methodologyProposalSchema.safeParse({
        ...proposal,
        validation_report: { ...report, outcome: "failed" },
      }).success,
    ).toBe(true);
    expect(
      methodologyProposalSchema.safeParse({ ...proposal, decision: "approved" })
        .success,
    ).toBe(false);
  });
});
