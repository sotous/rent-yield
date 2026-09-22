import {
  acceptedSubmissionDigestV2,
  type AcceptedReceiptV2,
  type DurableSubmissionV2,
  type DurableSubmissionV2Error,
} from "./durable-submission-v2.js";
import { durableSubmissionV2Vector } from "./durable-submission-v2.vectors.js";
export interface DurableSubmissionV2Provider {
  accept(
    input: DurableSubmissionV2,
  ): Promise<AcceptedReceiptV2 | DurableSubmissionV2Error>;
  progress(
    receiptId: string,
    afterSequence?: number,
  ): Promise<readonly unknown[]>;
}
const isError = (
  v: AcceptedReceiptV2 | DurableSubmissionV2Error,
): v is DurableSubmissionV2Error => "code" in v;
export async function runDurableSubmissionV2Conformance(
  provider: DurableSubmissionV2Provider,
): Promise<{ passed: true }> {
  const first = await provider.accept(durableSubmissionV2Vector);
  if (isError(first)) throw new Error(first.code);
  if (
    first.accepted_submission_hash !==
    acceptedSubmissionDigestV2(durableSubmissionV2Vector)
  )
    throw new Error("accepted_submission_hash");
  const retry = await provider.accept(durableSubmissionV2Vector);
  if (isError(retry) || retry.receipt_id !== first.receipt_id)
    throw new Error("exact replay must return original receipt");
  const other = { ...durableSubmissionV2Vector, source_key: "other-source" };
  const otherReceipt = await provider.accept(other);
  if (isError(otherReceipt) || otherReceipt.receipt_id === first.receipt_id)
    throw new Error("source-scoped idempotency");
  const changed = {
    ...durableSubmissionV2Vector,
    outcome: {
      ...durableSubmissionV2Vector.outcome,
      typed_outcome: { reason_code: "changed" },
    },
  } as DurableSubmissionV2;
  const conflict = await provider.accept(changed);
  if (!isError(conflict) || conflict.code !== "submission_conflict")
    throw new Error("changed payload must conflict");
  return { passed: true };
}
