import type { DiscoveryProfileProvenance } from "@rent-yield/discovery-profile-storage";
import {
  prepareFixtureArtifact,
  type ObservedResponseEvidence,
  type RuntimeArtifact,
} from "./runtime-artifact-pipeline.js";

export type RedactedProbeArtifactWriter = (input: {
  source_key: string;
  response_url: string;
  artifact: RuntimeArtifact;
  capture_evidence: ObservedResponseEvidence;
  discovery_profile_provenance?: DiscoveryProfileProvenance;
}) => Promise<void>;

type SupportedContentType = "application/json" | "text/html" | "text/plain";

function supportedContentType(
  value: string | null,
): value is SupportedContentType {
  return (
    value === "application/json" ||
    value === "text/html" ||
    value === "text/plain"
  );
}

/**
 * Converts a bounded, in-memory transport body into a redacted artifact before
 * its first writer call. It owns no filesystem or network capability.
 */
export function createRedactingProbeCaptureHandoff(dependencies: {
  write: RedactedProbeArtifactWriter;
}): {
  handoff(input: {
    source_key: string;
    response_url: string;
    content_type: string | null;
    original_bytes: Uint8Array;
    discovery_profile_provenance?: DiscoveryProfileProvenance;
  }): Promise<{ ok: true } | { ok: false }>;
} {
  return {
    async handoff(input) {
      if (!supportedContentType(input.content_type)) {
        input.original_bytes.fill(0);
        return { ok: false };
      }
      const prepared = await prepareFixtureArtifact(
        {
          content_type: input.content_type,
          original_bytes: input.original_bytes,
          disposition: "inline_redacted",
        },
        { disposeOriginal: () => input.original_bytes.fill(0) },
      );
      if (!prepared.ok) return { ok: false };
      try {
        await dependencies.write({
          source_key: input.source_key,
          response_url: input.response_url,
          artifact: prepared.artifact,
          capture_evidence: prepared.capture_evidence,
          ...(input.discovery_profile_provenance
            ? {
                discovery_profile_provenance:
                  input.discovery_profile_provenance,
              }
            : {}),
        });
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
  };
}
