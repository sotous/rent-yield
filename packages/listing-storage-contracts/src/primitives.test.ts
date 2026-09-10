import { describe, expect, it } from "vitest";
import {
  contractVersionSchema,
  decimalSchema,
  positiveDecimalSchema,
  instantSchema,
  sourceDateSchema,
  sha256Schema,
  safeNonNegativeIntegerSchema,
} from "./primitives.js";

describe("v1 primitive conformance", () => {
  it("rejects trailing line breaks in canonical strings and unsafe schema integers", () => {
    expect(decimalSchema.safeParse("12\n").success).toBe(false);
    expect(sha256Schema.safeParse("a".repeat(64) + "\n").success).toBe(false);
    expect(
      sourceDateSchema.safeParse({
        raw_text: "2024",
        precision: "year",
        value: "2024\n",
      }).success,
    ).toBe(false);
    expect(safeNonNegativeIntegerSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    for (const value of [-0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(safeNonNegativeIntegerSchema.safeParse(value).success).toBe(false);
  });
  it("rejects unsupported contract versions", () => {
    expect(contractVersionSchema.parse("v1")).toBe("v1");
    for (const value of [1, "1", "v2", "1.0"])
      expect(contractVersionSchema.safeParse(value).success).toBe(false);
  });
  it("preserves canonical decimals without rounding", () => {
    for (const value of [
      "0",
      "12.5",
      "-74.8",
      "0.0000000000000000001",
      "9007199254740993123",
    ])
      expect(decimalSchema.parse(value)).toBe(value);
    for (const value of [
      "01",
      "12.50",
      "1e3",
      "-0",
      "+1",
      ".5",
      "1.",
      "0.0",
      "-0.0",
      12.5,
    ])
      expect(decimalSchema.safeParse(value).success).toBe(false);
    expect(positiveDecimalSchema.parse("0.0000000000000000001")).toBe(
      "0.0000000000000000001",
    );
    for (const value of ["0", "-1", "-0.1"])
      expect(positiveDecimalSchema.safeParse(value).success).toBe(false);
  });
  it("requires real UTC calendar instants with milliseconds", () => {
    expect(instantSchema.parse("2024-02-29T23:59:59.999Z")).toBe(
      "2024-02-29T23:59:59.999Z",
    );
    for (const value of [
      "2023-02-29T00:00:00.000Z",
      "2024-04-31T00:00:00.000Z",
      "2024-01-01T24:00:00.000Z",
      "2024-01-01T00:00:60.000Z",
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00.000+00:00",
    ])
      expect(instantSchema.safeParse(value).success).toBe(false);
  });
  it("keeps source-date precision and unknown raw text without inventing instants", () => {
    for (const [precision, value] of [
      ["day", "2024-02-29"],
      ["month", "2024-02"],
      ["year", "2024"],
      ["instant", "2024-02-29T00:00:00.000Z"],
    ]) {
      expect(
        sourceDateSchema.parse({ raw_text: "source claim", precision, value }),
      ).toEqual({ raw_text: "source claim", precision, value });
    }
    expect(
      sourceDateSchema.parse({ raw_text: "ayer", precision: "unknown" }),
    ).toEqual({ raw_text: "ayer", precision: "unknown" });
    for (const claim of [
      { raw_text: "x", precision: "day", value: "2023-02-29" },
      { raw_text: "x", precision: "month", value: "2024-13" },
      { raw_text: "x", precision: "year", value: "24" },
      { raw_text: "x", precision: "unknown", value: "2024-01-01" },
      { raw_text: "x", precision: "day", value: "2024-01-01T00:00:00.000Z" },
    ])
      expect(sourceDateSchema.safeParse(claim).success).toBe(false);
  });
});
