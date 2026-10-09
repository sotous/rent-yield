import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  createNodeHttpsProbeTransport,
  type NodeHttpsProbeTransportDependencies,
} from "./node-https-probe-transport.js";

class FakeRequest extends EventEmitter {
  destroyed = false;
  ended = false;

  end() {
    this.ended = true;
  }

  destroy() {
    this.destroyed = true;
  }
}

class FakeResponse extends EventEmitter {
  destroyed = false;
  statusCode = 200;
  headers: Record<string, string> = { "content-type": "text/html" };

  destroy() {
    this.destroyed = true;
  }
}

function dependencies(
  onRequest: (response: FakeResponse, request: FakeRequest) => void,
): NodeHttpsProbeTransportDependencies {
  return {
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    request: (_options, callback) => {
      const request = new FakeRequest();
      const response = new FakeResponse();
      queueMicrotask(() => {
        callback(response as never);
        onRequest(response, request);
      });
      return request as never;
    },
  };
}

describe("NodeHttpsProbeTransport", () => {
  it("connects to a validated literal address while preserving the URL hostname for TLS", async () => {
    let options: Record<string, unknown> | undefined;
    const transport = createNodeHttpsProbeTransport({
      ...dependencies((response) => {
        response.emit("data", Buffer.from("ok"));
        response.emit("end");
      }),
      request: (input, callback) => {
        options = input as Record<string, unknown>;
        const request = new FakeRequest();
        const response = new FakeResponse();
        queueMicrotask(() => {
          callback(response as never);
          response.emit("data", Buffer.from("ok"));
          response.emit("end");
        });
        return request as never;
      },
    });

    await expect(
      transport.request({
        method: "GET",
        url: "https://listings.example.co/rentals?q=ignored",
        validated_addresses: ["93.184.216.34"],
        max_response_bytes: 10,
        timeout_ms: 100,
      }),
    ).resolves.toMatchObject({
      kind: "response",
      connected_address: "93.184.216.34",
    });

    expect(options).toMatchObject({
      protocol: "https:",
      hostname: "93.184.216.34",
      servername: "listings.example.co",
      path: "/rentals?q=ignored",
      headers: { host: "listings.example.co" },
      agent: false,
    });
  });

  it("returns only the allowed prefix when streaming exceeds the response-byte budget", async () => {
    let response: FakeResponse | undefined;
    const transport = createNodeHttpsProbeTransport(
      dependencies((emittedResponse) => {
        response = emittedResponse;
        emittedResponse.emit("data", Buffer.from("12345"));
      }),
    );

    await expect(
      transport.request({
        method: "GET",
        url: "https://listings.example.co/rentals",
        validated_addresses: ["93.184.216.34"],
        max_response_bytes: 3,
        timeout_ms: 100,
      }),
    ).resolves.toMatchObject({
      kind: "budget_exhausted",
      connected_address: "93.184.216.34",
      partial_body: Buffer.from("123"),
    });
    expect(response?.destroyed).toBe(true);
  });

  it("turns a whole-request timeout into a typed budget stop", async () => {
    const transport = createNodeHttpsProbeTransport(
      dependencies(() => {
        // Deliberately leave the stream open.
      }),
    );

    const result = await transport.request({
      method: "GET",
      url: "https://listings.example.co/rentals",
      validated_addresses: ["93.184.216.34"],
      max_response_bytes: 10,
      timeout_ms: 1,
    });
    expect(result).toMatchObject({
      kind: "budget_exhausted",
      connected_address: "93.184.216.34",
    });
    expect(
      result.kind === "budget_exhausted" && result.partial_body,
    ).toHaveLength(0);
  });

  it("rejects a non-public validated address before opening a socket", async () => {
    let calls = 0;
    const transport = createNodeHttpsProbeTransport({
      lookup: async () => [],
      request: () => {
        calls += 1;
        return new FakeRequest() as never;
      },
    });

    await expect(
      transport.request({
        method: "GET",
        url: "https://listings.example.co/rentals",
        validated_addresses: ["127.0.0.1"],
        max_response_bytes: 10,
        timeout_ms: 100,
      }),
    ).rejects.toThrow("public validated address required");
    expect(calls).toBe(0);
  });
});
