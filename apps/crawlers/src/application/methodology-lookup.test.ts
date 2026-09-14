import { describe, expect, it } from "vitest";
import {
  methodologyLookupExample,
  methodologyManifestDigest,
  methodologyReviewDecisionExample,
  methodologyValidationReportDigest,
  type MethodologyProposalV1,
} from "@rent-yield/listing-storage-contracts";
import { MemoryMethodologyReview } from "./methodology-lookup.js";

const at = "2026-09-14T12:00:00.000Z";
const later = "2026-09-14T13:00:00.000Z";
const adapter = {
  key: "fixture-json-v1",
  artifact_hash: "c".repeat(64),
  parser_version: "parser-v1",
  normalizer_version: "normalizer-v1",
  supported_contract_version: "v1" as const,
  strategies: ["structured_json"] as const,
};
function proposal(key = "synthetic-detail-v1"): MethodologyProposalV1 {
  const proposal = {
    contract_version: "v1" as const,
    manifest_hash: "a".repeat(64),
    manifest: {
      contract_version: "v1" as const,
      methodology_key: key,
      scope: {
        source_key: "synthetic-source",
        country_code: "CO" as const,
        city_key: "barranquilla",
        capability: "detail" as const,
        listing_roles: ["for_rent" as const],
      },
      assessment_hash: "b".repeat(64),
      evidence_hashes: ["c".repeat(64)],
      recheck_after: "2026-09-15T00:00:00.000Z",
      adapter: {
        key: adapter.key,
        artifact_hash: adapter.artifact_hash,
        parser_version: adapter.parser_version,
        normalizer_version: adapter.normalizer_version,
        extraction_contract_hash: "d".repeat(64),
        supported_contract_version: "v1" as const,
      },
      access_scope: {
        hosts: ["fixtures.example"],
        path_prefixes: ["/listing/"],
      },
      permitted_operations: ["read_detail" as const],
      strategy: "structured_json" as const,
      budget: {
        max_requests: 1,
        max_bytes: 1,
        max_duration_ms: 1,
        max_redirects: 0,
        max_concurrency: 1,
        max_source_requests: 1,
      },
      circuit_breaker: {
        stop_on: ["parser_drift" as const],
        max_consecutive_failures: 1,
      },
      fixture_hashes: ["e".repeat(64)],
      redaction: { policy_key: "redaction-v1", policy_hash: "f".repeat(64) },
      retention: {
        policy_key: "fixtures",
        policy_hash: "0".repeat(64),
        permitted_uses: ["parser_replay" as const],
        body_representation: "redacted_fixture" as const,
        retain_images: false as const,
      },
    },
    validation_report_hash: "",
    validation_report: {
      contract_version: "v1" as const,
      manifest_hash: "a".repeat(64),
      adapter_artifact_hash: adapter.artifact_hash,
      fixture_hashes: ["e".repeat(64)],
      extraction_contract_hash: "d".repeat(64),
      validated_at: at,
      validator_version: "fixture-validator-v1",
      outcome: "passed" as const,
      checks_run: 1,
      issues: [],
    },
  };
  proposal.manifest_hash = methodologyManifestDigest(proposal.manifest);
  proposal.validation_report.manifest_hash = proposal.manifest_hash;
  proposal.validation_report_hash = methodologyValidationReportDigest(
    proposal.validation_report,
  );
  return proposal;
}
const lookup = {
  ...methodologyLookupExample,
  effective_at: at,
  recorded_as_of: later,
};
const reviewDecisionInput = structuredClone(methodologyReviewDecisionExample);
delete (reviewDecisionInput as { sequence?: number }).sequence;

