import { createHash } from "node:crypto";
import {
  accessAssessmentSchema,
  canonicalJson,
  canonicalSet,
  instantSchema,
  researchScopeSchema,
  sourceCandidateSchema,
  type AccessAssessment,
  type ResearchScope,
  type SourceCandidate,
} from "@rent-yield/listing-storage-contracts";
import { z } from "zod";
import type { ProbeConstraints } from "../ports/probe-transport.js";

const assessmentInputSchema = accessAssessmentSchema.omit({ result: true });
type AssessmentInput = z.infer<typeof assessmentInputSchema>;

type InputIssue = { code: string; path: Array<string | number> };
type ResearchError =
  | { code: "invalid_input"; issues: InputIssue[] }
  | { code: "identifier_conflict" }
  | { code: "invalid_supersession" }
  | { code: "candidate_not_found" };

type AppendResult<T> =
  | { ok: true; value: T; appended: boolean }
  | { ok: false; error: ResearchError };

type ProbeAccess =
  | {
      permitted: true;
      assessment_id: string;
      assessment_sha256: string;
      constraints: ProbeConstraints;
    }
  | {
      permitted: false;
      reason:
        | AccessAssessment["result"]
        | "access_unknown"
        | "assessment_expired"
        | "ambiguous_assessment"
        | "invalid_input";
      assessment_id?: string;
      assessment_sha256?: string;
    };

function issues(error: z.ZodError): InputIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.map((part) =>
      typeof part === "number" ? part : String(part),
    ),
  }));
}

function scopeKey(scope: ResearchScope): string {
  return canonicalJson({
    ...scope,
    listing_roles: canonicalSet(scope.listing_roles),
  });
}

function candidateIdentity(value: SourceCandidate): string {
  return canonicalJson({
    ...value,
    scope: {
      ...value.scope,
      listing_roles: canonicalSet(value.scope.listing_roles),
    },
  });
}

function assessmentIdentity(value: AccessAssessment): string {
  return canonicalJson({
    ...value,
    scope: {
      ...value.scope,
      listing_roles: canonicalSet(value.scope.listing_roles),
    },
  });
}

function assessmentDigest(value: AccessAssessment): string {
  return createHash("sha256")
    .update(assessmentIdentity(value), "utf8")
    .digest("hex");
}

const defaultProbeBudget: ProbeConstraints["budget"] = {
  max_requests: 3,
  max_bytes: 1024,
  max_duration_ms: 1000,
  max_redirects: 1,
  max_concurrency: 1,
  max_source_requests: 4,
};

function assessmentResult(input: AssessmentInput): AccessAssessment["result"] {
  if (
    input.technical_access === "blocked" ||
    input.contractual_access === "blocked"
  ) {
    return "disallowed";
  }
  if (
    input.technical_access === "unknown" ||
    input.contractual_access === "unknown"
  ) {
    return "unknown";
  }
  if (input.contractual_access === "approval_required") {
    return "approval_required";
  }
  if (
    input.evidence.length === 0 ||
    input.unknowns.length > 0 ||
    input.issues.some((issue) => issue.severity === "error")
  ) {
    return "unknown";
  }
  return "allowed_for_probe";
}

/** Append-only, fixture-only research repository. No method performs I/O. */
export class MemorySourceResearch {
  readonly #candidates = new Map<
    string,
    { canonical: string; value: SourceCandidate }
  >();
  readonly #assessments = new Map<
    string,
    { canonical: string; value: AccessAssessment }
  >();

