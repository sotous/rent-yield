import { access, link, mkdir, rm, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, isAbsolute } from "node:path";
import {
  detailCandidateSelectionV1Schema,
  resolveDetailCandidateSelection,
  type DiscoveryObservationRepository,
} from "@rent-yield/listing-storage-contracts";
import { JsonFileDiscoveryObservationRepository } from "@rent-yield/discovery-profile-storage";
import { BoundedHttpsProbeTransport } from "../adapters/transport/bounded-https-probe-transport.js";
import type { ProbeTransport } from "../ports/probe-transport.js";
import { redactOfflineDetailCapture } from "./offline-detail-capture-redaction.js";

// The user explicitly removed first-canary page-size limits for this MVP.
// These transport-required sentinels avoid a product-level truncation policy.
const maxResponseBytes = Number.MAX_SAFE_INTEGER;
const timeoutMs = 2_147_483_647;

export type ReviewDetailCaptureCommand = {
  discovery_observation_id: string;
  candidate_url: string;
  discovery_observation_path: string;
  output_path: string;
};

type Dependencies = {
  observations?: DiscoveryObservationRepository;
  transport?: ProbeTransport;
};

type SafeCaptureArtifact = {
  contract_version: "v1";
  kind: "review_detail_capture";
  selection: { discovery_observation_id: string; candidate_url: string };
  source_key: string;
  discovery_profile_provenance: {
    source_key: string;
    profile_version: number;
    profile_sha256: string;
  };
  receipt: { original_bytes_sha256: string; byte_length: number };
  claims: Exclude<
    ReturnType<typeof redactOfflineDetailCapture>,
    { ok: false }
  >["claims"];
};

export type ReviewDetailCaptureResult =
  | {
      ok: true;
      report: {
        kind: "captured";
        output_path: string;
        original_bytes_sha256: string;
        byte_length: number;
      };
    }
  | { ok: true; report: { kind: "stopped"; reason: string } }
  | {
      ok: false;
      error: {
        code:
          | "selection_unavailable"
          | "invalid_output_path"
          | "capture_exists"
          | "write_failed";
      };
    };

function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [first = -1, second = -1] = address.split(".").map(Number);
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168))
  );
}

function robotsDisallow(body: Uint8Array, pathname: string): boolean {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(body)
      .split(/\r?\n/)
      .some((line) => {
        const match = /^\s*disallow\s*:\s*(\/\S*)\s*$/i.exec(line);
        return !!match?.[1] && pathname.startsWith(match[1]);
      });
  } catch {
    return true;
  }
}

async function requestOnce(input: {
  url: URL;
  transport: ProbeTransport;
}): Promise<
  | { ok: true; outcome: Awaited<ReturnType<ProbeTransport["request"]>> }
  | { ok: false }
> {
  let resolution;
  try {
    resolution = await input.transport.resolve({
      hostname: input.url.hostname,
      timeout_ms: timeoutMs,
    });
  } catch {
    return { ok: false };
  }
  if (
    resolution.kind !== "resolved" ||
    resolution.addresses.length === 0 ||
    resolution.addresses.some((address) => !isPublicIpv4(address))
  )
    return { ok: false };
  try {
    const outcome = await input.transport.request({
      method: "GET",
      url: input.url.href,
      validated_addresses: resolution.addresses,
      max_response_bytes: maxResponseBytes,
      timeout_ms: timeoutMs,
    });
    if (
      outcome.connected_address === null ||
      !resolution.addresses.includes(outcome.connected_address) ||
      !isPublicIpv4(outcome.connected_address)
    ) {
      if (outcome.kind === "response") outcome.response.body.fill(0);
      else outcome.partial_body.fill(0);
      return { ok: false };
    }
    return { ok: true, outcome };
  } catch {
    return { ok: false };
  }
}

async function reserveSafeArtifact(
  path: string,
  artifact: SafeCaptureArtifact,
): Promise<"written" | "exists" | "failed"> {
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(artifact, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    try {
      await link(temporary, path);
      return "written";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
      return "failed";
    }
  } catch {
    return "failed";
  } finally {
    await rm(temporary, { force: true });
  }
}

