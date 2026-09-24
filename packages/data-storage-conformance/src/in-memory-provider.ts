import {
  acceptedSubmissionDigestV2,
  canonicalJson,
  durableSubmissionV2Schema,
  receiptProgressV2Schema,
  type AcceptedReceiptV2,
  type DurableSubmissionV2,
  type DurableSubmissionV2ConformanceFixtures,
  type DurableSubmissionV2Error,
  type DurableSubmissionV2Provider,
  type ReceiptProgressV2,
} from "@rent-yield/listing-storage-contracts";

type ReferenceDetails = {
  key: string;
  binding: unknown;
  error:
    "staged_reference_invalid" | "artifact_unverified" | "outcome_unverified";
};

type TerminalProgressInput = Pick<
  ReceiptProgressV2,
  "occurred_at" | "state" | "code" | "reason"
>;

const submissionKey = (input: DurableSubmissionV2): string =>
  canonicalJson([input.source_key, input.submission_id]);

const captureKey = (input: DurableSubmissionV2): string =>
  canonicalJson([input.source_key, input.capture.capture_event_id]);

const captureFingerprint = (input: DurableSubmissionV2): string => {
  const capture = input.capture;
  return canonicalJson({
    collected_at: capture.collected_at,
    request: capture.request,
    response: capture.response,
    methodology_manifest_hash: capture.methodology_manifest_hash,
    policy_hash: capture.policy_hash,
    retention_policy_hash: capture.retention_policy_hash,
    redaction_policy_hash: capture.redaction_policy_hash,
    fixture_id: capture.fixture_id,
  });
};

const interpretationKey = (input: DurableSubmissionV2): string =>
  canonicalJson([captureKey(input), input.interpretation]);

const outcomeHash = (input: DurableSubmissionV2): string =>
  input.outcome.kind === "complete"
    ? input.outcome.canonical_outcome_hash
    : input.outcome.reference.referenced_outcome_hash;

const referenceDetails = (
  input: DurableSubmissionV2,
): ReferenceDetails | null => {
  if (input.artifact.kind === "staged_reference")
    return {
      key: `staged:${input.artifact.reference_id}`,
      binding: input.artifact,
      error: "staged_reference_invalid",
    };
  if (input.artifact.kind === "verified_immutable_reference")
    return {
      key: `artifact:${input.artifact.reference_id}`,
      binding: input.artifact,
      error: "artifact_unverified",
    };
  if (input.outcome.kind === "verified_immutable_reference")
    return {
      key: `outcome:${input.outcome.reference.reference_id}`,
      binding: input.outcome.reference,
      error: "outcome_unverified",
    };
  return null;
};

/**
 * Provider-neutral conformance fake. Its state is intentionally process-local:
 * it demonstrates V2 behavior but makes no durability claim.
 */
export class InMemoryDurableSubmissionV2Provider
  implements DurableSubmissionV2Provider, DurableSubmissionV2ConformanceFixtures
{
  private readonly submissions = new Map<string, AcceptedReceiptV2>();
  private readonly submissionHashes = new Map<string, string>();
  private readonly captureFingerprints = new Map<string, string>();
  private readonly interpretationOutcomes = new Map<string, string>();
  private readonly references = new Map<string, string>();
  private readonly terminalProgress = new Map<string, ReceiptProgressV2>();
  private nextReceipt = 1;

  async accept(
    input: DurableSubmissionV2,
  ): Promise<AcceptedReceiptV2 | DurableSubmissionV2Error> {
    const parsed = durableSubmissionV2Schema.parse(input);
    const key = submissionKey(parsed);
    const hash = acceptedSubmissionDigestV2(parsed);
    const existing = this.submissions.get(key);
    if (existing) {
      if (this.submissionHashes.get(key) !== hash)
        return { code: "submission_conflict" };
      return existing;
    }

    const reference = referenceDetails(parsed);
    if (
      reference &&
      this.references.get(reference.key) !== canonicalJson(reference.binding)
    )
      return { code: reference.error };

    const capture = captureKey(parsed);
    const fingerprint = captureFingerprint(parsed);
    const knownCapture = this.captureFingerprints.get(capture);
    if (knownCapture && knownCapture !== fingerprint)
      return { code: "capture_event_conflict" };

    const interpretation = interpretationKey(parsed);
    const knownOutcome = this.interpretationOutcomes.get(interpretation);
    const declaredOutcome = outcomeHash(parsed);
    if (knownOutcome && knownOutcome !== declaredOutcome)
      return { code: "interpretation_conflict" };

    const receipt: AcceptedReceiptV2 = {
      contract_version: "v2",
      receipt_id: `receipt-${this.nextReceipt}`,
      source_key: parsed.source_key,
      submission_id: parsed.submission_id,
      capture_event_id: parsed.capture.capture_event_id,
      accepted_submission_hash: hash,
      accepted_at: "2026-09-24T00:00:00.000Z",
      state: "accepted",
      duplicate_delivery: false,
    };
    this.nextReceipt += 1;
    this.submissions.set(key, receipt);
    this.submissionHashes.set(key, hash);
    this.captureFingerprints.set(capture, fingerprint);
    this.interpretationOutcomes.set(interpretation, declaredOutcome);
    return receipt;
  }

  async progress(
    receiptId: string,
    afterSequence = 0,
  ): Promise<readonly ReceiptProgressV2[]> {
    const progress = this.terminalProgress.get(receiptId);
    if (!progress || progress.sequence <= afterSequence) return [];
    return [progress];
  }

  seedReference(input: DurableSubmissionV2): Promise<void> {
    const reference = referenceDetails(durableSubmissionV2Schema.parse(input));
    if (!reference)
      return Promise.reject(new Error("Expected reference input"));
    this.references.set(reference.key, canonicalJson(reference.binding));
    return Promise.resolve();
  }

  invalidateReference(input: DurableSubmissionV2): Promise<void> {
    const reference = referenceDetails(durableSubmissionV2Schema.parse(input));
    if (!reference)
      return Promise.reject(new Error("Expected reference input"));
    this.references.delete(reference.key);
    return Promise.resolve();
  }

  recordTerminalProgress(
    receiptId: string,
    input: TerminalProgressInput,
  ): ReceiptProgressV2 {
    if (!this.receiptExists(receiptId)) throw new Error("Unknown receipt");
    if (this.terminalProgress.has(receiptId))
      throw new Error("Terminal progress already recorded");
    const progress = receiptProgressV2Schema.parse({
      contract_version: "v2",
      receipt_id: receiptId,
      sequence: 1,
      ...input,
    });
    this.terminalProgress.set(receiptId, progress);
    return progress;
  }

  private receiptExists(receiptId: string): boolean {
    return [...this.submissions.values()].some(
      (receipt) => receipt.receipt_id === receiptId,
    );
  }
}