  registerSourceCandidate(input: unknown): AppendResult<SourceCandidate> {
    const parsed = sourceCandidateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: "invalid_input", issues: issues(parsed.error) },
      };
    }
    const canonical = candidateIdentity(parsed.data);
    const existing = this.#candidates.get(parsed.data.candidate_id);
    if (existing) {
      return existing.canonical === canonical
        ? { ok: true, value: structuredClone(existing.value), appended: false }
        : { ok: false, error: { code: "identifier_conflict" } };
    }
    const sameScope = [...this.#candidates.values()].filter(
      ({ value }) => scopeKey(value.scope) === scopeKey(parsed.data.scope),
    );
    if (parsed.data.supersedes_candidate_id === undefined) {
      if (sameScope.length > 0) {
        return { ok: false, error: { code: "invalid_supersession" } };
      }
    } else {
      const predecessor = this.#candidates.get(
        parsed.data.supersedes_candidate_id,
      )?.value;
      if (!predecessor) {
        return { ok: false, error: { code: "candidate_not_found" } };
      }
      const alreadySuperseded = sameScope.some(
        ({ value }) =>
          value.supersedes_candidate_id === predecessor.candidate_id,
      );
      if (
        scopeKey(predecessor.scope) !== scopeKey(parsed.data.scope) ||
        parsed.data.registered_at <= predecessor.registered_at ||
        alreadySuperseded
      ) {
        return { ok: false, error: { code: "invalid_supersession" } };
      }
    }
    this.#candidates.set(parsed.data.candidate_id, {
      canonical,
      value: structuredClone(parsed.data),
    });
    return { ok: true, value: structuredClone(parsed.data), appended: true };
  }

  inspectSourceAccess(input: unknown): AppendResult<AccessAssessment> {
    const parsed = assessmentInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: "invalid_input", issues: issues(parsed.error) },
      };
    }
    if (parsed.data.recheck_at <= parsed.data.assessed_at) {
      return {
        ok: false,
        error: {
          code: "invalid_input",
          issues: [{ code: "invalid_interval", path: ["recheck_at"] }],
        },
      };
    }
    const candidate = this.#candidates.get(parsed.data.candidate_id)?.value;
    if (
      !candidate ||
      scopeKey(candidate.scope) !== scopeKey(parsed.data.scope) ||
      candidate.registered_at > parsed.data.assessed_at
    ) {
      return { ok: false, error: { code: "candidate_not_found" } };
    }
    const value = accessAssessmentSchema.parse({
      ...parsed.data,
      result: assessmentResult(parsed.data),
    });
    const canonical = assessmentIdentity(value);
    const existing = this.#assessments.get(value.assessment_id);
    if (existing) {
      return existing.canonical === canonical
        ? { ok: true, value: structuredClone(existing.value), appended: false }
        : { ok: false, error: { code: "identifier_conflict" } };
    }
    this.#assessments.set(value.assessment_id, {
      canonical,
      value: structuredClone(value),
    });
    return { ok: true, value: structuredClone(value), appended: true };
  }

  probeAccess(input: { scope: unknown; as_of: unknown }): ProbeAccess {
    const parsedScope = researchScopeSchema.safeParse(input.scope);
    const parsedTime = instantSchema.safeParse(input.as_of);
    if (!parsedScope.success || !parsedTime.success) {
      return { permitted: false, reason: "invalid_input" };
    }
    const key = scopeKey(parsedScope.data);
    const candidates = [...this.#candidates.values()]
      .map(({ value }) => value)
      .filter(
        (value) =>
          scopeKey(value.scope) === key &&
          value.registered_at <= parsedTime.data,
      );
    const currentCandidates = candidates.filter(
      (candidate) =>
        !candidates.some(
          (possibleSuccessor) =>
            possibleSuccessor.supersedes_candidate_id ===
            candidate.candidate_id,
        ),
    );
    if (currentCandidates.length !== 1) {
      return { permitted: false, reason: "access_unknown" };
    }
    const currentCandidate = currentCandidates[0]!;
    const eligible = [...this.#assessments.values()]
      .map(({ value }) => value)
      .filter(
        (value) =>
          value.candidate_id === currentCandidate.candidate_id &&
          scopeKey(value.scope) === key &&
          value.assessed_at <= parsedTime.data,
      );
    if (eligible.length === 0) {
      return { permitted: false, reason: "access_unknown" };
    }
    const latestTime = eligible.reduce(
      (latest, value) =>
        value.assessed_at > latest ? value.assessed_at : latest,
      eligible[0]!.assessed_at,
    );
    const latest = eligible.filter((value) => value.assessed_at === latestTime);
    if (latest.length !== 1) {
      return { permitted: false, reason: "ambiguous_assessment" };
    }
    const assessment = latest[0]!;
    if (parsedTime.data >= assessment.recheck_at) {
      return {
        permitted: false,
        reason: "assessment_expired",
        assessment_id: assessment.assessment_id,
        assessment_sha256: assessmentDigest(assessment),
      };
    }
    if (assessment.result !== "allowed_for_probe") {
      return {
        permitted: false,
        reason: assessment.result,
        assessment_id: assessment.assessment_id,
        assessment_sha256: assessmentDigest(assessment),
      };
    }
    return {
      permitted: true,
      assessment_id: assessment.assessment_id,
      assessment_sha256: assessmentDigest(assessment),
      constraints: {
        allowed_hosts: [new URL(currentCandidate.homepage_url).hostname],
        allowed_path_prefixes: [
          new URL(currentCandidate.homepage_url).pathname,
        ],
        budget: { ...defaultProbeBudget },
      },
    };
  }

  candidates(): SourceCandidate[] {
    return [...this.#candidates.values()].map(({ value }) =>
      structuredClone(value),
    );
  }

  assessments(): AccessAssessment[] {
    return [...this.#assessments.values()].map(({ value }) =>
      structuredClone(value),
    );
  }
}
