import { pathToFileURL } from "node:url";
import {
  runLocalBoundedDetailObservation,
  type LocalBoundedDetailObservationCommand,
} from "../application/manual-bounded-detail-observation-command.js";

type CliDependencies = {
  runLocal?: typeof runLocalBoundedDetailObservation;
  write?: (line: string) => void;
};

const usage =
  "Usage: pnpm --filter @rent-yield/crawlers detail-canary -- (--dry-run | --live) --source-key <key> --candidate-url <canonical-https-url> --observation <absolute-path> --profile <absolute-path>";

export function parseManualBoundedDetailObservationArguments(
  arguments_: readonly string[],
): LocalBoundedDetailObservationCommand {
  const supplied = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  let dryRun = false;
  let live = false;
  const values: Record<string, string> = {};
  for (let index = 0; index < supplied.length; index += 1) {
    const argument = supplied[index]!;
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--live") {
      live = true;
      continue;
    }
    const key = (
      {
        "--source-key": "source_key",
        "--candidate-url": "candidate_url",
        "--observation": "discovery_observation_path",
        "--profile": "profile_path",
      } as const
    )[argument];
    if (!key) throw new Error(`${usage}\nUnknown argument: ${argument}`);
    const value = supplied[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`${usage}\nMissing value for ${argument}`);
    if (values[key])
      throw new Error(`${usage}\nRepeated argument: ${argument}`);
    values[key] = value;
    index += 1;
  }
  if (dryRun === live)
    throw new Error(`${usage}\nChoose exactly one of --dry-run or --live.`);
  if (
    !values.source_key ||
    !values.candidate_url ||
    !values.discovery_observation_path ||
    !values.profile_path
  )
    throw new Error(`${usage}\nAll named inputs are required.`);
  return {
    source_key: values.source_key,
    candidate_url: values.candidate_url,
    discovery_observation_path: values.discovery_observation_path,
    profile_path: values.profile_path,
    dry_run: dryRun,
  };
}

/** Explicit --live is the only path that can construct the HTTPS transport. */
export async function executeManualBoundedDetailObservationCli(
  arguments_: readonly string[],
  dependencies: CliDependencies = {},
): Promise<number> {
  const command = parseManualBoundedDetailObservationArguments(arguments_);
  const result = await (
    dependencies.runLocal ?? runLocalBoundedDetailObservation
  )(command);
  (dependencies.write ?? console.log)(JSON.stringify(result));
  return result.ok ? 0 : 1;
}

async function main(): Promise<void> {
  try {
    process.exitCode = await executeManualBoundedDetailObservationCli(
      process.argv.slice(2),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        error: { code: "invalid_command", message: String(error) },
      }),
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main();
