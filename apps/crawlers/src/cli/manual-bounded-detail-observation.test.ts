import { describe, expect, it, vi } from "vitest";
import {
  executeManualBoundedDetailObservationCli,
  parseManualBoundedDetailObservationArguments,
} from "./manual-bounded-detail-observation.js";

const arguments_ = [
  "--dry-run",
  "--observation-id",
  "discovery-1",
  "--candidate-url",
  "https://www.ciencuadras.com/inmueble/one",
  "--observation",
  "/tmp/observation.json",
  "--profile",
  "/tmp/profile.json",
];

describe("manual bounded detail observation CLI", () => {
  it("requires exactly one mode and all selection-bound inputs", () => {
    expect(() =>
      parseManualBoundedDetailObservationArguments(arguments_.slice(1)),
    ).toThrow("exactly one");
    expect(() =>
      parseManualBoundedDetailObservationArguments([
        "--live",
        "--dry-run",
        ...arguments_.slice(1),
      ]),
    ).toThrow("exactly one");
  });

  it("runs dry preflight through the persisted selection input without a live flag", async () => {
    const runLocal = vi.fn().mockResolvedValue({
      ok: true,
      report: {
        kind: "dry_run",
        source_key: "ciencuadras",
        discovery_observation_id: "discovery-1",
      },
    });
    const output: string[] = [];
    await expect(
      executeManualBoundedDetailObservationCli(arguments_, {
        runLocal,
        write: (line) => output.push(line),
      }),
    ).resolves.toBe(0);
    expect(runLocal).toHaveBeenCalledWith(
      expect.objectContaining({ dry_run: true, candidate_url: arguments_[4] }),
    );
    expect(JSON.parse(output[0]!)).toMatchObject({
      report: { kind: "dry_run" },
    });
  });
});
