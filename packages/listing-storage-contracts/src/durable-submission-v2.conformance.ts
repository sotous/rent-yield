import {
  acceptedSubmissionDigestV2,
  canonicalOutcomeDigestV2,
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

/** Test-only setup; production providers never expose reference issuance here. */
export interface DurableSubmissionV2ConformanceFixtures {
  seedReference(input: DurableSubmissionV2): Promise<void>;
  invalidateReference(input: DurableSubmissionV2): Promise<void>;
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

const referenceDetails = (input: DurableSubmissionV2) => {
  if (
    input.artifact.kind === "staged_reference" ||
    input.artifact.kind === "verified_immutable_reference"
  )
    return {
      reference: input.artifact,
      error:
        input.artifact.kind === "staged_reference"
          ? ("staged_reference_invalid" as const)
          : ("artifact_unverified" as const),
    };
  if (input.outcome.kind === "verified_immutable_reference")
    return {
      reference: input.outcome.reference,
      error: "outcome_unverified" as const,
    };
  return null;
};

/** Keep mutations schema-valid so provider binding checks, not parsing, are tested. */
function mutateReference(
  input: DurableSubmissionV2,
  mutate: (draft: Record<string, unknown>) => void,
): DurableSubmissionV2 {
  const draft = structuredClone(input) as Record<string, unknown>;
  mutate(draft);
  return durableSubmissionV2Schema.parse(draft);
}

function setReferenceId(draft: Record<string, unknown>, value: string): void {
  const artifact = draft.artifact as Record<string, unknown>;
  const outcome = draft.outcome as Record<string, unknown>;
  if (
    artifact.kind === "staged_reference" ||
    artifact.kind === "verified_immutable_reference"
  )
    artifact.reference_id = value;
  else (outcome.reference as Record<string, unknown>).reference_id = value;
}

function mutateReferenceBinding(
  draft: Record<string, unknown>,
  key:
    | "source_key"
    | "capture_event_id"
    | "retention_policy_hash"
    | "interpretation",
  value: unknown,
): void {
  const artifact = draft.artifact as Record<string, unknown>;
  const outcome = draft.outcome as Record<string, unknown>;
  const reference =
    artifact.kind === "staged_reference" ||
    artifact.kind === "verified_immutable_reference"
      ? artifact
      : (outcome.reference as Record<string, unknown>);
  reference[key] = value;
  if (key === "source_key") draft.source_key = value;
  if (key === "capture_event_id")
    (draft.capture as Record<string, unknown>).capture_event_id = value;
  if (key === "retention_policy_hash")
    (draft.capture as Record<string, unknown>).retention_policy_hash = value;
  if (key === "interpretation") draft.interpretation = value;
}

function mutateArtifactEvidence(
  draft: Record<string, unknown>,
  key:
    | "referenced_artifact_hash"
    | "body_sha256"
    | "body_byte_length"
    | "media_type"
    | "encoding",
  value: unknown,
): void {
  const artifact = draft.artifact as Record<string, unknown>;
  artifact[key] = value;
  if (key === "referenced_artifact_hash" || key === "body_sha256") {
    artifact.referenced_artifact_hash = value;
    artifact.body_sha256 = value;
  }
  const response = (draft.capture as Record<string, unknown>)
    .response as Record<string, unknown>;
  if (key === "referenced_artifact_hash" || key === "body_sha256")
    response.body_sha256 = value;
  else if (key === "body_byte_length") response.body_byte_length = value;
  else if (key === "media_type") response.media_type = value;
  else response.content_encoding = value;
}

async function assertReferenceRejections(
  provider: DurableSubmissionV2Provider,
  fixtures: DurableSubmissionV2ConformanceFixtures,
  vector: DurableSubmissionV2,
  index: number,
): Promise<void> {
  const details = referenceDetails(vector);
  if (!details) return;
  const seeded = rekey(vector, `reference-negative-${index}`);
  await fixtures.seedReference(seeded);

  await expectError(
    provider,
    mutateReference(seeded, (draft) =>
      setReferenceId(draft, `unknown-reference-${index}`),
    ),
    details.error,
  );
  await fixtures.invalidateReference(seeded);
  await expectError(provider, seeded, details.error);

  const bindings: ReadonlyArray<
    readonly [
      (
        | "source_key"
        | "capture_event_id"
        | "retention_policy_hash"
        | "interpretation"
      ),
      unknown,
    ]
  > = [
    ["source_key", `other-source-${index}`],
    ["capture_event_id", `other-capture-${index}`],
    ["retention_policy_hash", "9".repeat(64)],
    ...(
      [
        "methodology_manifest_hash",
        "adapter_artifact_hash",
        "parser_version",
        "normalizer_version",
        "extraction_contract_hash",
      ] as const
    ).map(
      (field) =>
        [
          "interpretation",
          {
            ...seeded.interpretation,
            [field]: field.endsWith("hash")
              ? "9".repeat(64)
              : `other-${field}-${index}`,
          },
        ] as const,
    ),
  ];
  for (const [key, value] of bindings) {
    const fresh = rekey(vector, `reference-binding-${index}-${key}`);
    await fixtures.seedReference(fresh);
    await expectError(
      provider,
      mutateReference(fresh, (draft) =>
        mutateReferenceBinding(draft, key, value),
      ),
      details.error,
    );
  }

  if (
    seeded.artifact.kind === "staged_reference" ||
    seeded.artifact.kind === "verified_immutable_reference"
  ) {
    const evidence: ReadonlyArray<
      readonly [
        (
          | "referenced_artifact_hash"
          | "body_sha256"
          | "body_byte_length"
          | "media_type"
          | "encoding"
        ),
        unknown,
      ]
    > = [
      ["referenced_artifact_hash", "8".repeat(64)],
      ["body_sha256", "8".repeat(64)],
      ["body_byte_length", 121],
      ["media_type", "text/html"],
      ["encoding", "latin-1"],
    ];
    for (const [key, value] of evidence) {
      const fresh = rekey(vector, `reference-evidence-${index}-${key}`);
      await fixtures.seedReference(fresh);
      await expectError(
        provider,
        mutateReference(fresh, (draft) =>
          mutateArtifactEvidence(draft, key, value),
        ),
        details.error,
      );
    }
  } else {
    const fresh = rekey(vector, `reference-outcome-${index}`);
    await fixtures.seedReference(fresh);
    await expectError(
      provider,
      mutateReference(fresh, (draft) => {
        const outcome = draft.outcome as Record<string, unknown>;
        (outcome.reference as Record<string, unknown>).referenced_outcome_hash =
          "8".repeat(64);
      }),
      details.error,
    );
  }
}

async function assertProgress(
  provider: DurableSubmissionV2Provider,
  receipt: AcceptedReceiptV2,
): Promise<void> {
  const raw = await provider.progress(receipt.receipt_id);
  if (!Array.isArray(raw)) throw new Error("receipt progress must be an array");
  if (raw.length > 1) throw new Error("receipt progress is terminal");
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
  fixtures?: DurableSubmissionV2ConformanceFixtures,
): Promise<{ passed: true }> {
  // All artifact representations must be accepted when they meet the schema.
  const acceptanceVectors = [
    ...durableSubmissionV2ArtifactVectors,
    durableSubmissionV2OutcomeReferenceVector,
  ];
  if (!fixtures)
    throw new Error("reference conformance requires seeded-reference fixtures");
  for (const [index, vector] of acceptanceVectors.entries()) {
    const input = rekey(vector, `artifact-${index + 1}`);
    if (
      input.artifact.kind === "staged_reference" ||
      input.artifact.kind === "verified_immutable_reference" ||
      input.outcome.kind === "verified_immutable_reference"
    )
      await fixtures.seedReference(input);
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
    await assertReferenceRejections(provider, fixtures, vector, index + 1);
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
        canonical_outcome_hash: canonicalOutcomeDigestV2({
          outcome_kind: "capture_only",
          typed_outcome: { reason_code: "changed" },
          provenance: { extraction_trace_hash: "3".repeat(64) },
        }),
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
  const reinterpretation = durableSubmissionV2Schema.parse({
    ...base,
    submission_id: "submission-reinterpretation",
    interpretation: { ...base.interpretation, parser_version: "parser-v3" },
  });
  parseAccepted(await provider.accept(reinterpretation), reinterpretation);
  await expectError(
    provider,
    durableSubmissionV2Schema.parse({
      ...base,
      submission_id: "submission-interpretation-conflict",
      outcome: {
        kind: "complete",
        canonical_outcome_hash: canonicalOutcomeDigestV2({
          outcome_kind: "capture_only",
          typed_outcome: { reason_code: "changed-hash" },
          provenance: { extraction_trace_hash: "2".repeat(64) },
        }),
        outcome_kind: "capture_only",
        typed_outcome: { reason_code: "changed-hash" },
        provenance: { extraction_trace_hash: "2".repeat(64) },
      },
    }),
    "interpretation_conflict",
  );

  return { passed: true };
}
