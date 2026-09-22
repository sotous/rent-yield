import type { DurableSubmissionV2 } from "./durable-submission-v2.js";
const interpretation = {
  methodology_manifest_hash: "b".repeat(64),
  adapter_artifact_hash: "f".repeat(64),
  parser_version: "parser-v2",
  normalizer_version: "normalizer-v2",
  extraction_contract_hash: "0".repeat(64),
  canonical_outcome_hash: "1".repeat(64),
};
export const durableSubmissionV2Vector: DurableSubmissionV2 = {
  contract_version: "v2",
  source_key: "synthetic-source",
  submission_id: "submission-1",
  submitted_at: "2026-09-22T12:00:00.000Z",
  context: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "detail",
    listing_role: "for_rent",
    effective_at: "2026-09-22T12:00:00.000Z",
    recorded_as_of: "2026-09-22T12:00:00.000Z",
  },
  capture: {
    capture_event_id: "capture-1",
    collected_at: "2026-09-22T12:00:00.000Z",
    request: {
      method: "GET",
      canonical_url: "https://fixtures.example/listing/1",
    },
    response: {
      status_code: 200,
      media_type: "application/json",
      content_encoding: "utf-8",
      representation: "redacted_fixture",
      body_sha256: "a".repeat(64),
      body_byte_length: 120,
    },
    methodology_manifest_hash: "b".repeat(64),
    policy_hash: "c".repeat(64),
    retention_policy_hash: "d".repeat(64),
    redaction_policy_hash: "e".repeat(64),
    fixture_id: "fixture-1",
  },
  interpretation,
  outcome: {
    kind: "complete",
    outcome_kind: "capture_only",
    typed_outcome: { reason_code: "no_listing_found" },
    provenance: { extraction_trace_hash: "2".repeat(64) },
  },
  artifact: {
    kind: "no_retained_bytes",
    disposition: "policy_forbids_retention",
    media_type: "application/json",
    encoding: "utf-8",
    body_sha256: "a".repeat(64),
    body_byte_length: 120,
  },
};
