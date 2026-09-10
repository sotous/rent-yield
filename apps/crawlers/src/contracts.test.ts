import { describe, expect, it } from "vitest";
import {
  contractSchemas,
  methodologyManifestExample,
} from "@rent-yield/listing-storage-contracts";
import { validateEnvelope } from "./workbench.js";

describe("crawler consumes the shared contract", () => {
  it("validates a frozen synthetic manifest without activating it", () => {
    const result = validateEnvelope(
      contractSchemas.methodology_manifest,
      methodologyManifestExample,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toHaveProperty("approval");
      expect(result.data).not.toHaveProperty("status");
    }
  });
  it("rejects unknown versions at the consumer boundary", () => {
    const result = validateEnvelope(contractSchemas.methodology_manifest, {
      ...methodologyManifestExample,
      contract_version: "v9",
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "unsupported_contract_version", issues: [] },
    });
  });
});