async function captureTargetExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
  }
}

async function resolveSelection(
  input: ReviewDetailCaptureCommand,
  observations: DiscoveryObservationRepository,
) {
  try {
    const selection = detailCandidateSelectionV1Schema.parse({
      contract_version: "v1",
      discovery_observation_id: input.discovery_observation_id,
      candidate_url: input.candidate_url,
    });
    const observation = await observations.findById({
      observation_id: selection.discovery_observation_id,
    });
    return observation
      ? resolveDetailCandidateSelection(observation, selection)
      : null;
  } catch {
    return null;
  }
}

/**
 * A deliberately isolated, one-time capture path for producing reviewable
 * safe claims. It does not consult a reviewed detail profile and can never
 * emit a raw page, a DOM, selectors, or source text.
 */
export async function runReviewDetailCapture(
  input: ReviewDetailCaptureCommand,
  dependencies: Dependencies = {},
): Promise<ReviewDetailCaptureResult> {
  if (!isAbsolute(input.output_path))
    return { ok: false, error: { code: "invalid_output_path" } };
  if (await captureTargetExists(input.output_path))
    return { ok: false, error: { code: "capture_exists" } };
  const observations =
    dependencies.observations ??
    new JsonFileDiscoveryObservationRepository({
      path: input.discovery_observation_path,
    });
  const resolved = await resolveSelection(input, observations);
  if (!resolved) return { ok: false, error: { code: "selection_unavailable" } };

  const candidate = new URL(resolved.selection.candidate_url);
  const transport = dependencies.transport ?? new BoundedHttpsProbeTransport();
  const robots = await requestOnce({
    url: new URL(`https://${candidate.hostname}/robots.txt`),
    transport,
  });
  if (!robots.ok || robots.outcome.kind !== "response") {
    if (robots.ok) robots.outcome.partial_body.fill(0);
    return {
      ok: true,
      report: { kind: "stopped", reason: "robots_unavailable" },
    };
  }
  try {
    const response = robots.outcome.response;
    if (
      response.status_code < 200 ||
      response.status_code >= 300 ||
      !response.content_type?.toLowerCase().startsWith("text/plain") ||
      robotsDisallow(response.body, candidate.pathname)
    )
      return {
        ok: true,
        report: { kind: "stopped", reason: "robots_conflict" },
      };
  } finally {
    robots.outcome.response.body.fill(0);
  }

  const detail = await requestOnce({ url: candidate, transport });
  if (!detail.ok || detail.outcome.kind !== "response") {
    if (detail.ok) detail.outcome.partial_body.fill(0);
    return {
      ok: true,
      report: { kind: "stopped", reason: "detail_unavailable" },
    };
  }
  try {
    const response = detail.outcome.response;
    if (
      response.status_code < 200 ||
      response.status_code >= 300 ||
      response.redirect_location !== undefined ||
      response.classification === "challenge" ||
      response.classification === "authentication_required" ||
      !response.content_type?.toLowerCase().startsWith("text/html")
    )
      return {
        ok: true,
        report: { kind: "stopped", reason: "detail_unavailable" },
      };
    const redacted = redactOfflineDetailCapture({
      original_bytes: response.body,
    });
    if (!redacted.ok)
      return {
        ok: true,
        report: { kind: "stopped", reason: "invalid_detail" },
      };
    const artifact: SafeCaptureArtifact = {
      contract_version: "v1",
      kind: "review_detail_capture",
      selection: resolved.selection,
      source_key: resolved.source_key,
      discovery_profile_provenance: resolved.discovery_profile_provenance,
      receipt: redacted.receipt,
      claims: redacted.claims,
    };
    const written = await reserveSafeArtifact(input.output_path, artifact);
    if (written === "exists")
      return { ok: false, error: { code: "capture_exists" } };
    if (written === "failed")
      return { ok: false, error: { code: "write_failed" } };
    return {
      ok: true,
      report: {
        kind: "captured",
        output_path: input.output_path,
        original_bytes_sha256: redacted.receipt.original_bytes_sha256,
        byte_length: redacted.receipt.byte_length,
      },
    };
  } finally {
    detail.outcome.response.body.fill(0);
  }
}
