export type MockProbeResponse = {
  status_code: number;
  content_type: string | null;
  body: Uint8Array;
  redirect_location?: string;
  classification?:
    "listing_discovery" | "challenge" | "authentication_required";
  discovered_urls?: string[];
};

export type ProbeTransportRequest = {
  method: "GET";
  url: string;
  validated_addresses: string[];
  max_response_bytes: number;
  timeout_ms: number;
};

export type ProbeTransportOutcome =
  | {
      kind: "response";
      connected_address: string;
      response: MockProbeResponse;
    }
  | {
      kind: "budget_exhausted";
      connected_address: string | null;
      status_code: number | null;
      content_type: string | null;
      partial_body: Uint8Array;
    };

export type ProbeResolveOutcome =
  { kind: "resolved"; addresses: string[] } | { kind: "budget_exhausted" };

export type ProbeConstraints = {
  allowed_hosts: string[];
  allowed_path_prefixes: string[];
  budget: {
    max_requests: number;
    max_bytes: number;
    max_duration_ms: number;
    max_redirects: number;
    max_concurrency: number;
    max_source_requests: number;
  };
};

export interface ProbeTransport {
  resolve(input: {
    hostname: string;
    timeout_ms: number;
  }): Promise<ProbeResolveOutcome>;
  request(input: ProbeTransportRequest): Promise<ProbeTransportOutcome>;
}

export interface ProbeClock {
  nowMs(): number;
  nowInstant(): string;
}

export interface ProbeAccessGate {
  probeAccess(input: { scope: unknown; as_of: unknown }):
    | {
        permitted: true;
        assessment_id: string;
        assessment_sha256: string;
        constraints: ProbeConstraints;
      }
    | {
        permitted: false;
        reason: string;
        assessment_id?: string;
        assessment_sha256?: string;
      };
}
