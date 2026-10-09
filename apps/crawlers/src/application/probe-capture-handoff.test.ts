import { describe, expect, it, vi } from "vitest";
import { createRedactingProbeCaptureHandoff } from "./probe-capture-handoff.js";

describe("redacting probe capture handoff", () => {
  it("redacts and scans bounded bytes before the writer receives an artifact", async () => {
    const write = vi.fn(async (input: unknown) => {
      void input;
    });
    const handoff = createRedactingProbeCaptureHandoff({ write });

    await expect(
      handoff.handoff({
        source_key: "source-a",
        response_url: "https://fixtures.example/listings",
        content_type: "application/json",
        original_bytes: new TextEncoder().encode(
          '{"rent":"1800000 COP","email":"private@example.com"}',
        ),
        discovery_profile_provenance: {
          source_key: "source-a",
          profile_version: 1,
          profile_sha256:
            "e29f1353e04b6425ce4385b343b3df1862213f0b7d2a18eb0b6d338cf7c533fc",
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        source_key: "source-a",
        artifact: expect.objectContaining({ kind: "inline_redacted" }),
        discovery_profile_provenance: {
          source_key: "source-a",
          profile_version: 1,
          profile_sha256:
            "e29f1353e04b6425ce4385b343b3df1862213f0b7d2a18eb0b6d338cf7c533fc",
        },
      }),
    );
    expect(JSON.stringify(write.mock.calls)).not.toContain(
      "private@example.com",
    );
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty("assessment_sha256");
  });

  it("blocks unsafe bytes before the writer is invoked", async () => {
    const write = vi.fn();
    const handoff = createRedactingProbeCaptureHandoff({ write });

    await expect(
      handoff.handoff({
        source_key: "source-a",
        response_url: "https://fixtures.example/listings",
        content_type: "text/plain",
        original_bytes: new Uint8Array([0, 1]),
      }),
    ).resolves.toEqual({ ok: false });
    expect(write).not.toHaveBeenCalled();
  });
});
