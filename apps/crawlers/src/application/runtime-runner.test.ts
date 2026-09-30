import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  acceptedSubmissionDigestV2,
  durableSubmissionV2Vector,
  type DurableSubmissionV2,
  type DurableSubmissionV2Provider,
} from "@rent-yield/listing-storage-contracts";
import type { ReadyFixturePreflight } from "./runtime-preflight.js";
import { runFixtureRuntime } from "./runtime-runner.js";

const preflight = {
  ok: true,
  run: {
    mode: "fixture",
    command: {},
    methodology: { manifest_hash: "b".repeat(64) },
    capture: {
      source_key: "synthetic-source",
      capture_event_id: "capture-1",
      allocated_at: "2026-09-30T00:00:00.000Z",
    },
  },
} as ReadyFixturePreflight;

const baseFor = (
  body: string,
): Omit<DurableSubmissionV2, "artifact" | "outcome"> => ({
  ...durableSubmissionV2Vector,
  capture: {
    ...durableSubmissionV2Vector.capture,
    response: {
      ...durableSubmissionV2Vector.capture.response,
      media_type: "text/plain",
      body_sha256: createHash("sha256").update(body, "utf8").digest("hex"),
      body_byte_length: Buffer.byteLength(body, "utf8"),
    },
  },
});

const provider = (): DurableSubmissionV2Provider => ({
  accept: async (input) => ({
    contract_version: "v2",
    receipt_id: "receipt-1",
    source_key: input.source_key,
    submission_id: input.submission_id,
    capture_event_id: input.capture.capture_event_id,
    accepted_submission_hash: acceptedSubmissionDigestV2(input),
    accepted_at: "2026-09-30T00:00:00.000Z",
    state: "accepted",
    duplicate_delivery: false,
  }),
  progress: async () => [],
});

describe("fixture runtime runner", () => {
  it("delivers only a normalized nonempty interpretation and returns Storage's receipt", async () => {
    const body = "listing fixture";
    await expect(
      runFixtureRuntime(
        {
          preflight,
          artifact: {
            content_type: "text/plain",
            original_bytes: new TextEncoder().encode(body),
            disposition: "inline_redacted",
          },
          submission: { base: baseFor(body), provenance: { fixture: true } },
        },
        {
          disposeOriginal: () => undefined,
          replay: async () => ({
            kind: "normalized",
            observations: [{ quality: { blocking: false } }],
            rental_evidence: [],
            issues: [],
          }),
          emitHealth: async () => undefined,
          provider: provider(),
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      result: { kind: "normalized", receipt: { receipt_id: "receipt-1" } },
    });
  });

  it("reports an artifact safety block and never calls replay or Storage after unsafe input", async () => {
    const replay = vi.fn();
    const accept = vi.fn();
    const emitHealth = vi.fn(async () => undefined);
    await expect(
      runFixtureRuntime(
        {
          preflight,
          artifact: {
            content_type: "text/plain",
            original_bytes: new Uint8Array([0, 1]),
            disposition: "inline_redacted",
          },
          submission: { base: baseFor(""), provenance: { fixture: true } },
        },
        {
          disposeOriginal: () => undefined,
          replay,
          emitHealth,
          provider: { accept, progress: async () => [] },
        },
      ),
    ).resolves.toEqual({ ok: false, error: { code: "prohibited_data" } });
    expect(replay).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
    expect(emitHealth).toHaveBeenCalledWith(
      expect.objectContaining({ code: "artifact_safety_block" }),
    );
  });
});
