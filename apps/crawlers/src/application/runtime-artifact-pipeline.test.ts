import { describe, expect, it, vi } from "vitest";
import { MAX_INLINE_REDACTED_BYTES_V2 } from "@rent-yield/listing-storage-contracts";
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
      capture_evidence: {
        original_body_byte_length: 49,
      },
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

  it("discards an oversized redacted fixture without requesting a staged reference", async () => {
    const dispose = vi.fn();
    const result = await prepareFixtureArtifact(
      {
        content_type: "text/plain",
        // Separators avoid exercising pathological long-token regex cases;
        // this test is concerned with the byte-retention boundary.
        original_bytes: new TextEncoder().encode(
          "safe ".repeat(Math.ceil((MAX_INLINE_REDACTED_BYTES_V2 + 1) / 5)),
        ),
        disposition: "inline_redacted",
      },
      { disposeOriginal: dispose },
    );
    expect(result).toMatchObject({
      ok: true,
      artifact: {
        kind: "no_retained_bytes",
        disposition: "inline_limit_exceeded",
      },
    });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("retains only evidence metadata when policy forbids fixture bytes", async () => {
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

    expect(dispose).toHaveBeenCalledOnce();
  });
});

// Regression: a real bounded HTML discovery response may include removable
// embedded-media attributes. They must be stripped before final safety scan.
describe("HTML embedded-media sanitization", () => {
  it("removes data attributes and embedded-media tags before the final prohibited scan", async () => {
    const result = await prepareFixtureArtifact(
      {
        content_type: "text/html",
        original_bytes: new TextEncoder().encode(
          '<div data-image="data:image/png;base64,AAAA">rent 1800000 COP</div><img src="data:image/png;base64,BBBB">',
        ),
        disposition: "inline_redacted",
      },
      { disposeOriginal: () => undefined },
    );
    expect(result).toMatchObject({
      ok: true,
      artifact: { kind: "inline_redacted" },
    });
    if (result.ok && result.artifact.kind === "inline_redacted") {
      expect(result.artifact.bytes).not.toContain("data:");
      expect(result.artifact.bytes).not.toContain("<img");
    }
  });
});
