import { describe, expect, it } from "vitest";
import {
  acceptedSubmissionDigestV2,
  canonicalOutcomeDigestV2,
  durableSubmissionV2Schema,
  durableSubmissionV2Vector,
  type DurableSubmissionV2,
  type DurableSubmissionV2Provider,
} from "@rent-yield/listing-storage-contracts";
import { deliverFixtureSubmissionCandidate } from "./runtime-submission-delivery.js";

const normalizedSubmission = (): DurableSubmissionV2 => {
  const outcome = durableSubmissionV2Vector.outcome;
  if (outcome.kind !== "complete") throw new Error("expected complete vector");
  return durableSubmissionV2Schema.parse({
    ...durableSubmissionV2Vector,
    outcome: {
      ...outcome,
      outcome_kind: "normalized",
      canonical_outcome_hash: canonicalOutcomeDigestV2({
        outcome_kind: "normalized",
        typed_outcome: outcome.typed_outcome,
        provenance: outcome.provenance,
      }),
    },
  });
};

describe("fixture submission delivery", () => {
  it("submits only the candidate and returns Storage's immutable receipt", async () => {
    const submission = normalizedSubmission();
    const provider: DurableSubmissionV2Provider = {
      accept: async (input) => {
        expect(input).toEqual(submission);
        return {
          contract_version: "v2",
          receipt_id: "receipt-1",
          source_key: input.source_key,
          submission_id: input.submission_id,
          capture_event_id: input.capture.capture_event_id,
          accepted_submission_hash: acceptedSubmissionDigestV2(input),
          accepted_at: "2026-09-30T00:00:00.000Z",
          state: "accepted",
          duplicate_delivery: false,
        };
      },
      progress: async () => [],
    };

    await expect(
      deliverFixtureSubmissionCandidate(submission, provider),
    ).resolves.toMatchObject({
      ok: true,
      receipt: { receipt_id: "receipt-1" },
    });
  });

  it("returns Storage's typed refusal without creating local receipt state", async () => {
    const provider: DurableSubmissionV2Provider = {
      accept: async () => ({ code: "interpretation_conflict" }),
      progress: async () => [],
    };
    await expect(
      deliverFixtureSubmissionCandidate(normalizedSubmission(), provider),
    ).resolves.toEqual({
      ok: false,
      error: { code: "interpretation_conflict" },
    });
  });

  it("maps an unavailable provider to a sanitized process error", async () => {
    const provider: DurableSubmissionV2Provider = {
      accept: async () => {
        throw new Error("connection details");
      },
      progress: async () => [],
    };
    await expect(
      deliverFixtureSubmissionCandidate(normalizedSubmission(), provider),
    ).resolves.toEqual({ ok: false, error: { code: "storage_unavailable" } });
  });
});
