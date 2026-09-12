import { lstat, readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { FixtureEnvelope } from "@rent-yield/listing-storage-contracts";
import {
  validateFixtureArtifact,
  type FixtureArtifact,
} from "./fixture-capture.js";

export type FixtureDirectoryIssue = {
  code:
    | "fixture_set_empty"
    | "invalid_envelope"
    | "invalid_fixture"
    | "invalid_layout"
    | "invalid_payload_encoding"
    | "payload_too_large"
    | "prohibited_file"
    | "symlink_not_allowed";
  path: string;
};

export type FixtureDirectoryResult =
  | { ok: true; artifacts: number }
  | { ok: false; issues: FixtureDirectoryIssue[] };

const payloadNames = new Map<string, FixtureEnvelope["content_type"]>([
  ["payload.json", "application/json"],
  ["payload.html", "text/html"],
  ["payload.txt", "text/plain"],
]);
const prohibitedExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
  ".zip",
]);
const maximumPayloadBytes = 1024 * 1024;

async function directoriesWithEnvelopes(
  root: string,
  directory: string,
  issues: FixtureDirectoryIssue[],
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  if (entries.some((entry) => entry.name === "envelope.json"))
    found.push(directory);
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    const path = relative(root, absolute) || ".";
    if (entry.isSymbolicLink()) {
      issues.push({ code: "symlink_not_allowed", path });
      continue;
    }
    if (entry.isDirectory()) {
      found.push(...(await directoriesWithEnvelopes(root, absolute, issues)));
      continue;
    }
    if (prohibitedExtensions.has(extname(entry.name).toLowerCase()))
      issues.push({ code: "prohibited_file", path });
  }
  return found;
}

async function readUtf8(path: string): Promise<string | null> {
  const bytes = await readFile(path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** CI-facing scanner. Diagnostics contain paths and codes, never fixture data. */
export async function scanFixtureDirectory(
  root: string,
): Promise<FixtureDirectoryResult> {
  const issues: FixtureDirectoryIssue[] = [];
  try {
    if (!(await lstat(root)).isDirectory())
      return { ok: false, issues: [{ code: "invalid_layout", path: "." }] };
  } catch {
    return { ok: false, issues: [{ code: "invalid_layout", path: "." }] };
  }
  const directories = await directoriesWithEnvelopes(root, root, issues);
  if (directories.length === 0)
    issues.push({ code: "fixture_set_empty", path: "." });

  for (const directory of directories) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map(({ name }) => name);
    const payloadFiles = files.filter((name) => payloadNames.has(name));
    const permitted = new Set(["envelope.json", ...payloadFiles]);
    if (
      payloadFiles.length !== 1 ||
      files.some((name) => !permitted.has(name))
    ) {
      issues.push({
        code: "invalid_layout",
        path: relative(root, directory) || ".",
      });
      continue;
    }
    const payloadName = payloadFiles[0]!;
    const payloadPath = join(directory, payloadName);
    const envelopePath = join(directory, "envelope.json");
    const payloadBytes = await readFile(payloadPath);
    if (payloadBytes.byteLength > maximumPayloadBytes) {
      issues.push({
        code: "payload_too_large",
        path: relative(root, payloadPath),
      });
      continue;
    }
    const payload = await readUtf8(payloadPath);
    if (payload === null) {
      issues.push({
        code: "invalid_payload_encoding",
        path: relative(root, payloadPath),
      });
      continue;
    }
    let envelope: FixtureEnvelope;
    try {
      envelope = JSON.parse(
        await readFile(envelopePath, "utf8"),
      ) as FixtureEnvelope;
    } catch {
      issues.push({
        code: "invalid_envelope",
        path: relative(root, envelopePath),
      });
      continue;
    }
    if (envelope.content_type !== payloadNames.get(payloadName)) {
      issues.push({
        code: "invalid_layout",
        path: relative(root, directory) || ".",
      });
      continue;
    }
    const artifact: FixtureArtifact = { envelope, payload };
    if (!validateFixtureArtifact(artifact).ok)
      issues.push({
        code: "invalid_fixture",
        path: relative(root, directory) || ".",
      });
  }
  issues.sort((left, right) =>
    left.path === right.path
      ? left.code.localeCompare(right.code)
      : left.path.localeCompare(right.path),
  );
  return issues.length === 0
    ? { ok: true, artifacts: directories.length }
    : { ok: false, issues };
}
