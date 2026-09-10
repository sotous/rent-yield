import { createHash } from "node:crypto";
import { BlockList, isIP } from "node:net";
import {
  instantSchema,
  probeBudgetSchema,
  probeResultSchema,
  researchScopeSchema,
  type ProbeResponseEvidence,
  type ProbeResult,
} from "@rent-yield/listing-storage-contracts";
import { z } from "zod";
import type {
  ProbeAccessGate,
  ProbeClock,
  ProbeTransport,
  ProbeTransportOutcome,
} from "../ports/probe-transport.js";

const hostnameSchema = z
  .string()
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/);
const pathPrefixSchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]*$/)
  .refine(
    (value) =>
      !value.split("/").some((segment) => segment === "." || segment === ".."),
  );
const commandSchema = z
  .strictObject({
    contract_version: z.literal("v1"),
    probe_id: z.string().min(1).max(256),
    scope: researchScopeSchema,
    start_url: z.string().min(1).max(4096),
    allowed_hosts: z
      .array(hostnameSchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length),
    allowed_path_prefixes: z
      .array(pathPrefixSchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length),
    budget: probeBudgetSchema,
    as_of: instantSchema,
  })
  .refine((value) => value.budget.max_redirects <= 19, {
    path: ["budget", "max_redirects"],
    message: "At most 19 redirects can be recorded",
  });
type ProbeCommand = z.infer<typeof commandSchema>;
type StopReason = Extract<
  ProbeResult["outcome"],
  { kind: "stopped" }
>["reason"];

export class MemorySourceBudget {
  readonly #requests = new Map<string, number>();
  readonly #active = new Map<string, number>();
  readonly #policies = new Map<
    string,
    { requestLimit: number; concurrencyLimit: number }
  >();

  tryStartRequest(
    sourceKey: string,
    requestLimit: number,
    concurrencyLimit: number,
  ): boolean {
    const policy = this.#policies.get(sourceKey);
    if (
      policy &&
      (policy.requestLimit !== requestLimit ||
        policy.concurrencyLimit !== concurrencyLimit)
    ) {
      return false;
    }
    this.#policies.set(sourceKey, { requestLimit, concurrencyLimit });
    const used = this.#requests.get(sourceKey) ?? 0;
    const active = this.#active.get(sourceKey) ?? 0;
    if (used >= requestLimit || active >= concurrencyLimit) return false;
    this.#requests.set(sourceKey, used + 1);
    this.#active.set(sourceKey, active + 1);
    return true;
  }

  finishRequest(sourceKey: string): void {
    const active = this.#active.get(sourceKey) ?? 0;
    if (active <= 1) this.#active.delete(sourceKey);
    else this.#active.set(sourceKey, active - 1);
  }
}

export type ProbeDependencies = {
  transport: ProbeTransport;
  access: ProbeAccessGate;
  clock: ProbeClock;
  sourceBudget: MemorySourceBudget;
};

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (
    /^::(?:\d+\.){3}\d+$/i.test(address) ||
    /^::[a-f0-9]{1,4}:[a-f0-9]{1,4}$/i.test(address) ||
    /^::ffff:0:(?:[a-f0-9]{1,4}:){1}[a-f0-9]{1,4}$/i.test(address) ||
    /^::ffff:0:(?:\d+\.){3}\d+$/i.test(address)
  ) {
    return false;
  }
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return publicAddress(mapped[1]);
  const mappedHex = address
    .toLowerCase()
    .match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/);
  if (mappedHex?.[1] && mappedHex[2]) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return publicAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6");
}

function pathAllowed(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => {
    if (prefix === "/") return true;
    if (pathname === prefix) return true;
    const boundary = prefix.endsWith("/") ? prefix : `${prefix}/`;
    return pathname.startsWith(boundary);
  });
}

function sanitizedUrl(url: URL): string {
  const copy = new URL(url.href);
  copy.search = "";
  copy.hash = "";
  return copy.href;
}

function validateTarget(
  value: string,
  command: ProbeCommand,
  base?: string,
): { ok: true; url: URL } | { ok: false; reason: StopReason } {
  if (/%(?:2e|2f|5c)/i.test(value)) {
    return { ok: false, reason: "path_blocked" };
  }
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return { ok: false, reason: "host_blocked" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "authentication_required" };
  }
  if (
    url.protocol !== "https:" ||
    !command.allowed_hosts.includes(url.hostname.toLowerCase())
  ) {
    return { ok: false, reason: "host_blocked" };
  }
  if (!pathAllowed(url.pathname, command.allowed_path_prefixes)) {
    return { ok: false, reason: "path_blocked" };
  }
  return { ok: true, url };
}

