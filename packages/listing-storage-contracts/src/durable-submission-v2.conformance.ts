import {
  acceptedSubmissionDigestV2,
  acceptedReceiptV2Schema,
  durableSubmissionV2ErrorSchema,
  durableSubmissionV2Schema,
  receiptProgressV2Schema,
  type AcceptedReceiptV2,
  type DurableSubmissionV2,
  type DurableSubmissionV2Error,
  type ReceiptProgressV2,
} from "./durable-submission-v2.js";
import {
  durableSubmissionV2ArtifactVectors,
  durableSubmissionV2OutcomeReferenceVector,
  durableSubmissionV2Vector,
} from "./durable-submission-v2.vectors.js";

/**
 * Provider boundary only: implementations must not import crawler runtime types.
 * Unknown return values are parsed at this boundary so conformance proves the
 * wire contract, rather than trusting a provider's TypeScript declaration.
 */
export interface DurableSubmissionV2Provider {
  accept(
    input: DurableSubmissionV2,
  ): Promise<AcceptedReceiptV2 | DurableSubmissionV2Error>;
  progress(
    receiptId: string,
    afterSequence?: number,
  ): Promise<readonly ReceiptProgressV2[]>;
}

const isError = (value: unknown): value is DurableSubmissionV2Error =>
  typeof value === "object" && value !== null && "code" in value;

function parseAccepted(
  value: unknown,
  input: DurableSubmissionV2,
): AcceptedReceiptV2 {
  if (isError(value)) {
    const error = durableSubmissionV2ErrorSchema.parse(value);
    throw new Error(`unexpected provider error: ${error.code}`);
  }
  const receipt = acceptedReceiptV2Schema.parse(value);
  if (receipt.accepted_submission_hash !== acceptedSubmissionDigestV2(input))
    throw new Error("accepted_submission_hash");
  if (
    receipt.source_key !== input.source_key ||
    receipt.submission_id !== input.submission_id ||
    receipt.capture_event_id !== input.capture.capture_event_id ||
    receipt.state !== "accepted"
  )
    throw new Error("accepted receipt identity");
  return receipt;
}

function rekey(
  input: DurableSubmissionV2,
  suffix: string,
): DurableSubmissionV2 {
  const capture_event_id = `capture-${suffix}`;
  const updateBinding = <T extends Record<string, unknown>>(binding: T): T => ({
    ...binding,
    capture_event_id,
  });
  const artifact =
    input.artifact.kind === "staged_reference" ||
    input.artifact.kind === "verified_immutable_reference"
      ? updateBinding(input.artifact)
      : input.artifact;
  const outcome =
    input.outcome.kind === "verified_immutable_reference"
      ? { ...input.outcome, reference: updateBinding(input.outcome.reference) }
      : input.outcome;
  return durableSubmissionV2Schema.parse({
    ...input,
    submission_id: `submission-${suffix}`,
    capture: { ...input.capture, capture_event_id },
    artifact,
    outcome,
  });
}

async function expectError(
  provider: DurableSubmissionV2Provider,
  input: DurableSubmissionV2,
  code: DurableSubmissionV2Error["code"],
): Promise<void> {
  const value = await provider.accept(input);
  if (!isError(value)) throw new Error(`expected ${code}`);
  const error = durableSubmissionV2ErrorSchema.parse(value);
  if (error.code !== code)
    throw new Error(`expected ${code}, got ${error.code}`);
}

async function assertProgress(
  provider: DurableSubmissionV2Provider,
  receipt: AcceptedReceiptV2,
): Promise<void> {
  const raw = await provider.progress(receipt.receipt_id);
  if (!Array.isArray(raw)) throw new Error("receipt progress must be an array");
  let previous = 0;
  for (const event of raw) {
    const parsed: ReceiptProgressV2 = receiptProgressV2Schema.parse(event);
    if (parsed.receipt_id !== receipt.receipt_id || parsed.sequence <= previous)
      throw new Error(
        "receipt progress must be ordered and bound to its receipt",
      );
    previous = parsed.sequence;
  }
}

/** Runs canonical provider-facing V2 behavior against a provider adapter. */
export async function runDurableSubmissionV2Conformance(
  provider: DurableSubmissionV2Provider,
): Promise<{ passed: true }> {
  // All artifact representations must be accepted when they meet the schema.
  const acceptanceVectors = [
    ...durableSubmissionV2ArtifactVectors,
    durableSubmissionV2OutcomeReferenceVector,
  ];
  for (const [index, vector] of acceptanceVectors.entries()) {
    const input = rekey(vector, `artifact-${index + 1}`);
    const first = parseAccepted(await provider.accept(input), input);
    if (first.duplicate_delivery)
      throw new Error("first acceptance marked duplicate");
    const retry = parseAccepted(await provider.accept(input), input);
    if (
      retry.receipt_id !== first.receipt_id ||
      retry.accepted_submission_hash !== first.accepted_submission_hash
    )
      throw new Error("exact replay must return the original receipt");
    await assertProgress(provider, first);
  }

  // A submission id scopes only to a source, while payload changes under that
  // same pair must fail closed.
  const base = rekey(durableSubmissionV2Vector, "idempotency");
  const first = parseAccepted(await provider.accept(base), base);
  const otherSource = durableSubmissionV2Schema.parse({
    ...base,
    source_key: "other-source",
    // no references in the base vector, so its source identity can change alone.
  });
  const other = parseAccepted(await provider.accept(otherSource), otherSource);
  if (other.receipt_id === first.receipt_id)
    throw new Error("source-scoped idempotency");
  await expectError(
    provider,
    durableSubmissionV2Schema.parse({
      ...base,
      outcome: {
        kind: "complete",
        outcome_kind: "capture_only",
        typed_outcome: { reason_code: "changed" },
        provenance: { extraction_trace_hash: "3".repeat(64) },
      },
    }),
    "submission_conflict",
  );

  // A second submission may not redefine immutable capture or interpretation
  // identity. These use a fresh idempotency pair so the provider must expose
  // the specific conflict category rather than submission_conflict.
  await expectError(
    provider,
    durableSubmissionV2Schema.parse({
      ...base,
      submission_id: "submission-capture-conflict",
      capture: {
        ...base.capture,
        response: { ...base.capture.response, body_sha256: "4".repeat(64) },
      },
    }),
    "capture_event_conflict",
  );
  await expectError(
    provider,
    durableSubmissionV2Schema.parse({
      ...base,
      submission_id: "submission-interpretation-conflict",
      interpretation: {
        ...base.interpretation,
        parser_version: "parser-v3",
      },
    }),
    "interpretation_conflict",
  );

  return { passed: true };
}
