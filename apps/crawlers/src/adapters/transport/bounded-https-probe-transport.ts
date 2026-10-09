import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type {
  ProbeResolveOutcome,
  ProbeTransport,
  ProbeTransportOutcome,
} from "../../ports/probe-transport.js";

/**
 * Minimal HTTPS-only transport. The probe validates returned DNS addresses and
 * supplies them back here; this adapter connects to one validated address with
 * SNI and Host pinned to the URL hostname.
 */
export class BoundedHttpsProbeTransport implements ProbeTransport {
  async resolve(input: {
    hostname: string;
    timeout_ms: number;
  }): Promise<ProbeResolveOutcome> {
    const addresses = await withTimeout(
      lookup(input.hostname, { all: true, verbatim: true }),
      input.timeout_ms,
    );
    return {
      kind: "resolved",
      addresses: addresses.map((entry) => entry.address),
    };
  }

  async request(input: {
    method: "GET";
    url: string;
    validated_addresses: string[];
    max_response_bytes: number;
    timeout_ms: number;
  }): Promise<ProbeTransportOutcome> {
    const url = new URL(input.url);
    const address = input.validated_addresses[0];
    if (!address) throw new Error("No validated address");
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let settled = false;
      const finish = (outcome: ProbeTransportOutcome) => {
        if (!settled) {
          settled = true;
          resolve(outcome);
        }
      };
      const connection = request(
        {
          protocol: "https:",
          hostname: address,
          servername: url.hostname,
          method: input.method,
          path: `${url.pathname}${url.search}`,
          headers: { host: url.host },
          rejectUnauthorized: true,
          timeout: input.timeout_ms,
        },
        (response) => {
          const content_type =
            response.headers["content-type"]?.split(";", 1)[0] ?? null;
          response.on("data", (chunk: Buffer) => {
            const remaining = input.max_response_bytes - bytes;
            if (remaining <= 0) {
              connection.destroy();
              finish({
                kind: "budget_exhausted",
                connected_address: address,
                status_code: response.statusCode ?? null,
                content_type,
                partial_body: Buffer.concat(chunks),
              });
              return;
            }
            const bounded = chunk.subarray(0, remaining);
            chunks.push(bounded);
            bytes += bounded.byteLength;
            if (bounded.byteLength !== chunk.byteLength) {
              connection.destroy();
              finish({
                kind: "budget_exhausted",
                connected_address: address,
                status_code: response.statusCode ?? null,
                content_type,
                partial_body: Buffer.concat(chunks),
              });
            }
          });
          response.on("end", () =>
            finish({
              kind: "response",
              connected_address: address,
              response: {
                status_code: response.statusCode ?? 0,
                content_type,
                body: Buffer.concat(chunks),
                ...(typeof response.headers.location === "string"
                  ? { redirect_location: response.headers.location }
                  : {}),
                classification: "listing_discovery",
                discovered_urls: [],
              },
            }),
          );
        },
      );
      connection.once("timeout", () =>
        connection.destroy(new Error("HTTPS timeout")),
      );
      connection.once("error", (error) => {
        if (!settled) reject(error);
      });
      connection.end();
    });
  }
}

function withTimeout<T>(value: Promise<T>, timeout_ms: number): Promise<T> {
  return Promise.race([
    value,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error("DNS timeout")), timeout_ms);
    }),
  ]);
}
