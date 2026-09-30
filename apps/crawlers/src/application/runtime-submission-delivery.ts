import {
  acceptedReceiptV2Schema,
  acceptedSubmissionDigestV2,
  durableSubmissionV2ErrorSchema,
  type AcceptedReceiptV2,
  type DurableSubmissionV2,
  type DurableSubmissionV2Error,
  type DurableSubmissionV2Provider,
} from "@rent-yield/listing-storage-contracts";

export type FixtureSubmissionDeliveryResult =
  | { ok: true; receipt: AcceptedReceiptV2 }
  | { ok: false; error: DurableSubmissionV2Error };

/**
 * Delivers an already validated normalized candidate. Storage owns every
 * durable receipt and idempotency decision; this adapter retains nothing.
 */
export async function deliverFixtureSubmissionCandidate(
  candidate: DurableSubmissionV2,
  provider: DurableSubmissionV2Provider,
): Promise<FixtureSubmissionDeliveryResult> {
  let response: unknown;
  try {
    response = await provider.accept(candidate);
  } catch {
    return { ok: false, error: { code: "storage_unavailable" } };
  }

  const refusal = durableSubmissionV2ErrorSchema.safeParse(response);
  if (refusal.success) return { ok: false, error: refusal.data };

  const receipt = acceptedReceiptV2Schema.safeParse(response);
  if (
    !receipt.success ||
    receipt.data.source_key !== candidate.source_key ||
    receipt.data.submission_id !== candidate.submission_id ||
    receipt.data.capture_event_id !== candidate.capture.capture_event_id ||
    receipt.data.accepted_submission_hash !==
      acceptedSubmissionDigestV2(candidate)
  )
    return { ok: false, error: { code: "storage_unavailable" } };
  return { ok: true, receipt: receipt.data };
}
