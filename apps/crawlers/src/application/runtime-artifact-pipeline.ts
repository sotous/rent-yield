import { createHash } from "node:crypto";
import { MAX_INLINE_REDACTED_BYTES_V2 } from "@rent-yield/listing-storage-contracts";
import {
  redactFixturePayload,
  scanProhibitedFixtureData,
} from "./fixture-capture.js";

type ContentType = "application/json" | "text/html" | "text/plain";
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
      disposition: "policy_forbids_retention";
      media_type: ContentType;
      encoding: "utf-8";
      body_sha256: string;
      body_byte_length: number;
    }
  | {
      kind: "staged_reference";
      reference_id: string;
      media_type: ContentType;
      encoding: "utf-8";
      body_sha256: string;
      body_byte_length: number;
    };
export type RuntimeArtifactResult =
  | { ok: true; artifact: RuntimeArtifact }
  | {
      ok: false;
      error: {
        code:
          | "invalid_encoding"
          | "invalid_payload"
          | "prohibited_data"
          | "inline_limit_exceeded";
      };
    };

/** Fixture-only pipeline: raw bytes exist only inside this function and are disposed on every exit. */
export async function prepareFixtureArtifact(
  input: {
    content_type: ContentType;
    original_bytes: Uint8Array;
    disposition: "inline_redacted" | "no_retained_bytes" | "staged_reference";
  },
  dependencies: {
    disposeOriginal(): void;
    stageRedacted?: (input: {
      bytes: string;
      media_type: ContentType;
      encoding: "utf-8";
      body_sha256: string;
      body_byte_length: number;
    }) => Promise<{ ok: true; reference_id: string } | { ok: false }>;
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
        return { ok: false, error: { code: "inline_limit_exceeded" } };
      return {
        ok: true,
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
    if (input.disposition === "staged_reference") {
      if (!dependencies.stageRedacted)
        return { ok: false, error: { code: "invalid_payload" } };
      const staged = await dependencies.stageRedacted({
        bytes: redacted,
        media_type: input.content_type,
        encoding: "utf-8",
        body_sha256,
        body_byte_length,
      });
      if (!staged.ok) return { ok: false, error: { code: "invalid_payload" } };
      return {
        ok: true,
        artifact: {
          kind: "staged_reference",
          reference_id: staged.reference_id,
          media_type: input.content_type,
          encoding: "utf-8",
          body_sha256,
          body_byte_length,
        },
      };
    }
    return {
      ok: true,
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
