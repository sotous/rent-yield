import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request, type RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { BlockList, isIP } from "node:net";
import type {
  ProbeResolveOutcome,
  ProbeTransport,
  ProbeTransportOutcome,
} from "../../ports/probe-transport.js";

export type NodeHttpsProbeTransportDependencies = {
  lookup(
    hostname: string,
    options: { all: true; verbatim: true },
  ): Promise<LookupAddress[]>;
  request(
    options: RequestOptions,
    callback: (response: IncomingMessage) => void,
  ): ClientRequest;
};

const nodeDependencies: NodeHttpsProbeTransportDependencies = {
  lookup,
  request,
};

/** A canary-only transport: no cookies, caller headers, redirects, or retries. */
export class NodeHttpsProbeTransport implements ProbeTransport {
  readonly #dependencies: NodeHttpsProbeTransportDependencies;

  constructor(
    dependencies: NodeHttpsProbeTransportDependencies = nodeDependencies,
  ) {
    this.#dependencies = dependencies;
  }

  async resolve(input: {
    hostname: string;
    timeout_ms: number;
  }): Promise<ProbeResolveOutcome> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const addresses = await Promise.race([
        this.#dependencies
          .lookup(input.hostname, { all: true, verbatim: true })
          .then((entries) => entries.map((entry) => entry.address)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("DNS timeout")),
            input.timeout_ms,
          );
        }),
      ]);
      return addresses.length === 0
        ? { kind: "budget_exhausted" }
        : { kind: "resolved", addresses };
    } catch {
      return { kind: "budget_exhausted" };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async request(input: {
    method: "GET";
    url: string;
    validated_addresses: string[];
    max_response_bytes: number;
    timeout_ms: number;
  }): Promise<ProbeTransportOutcome> {
    const url = new URL(input.url);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("HTTPS URL without credentials required");
    }
    const address = input.validated_addresses[0];
    if (!address || !isPublicAddress(address)) {
      throw new Error("public validated address required");
    }
    if (input.max_response_bytes < 0 || input.timeout_ms <= 0) {
      throw new Error("positive request limits required");
    }

    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      let response: IncomingMessage | undefined;
      let settled = false;
      const deadline = { value: undefined as NodeJS.Timeout | undefined };
      const finish = (outcome: ProbeTransportOutcome) => {
        if (settled) return;
        settled = true;
        if (deadline.value) clearTimeout(deadline.value);
        resolve(outcome);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        if (deadline.value) clearTimeout(deadline.value);
        reject(error);
      };
      const partial = (): ProbeTransportOutcome => ({
        kind: "budget_exhausted",
        connected_address: address,
        status_code: response?.statusCode ?? null,
        content_type: contentType(response),
        partial_body: Buffer.concat(chunks),
      });

      const req = this.#dependencies.request(
        {
          protocol: "https:",
          hostname: address,
          family: isIP(address),
          servername: url.hostname,
          path: `${url.pathname}${url.search}`,
          method: input.method,
          headers: { host: url.host },
          agent: false,
        },
        (received) => {
          response = received;
          received.on("data", (chunk: Buffer) => {
            if (settled) return;
            const remaining = input.max_response_bytes - bytes;
            if (remaining <= 0) {
              received.destroy();
              finish(partial());
              return;
            }
            const allowed = chunk.subarray(0, remaining);
            chunks.push(allowed);
            bytes += allowed.length;
            if (allowed.length < chunk.length) {
              received.destroy();
              finish(partial());
            }
          });
          received.once("end", () => {
            finish({
              kind: "response",
              connected_address: address,
              response: {
                status_code: received.statusCode ?? 0,
                content_type: contentType(received),
                body: Buffer.concat(chunks),
                ...(typeof received.headers.location === "string"
                  ? { redirect_location: received.headers.location }
                  : {}),
              },
            });
          });
          received.once("error", fail);
          received.once("aborted", () => fail(new Error("response aborted")));
        },
      );
      deadline.value = setTimeout(() => {
        req.destroy();
        response?.destroy();
        finish(partial());
      }, input.timeout_ms);
      req.once("error", fail);
      req.end();
    });
  }
}

export function createNodeHttpsProbeTransport(
  dependencies: NodeHttpsProbeTransportDependencies = nodeDependencies,
): ProbeTransport {
  return new NodeHttpsProbeTransport(dependencies);
}

function contentType(response: IncomingMessage | undefined): string | null {
  const value = response?.headers["content-type"];
  return typeof value === "string" ? value : null;
}

const blockedAddresses = new BlockList();
for (const [network, prefix, family] of [
  ["0.0.0.0", 8, "ipv4"],
  ["10.0.0.0", 8, "ipv4"],
  ["100.64.0.0", 10, "ipv4"],
  ["127.0.0.0", 8, "ipv4"],
  ["169.254.0.0", 16, "ipv4"],
  ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"],
  ["192.0.2.0", 24, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["198.18.0.0", 15, "ipv4"],
  ["198.51.100.0", 24, "ipv4"],
  ["203.0.113.0", 24, "ipv4"],
  ["224.0.0.0", 4, "ipv4"],
  ["240.0.0.0", 4, "ipv4"],
  ["::", 128, "ipv6"],
  ["::1", 128, "ipv6"],
  ["64:ff9b::", 96, "ipv6"],
  ["64:ff9b:1::", 48, "ipv6"],
  ["100::", 64, "ipv6"],
  ["2001::", 23, "ipv6"],
  ["2001:db8::", 32, "ipv6"],
  ["2002::", 16, "ipv6"],
  ["3fff::", 20, "ipv6"],
  ["5f00::", 16, "ipv6"],
  ["fc00::", 7, "ipv6"],
  ["fe80::", 10, "ipv6"],
  ["ff00::", 8, "ipv6"],
] as const) {
  blockedAddresses.addSubnet(network, prefix, family);
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return (
    family !== 0 &&
    !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6")
  );
}
