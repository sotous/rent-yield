import { describe, expect, it, vi } from "vitest";
import { prepareFixtureArtifact } from "./runtime-artifact-pipeline.js";

describe("fixture runtime artifact pipeline", () => {
  it("redacts and scans in memory before returning a bounded inline artifact", async () => {
    const dispose = vi.fn();
    const result = await prepareFixtureArtifact(
      {
        content_type: "application/json",
        original_bytes: new TextEncoder().encode(
          '{"price":"1800000","email":"private@example.com"}',
        ),
        disposition: "inline_redacted",
      },
      { disposeOriginal: dispose },
    );
    expect(result).toMatchObject({
      ok: true,
      artifact: { kind: "inline_redacted" },
    });
    if (result.ok && result.artifact.kind === "inline_redacted")
      expect(result.artifact.bytes).not.toContain("private@example.com");
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("never stages or returns unsafe material and disposes originals on failure", async () => {
    const dispose = vi.fn();
    const result = await prepareFixtureArtifact(
      {
        content_type: "text/plain",
        original_bytes: new Uint8Array([0, 1]),
        disposition: "inline_redacted",
      },
      { disposeOriginal: dispose },
    );
    expect(result).toEqual({ ok: false, error: { code: "prohibited_data" } });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("hands only scanned redacted bytes to an opaque staging port", async () => {
    const dispose = vi.fn();
    const stageRedacted = vi.fn(async (input: { bytes: string }) => {
      expect(input.bytes).not.toContain("private@example.com");
      return { ok: true as const, reference_id: "staged-redacted-1" };
    });
    const result = await prepareFixtureArtifact(
      {
        content_type: "text/plain",
        original_bytes: new TextEncoder().encode("email: private@example.com"),
        disposition: "staged_reference",
      },
      { disposeOriginal: dispose, stageRedacted },
    );
    expect(result).toMatchObject({
      ok: true,
      artifact: { kind: "staged_reference", reference_id: "staged-redacted-1" },
    });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("retains only evidence metadata when policy forbids bytes and disposes after staging failure", async () => {
    const dispose = vi.fn();
    const noRetention = await prepareFixtureArtifact(
      {
        content_type: "text/plain",
        original_bytes: new TextEncoder().encode("rent: 1800000 COP"),
        disposition: "no_retained_bytes",
      },
      { disposeOriginal: dispose },
    );
    expect(noRetention).toMatchObject({
      ok: true,
      artifact: {
        kind: "no_retained_bytes",
        disposition: "policy_forbids_retention",
      },
    });

    const failedStage = await prepareFixtureArtifact(
      {
        content_type: "text/plain",
        original_bytes: new TextEncoder().encode("rent: 1800000 COP"),
        disposition: "staged_reference",
      },
      { disposeOriginal: dispose, stageRedacted: async () => ({ ok: false }) },
    );
    expect(failedStage).toEqual({
      ok: false,
      error: { code: "invalid_payload" },
    });
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});
