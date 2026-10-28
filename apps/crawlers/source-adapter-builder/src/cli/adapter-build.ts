import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { buildSourceAdapter } from "../source-adapter-builder.js";

async function main(args: readonly string[]): Promise<void> {
  if (args.length !== 2 || args[0] !== "--candidate" || !args[1]) {
    console.log(
      JSON.stringify({ kind: "build_failed", code: "invalid_arguments" }),
    );
    process.exitCode = 2;
    return;
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(await readFile(args[1], "utf8"));
  } catch {
    console.log(JSON.stringify({ kind: "build_failed", code: "invalid_json" }));
    process.exitCode = 1;
    return;
  }
  const result = buildSourceAdapter(candidate);
  console.log(
    JSON.stringify(
      result.kind === "built"
        ? { kind: "built", sourceKey: result.adapter.sourceKey }
        : result,
      null,
      2,
    ),
  );
  if (result.kind !== "built") process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main(process.argv.slice(2));
}
