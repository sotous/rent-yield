import {
  methodologyLookupSchema,
  methodologyManifestDigest,
  methodologyProposalSchema,
  methodologyReviewDecisionSchema,
  methodologyValidationReportDigest,
  sourceHealthEventSchema,
  type MethodologyLookupV1,
  type MethodologyProposalV1,
  type MethodologyReviewDecisionV1,
  type SourceHealthEventV1,
} from "@rent-yield/listing-storage-contracts";
import type { AdapterRegistration } from "./methodology-validation.js";

type LookupError =
  | "invalid_input"
  | "not_found"
  | "ambiguous_methodology"
  | "hash_mismatch"
  | "incompatible_adapter"
  | "policy_blocked";

type RegisteredProposal = {
  proposal: MethodologyProposalV1;
  decisions: MethodologyReviewDecisionV1[];
};

const adapterIsRegistered = (
  proposal: MethodologyProposalV1,
  adapters: readonly AdapterRegistration[],
): boolean => {
  const registered = adapters.find(
    (candidate) => candidate.key === proposal.manifest.adapter.key,
  );
  return Boolean(
    registered &&
    registered.artifact_hash === proposal.manifest.adapter.artifact_hash &&
    registered.parser_version === proposal.manifest.adapter.parser_version &&
    registered.normalizer_version ===
      proposal.manifest.adapter.normalizer_version &&
    registered.supported_contract_version ===
      proposal.manifest.adapter.supported_contract_version &&
    registered.strategies.includes(proposal.manifest.strategy),
  );
};

function proposalIsIntact(proposal: MethodologyProposalV1): boolean {
  return (
    methodologyManifestDigest(proposal.manifest) === proposal.manifest_hash &&
    methodologyValidationReportDigest(proposal.validation_report) ===
      proposal.validation_report_hash
  );
}

const matchesScope = (
  proposal: MethodologyProposalV1,
  lookup: MethodologyLookupV1,
): boolean => {
  const { scope } = proposal.manifest;
  return (
    scope.source_key === lookup.source_key &&
    scope.country_code === lookup.country_code &&
    scope.city_key === lookup.city_key &&
    scope.capability === lookup.capability &&
    scope.listing_roles.includes(lookup.listing_role)
  );
};

const effectiveDecision = (
  decisions: readonly MethodologyReviewDecisionV1[],
  lookup: MethodologyLookupV1,
): MethodologyReviewDecisionV1 | null => {
  const applicable = decisions.filter(
    (decision) =>
      decision.recorded_at <= lookup.recorded_as_of &&
      decision.effective_from <= lookup.effective_at &&
      (decision.effective_to === null ||
        lookup.effective_at < decision.effective_to),
  );
  if (applicable.length === 0) return null;
  return applicable.reduce((latest, decision) =>
    decision.sequence > latest.sequence ? decision : latest,
  );
};

const healthBlocks = (
  event: SourceHealthEventV1,
  proposal: MethodologyProposalV1,
  approval: MethodologyReviewDecisionV1,
  lookup: MethodologyLookupV1,
): boolean =>
  event.severity === "error" &&
  event.source_key === proposal.manifest.scope.source_key &&
  (event.methodology_hash === null ||
    event.methodology_hash === proposal.manifest_hash) &&
  event.occurred_at >= approval.effective_from &&
  event.occurred_at <= lookup.effective_at &&
  event.occurred_at <= lookup.recorded_as_of;

/** In-memory trusted-review fixture. It cannot reach a source or authorize one. */
export class MemoryMethodologyReview {
  readonly #proposals = new Map<string, RegisteredProposal>();
  readonly #health = new Map<string, SourceHealthEventV1>();
  #sequence = 0;
  readonly #adapters: readonly AdapterRegistration[];

  constructor(adapters: readonly AdapterRegistration[]) {
    this.#adapters = adapters;
  }

