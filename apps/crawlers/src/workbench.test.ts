import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateEnvelope } from "./workbench.js";

describe("offline contract validation", () => {
  const schema = z.strictObject({
    contract_version: z.literal("v1"),
    value: z.string(),
  });
  it("returns a typed unsupported version without echoing raw input", () => {
    expect(
      validateEnvelope(schema, { contract_version: "v2", secret: "private" }),
    ).toEqual({
      ok: false,
      error: { code: "unsupported_contract_version", issues: [] },
    });
  });
  it("returns sanitized schema issues for missing or invalid v1 fields", () => {
    const result = validateEnvelope(schema, {
      contract_version: "v1",
      value: 42,
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_input",
        issues: [{ code: "invalid_type", path: ["value"] }],
      },
    });
  });
  it("returns validated data and rejects unknown keys", () => {
    expect(
      validateEnvelope(schema, { contract_version: "v1", value: "frozen" }),
    ).toEqual({ ok: true, data: { contract_version: "v1", value: "frozen" } });
    expect(
      validateEnvelope(schema, {
        contract_version: "v1",
        value: "frozen",
        live_url: "secret",
      }).ok,
    ).toBe(false);
  });
  it("does not need a clock, network, database or credentials", () => {
    const input = Object.freeze({ contract_version: "v1", value: "frozen" });
    expect(validateEnvelope(schema, input)).toEqual(
      validateEnvelope(schema, input),
    );
  });
});
