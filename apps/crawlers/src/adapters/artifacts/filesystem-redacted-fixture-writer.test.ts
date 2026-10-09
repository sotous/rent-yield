import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanFixtureDirectory } from "../../application/fixture-directory.js";
import {
  MemoryFixtureCapture,
  type FixtureArtifact,
} from "../../application/fixture-capture.js";
import { writeRedactedFixture } from "./filesystem-redacted-fixture-writer.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

function artifact(): FixtureArtifact {
  const captured = new MemoryFixtureCapture().captureRedactedFixture({
    fixture_id: "canary-ciencuadras-1",
    supersedes_fixture_id: null,
    origin: {
      kind: "permitted_source",
      source_key: "ciencuadras",
      source_url:
        "https://www.ciencuadras.com/arriendo/barranquilla?tracking=1",
      collected_at: "2026-10-09T00:00:00.000Z",
      discovery_profile_provenance: {
        source_key: "ciencuadras",
        profile_version: 1,
        profile_sha256: "0".repeat(64),
      },
    },
    created_at: "2026-10-09T00:00:01.000Z",
    content_type: "application/json",
    payload: '{"price":"1800000","email":"private@example.com"}',
    permitted_use: ["parser_replay"],
    retention_policy_key: "canary-redacted-fixture",
    research_session_id: "canary-run-1",
    parser_compatibility: ["parser-v1"],
    expected_classification: "capture_only",
  });
  if (!captured.ok) throw new Error("test setup failed");
  return captured.artifact;
}

describe("filesystem redacted fixture writer", () => {
  it("writes only a validated redacted envelope and payload that CI can replay", async () => {
    const root = await mkdtemp(join(tmpdir(), "rent-yield-fixtures-"));
    roots.push(root);
    const redacted = artifact();

    const result = await writeRedactedFixture({ root, artifact: redacted });

    expect(result).toEqual({
      ok: true,
      path: join(root, "canary-ciencuadras-1"),
    });
    await expect(
      readFile(join(root, "canary-ciencuadras-1", "payload.json"), "utf8"),
    ).resolves.not.toContain("private@example.com");
    await expect(scanFixtureDirectory(root)).resolves.toEqual({
      ok: true,
      artifacts: 1,
    });
  });

  it("rejects an invalid artifact before creating any artifact directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "rent-yield-fixtures-"));
    roots.push(root);
    const unsafe = artifact();
    unsafe.payload = '{"email":"private@example.com"}';

    await expect(
      writeRedactedFixture({ root, artifact: unsafe }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "invalid_artifact" },
    });
    await expect(scanFixtureDirectory(root)).resolves.toEqual({
      ok: false,
      issues: [{ code: "fixture_set_empty", path: "." }],
    });
  });

  it("never overwrites an existing fixture id", async () => {
    const root = await mkdtemp(join(tmpdir(), "rent-yield-fixtures-"));
    roots.push(root);
    const input = { root, artifact: artifact() };

    await expect(writeRedactedFixture(input)).resolves.toMatchObject({
      ok: true,
    });
    await expect(writeRedactedFixture(input)).resolves.toEqual({
      ok: false,
      error: { code: "fixture_already_exists" },
    });
  });
});