describe("effective methodology lookup", () => {
  it("only resolves a trusted approval for the exact scope and both caller clocks", () => {
    const store = new MemoryMethodologyReview([adapter]);
    const item = proposal();
    expect(store.registerProposal(item)).toEqual({ ok: true, appended: true });
    expect(store.resolve(lookup)).toEqual({
      ok: false,
      error: { code: "not_found" },
    });
    expect(
      store.recordTrustedDecision({
        ...reviewDecisionInput,
        manifest_hash: item.manifest_hash,
        validation_report_hash: item.validation_report_hash,
        effective_from: at,
        recorded_at: later,
      }),
    ).toMatchObject({ ok: true, decision: { sequence: 1 } });
    expect(store.resolve(lookup)).toMatchObject({
      ok: true,
      methodology: { manifest_hash: item.manifest_hash },
    });
    expect(store.resolve({ ...lookup, recorded_as_of: at })).toEqual({
      ok: false,
      error: { code: "not_found" },
    });
    expect(store.resolve({ ...lookup, listing_role: "for_sale" })).toEqual({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it("fails closed for lifecycle states, health blocks, reactivation and ambiguity", () => {
    const store = new MemoryMethodologyReview([adapter]);
    const first = proposal("first");
    const second = proposal("second");
    store.registerProposal(first);
    store.registerProposal(second);
    const approve = (item: MethodologyProposalV1, time: string) =>
      store.recordTrustedDecision({
        ...reviewDecisionInput,
        decision_event_id: `approval-${item.manifest.methodology_key}-${time.slice(11, 13)}`,
        manifest_hash: item.manifest_hash,
        validation_report_hash: item.validation_report_hash,
        effective_from: time,
        recorded_at: time,
      });
    approve(first, at);
    expect(
      store.recordHealthEvent({
        contract_version: "v1",
        event_id: "drift",
        source_key: "synthetic-source",
        methodology_hash: first.manifest_hash,
        policy_hash: null,
        occurred_at: later,
        code: "parser_drift",
        severity: "error",
        issue_codes: ["parser_drift"],
      }),
    ).toEqual({ ok: true, appended: true });
    expect(store.resolve({ ...lookup, effective_at: later })).toEqual({
      ok: false,
      error: { code: "policy_blocked" },
    });
    approve(first, "2026-09-14T14:00:00.000Z");
    expect(
      store.resolve({
        ...lookup,
        effective_at: "2026-09-14T14:00:00.000Z",
        recorded_as_of: "2026-09-14T14:00:00.000Z",
      }),
    ).toMatchObject({ ok: true });
    approve(second, "2026-09-14T14:00:00.000Z");
    expect(
      store.resolve({
        ...lookup,
        effective_at: "2026-09-14T14:00:00.000Z",
        recorded_as_of: "2026-09-14T14:00:00.000Z",
      }),
    ).toEqual({ ok: false, error: { code: "ambiguous_methodology" } });
  });

  it("keeps failed validation reviewable but refuses approval and tampered artifacts", () => {
    const failed = proposal("failed-validation");
    failed.validation_report.outcome = "failed";
    failed.validation_report_hash = methodologyValidationReportDigest(
      failed.validation_report,
    );
    const store = new MemoryMethodologyReview([adapter]);
    expect(store.registerProposal(failed)).toEqual({
      ok: true,
      appended: true,
    });
    expect(
      store.recordTrustedDecision({
        ...reviewDecisionInput,
        decision_event_id: "failed-validation-approval",
        manifest_hash: failed.manifest_hash,
        validation_report_hash: failed.validation_report_hash,
        effective_from: at,
        recorded_at: later,
      }),
    ).toEqual({ ok: false, error: { code: "invalid_input" } });

    const tampered = structuredClone(proposal("tampered"));
    tampered.manifest.access_scope.hosts = ["other.example"];
    expect(store.registerProposal(tampered)).toEqual({
      ok: false,
      error: { code: "hash_mismatch" },
    });
  });

  it("uses repository sequence and caller clocks for lifecycle intervals", () => {
    const item = proposal("intervals");
    const store = new MemoryMethodologyReview([adapter]);
    expect(store.registerProposal(item)).toEqual({ ok: true, appended: true });
    const approved = store.recordTrustedDecision({
      ...reviewDecisionInput,
      decision_event_id: "interval-approved",
      manifest_hash: item.manifest_hash,
      validation_report_hash: item.validation_report_hash,
      effective_from: at,
      effective_to: "2026-09-14T13:00:00.000Z",
      recorded_at: at,
    });
    expect(approved).toMatchObject({ ok: true, decision: { sequence: 1 } });
    expect(
      store.recordTrustedDecision({
        ...reviewDecisionInput,
        decision_event_id: "interval-paused",
        manifest_hash: item.manifest_hash,
        validation_report_hash: null,
        decision: "paused",
        effective_from: later,
        effective_to: null,
        recorded_at: later,
      }),
    ).toMatchObject({ ok: true, decision: { sequence: 2 } });

    expect(
      store.resolve({ ...lookup, effective_at: "2026-09-14T12:59:59.999Z" }),
    ).toMatchObject({ ok: true });
    expect(store.resolve({ ...lookup, effective_at: later })).toEqual({
      ok: false,
      error: { code: "not_found" },
    });
    expect(store.resolve({ ...lookup, recorded_as_of: at })).toMatchObject({
      ok: true,
    });
    expect(
      store.recordTrustedDecision({
        ...methodologyReviewDecisionExample,
        decision_event_id: "caller-supplied-sequence",
        manifest_hash: item.manifest_hash,
        validation_report_hash: item.validation_report_hash,
        sequence: 99,
        effective_from: at,
        recorded_at: at,
      }),
    ).toEqual({ ok: false, error: { code: "invalid_input" } });
  });

  it("fails closed for every non-approval state, recheck expiry, and adapter drift", () => {
    for (const decision of [
      "paused",
      "revoked",
      "rejected",
      "retired",
    ] as const) {
      const item = proposal(`state-${decision}`);
      const store = new MemoryMethodologyReview([adapter]);
      store.registerProposal(item);
      expect(
        store.recordTrustedDecision({
          ...reviewDecisionInput,
          decision_event_id: `state-${decision}`,
          manifest_hash: item.manifest_hash,
          validation_report_hash: null,
          decision,
          effective_from: at,
          effective_to: null,
          recorded_at: at,
        }),
      ).toMatchObject({ ok: true });
      expect(store.resolve({ ...lookup, recorded_as_of: at })).toEqual({
        ok: false,
        error: { code: "not_found" },
      });
    }

    const expired = proposal("expired");
    expired.manifest.recheck_after = at;
    expired.manifest_hash = methodologyManifestDigest(expired.manifest);
    expired.validation_report.manifest_hash = expired.manifest_hash;
    expired.validation_report_hash = methodologyValidationReportDigest(
      expired.validation_report,
    );
    const expiryStore = new MemoryMethodologyReview([adapter]);
    expiryStore.registerProposal(expired);
    expiryStore.recordTrustedDecision({
      ...reviewDecisionInput,
      decision_event_id: "expired-approved",
      manifest_hash: expired.manifest_hash,
      validation_report_hash: expired.validation_report_hash,
      effective_from: at,
      recorded_at: at,
    });
    expect(expiryStore.resolve({ ...lookup, recorded_as_of: at })).toEqual({
      ok: false,
      error: { code: "policy_blocked" },
    });

    const incompatible = proposal("incompatible");
    incompatible.manifest.adapter.parser_version = "parser-v2";
    incompatible.manifest_hash = methodologyManifestDigest(
      incompatible.manifest,
    );
    incompatible.validation_report.manifest_hash = incompatible.manifest_hash;
    incompatible.validation_report_hash = methodologyValidationReportDigest(
      incompatible.validation_report,
    );
    expect(
      new MemoryMethodologyReview([adapter]).registerProposal(incompatible),
    ).toEqual({
      ok: false,
      error: { code: "incompatible_adapter" },
    });
  });
});
