import { describe, expect, it } from "vitest";
import { contractSchemas, contractJsonSchemas } from "./catalog.js";

describe("shared v1 schema catalog", () => {
  it("publishes every foundation envelope as strict JSON Schema", () => {
    expect(Object.keys(contractSchemas).sort()).toEqual([
      "access_assessment",
      "extraction_contract",
      "fixture_envelope",
      "methodology_lookup",
      "methodology_manifest",
      "methodology_proposal",
      "probe_result",
      "review_decision",
      "source_candidate",
      "source_health",
      "validation_report",
    ]);
    for (const name of Object.keys(contractSchemas)) {
      const document =
        contractJsonSchemas[name as keyof typeof contractSchemas];
      expect(document.$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(JSON.parse(JSON.stringify(document))).toEqual(document);
    }
  });
});
