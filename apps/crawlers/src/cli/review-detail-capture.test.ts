import { describe, expect, it, vi } from "vitest";
import {
  executeReviewDetailCaptureCli,
  parseReviewDetailCaptureArguments,
} from "./review-detail-capture.js";

const arguments_ = [
  "--live",
  "--observation-id",
  "discovery-1",
  "--candidate-url",
  "https://www.example.com/inmueble/one",
  "--observation",
  "/tmp/observation.json",
  "--output",
  "/tmp/capture.json",
];

describe("review detail capture CLI", () => {
  it("requires explicit live mode and all persisted-selection/output inputs", () => {
    expect(() =>
      parseReviewDetailCaptureArguments(arguments_.slice(1)),
    ).toThrow("--live is required");
    expect(() =>
      parseReviewDetailCaptureArguments(["--live", ...arguments_.slice(1, -2)]),
    ).toThrow("All named inputs");
  });

  it("passes only selection and explicit output inputs to the application command", async () => {
    const run = vi.fn().mockResolvedValue({
      ok: true,
      report: {
        kind: "captured",
        output_path: "/tmp/capture.json",
        original_bytes_sha256: "a".repeat(64),
        byte_length: 123,
      },
    });
    const output: string[] = [];

    await expect(
      executeReviewDetailCaptureCli(arguments_, {
        run,
        write: (line) => output.push(line),
      }),
    ).resolves.toBe(0);
    expect(run).toHaveBeenCalledWith({
      discovery_observation_id: "discovery-1",
      candidate_url: "https://www.example.com/inmueble/one",
      discovery_observation_path: "/tmp/observation.json",
      output_path: "/tmp/capture.json",
    });
    expect(JSON.parse(output[0]!)).toMatchObject({
      report: { kind: "captured" },
    });
  });
});
