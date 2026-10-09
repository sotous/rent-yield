import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
  validateFixtureArtifact,
  type FixtureArtifact,
} from "../../application/fixture-capture.js";

export type RedactedFixtureWriteResult =
  | { ok: true; path: string }
  | {
      ok: false;
      error: {
        code: "invalid_root" | "invalid_artifact" | "fixture_already_exists" | "write_failed";
      };
    };

const payloadFileName = (artifact: FixtureArtifact): string => {
  switch (artifact.envelope.content_type) {
    case "application/json":
      return "payload.json";
    case "text/html":
      return "payload.html";
    case "text/plain":
      return "payload.txt";
  }
};

/**
 * Stores an already-redacted fixture atomically. It deliberately accepts no
 * raw response bytes: validation happens before any artifact directory exists.
 */
export async function writeRedactedFixture(input: {
  root: string;
  artifact: FixtureArtifact;
}): Promise<RedactedFixtureWriteResult> {
  if (!isAbsolute(input.root))
    return { ok: false, error: { code: "invalid_root" } };
  if (!validateFixtureArtifact(input.artifact).ok)
    return { ok: false, error: { code: "invalid_artifact" } };

  const destination = join(input.root, input.artifact.envelope.fixture_id);
  try {
    await mkdir(input.root, { recursive: true });
    // Reserve the destination first. This makes fixture ids append-only even
    // when two manual invocations race.
    await mkdir(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      return { ok: false, error: { code: "fixture_already_exists" } };
    return { ok: false, error: { code: "write_failed" } };
  }

  try {
    await Promise.all([
      writeFile(
        join(destination, "envelope.json"),
        `${JSON.stringify(input.artifact.envelope, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      ),
      writeFile(join(destination, payloadFileName(input.artifact)), input.artifact.payload, {
    ]);
    return { ok: true, path: destination };
  } catch {
    // A partially created safe artifact must not become replayable evidence.
    await rm(destination, { recursive: true, force: true });
    return { ok: false, error: { code: "write_failed" } };
  }
}