function sanitizedRedirect(
  value: string | undefined,
  base: string,
): string | null {
  if (value === undefined) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return sanitizedUrl(url);
  } catch {
    return null;
  }
}

function accessReason(reason: string): StopReason {
  if (reason === "robots_conflict") return "robots_conflict";
  if (reason === "policy_mismatch" || reason === "disallowed") {
    return "policy_mismatch";
  }
  return "access_unknown";
}

function commandWithinConstraints(
  command: ProbeCommand,
  constraints: Extract<
    ReturnType<ProbeAccessGate["probeAccess"]>,
    { permitted: true }
  >["constraints"],
): boolean {
  const hostsAllowed = command.allowed_hosts.every((host) =>
    constraints.allowed_hosts.includes(host),
  );
  const pathsAllowed = command.allowed_path_prefixes.every((prefix) =>
    pathAllowed(prefix, constraints.allowed_path_prefixes),
  );
  const budgetAllowed = (
    Object.keys(command.budget) as Array<keyof typeof command.budget>
  ).every((key) => command.budget[key] <= constraints.budget[key]);
  return hostsAllowed && pathsAllowed && budgetAllowed;
}

function digest(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function connectionAllowed(
  outcome: ProbeTransportOutcome,
  validatedAddresses: readonly string[],
): boolean {
  if (outcome.connected_address === null) {
    return (
      outcome.kind === "budget_exhausted" &&
      outcome.status_code === null &&
      outcome.content_type === null &&
      outcome.partial_body.byteLength === 0
    );
  }
  return (
    validatedAddresses.includes(outcome.connected_address) &&
    publicAddress(outcome.connected_address)
  );
}

export async function probeListingDiscovery(
  input: unknown,
  dependencies: ProbeDependencies,
): Promise<
  | { ok: true; value: ProbeResult }
  | {
      ok: false;
      error: {
        code: "invalid_input";
        issues: Array<{ code: string; path: Array<string | number> }>;
      };
    }
> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "invalid_input",
        issues: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.map((part) =>
            typeof part === "number" ? part : String(part),
          ),
        })),
      },
    };
  }
  const command = parsed.data;
  const startedAt = dependencies.clock.nowMs();
  const usage = { requests: 0, bytes: 0, duration_ms: 0, redirects: 0 };
  const responseEvidence: ProbeResponseEvidence[] = [];
  let assessmentId: string | null = null;
  let assessmentSha256: string | null = null;
  const finish = (outcome: ProbeResult["outcome"]) => ({
    ok: true as const,
    value: probeResultSchema.parse({
      contract_version: "v1",
      probe_id: command.probe_id,
      assessment_id: assessmentId,
      assessment_sha256: assessmentSha256,
      scope: command.scope,
      completed_at: dependencies.clock.nowInstant(),
      budget: command.budget,
      usage,
      outcome,
      evidence: [],
      response_evidence: responseEvidence,
      issues: [],
    }),
  });
  const stop = (reason: StopReason) =>
    finish({ kind: "stopped" as const, reason });

  const access = dependencies.access.probeAccess({
    scope: command.scope,
    as_of: command.as_of,
  });
  assessmentId = access.assessment_id ?? null;
  assessmentSha256 = access.assessment_sha256 ?? null;
  if (!access.permitted) return stop(accessReason(access.reason));
  if (!commandWithinConstraints(command, access.constraints)) {
    return stop("policy_mismatch");
  }

  let target = command.start_url;
  let base: string | undefined;
  while (true) {
    usage.duration_ms = dependencies.clock.nowMs() - startedAt;
    if (
      usage.requests >= command.budget.max_requests ||
      usage.duration_ms >= command.budget.max_duration_ms
    ) {
      return stop("budget_exhausted");
    }
    const targetResult = validateTarget(target, command, base);
    if (!targetResult.ok) return stop(targetResult.reason);
    let addresses: string[];
    try {
      const resolution = await dependencies.transport.resolve({
        hostname: targetResult.url.hostname,
        timeout_ms: command.budget.max_duration_ms - usage.duration_ms,
      });
      if (resolution.kind === "budget_exhausted") {
        usage.duration_ms = dependencies.clock.nowMs() - startedAt;
        return stop("budget_exhausted");
      }
      addresses = resolution.addresses;
    } catch {
      return stop("transport_error");
    }
    usage.duration_ms = dependencies.clock.nowMs() - startedAt;
    if (usage.duration_ms >= command.budget.max_duration_ms) {
      return stop("budget_exhausted");
    }
    if (
      addresses.length === 0 ||
      addresses.some((item) => !publicAddress(item))
    ) {
      return stop("ip_blocked");
    }
    if (
      !dependencies.sourceBudget.tryStartRequest(
        command.scope.source_key,
        command.budget.max_source_requests,
        command.budget.max_concurrency,
      )
    ) {
      return stop("budget_exhausted");
    }
    usage.requests += 1;
    let outcome: ProbeTransportOutcome;
    try {
      outcome = await dependencies.transport.request({
        method: "GET",
        url: targetResult.url.href,
        validated_addresses: [...addresses],
        max_response_bytes: command.budget.max_bytes - usage.bytes,
        timeout_ms: command.budget.max_duration_ms - usage.duration_ms,
      });
    } catch {
      return stop("transport_error");
    } finally {
      dependencies.sourceBudget.finishRequest(command.scope.source_key);
    }
    usage.duration_ms = dependencies.clock.nowMs() - startedAt;
    if (!connectionAllowed(outcome, addresses)) return stop("ip_blocked");

    const evidenceUrl = sanitizedUrl(targetResult.url);
    if (outcome.kind === "budget_exhausted") {
      usage.bytes += outcome.partial_body.byteLength;
      responseEvidence.push({
        url: evidenceUrl,
        collected_at: dependencies.clock.nowInstant(),
        status_code: outcome.status_code,
        content_type: outcome.content_type,
        body: {
          complete: false,
          received_sha256: digest(outcome.partial_body),
          byte_length: outcome.partial_body.byteLength,
        },
        redirect_location: null,
      });
      return stop("budget_exhausted");
    }

    const response = outcome.response;
    usage.bytes += response.body.byteLength;
    responseEvidence.push({
      url: evidenceUrl,
      collected_at: dependencies.clock.nowInstant(),
      status_code: response.status_code,
      content_type: response.content_type,
      body: {
        complete: true,
        sha256: digest(response.body),
        byte_length: response.body.byteLength,
      },
      redirect_location: sanitizedRedirect(
        response.redirect_location,
        targetResult.url.href,
      ),
    });
    if (
      usage.bytes > command.budget.max_bytes ||
      usage.duration_ms > command.budget.max_duration_ms
    ) {
      return stop("budget_exhausted");
    }
    const statusReason: Record<number, StopReason> = {
      401: "unauthorized",
      403: "forbidden",
      429: "rate_limited",
    };
    if (statusReason[response.status_code]) {
      return stop(statusReason[response.status_code]!);
    }
    if (response.status_code < 200 || response.status_code >= 400) {
      return stop("transport_error");
    }
    if (response.classification === "challenge") return stop("challenge");
    if (response.classification === "authentication_required") {
      return stop("authentication_required");
    }
    if (response.redirect_location !== undefined) {
      usage.redirects += 1;
      if (usage.redirects > command.budget.max_redirects) {
        return stop("redirect_blocked");
      }
      const redirectTarget = validateTarget(
        response.redirect_location,
        command,
        targetResult.url.href,
      );
      if (!redirectTarget.ok) return stop("redirect_blocked");
      target = redirectTarget.url.href;
      base = targetResult.url.href;
      continue;
    }
    if (response.status_code >= 300) return stop("transport_error");
    if (response.classification !== "listing_discovery") {
      return stop("transport_error");
    }
    const discovered: string[] = [];
    for (const discoveredUrl of response.discovered_urls ?? []) {
      const discoveredResult = validateTarget(
        discoveredUrl,
        command,
        targetResult.url.href,
      );
      if (!discoveredResult.ok) return stop(discoveredResult.reason);
      discovered.push(sanitizedUrl(discoveredResult.url));
    }
    return finish({ kind: "completed", discovered_urls: discovered });
  }
}
