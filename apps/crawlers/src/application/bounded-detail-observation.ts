import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";
import { MemorySourceBudget } from "./bounded-probe.js";

/**
 * Temporary application-facing projection of the future Storage detail
 * profile. It is deliberately limited to request scope and budget: source
 * extraction configuration never enters this orchestration boundary.
 */
export type DetailObservationProfile = {
  source_key: string;
  allowed_hosts: readonly string[];
  allowed_path_prefixes: readonly string[];
  budget: {
    max_requests: number;
    max_bytes: number;
    max_duration_ms: number;
    max_redirects: number;
    max_concurrency: number;
    max_source_requests: number;
  };
};

export type DetailCandidateSelection = {
  source_key: string;
  discovery_observation_id: string;
  candidate_url: string;
  /** Read from the persisted discovery observation by the future adapter. */
  candidate_urls: readonly string[];
  dry_run: boolean;
};

type Dependencies = {
  profile: DetailObservationProfile;
  transport: ProbeTransport;
  clock: ProbeClock;
  sourceBudget: MemorySourceBudget;
};

export type BoundedDetailObservationResult =
  | {
      ok: true;
      report: {
        kind: "dry_run";
        source_key: string;
        discovery_observation_id: string;
      };
    }
  | {
      ok: true;
      report: {
        kind: "detail_received";
        response: {
          canonical_url: string;
          media_type: string | null;
          body_sha256: string;
          body_byte_length: number;
        };
      };
    }
  | { ok: true; report: { kind: "stopped"; reason: string } }
  | {
      ok: false;
      error: { code: "candidate_not_selected" | "detail_scope_unavailable" };
    };

function canonicalHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

function pathAllowed(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) =>
      pathname === prefix ||
      (prefix.endsWith("/")
        ? pathname.startsWith(prefix)
        : pathname.startsWith(`${prefix}/`)),
  );
}

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

async function requestBounded(
  input: {
    url: URL;
    source_key: string;
    remaining_bytes: number;
    started_at: number;
  },
  dependencies: Dependencies,
): Promise<
  | { ok: true; outcome: Awaited<ReturnType<ProbeTransport["request"]>> }
  | { ok: false; reason: string }
> {
  const { budget } = dependencies.profile;
  const elapsed = dependencies.clock.nowMs() - input.started_at;
  if (elapsed >= budget.max_duration_ms || input.remaining_bytes <= 0)
    return { ok: false, reason: "budget_exhausted" };
  let resolution;
  try {
    resolution = await dependencies.transport.resolve({
      hostname: input.url.hostname,
      timeout_ms: budget.max_duration_ms - elapsed,
    });
  } catch {
    return { ok: false, reason: "transport_error" };
  }
  if (
    resolution.kind !== "resolved" ||
    resolution.addresses.length === 0 ||
    resolution.addresses.some((address) => !isPublicIpv4(address))
  )
    return { ok: false, reason: "ip_blocked" };
  if (
    !dependencies.sourceBudget.tryStartRequest(
      input.source_key,
      budget.max_source_requests,
      budget.max_concurrency,
    )
  )
    return { ok: false, reason: "budget_exhausted" };
  try {
    const outcome = await dependencies.transport.request({
      method: "GET",
      url: input.url.href,
      validated_addresses: [...resolution.addresses],
      max_response_bytes: input.remaining_bytes,
      timeout_ms: Math.max(0, budget.max_duration_ms - elapsed),
    });
    if (
      outcome.connected_address === null ||
      !resolution.addresses.includes(outcome.connected_address) ||
      !isPublicIpv4(outcome.connected_address)
    )
      return { ok: false, reason: "ip_blocked" };
    return { ok: true, outcome };
  } catch {
    return { ok: false, reason: "transport_error" };
  } finally {
    dependencies.sourceBudget.finishRequest(input.source_key);
  }
}

/**
 * A body-discarding, robots-first detail transport shell. It intentionally
 * stops at a safe receipt; extraction and durable Storage handoff are separate
 * future boundaries and cannot receive bytes from this function.
 */
export async function runBoundedDetailObservation(
  input: DetailCandidateSelection,
  dependencies: Dependencies,
): Promise<BoundedDetailObservationResult> {
  const candidate = canonicalHttpsUrl(input.candidate_url);
  const selected = input.candidate_urls.includes(input.candidate_url);
  if (!candidate || !selected)
    return { ok: false, error: { code: "candidate_not_selected" } };
  const profile = dependencies.profile;
  if (
    profile.source_key !== input.source_key ||
    !profile.allowed_hosts.includes(candidate.hostname) ||
    !pathAllowed(candidate.pathname, profile.allowed_path_prefixes) ||
    profile.budget.max_requests < 2 ||
    profile.budget.max_source_requests < 2
  )
    return { ok: false, error: { code: "detail_scope_unavailable" } };
  if (input.dry_run)
    return {
      ok: true,
      report: {
        kind: "dry_run",
        source_key: input.source_key,
        discovery_observation_id: input.discovery_observation_id,
      },
    };

  const startedAt = dependencies.clock.nowMs();
  const robotsUrl = new URL(`https://${candidate.hostname}/robots.txt`);
  const robots = await requestBounded(
    {
      url: robotsUrl,
      source_key: input.source_key,
      remaining_bytes: profile.budget.max_bytes,
      started_at: startedAt,
    },
    dependencies,
  );
  if (!robots.ok)
    return {
      ok: true,
      report: { kind: "stopped", reason: "robots_unavailable" },
    };
  if (robots.outcome.kind !== "response") {
    robots.outcome.partial_body.fill(0);
    return {
      ok: true,
      report: { kind: "stopped", reason: "robots_unavailable" },
    };
  }
  const robotsResponse = robots.outcome.response;
  const robotsLength = robotsResponse.body.byteLength;
  try {
    if (
      robotsResponse.status_code < 200 ||
      robotsResponse.status_code >= 300 ||
      !robotsResponse.content_type?.toLowerCase().startsWith("text/plain") ||
      robotsDisallow(robotsResponse.body, candidate.pathname)
    )
      return {
        ok: true,
        report: { kind: "stopped", reason: "robots_conflict" },
      };
  } finally {
    robotsResponse.body.fill(0);
  }

  const detail = await requestBounded(
    {
      url: candidate,
      source_key: input.source_key,
      remaining_bytes: profile.budget.max_bytes - robotsLength,
      started_at: startedAt,
    },
    dependencies,
  );
  if (!detail.ok)
    return { ok: true, report: { kind: "stopped", reason: detail.reason } };
  if (detail.outcome.kind !== "response") {
    detail.outcome.partial_body.fill(0);
    return {
      ok: true,
      report: { kind: "stopped", reason: "budget_exhausted" },
    };
  }
  const response = detail.outcome.response;
  try {
    if (
      response.status_code < 200 ||
      response.status_code >= 300 ||
      response.redirect_location !== undefined ||
      response.classification === "challenge" ||
      response.classification === "authentication_required"
    )
      return {
        ok: true,
        report: { kind: "stopped", reason: "detail_unavailable" },
      };
    return {
      ok: true,
      report: {
        kind: "detail_received",
        response: {
          canonical_url: candidate.href,
          media_type: response.content_type,
          body_sha256: createHash("sha256").update(response.body).digest("hex"),
          body_byte_length: response.body.byteLength,
        },
      },
    };
  } finally {
    response.body.fill(0);
  }
}
