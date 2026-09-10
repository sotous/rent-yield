import { z } from "zod";
import {
  sourceCandidateSchema,
  accessAssessmentSchema,
  probeResultSchema,
  fixtureEnvelopeSchema,
  extractionContractSchema,
} from "./research.js";
import {
  methodologyManifestSchema,
  methodologyValidationReportSchema,
  methodologyReviewDecisionSchema,
  methodologyLookupSchema,
  methodologyProposalSchema,
  sourceHealthEventSchema,
} from "./methodology.js";

export const contractSchemas = {
  source_candidate: sourceCandidateSchema,
  access_assessment: accessAssessmentSchema,
  probe_result: probeResultSchema,
  fixture_envelope: fixtureEnvelopeSchema,
  extraction_contract: extractionContractSchema,
  methodology_manifest: methodologyManifestSchema,
  validation_report: methodologyValidationReportSchema,
  review_decision: methodologyReviewDecisionSchema,
  methodology_lookup: methodologyLookupSchema,
  methodology_proposal: methodologyProposalSchema,
  source_health: sourceHealthEventSchema,
} as const;

export type ContractName = keyof typeof contractSchemas;

const toDocument = (schema: z.ZodType) => z.toJSONSchema(schema);

/** JSON Schema expresses structure; runtime refinements remain authoritative. */
export const contractJsonSchemas = Object.fromEntries(
  Object.entries(contractSchemas).map(([name, schema]) => [
    name,
    toDocument(schema),
  ]),
) as Record<ContractName, ReturnType<typeof toDocument>>;
