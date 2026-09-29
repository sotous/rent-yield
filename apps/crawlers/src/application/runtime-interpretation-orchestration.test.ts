import { describe, expect, it, vi } from "vitest";
import { durableSubmissionV2Vector } from "@rent-yield/listing-storage-contracts";
import type { RuntimeArtifact } from "./runtime-artifact-pipeline.js";
import type { ReadyFixturePreflight } from "./runtime-preflight.js";
import {
  MemoryFixtureInterpretationRegistry,
  deriveFixtureSubmissionCandidate,
  orchestrateFixtureInterpretation,
} from "./runtime-interpretation-orchestration.js";

const readyPreflight = {
  ok: true,
  run: {
    mode: "fixture",
    command: {},
    methodology: { manifest_hash: "m".repeat(64) },
    capture: {
      source_key: "synthetic-source",
      capture_event_id: "capture-1",
      allocated_at: "2026-09-24T00:00:00Z",
    },
  },
} as ReadyFixturePreflight;

describe("fixture runtime interpretation orchestration", () => {
  it("passes only a sanitized artifact to the pinned replay port and emits a typed normalized result", async () => {
    const replay = vi.fn(
      async (input: {
        run: ReadyFixturePreflight["run"];
        artifact: RuntimeArtifact;
      }) => {
        expect(input.run).toBe(readyPreflight.run);
        if (input.artifact.kind === "inline_redacted")
          expect(input.artifact.bytes).not.toContain("private@example.com");
        return {
          kind: "normalized" as const,
          observations: [],
          rental_evidence: [],
          issues: [],
        };
      },
    );
    const result = await orchestrateFixtureInterpretation(
      {
        preflight: readyPreflight,
        artifact: {
          kind: "inline_redacted",
          bytes: '{"listing":{"price":"1800000"}}',
          media_type: "application/json",
          encoding: "utf-8",
          body_sha256: "a".repeat(64),
          body_byte_length: 31,
        },
      },
      { replay, emitHealth: async () => undefined },
    );
    expect(result).toMatchObject({
      ok: true,
      interpretation: { kind: "normalized" },
    });
    expect(replay).toHaveBeenCalledOnce();
  });

  it("emits a sanitized parser-drift health event for parse failure and fails closed if health is unavailable", async () => {
    const emitHealth = vi.fn(async () => undefined);
    const input = {
      preflight: readyPreflight,
      artifact: {
        kind: "no_retained_bytes" as const,
        disposition: "policy_forbids_retention" as const,
        media_type: "application/json" as const,
        encoding: "utf-8" as const,
        body_sha256: "a".repeat(64),
        body_byte_length: 0,
      },
    };
    const replay = async () => ({
      kind: "parse_failed" as const,
      observations: [],
      rental_evidence: [],
      issues: [],
    });
    await expect(
      orchestrateFixtureInterpretation(input, { replay, emitHealth }),
    ).resolves.toMatchObject({
      ok: true,
      interpretation: { kind: "parse_failed" },
    });
    expect(emitHealth).toHaveBeenCalledWith({
      code: "parser_drift",
      severity: "error",
      source_key: "synthetic-source",
      capture_event_id: "capture-1",
      methodology_manifest_hash: "m".repeat(64),
    });
    await expect(
      orchestrateFixtureInterpretation(input, {
        replay,
        emitHealth: async () => {
          throw new Error("raw port error");
        },
      }),
    ).resolves.toEqual({ ok: false, error: { code: "health_unavailable" } });
  });

  it("keeps capture and five-field interpretation identity immutable while allowing exact replay", () => {
    const registry = new MemoryFixtureInterpretationRegistry();
    const identity = {
      source_key: "synthetic-source",
      capture_event_id: "capture-1",
      methodology_manifest_hash: "a".repeat(64),
      adapter_artifact_hash: "b".repeat(64),
      parser_version: "parser-v1",
      normalizer_version: "normalizer-v1",
      extraction_contract_hash: "c".repeat(64),
      capture_fingerprint: "capture-fingerprint-1",
      outcome_hash: "outcome-1",
    };
    expect(registry.record(identity)).toEqual({ ok: true, duplicate: false });
    expect(registry.record(identity)).toEqual({ ok: true, duplicate: true });
    expect(registry.record({ ...identity, outcome_hash: "changed" })).toEqual({
      ok: false,
      error: { code: "interpretation_conflict" },
    });
    expect(
      registry.record({ ...identity, capture_fingerprint: "changed" }),
    ).toEqual({
      ok: false,
      error: { code: "capture_event_conflict" },
    });
  });

  it.each(["normalized", "quarantined", "capture_only"] as const)(
    "returns %s without a parser-drift health event",
    async (kind) => {
      const emitHealth = vi.fn(async () => undefined);
      const result = await orchestrateFixtureInterpretation(
        {
          preflight: readyPreflight,
          artifact: {
            kind: "no_retained_bytes",
            disposition: "policy_forbids_retention",
            media_type: "application/json",
            encoding: "utf-8",
            body_sha256: "a".repeat(64),
            body_byte_length: 0,
          },
        },
        {
          replay: async () => ({
            kind,
            observations: [],
            rental_evidence: [],
            issues: [],
          }),
          emitHealth,
        },
      );
      expect(result).toMatchObject({ ok: true, interpretation: { kind } });
      expect(emitHealth).not.toHaveBeenCalled();
    },
  );

  it("derives but does not deliver a validated V2 fixture submission candidate", () => {
    const base: Omit<typeof durableSubmissionV2Vector, "artifact" | "outcome"> =
      durableSubmissionV2Vector;
    const candidate = deriveFixtureSubmissionCandidate({
      base,
      artifact: {
        kind: "no_retained_bytes",
        disposition: "policy_forbids_retention",
        media_type: "application/json",
        encoding: "utf-8",
        body_sha256: "a".repeat(64),
        body_byte_length: 120,
      },
      interpretation: {
        kind: "capture_only",
        observations: [],
        rental_evidence: [],
        issues: [],
      },
      provenance: { fixture: true },
    });
    expect(candidate.outcome).toMatchObject({
      kind: "complete",
      outcome_kind: "capture_only",
    });
    expect(candidate.artifact.kind).toBe("no_retained_bytes");
  });
});
