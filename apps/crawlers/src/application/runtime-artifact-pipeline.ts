import { createHash } from "node:crypto";
import { MAX_INLINE_REDACTED_BYTES_V2 } from "@rent-yield/listing-storage-contracts";
import {
  redactFixturePayload,
  scanProhibitedFixtureData,
} from "./fixture-capture.js";

type ContentType = "application/json" | "text/html" | "text/plain";
export type ObservedResponseEvidence = {
  original_body_sha256: string;
  original_body_byte_length: number;
};
export type RuntimeArtifact =
  | {
      kind: "inline_redacted";
      bytes: string;
      media_type: ContentType;
      encoding: "utf-8";
      body_sha256: string;
      body_byte_length: number;
    }
  | {
      kind: "no_retained_bytes";
      disposition: "policy_forbids_retention" | "inline_limit_exceeded";
      media_type: ContentType;
      encoding: "utf-8";
      body_sha256: string;
      body_byte_length: number;
    };
export type RuntimeArtifactResult =
  | {
      ok: true;
      artifact: RuntimeArtifact;
      capture_evidence: ObservedResponseEvidence;
    }
  | {
      ok: false;
      error: {
        code: "invalid_encoding" | "invalid_payload" | "prohibited_data";
      };
    };

/** Fixture-only pipeline: raw bytes exist only inside this function and are disposed on every exit. */
export async function prepareFixtureArtifact(
  input: {
    content_type: ContentType;
    original_bytes: Uint8Array;
    disposition: "inline_redacted" | "no_retained_bytes";
  },
  dependencies: {
    disposeOriginal(): void;
  },
): Promise<RuntimeArtifactResult> {
  try {
    let original: string;
    try {
      original = new TextDecoder("utf-8", { fatal: true }).decode(
        input.original_bytes,
      );
    } catch {
      return { ok: false, error: { code: "invalid_encoding" } };
    }
    const capture_evidence = {
      original_body_sha256: createHash("sha256")
        .update(original, "utf8")
        .digest("hex"),
      original_body_byte_length: Buffer.byteLength(original, "utf8"),
    };
    if (
      scanProhibitedFixtureData(original).some(
        (issue) => issue === "embedded_binary" || issue === "embedded_control",
      )
    )
      return { ok: false, error: { code: "prohibited_data" } };
    const redacted = redactFixturePayload(input.content_type, original);
    if (redacted === null)
      return { ok: false, error: { code: "invalid_payload" } };
    if (scanProhibitedFixtureData(redacted).length > 0)
      return { ok: false, error: { code: "prohibited_data" } };
    const body_byte_length = Buffer.byteLength(redacted, "utf8");
    const body_sha256 = createHash("sha256")
      .update(redacted, "utf8")
      .digest("hex");
    if (input.disposition === "inline_redacted") {
      if (body_byte_length > MAX_INLINE_REDACTED_BYTES_V2)
        return {
          ok: true,
          capture_evidence,
          artifact: {
            kind: "no_retained_bytes",
            disposition: "inline_limit_exceeded",
            media_type: input.content_type,
            encoding: "utf-8",
            body_sha256,
            body_byte_length,
          },
        };
      return {
        ok: true,
        capture_evidence,
        artifact: {
          kind: "inline_redacted",
          bytes: redacted,
          media_type: input.content_type,
          encoding: "utf-8",
          body_sha256,
          body_byte_length,
        },
      };
    }
    return {
      ok: true,
      capture_evidence,
      artifact: {
        kind: "no_retained_bytes",
        disposition: "policy_forbids_retention",
        media_type: input.content_type,
        encoding: "utf-8",
        body_sha256,
        body_byte_length,
      },
    };
  } finally {
    dependencies.disposeOriginal();
  }
}
