import { JsonFileDiscoveryProfileRepository } from "@rent-yield/discovery-profile-storage";
import { pathToFileURL } from "node:url";
import {
  runLocalManualBoundedDiscovery,
  type LocalManualBoundedDiscoveryCommand,
} from "../application/manual-bounded-discovery-command.js";

type CliMode = "dry_run" | "live";

export type ParsedManualBoundedDiscoveryCli = {
  mode: CliMode;
  source_key: string;
  profile_path: string;
  fixture_root?: string;
  fixture_id?: string;
  probe_id?: string;
  as_of?: string;
  kill_switch: boolean;
};

type CliDependencies = {
  now?: () => string;
  runLocal?: typeof runLocalManualBoundedDiscovery;
  write?: (line: string) => void;
};

const usage =
  "Usage: pnpm --filter @rent-yield/crawlers canary -- (--dry-run | --live) --source-key <key> --profile <path> [--fixtures <directory> --fixture-id <id> --probe-id <id> --as-of <ISO-8601> --kill-switch]";

/** Parses flags without accepting positional input or caller-supplied scope. */
export function parseManualBoundedDiscoveryCliArguments(
  arguments_: readonly string[],
): ParsedManualBoundedDiscoveryCli {
  const suppliedArguments =
    arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const values: Record<string, string> = {};
  let dryRun = false;
  let live = false;
  let killSwitch = false;
  for (let index = 0; index < suppliedArguments.length; index += 1) {
    const argument = suppliedArguments[index]!;
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--live") {
      live = true;
      continue;
    }
    if (argument === "--kill-switch") {
      killSwitch = true;
      continue;
    }
    const key = argumentToKey(argument);
    if (!key) throw new Error(`${usage}\nUnknown argument: ${argument}`);
    const value = suppliedArguments[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`${usage}\nMissing value for ${argument}`);
    if (values[key])
      throw new Error(`${usage}\nRepeated argument: ${argument}`);
    values[key] = value;
    index += 1;
  }
  if (dryRun === live)
    throw new Error(`${usage}\nChoose exactly one of --dry-run or --live.`);
  if (!values.source_key || !values.profile)
    throw new Error(`${usage}\n--source-key and --profile are required.`);
  if (live && (!values.fixtures || !values.fixture_id))
    throw new Error(`${usage}\n--live requires --fixtures and --fixture-id.`);
  return {
    mode: dryRun ? "dry_run" : "live",
    source_key: values.source_key,
    profile_path: values.profile,
    ...(values.fixtures ? { fixture_root: values.fixtures } : {}),
    ...(values.fixture_id ? { fixture_id: values.fixture_id } : {}),
    ...(values.probe_id ? { probe_id: values.probe_id } : {}),
    ...(values.as_of ? { as_of: values.as_of } : {}),
    kill_switch: killSwitch,
  };
}

function argumentToKey(
  argument: string,
):
  | "source_key"
  | "profile"
  | "fixtures"
  | "fixture_id"
  | "probe_id"
  | "as_of"
  | null {
  return (
    (
      {
        "--source-key": "source_key",
        "--profile": "profile",
        "--fixtures": "fixtures",
        "--fixture-id": "fixture_id",
        "--probe-id": "probe_id",
        "--as-of": "as_of",
      } as const
    )[argument] ?? null
  );
}

/** Executes a local-only preflight, or the explicitly requested bounded run. */
export async function executeManualBoundedDiscoveryCli(
  arguments_: readonly string[],
  dependencies: CliDependencies = {},
): Promise<number> {
  const command = parseManualBoundedDiscoveryCliArguments(arguments_);
  const write = dependencies.write ?? console.log;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const profiles = new JsonFileDiscoveryProfileRepository({
    path: command.profile_path,
  });
  const profile = await profiles.findActiveBySourceKey({
    source_key: command.source_key,
  });
  if (!profile) {
    write(
      JSON.stringify({ ok: false, error: { code: "profile_unavailable" } }),
    );
    return 1;
  }
  if (command.mode === "dry_run") {
    write(
      JSON.stringify({
        ok: true,
        mode: "dry_run",
        source_key: profile.source_key,
        scope: profile.scope,
        budget: profile.budget,
        permitted_media_types: profile.permitted_media_types,
        discovery_profile_provenance: profile.discovery_profile_provenance,
      }),
    );
    return 0;
  }
  const asOf = command.as_of ?? now();
  const runInput: LocalManualBoundedDiscoveryCommand = {
    contract_version: "v1",
    source_key: command.source_key,
    probe_id: command.probe_id ?? `manual-${command.source_key}-${asOf}`,
    as_of: asOf,
    kill_switch: command.kill_switch,
    dry_run: false,
    profilePath: command.profile_path,
    fixtureRoot: command.fixture_root!,
    fixture_id: command.fixture_id!,
  };
  const result = await (
    dependencies.runLocal ?? runLocalManualBoundedDiscovery
  )(runInput, {});
  write(JSON.stringify(result));
  return result.ok ? 0 : 1;
}

async function main(): Promise<void> {
  try {
    process.exitCode = await executeManualBoundedDiscoveryCli(
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
