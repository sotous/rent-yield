import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanFixtureDirectory } from "./fixture-directory.js";

describe("fixture directory scanner", () => {
  it("validates every committed fixture without exposing its content", async () => {
    const result = await scanFixtureDirectory(
      new URL("../../fixtures", import.meta.url).pathname,
    );
    expect(result).toEqual({ ok: true, artifacts: 1 });
  });

  it("fails closed with sanitized diagnostics for an unsafe fixture directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "crawler-fixtures-"));
    const fixture = join(root, "unsafe");
    await mkdir(fixture);
    await writeFile(join(fixture, "envelope.json"), "{}", "utf8");
    await writeFile(
      join(fixture, "payload.json"),
      '{"email":"private@example.com"}',
      "utf8",
    );
    await writeFile(join(fixture, "photo.jpg"), "not-an-image", "utf8");

    const result = await scanFixtureDirectory(root);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { code: "prohibited_file", path: "unsafe/photo.jpg" },
        { code: "invalid_layout", path: "unsafe" },
      ]),
    );
    expect(JSON.stringify(result.issues)).not.toContain("private@example.com");
  });
});
