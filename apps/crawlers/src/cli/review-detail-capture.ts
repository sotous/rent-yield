import { pathToFileURL } from "node:url";
import {
  runReviewDetailCapture,
  type ReviewDetailCaptureCommand,
} from "../application/review-detail-capture-command.js";

type CliDependencies = {
  run?: typeof runReviewDetailCapture;
  write?: (line: string) => void;
};

const usage =
  "Usage: pnpm --filter @rent-yield/crawlers review-detail-capture -- --live --observation-id <id> --candidate-url <canonical-https-url> --observation <absolute-path> --output <absolute-path>";

export function parseReviewDetailCaptureArguments(
  arguments_: readonly string[],
): ReviewDetailCaptureCommand {
  const supplied = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const values: Record<string, string> = {};
  let live = false;
  for (let index = 0; index < supplied.length; index += 1) {
    const argument = supplied[index]!;
    if (argument === "--live") {
      live = true;
      continue;
    }
    const key = (
      {
        "--observation-id": "discovery_observation_id",
        "--candidate-url": "candidate_url",
        "--observation": "discovery_observation_path",
        "--output": "output_path",
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
  if (!live)
    throw new Error(`${usage}\n--live is required for this one-time capture.`);
  if (
    !values.discovery_observation_id ||
    !values.candidate_url ||
    !values.discovery_observation_path ||
    !values.output_path
  )
    throw new Error(`${usage}\nAll named inputs are required.`);
  return {
    discovery_observation_id: values.discovery_observation_id,
    candidate_url: values.candidate_url,
    discovery_observation_path: values.discovery_observation_path,
    output_path: values.output_path,
  };
}

export async function executeReviewDetailCaptureCli(
  arguments_: readonly string[],
  dependencies: CliDependencies = {},
): Promise<number> {
  const command = parseReviewDetailCaptureArguments(arguments_);
  const result = await (dependencies.run ?? runReviewDetailCapture)(command);
  (dependencies.write ?? console.log)(JSON.stringify(result));
  return result.ok ? 0 : 1;
}

async function main(): Promise<void> {
  try {
    process.exitCode = await executeReviewDetailCaptureCli(
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
