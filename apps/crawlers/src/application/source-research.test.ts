import { describe, expect, it } from "vitest";
import { MemorySourceResearch } from "./source-research.js";

const first = "2026-09-09T12:00:00.000Z";
const later = "2026-09-10T12:00:00.000Z";
const recheck = "2026-10-01T00:00:00.000Z";
const scope = {
  source_key: "synthetic-listings",
  country_code: "CO" as const,
  city_key: "barranquilla",
  capability: "discovery" as const,
  listing_roles: ["for_rent" as const, "for_sale" as const],
};
const candidate = {
  contract_version: "v1" as const,
  candidate_id: "candidate-1",
  scope,
  homepage_url: "https://fixtures.example/",
  registered_at: first,
  evidence: [],
  unknowns: ["source permission"],
};
const evidence = {
  url: "https://fixtures.example/access-policy",
  observed_at: first,
  sha256: "a".repeat(64),
  conclusion: "Synthetic evidence marks fixture probes as allowed.",
  excerpt: null,
};

function assessment(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: "v1",
    assessment_id: "assessment-1",
    candidate_id: "candidate-1",
    scope: { ...scope, listing_roles: ["for_sale", "for_rent"] },
    assessed_at: first,
    technical_access: "allowed",
    contractual_access: "allowed",
    evidence: [evidence],
    unknowns: [],
    issues: [],
    recheck_at: recheck,
    ...overrides,
  };
}

describe("source candidate registration", () => {
  it("appends validated candidates, makes identical retries idempotent, and rejects mutation", () => {
    const research = new MemorySourceResearch();
    expect(research.registerSourceCandidate(candidate)).toMatchObject({
      ok: true,
      appended: true,
    });
    expect(research.registerSourceCandidate(candidate)).toMatchObject({
      ok: true,
      appended: false,
    });
    expect(
      research.registerSourceCandidate({
        ...candidate,
        scope: { ...scope, listing_roles: ["for_sale", "for_rent"] },
      }),
    ).toMatchObject({ ok: true, appended: false });
    expect(
      research.registerSourceCandidate({
        ...candidate,
        homepage_url: "https://changed.example/",
      }),
    ).toEqual({
      ok: false,
      error: { code: "identifier_conflict" },
    });
    expect(research.candidates()).toHaveLength(1);
  });

  it("requires a new identity for a correction and retains both versions", () => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate(candidate);
    expect(
      research.registerSourceCandidate({
        ...candidate,
        candidate_id: "candidate-2",
        supersedes_candidate_id: "candidate-1",
        registered_at: later,
        unknowns: [],
        evidence: [evidence],
      }),
    ).toMatchObject({ ok: true, appended: true });
    expect(research.candidates().map((item) => item.candidate_id)).toEqual([
      "candidate-1",
      "candidate-2",
    ]);
  });

  it("rejects an unlinked correction or a missing predecessor", () => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate(candidate);
    expect(
      research.registerSourceCandidate({
        ...candidate,
        candidate_id: "candidate-2",
        registered_at: later,
        unknowns: [],
      }),
    ).toEqual({ ok: false, error: { code: "invalid_supersession" } });
    expect(
      research.registerSourceCandidate({
        ...candidate,
        candidate_id: "candidate-3",
        supersedes_candidate_id: "missing",
        registered_at: later,
        unknowns: [],
      }),
    ).toEqual({ ok: false, error: { code: "candidate_not_found" } });
  });
});

