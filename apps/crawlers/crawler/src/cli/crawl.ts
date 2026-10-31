import { open, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { crawlCandidate, type CrawlRunArtifact } from "../crawler.js";

type CliDependencies = {
  repositoryRoot?: string;
  fetch?: typeof fetch;
  now?: () => Date;
};

type CliSummary = {
  sourceKey: string;
  status: CrawlRunArtifact["status"];
  operations: Record<string, { status: string; listingCount: number }>;
  listingCount: number;
};

export type CliResult = {
  exitCode: number;
  artifactPath: string | null;
  summary: CliSummary | null;
  error?: { code: string; summary: string };
};

function parseArguments(
  args: string[],
):
  | { candidate: string; output?: string }
  | { error: { code: string; summary: string } } {
  let candidate: string | undefined;
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag !== "--candidate" && flag !== "--output") {
      return {
        error: {
          code: "invalid_arguments",
          summary: `Unknown argument: ${flag ?? ""}`,
        },
      };
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return {
        error: {
          code: "invalid_arguments",
          summary: `Missing value for ${flag}.`,
        },
      };
    }
    if (flag === "--candidate") {
      if (candidate !== undefined) {
        return {
          error: {
            code: "invalid_arguments",
            summary: "Duplicate --candidate argument.",
          },
        };
      }
      candidate = value;
    } else {
      if (output !== undefined) {
        return {
          error: {
            code: "invalid_arguments",
            summary: "Duplicate --output argument.",
          },
        };
      }
      output = value;
    }
    index += 1;
  }
  if (candidate === undefined) {
    return {
      error: { code: "invalid_arguments", summary: "--candidate is required." },
    };
  }
  return { candidate, ...(output === undefined ? {} : { output }) };
}

function summarize(artifact: CrawlRunArtifact): CliSummary {
  const operations: CliSummary["operations"] = {};
  for (const [operation, result] of Object.entries(artifact.operations)) {
    operations[operation] = {
      status: result?.status ?? "failed",
      listingCount: result?.status === "parsed" ? result.listingCount : 0,
    };
  }
  return {
    sourceKey: artifact.sourceKey,
    status: artifact.status,
    operations,
    listingCount: artifact.listings.length,
  };
}

async function writeArtifact(
  path: string,
  artifact: CrawlRunArtifact,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

export async function runCrawlerCli(
  args: string[],
  dependencies: CliDependencies = {},
): Promise<CliResult> {
  const parsed = parseArguments(args);
  if ("error" in parsed) {
    return {
      exitCode: 2,
      artifactPath: null,
      summary: null,
      error: parsed.error,
    };
  }

  const repositoryRoot =
    dependencies.repositoryRoot ??
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
  const candidatePath = isAbsolute(parsed.candidate)
    ? parsed.candidate
    : resolve(repositoryRoot, parsed.candidate);
  let candidate: unknown;
  try {
    candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  } catch (error) {
    const isSyntaxError = error instanceof SyntaxError;
    return {
      exitCode: 1,
      artifactPath: null,
      summary: null,
      error: {
        code: isSyntaxError ? "invalid_json" : "candidate_unreadable",
        summary: isSyntaxError
          ? "The candidate file does not contain valid JSON."
          : "The candidate file could not be read.",
      },
    };
  }

  const run = await crawlCandidate(candidate, {
    ...(dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch }),
    ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
  });
  if (run.kind === "candidate_failed") {
    return {
      exitCode: 1,
      artifactPath: null,
      summary: null,
      error: {
        code: run.code,
        summary: "The candidate could not be built into a source adapter.",
      },
    };
  }

  const artifactPath =
    parsed.output === undefined
      ? resolve(
          repositoryRoot,
          "data",
          "crawler-runs",
          run.artifact.sourceKey,
          `${run.artifact.startedAt}.json`,
        )
      : isAbsolute(parsed.output)
        ? parsed.output
        : resolve(repositoryRoot, parsed.output);
  try {
    await writeArtifact(artifactPath, run.artifact);
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EEXIST"
        ? "output_exists"
        : "output_write_failed";
    return {
      exitCode: 1,
      artifactPath: null,
      summary: summarize(run.artifact),
      error: {
        code,
        summary:
          code === "output_exists"
            ? "The output file already exists and was not overwritten."
            : "The run artifact could not be written.",
      },
    };
  }

  const summary = summarize(run.artifact);
  return {
    exitCode: run.artifact.status === "succeeded" ? 0 : 1,
    artifactPath,
    summary,
  };
}

async function main(): Promise<void> {
  const result = await runCrawlerCli(process.argv.slice(2));
  if (result.summary !== null) {
    console.log(
      JSON.stringify({ ...result.summary, artifactPath: result.artifactPath }),
    );
  } else {
    console.error(JSON.stringify(result.error));
  }
  process.exitCode = result.exitCode;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
