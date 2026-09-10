import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemorySourceBudget, probeListingDiscovery } from "./bounded-probe.js";
import { MemorySourceResearch } from "./source-research.js";
import type {
  MockProbeResponse,
  ProbeAccessGate,
  ProbeClock,
  ProbeTransport,
  ProbeTransportRequest,
} from "../ports/probe-transport.js";

const instant = "2026-09-09T12:00:00.000Z";
const scope = {
  source_key: "synthetic-listings",
  country_code: "CO",
  city_key: "barranquilla",
  capability: "discovery",
  listing_roles: ["for_rent"],
};
const budget = {
  max_requests: 3,
  max_bytes: 1024,
  max_duration_ms: 1000,
  max_redirects: 1,
  max_concurrency: 1,
  max_source_requests: 4,
};
const command = {
  contract_version: "v1",
  probe_id: "probe-1",
  scope,
  start_url: "https://fixtures.example/listings",
  allowed_hosts: ["fixtures.example"],
  allowed_path_prefixes: ["/listings"],
  budget,
  as_of: instant,
};

class FakeClock implements ProbeClock {
  elapsed = 0;
  nowMs() {
    return this.elapsed;
  }
  nowInstant() {
    return instant;
  }
}

class FakeTransport implements ProbeTransport {
  readonly requests: string[] = [];
  readonly requestInputs: ProbeTransportRequest[] = [];
  readonly addressQueue: string[][];
  constructor(
    readonly responses: MockProbeResponse[],
    addresses: string[] | string[][] = ["93.184.216.34"],
    readonly clock?: FakeClock,
    readonly advanceMs = 0,
  ) {
    this.addressQueue = Array.isArray(addresses[0])
      ? [...(addresses as string[][])]
      : [addresses as string[]];
  }
  async resolve() {
    return {
      kind: "resolved" as const,
      addresses:
        this.addressQueue.length > 1
          ? this.addressQueue.shift()!
          : this.addressQueue[0]!,
    };
  }
  async request(input: ProbeTransportRequest) {
    this.requests.push(input.url);
    this.requestInputs.push(input);
    if (this.clock) this.clock.elapsed += this.advanceMs;
    const response = this.responses.shift();
    if (!response) throw new Error("unexpected request");
    return {
      kind: "response" as const,
      connected_address: input.validated_addresses[0]!,
      response,
    };
  }
}

const permitted = (constraintBudget = budget) => ({
  probeAccess: () => ({
    permitted: true as const,
    assessment_id: "assessment-1",
    assessment_sha256: "a".repeat(64),
    constraints: {
      allowed_hosts: ["fixtures.example"],
      allowed_path_prefixes: ["/listings"],
      budget: constraintBudget,
    },
  }),
});
const allowed = permitted();
const denied = {
  probeAccess: () => ({ permitted: false as const, reason: "access_unknown" }),
};
const robotsDenied = {
  probeAccess: () => ({
    permitted: false as const,
    reason: "robots_conflict",
    assessment_id: "assessment-2",
    assessment_sha256: "b".repeat(64),
  }),
};
const policyDenied = {
  probeAccess: () => ({
    permitted: false as const,
    reason: "policy_mismatch",
    assessment_id: "assessment-3",
    assessment_sha256: "c".repeat(64),
  }),
};
const body = (value: string) => new TextEncoder().encode(value);
const response = (
  overrides: Partial<MockProbeResponse> = {},
): MockProbeResponse => ({
  status_code: 200,
  content_type: "text/html",
  body: body("RAW_SECRET_BODY"),
  classification: "listing_discovery",
  discovered_urls: ["https://fixtures.example/listings/one"],
  ...overrides,
});

function run(
  transport: ProbeTransport,
  overrides: Record<string, unknown> = {},
  access: ProbeAccessGate = allowed,
  clock = new FakeClock(),
  sourceBudget = new MemorySourceBudget(),
) {
  return probeListingDiscovery(
    { ...command, ...overrides },
    { transport, access, clock, sourceBudget },
  );
}