  registerProposal(input: unknown):
    | { ok: true; appended: boolean }
    | {
        ok: false;
        error: {
          code: "invalid_input" | "hash_mismatch" | "incompatible_adapter";
        };
      } {
    const parsed = methodologyProposalSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
    const proposal = parsed.data;
    if (!proposalIsIntact(proposal))
      return { ok: false, error: { code: "hash_mismatch" } };
    if (!adapterIsRegistered(proposal, this.#adapters))
      return { ok: false, error: { code: "incompatible_adapter" } };
    if (this.#proposals.has(proposal.manifest_hash))
      return { ok: true, appended: false };
    this.#proposals.set(proposal.manifest_hash, { proposal, decisions: [] });
    return { ok: true, appended: true };
  }

  recordTrustedDecision(input: unknown):
    | { ok: true; decision: MethodologyReviewDecisionV1 }
    | {
        ok: false;
        error: { code: "invalid_input" | "not_found" | "hash_mismatch" };
      } {
    if (input === null || typeof input !== "object")
      return { ok: false, error: { code: "invalid_input" } };
    const inputRecord = input as Record<string, unknown>;
    if ("sequence" in inputRecord || inputRecord.contract_version !== "v1")
      return { ok: false, error: { code: "invalid_input" } };
    const candidate = {
      ...inputRecord,
      contract_version: "v1",
      sequence: this.#sequence + 1,
    };
    const parsed = methodologyReviewDecisionSchema.safeParse(candidate);
    if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
    const stored = this.#proposals.get(parsed.data.manifest_hash);
    if (!stored) return { ok: false, error: { code: "not_found" } };
    if (
      parsed.data.decision === "approved" &&
      (parsed.data.validation_report_hash !==
        stored.proposal.validation_report_hash ||
        stored.proposal.validation_report.outcome !== "passed")
    )
      return { ok: false, error: { code: "invalid_input" } };
    if (
      stored.decisions.some(
        (event) => event.decision_event_id === parsed.data.decision_event_id,
      )
    )
      return { ok: false, error: { code: "invalid_input" } };
    this.#sequence = parsed.data.sequence;
    stored.decisions.push(parsed.data);
    return { ok: true, decision: structuredClone(parsed.data) };
  }

  recordHealthEvent(
    input: unknown,
  ):
    | { ok: true; appended: boolean }
    | { ok: false; error: { code: "invalid_input" } } {
    const parsed = sourceHealthEventSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
    if (this.#health.has(parsed.data.event_id))
      return { ok: true, appended: false };
    this.#health.set(parsed.data.event_id, parsed.data);
    return { ok: true, appended: true };
  }

  resolve(input: unknown):
    | {
        ok: true;
        methodology: {
          manifest_hash: string;
          manifest: MethodologyProposalV1["manifest"];
          decision: MethodologyReviewDecisionV1;
        };
      }
    | { ok: false; error: { code: LookupError } } {
    const parsed = methodologyLookupSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
    const lookup = parsed.data;
    const scoped = [...this.#proposals.values()].filter(({ proposal }) =>
      matchesScope(proposal, lookup),
    );
    if (scoped.length === 0) return { ok: false, error: { code: "not_found" } };
    if (scoped.some(({ proposal }) => !proposalIsIntact(proposal)))
      return { ok: false, error: { code: "hash_mismatch" } };
    if (
      scoped.some(
        ({ proposal }) => !adapterIsRegistered(proposal, this.#adapters),
      )
    )
      return { ok: false, error: { code: "incompatible_adapter" } };

    const decisions = scoped.map(({ proposal, decisions: events }) => ({
      proposal,
      decision: effectiveDecision(events, lookup),
    }));
    const eligible = decisions.filter(
      (candidate) =>
        candidate.decision?.decision === "approved" &&
        lookup.effective_at < candidate.proposal.manifest.recheck_after &&
        ![...this.#health.values()].some((event) =>
          healthBlocks(event, candidate.proposal, candidate.decision!, lookup),
        ),
    );
    if (eligible.length === 1) {
      const candidate = eligible[0]!;
      return {
        ok: true,
        methodology: {
          manifest_hash: candidate.proposal.manifest_hash,
          manifest: structuredClone(candidate.proposal.manifest),
          decision: structuredClone(candidate.decision!),
        },
      };
    }
    if (eligible.length > 1)
      return { ok: false, error: { code: "ambiguous_methodology" } };
    if (
      decisions.some(
        (candidate) =>
          candidate.decision?.decision === "approved" &&
          [...this.#health.values()].some((event) =>
            healthBlocks(
              event,
              candidate.proposal,
              candidate.decision!,
              lookup,
            ),
          ),
      ) ||
      decisions.some(
        (candidate) =>
          candidate.decision?.decision === "approved" &&
          lookup.effective_at >= candidate.proposal.manifest.recheck_after,
      )
    )
      return { ok: false, error: { code: "policy_blocked" } };
    return { ok: false, error: { code: "not_found" } };
  }
}