describe("source access assessment", () => {
  it("derives allowed_for_probe from evidence instead of accepting caller authority", () => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate(candidate);
    expect(research.inspectSourceAccess(assessment())).toMatchObject({
      ok: true,
      value: { result: "allowed_for_probe" },
    });
    expect(
      research.inspectSourceAccess({
        ...assessment(),
        result: "allowed_for_probe",
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(
      research.inspectSourceAccess({ ...assessment(), scope }),
    ).toMatchObject({ ok: true, appended: false });
  });

  it.each([
    [{ technical_access: "blocked" }, "disallowed"],
    [{ contractual_access: "blocked" }, "disallowed"],
    [{ technical_access: "unknown" }, "unknown"],
    [{ contractual_access: "unknown" }, "unknown"],
    [{ contractual_access: "approval_required" }, "approval_required"],
    [{ evidence: [] }, "unknown"],
    [{ unknowns: ["license"] }, "unknown"],
    [{ issues: [{ code: "policy_conflict", severity: "error" }] }, "unknown"],
  ])("fails closed for %o", (override, expected) => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate(candidate);
    const result = research.inspectSourceAccess(assessment(override));
    expect(result).toMatchObject({ ok: true, value: { result: expected } });
  });

  it("rejects assessments without a candidate or with a non-forward recheck time", () => {
    const research = new MemorySourceResearch();
    expect(research.inspectSourceAccess(assessment())).toEqual({
      ok: false,
      error: { code: "candidate_not_found" },
    });
    research.registerSourceCandidate(candidate);
    expect(
      research.inspectSourceAccess(assessment({ candidate_id: "missing" })),
    ).toEqual({ ok: false, error: { code: "candidate_not_found" } });
    expect(
      research.inspectSourceAccess(
        assessment({ scope: { ...scope, city_key: "cartagena" } }),
      ),
    ).toEqual({ ok: false, error: { code: "candidate_not_found" } });
    expect(
      research.inspectSourceAccess(assessment({ recheck_at: first })),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
  });

  it("uses the latest assessment, invalidates changed policy, and expires closed", () => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate(candidate);
    research.inspectSourceAccess(assessment());
    expect(
      research.probeAccess({ scope, as_of: "2026-09-15T00:00:00.000Z" }),
    ).toMatchObject({
      permitted: true,
      assessment_id: "assessment-1",
      assessment_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    research.inspectSourceAccess(
      assessment({
        assessment_id: "assessment-2",
        assessed_at: later,
        contractual_access: "blocked",
      }),
    );
    expect(
      research.probeAccess({ scope, as_of: "2026-09-15T00:00:00.000Z" }),
    ).toMatchObject({
      permitted: false,
      reason: "disallowed",
      assessment_id: "assessment-2",
      assessment_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(
      research.probeAccess({ scope, as_of: "2026-10-02T00:00:00.000Z" }),
    ).toMatchObject({
      permitted: false,
      reason: "assessment_expired",
      assessment_id: "assessment-2",
      assessment_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("fails closed when latest assessment times conflict", () => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate(candidate);
    research.inspectSourceAccess(assessment());
    research.inspectSourceAccess(
      assessment({
        assessment_id: "assessment-2",
        contractual_access: "blocked",
      }),
    );
    expect(research.probeAccess({ scope, as_of: later })).toEqual({
      permitted: false,
      reason: "ambiguous_assessment",
    });
  });

  it("invalidates inherited access when the candidate is corrected", () => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate(candidate);
    research.inspectSourceAccess(assessment());
    research.registerSourceCandidate({
      ...candidate,
      candidate_id: "candidate-2",
      supersedes_candidate_id: "candidate-1",
      registered_at: later,
      unknowns: [],
      evidence: [evidence],
    });
    expect(
      research.probeAccess({ scope, as_of: "2026-09-15T00:00:00.000Z" }),
    ).toEqual({ permitted: false, reason: "access_unknown" });
    expect(
      research.inspectSourceAccess(
        assessment({
          assessment_id: "assessment-2",
          candidate_id: "candidate-2",
          assessed_at: later,
        }),
      ),
    ).toMatchObject({ ok: true, value: { result: "allowed_for_probe" } });
    expect(
      research.probeAccess({ scope, as_of: "2026-09-15T00:00:00.000Z" }),
    ).toMatchObject({ permitted: true, assessment_id: "assessment-2" });
  });
});