describe("bounded fixture probe", () => {
  it("uses the exact assessment receipt from the research gate", async () => {
    const research = new MemorySourceResearch();
    research.registerSourceCandidate({
      contract_version: "v1",
      candidate_id: "candidate-1",
      scope,
      homepage_url: "https://fixtures.example/listings",
      registered_at: instant,
      evidence: [],
      unknowns: [],
    });
    research.inspectSourceAccess({
      contract_version: "v1",
      assessment_id: "assessment-1",
      candidate_id: "candidate-1",
      scope,
      assessed_at: instant,
      technical_access: "allowed",
      contractual_access: "allowed",
      evidence: [
        {
          url: "https://fixtures.example/policy",
          observed_at: instant,
          sha256: "b".repeat(64),
          conclusion: "Synthetic fixture probe permitted.",
          excerpt: null,
        },
      ],
      unknowns: [],
      issues: [],
      recheck_at: "2026-10-01T00:00:00.000Z",
    });
    const access = research.probeAccess({ scope, as_of: instant });
    expect(access.permitted).toBe(true);
    if (!access.permitted) throw new Error("expected fixture access");
    const transport = new FakeTransport([response()]);
    await expect(run(transport, {}, research)).resolves.toMatchObject({
      value: {
        assessment_id: access.assessment_id,
        assessment_sha256: access.assessment_sha256,
        outcome: { kind: "completed" },
      },
    });
  });

  it("returns a deterministic sanitized discovery receipt", async () => {
    const transport = new FakeTransport([response()]);
    const result = await run(transport);
    expect(result).toEqual({
      ok: true,
      value: {
        contract_version: "v1",
        probe_id: "probe-1",
        assessment_id: "assessment-1",
        assessment_sha256: "a".repeat(64),
        scope,
        completed_at: instant,
        budget,
        usage: { requests: 1, bytes: 15, duration_ms: 0, redirects: 0 },
        outcome: {
          kind: "completed",
          discovered_urls: ["https://fixtures.example/listings/one"],
        },
        evidence: [],
        response_evidence: [
          {
            url: "https://fixtures.example/listings",
            collected_at: instant,
            status_code: 200,
            content_type: "text/html",
            body: {
              complete: true,
              sha256: createHash("sha256")
                .update(body("RAW_SECRET_BODY"))
                .digest("hex"),
              byte_length: 15,
            },
            redirect_location: null,
          },
        ],
        issues: [],
      },
    });
    expect(JSON.stringify(result)).not.toContain("RAW_SECRET_BODY");
    expect(transport.requestInputs[0]).toEqual({
      method: "GET",
      url: command.start_url,
      validated_addresses: ["93.184.216.34"],
      max_response_bytes: 1024,
      timeout_ms: 1000,
    });
  });

  it("rejects credentials, cookies, proxies, and arbitrary request headers", async () => {
    for (const injection of [
      { cookies: "secret" },
      { proxy: "https://proxy.example" },
      { headers: { authorization: "secret" } },
      { assessment_id: "assessment-1" },
      { assessment_sha256: "b".repeat(64) },
      { policy: { robots: "allowed", terms: "matching" } },
      { allowed_path_prefixes: ["/../"] },
    ]) {
      const transport = new FakeTransport([response()]);
      await expect(run(transport, injection)).resolves.toMatchObject({
        ok: false,
        error: { code: "invalid_input" },
      });
      expect(transport.requests).toEqual([]);
    }
  });

  it("stops before transport when access or policy is not allowed", async () => {
    const transport = new FakeTransport([response()]);
    await expect(run(transport, {}, denied)).resolves.toMatchObject({
      ok: true,
      value: { outcome: { kind: "stopped", reason: "access_unknown" } },
    });
    await expect(run(transport, {}, robotsDenied)).resolves.toMatchObject({
      value: { outcome: { reason: "robots_conflict" } },
    });
    await expect(run(transport, {}, policyDenied)).resolves.toMatchObject({
      value: { outcome: { reason: "policy_mismatch" } },
    });
    expect(transport.requests).toEqual([]);
  });

  it.each([
    ["http://fixtures.example/listings", "host_blocked"],
    ["https://other.example/listings", "host_blocked"],
    ["https://fixtures.example/private", "path_blocked"],
    [
      "https://user:secret@fixtures.example/listings",
      "authentication_required",
    ],
    ["https://fixtures.example/listings/%2e%2e/private", "path_blocked"],
    ["https://fixtures.example/listings%2fprivate", "path_blocked"],
  ])("blocks an invalid target %s", async (start_url, reason) => {
    const transport = new FakeTransport([response()]);
    await expect(run(transport, { start_url })).resolves.toMatchObject({
      value: { outcome: { kind: "stopped", reason } },
    });
    expect(transport.requests).toEqual([]);
  });

  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:0:127.0.0.1",
    "::7f00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "3fff::1",
    "5f00::1",
    "192.88.99.1",
  ])("blocks non-public resolved address %s", async (address) => {
    const transport = new FakeTransport([response()], [address]);
    await expect(run(transport)).resolves.toMatchObject({
      value: { outcome: { reason: "ip_blocked" } },
    });
    expect(transport.requests).toEqual([]);
  });

  it("rejects a connection outside the DNS-validated address set", async () => {
    const requests: ProbeTransportRequest[] = [];
    const transport: ProbeTransport = {
      async resolve() {
        return { kind: "resolved", addresses: ["93.184.216.34"] };
      },
      async request(input) {
        requests.push(input);
        return {
          kind: "response",
          connected_address: "1.1.1.1",
          response: response(),
        };
      },
    };
    await expect(run(transport)).resolves.toMatchObject({
      value: {
        usage: { requests: 1 },
        outcome: { reason: "ip_blocked" },
      },
    });
    expect(requests[0]?.validated_addresses).toEqual(["93.184.216.34"]);
  });

  it("cannot reuse an assessment to widen its approved target", async () => {
    const transport = new FakeTransport([response()]);
    await expect(
      run(transport, {
        start_url: "https://other.example/listings",
        allowed_hosts: ["other.example"],
      }),
    ).resolves.toMatchObject({
      value: {
        assessment_id: "assessment-1",
        outcome: { reason: "policy_mismatch" },
      },
    });
    expect(transport.requests).toEqual([]);
  });

  it("revalidates every redirect before another request", async () => {
    const transport = new FakeTransport([
      response({
        status_code: 302,
        redirect_location: "https://other.example/listings",
      }),
    ]);
    await expect(run(transport)).resolves.toMatchObject({
      value: {
        usage: { requests: 1, redirects: 1 },
        outcome: { reason: "redirect_blocked" },
      },
    });
    expect(transport.requests).toEqual([command.start_url]);
  });

  it("resolves DNS again after an allowed redirect and blocks rebinding", async () => {
    const transport = new FakeTransport(
      [response({ status_code: 302, redirect_location: "/listings/page-2" })],
      [["93.184.216.34"], ["127.0.0.1"]],
    );
    await expect(run(transport)).resolves.toMatchObject({
      value: {
        usage: { requests: 1, redirects: 1 },
        outcome: { reason: "ip_blocked" },
      },
    });
    expect(transport.requests).toHaveLength(1);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [429, "rate_limited"],
  ])("stops on status %s without retry", async (status_code, reason) => {
    const transport = new FakeTransport([response({ status_code })]);
    await expect(run(transport)).resolves.toMatchObject({
      value: { outcome: { reason }, usage: { requests: 1 } },
    });
    expect(transport.requests).toHaveLength(1);
  });

  it("treats unexpected HTTP failures as transport errors", async () => {
    const transport = new FakeTransport([response({ status_code: 500 })]);
    await expect(run(transport)).resolves.toMatchObject({
      value: { outcome: { reason: "transport_error" } },
    });
    expect(transport.requests).toHaveLength(1);
  });

  it.each([
    ["challenge", "challenge"],
    ["authentication_required", "authentication_required"],
  ] as const)(
    "stops on %s classification without retry",
    async (classification, reason) => {
      const transport = new FakeTransport([response({ classification })]);
      await expect(run(transport)).resolves.toMatchObject({
        value: { outcome: { reason }, usage: { requests: 1 } },
      });
      expect(transport.requests).toHaveLength(1);
    },
  );

  it("enforces response-byte and elapsed-time budgets", async () => {
    const byteTransport = new FakeTransport([
      response({ body: body("12345678") }),
    ]);
    await expect(
      run(byteTransport, { budget: { ...budget, max_bytes: 7 } }),
    ).resolves.toMatchObject({
      value: { outcome: { reason: "budget_exhausted" }, usage: { bytes: 8 } },
    });
    const clock = new FakeClock();
    const slowTransport = new FakeTransport(
      [response()],
      undefined,
      clock,
      1001,
    );
    await expect(run(slowTransport, {}, allowed, clock)).resolves.toMatchObject(
      {
        value: {
          outcome: { reason: "budget_exhausted" },
          usage: { duration_ms: 1001 },
        },
      },
    );

    const dnsClock = new FakeClock();
    const dnsRequests: string[] = [];
    const slowDns: ProbeTransport = {
      async resolve() {
        dnsClock.elapsed += 1001;
        return { kind: "resolved", addresses: ["93.184.216.34"] };
      },
      async request(input) {
        dnsRequests.push(input.url);
        return {
          kind: "response",
          connected_address: input.validated_addresses[0]!,
          response: response(),
        };
      },
    };
    await expect(run(slowDns, {}, allowed, dnsClock)).resolves.toMatchObject({
      value: {
        outcome: { reason: "budget_exhausted" },
        usage: { requests: 0, duration_ms: 1001 },
      },
    });
    expect(dnsRequests).toEqual([]);

    const timedOutDns: ProbeTransport = {
      async resolve(input) {
        expect(input.timeout_ms).toBe(1000);
        return { kind: "budget_exhausted" };
      },
      async request() {
        throw new Error("request must not run");
      },
    };
    await expect(run(timedOutDns)).resolves.toMatchObject({
      value: {
        outcome: { reason: "budget_exhausted" },
        usage: { requests: 0 },
      },
    });
  });

  it("records incomplete evidence when the transport exhausts a budget", async () => {
    const partial = body("partial");
    const requests: ProbeTransportRequest[] = [];
    const transport: ProbeTransport = {
      async resolve() {
        return { kind: "resolved", addresses: ["93.184.216.34"] };
      },
      async request(input) {
        requests.push(input);
        return {
          kind: "budget_exhausted",
          connected_address: "93.184.216.34",
          status_code: 200,
          content_type: "text/html",
          partial_body: partial,
        };
      },
    };
    await expect(run(transport)).resolves.toMatchObject({
      value: {
        usage: { requests: 1, bytes: 7 },
        outcome: { reason: "budget_exhausted" },
        response_evidence: [
          {
            status_code: 200,
            content_type: "text/html",
            body: {
              complete: false,
              received_sha256: createHash("sha256")
                .update(partial)
                .digest("hex"),
              byte_length: 7,
            },
          },
        ],
      },
    });
    expect(requests[0]).toMatchObject({
      max_response_bytes: 1024,
      timeout_ms: 1000,
    });
  });

  it("rejects response metadata when no validated connection was made", async () => {
    const transport: ProbeTransport = {
      async resolve() {
        return { kind: "resolved", addresses: ["93.184.216.34"] };
      },
      async request() {
        return {
          kind: "budget_exhausted",
          connected_address: null,
          status_code: null,
          content_type: "text/html",
          partial_body: body(""),
        };
      },
    };
    await expect(run(transport)).resolves.toMatchObject({
      value: { outcome: { reason: "ip_blocked" }, response_evidence: [] },
    });
  });

  it("enforces redirect and source-wide request budgets", async () => {
    const noRedirect = new FakeTransport([
      response({ status_code: 302, redirect_location: "/listings/page-2" }),
    ]);
    await expect(
      run(noRedirect, { budget: { ...budget, max_redirects: 0 } }),
    ).resolves.toMatchObject({
      value: { outcome: { reason: "redirect_blocked" } },
    });

    const oneRequest = new FakeTransport([
      response({ status_code: 302, redirect_location: "/listings/page-2" }),
    ]);
    await expect(
      run(oneRequest, { budget: { ...budget, max_requests: 1 } }),
    ).resolves.toMatchObject({
      value: {
        outcome: { reason: "budget_exhausted" },
        usage: { requests: 1 },
      },
    });

    const ledger = new MemorySourceBudget();
    await run(
      new FakeTransport([response()]),
      {
        probe_id: "probe-a",
        budget: { ...budget, max_source_requests: 1 },
      },
      permitted({ ...budget, max_source_requests: 1 }),
      new FakeClock(),
      ledger,
    );
    const second = new FakeTransport([response()]);
    await expect(
      run(
        second,
        {
          probe_id: "probe-b",
          budget: { ...budget, max_source_requests: 1 },
        },
        permitted({ ...budget, max_source_requests: 1 }),
        new FakeClock(),
        ledger,
      ),
    ).resolves.toMatchObject({
      value: {
        outcome: { reason: "budget_exhausted" },
        usage: { requests: 0 },
      },
    });
    expect(second.requests).toEqual([]);
  });

  it("cannot raise a trusted source request limit on a later command", async () => {
    const ledger = new MemorySourceBudget();
    const trusted = permitted({ ...budget, max_source_requests: 1 });
    await run(
      new FakeTransport([response()]),
      { budget: { ...budget, max_source_requests: 1 } },
      trusted,
      new FakeClock(),
      ledger,
    );
    const second = new FakeTransport([response()]);
    await expect(
      run(
        second,
        { budget: { ...budget, max_source_requests: 100 } },
        trusted,
        new FakeClock(),
        ledger,
      ),
    ).resolves.toMatchObject({
      value: { outcome: { reason: "policy_mismatch" }, usage: { requests: 0 } },
    });
    expect(second.requests).toEqual([]);
  });

  it("preserves a stricter source policy after its first request", async () => {
    const ledger = new MemorySourceBudget();
    await run(
      new FakeTransport([response()]),
      { budget: { ...budget, max_source_requests: 1 } },
      allowed,
      new FakeClock(),
      ledger,
    );
    const second = new FakeTransport([response()]);
    await expect(
      run(
        second,
        { budget: { ...budget, max_source_requests: 4 } },
        allowed,
        new FakeClock(),
        ledger,
      ),
    ).resolves.toMatchObject({
      value: {
        outcome: { reason: "budget_exhausted" },
        usage: { requests: 0 },
      },
    });
    expect(second.requests).toEqual([]);
  });

  it("enforces source concurrency across simultaneous probes", async () => {
    let releaseFirst!: () => void;
    const transport: ProbeTransport & { requests: string[] } = {
      requests: [],
      async resolve() {
        return { kind: "resolved", addresses: ["93.184.216.34"] };
      },
      async request(input) {
        this.requests.push(input.url);
        if (this.requests.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
        return {
          kind: "response",
          connected_address: input.validated_addresses[0]!,
          response: response(),
        };
      },
    };
    const ledger = new MemorySourceBudget();
    const firstRun = run(
      transport,
      {
        probe_id: "probe-a",
        budget: { ...budget, max_concurrency: 1 },
      },
      allowed,
      new FakeClock(),
      ledger,
    );
    while (transport.requests.length === 0) await Promise.resolve();
    await expect(
      run(
        transport,
        {
          probe_id: "probe-b",
          budget: { ...budget, max_concurrency: 1 },
        },
        allowed,
        new FakeClock(),
        ledger,
      ),
    ).resolves.toMatchObject({
      value: {
        outcome: { reason: "budget_exhausted" },
        usage: { requests: 0 },
      },
    });
    expect(transport.requests).toHaveLength(1);
    releaseFirst();
    await expect(firstRun).resolves.toMatchObject({
      value: { outcome: { kind: "completed" } },
    });
  });

  it("rejects discovered URLs that escape the approved scope", async () => {
    const transport = new FakeTransport([
      response({ discovered_urls: ["https://fixtures.example/private/one"] }),
    ]);
    await expect(run(transport)).resolves.toMatchObject({
      value: { outcome: { reason: "path_blocked" } },
    });
  });
});
