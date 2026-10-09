import { describe, expect, it, vi } from "vitest";
import {
  executeManualBoundedDiscoveryCli,
  parseManualBoundedDiscoveryCliArguments,
} from "./manual-bounded-discovery.js";

const profilePath = new URL(
  "../../../../packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json",
  import.meta.url,
).pathname;

describe("manual bounded-discovery CLI", () => {
  it("rejects omitted or conflicting execution modes", () => {
    expect(() =>
      parseManualBoundedDiscoveryCliArguments([
        "--source-key",
        "ciencuadras",
        "--profile",
        profilePath,
      ]),
    ).toThrow("exactly one");

    expect(() =>
      parseManualBoundedDiscoveryCliArguments([
        "--dry-run",
        "--live",
        "--source-key",
        "ciencuadras",
        "--profile",
        profilePath,
      ]),
    ).toThrow("exactly one");
  });

  it("accepts pnpm's leading argument separator", () => {
    expect(
      parseManualBoundedDiscoveryCliArguments([
        "--",
        "--dry-run",
        "--source-key",
        "ciencuadras",
        "--profile",
        profilePath,
      ]),
    ).toMatchObject({ mode: "dry_run", source_key: "ciencuadras" });
  });

  it("prints a sanitized profile preflight without invoking the live runner", async () => {
    const runLocal = vi.fn();
    const output: string[] = [];

    const exitCode = await executeManualBoundedDiscoveryCli(
      ["--dry-run", "--source-key", "ciencuadras", "--profile", profilePath],
      {
        runLocal,
        write: (line) => output.push(line),
        now: () => "2026-10-09T00:00:00.000Z",
      },
    );

    expect(exitCode).toBe(0);
    expect(runLocal).not.toHaveBeenCalled();
    expect(JSON.parse(output[0]!)).toMatchObject({
      mode: "dry_run",
      source_key: "ciencuadras",
      discovery_profile_provenance: {
        profile_version: 1,
      },
    });
  });

  it("runs only when --live is explicit and prints the typed result", async () => {
    const runLocal = vi.fn().mockResolvedValue({
      ok: true,
      report: { kind: "stopped", reason: "robots_denied" },
    });
    const output: string[] = [];

    const exitCode = await executeManualBoundedDiscoveryCli(
      [
        "--live",
        "--source-key",
        "ciencuadras",
        "--profile",
        profilePath,
        "--fixtures",
        "/tmp/redacted-fixtures",
        "--fixture-id",
        "manual-fixture-1",
        "--probe-id",
        "manual-probe-1",
        "--as-of",
        "2026-10-09T00:00:00.000Z",
      ],
      { runLocal, write: (line) => output.push(line) },
    );

    expect(exitCode).toBe(0);
    expect(runLocal).toHaveBeenCalledWith(
      expect.objectContaining({ dry_run: false, kill_switch: false }),
      {},
    );
    expect(JSON.parse(output[0]!)).toEqual({
      ok: true,
      report: { kind: "stopped", reason: "robots_denied" },
    });
  });
});
