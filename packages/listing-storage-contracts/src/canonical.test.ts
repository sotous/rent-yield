import { describe, expect, it } from "vitest";
import { canonicalJson, canonicalSet } from "./canonical.js";

describe("canonical JSON conformance", () => {
  it("directly serializes UTF-16 sorted keys, including integer-like names", () => {
    expect(
      canonicalJson({ 2: "two", 10: "ten", z: 1, a: { b: 2, a: 1 } }),
    ).toBe('{"10":"ten","2":"two","a":{"a":1,"b":2},"z":1}');
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });
  it("preserves semantic arrays, but normalizes declared sets and rejects duplicates", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
    expect(canonicalSet([{ b: 2 }, { a: 1 }])).toEqual([{ a: 1 }, { b: 2 }]);
    expect(canonicalSet([2, 10])).toEqual([10, 2]);
    expect(() =>
      canonicalSet([
        { a: 1, b: 2 },
        { b: 2, a: 1 },
      ]),
    ).toThrow();
  });
  it("distinguishes absent and null and rejects undefined rather than silently dropping it", () => {
    expect(canonicalJson({})).not.toBe(canonicalJson({ a: null }));
    expect(() => canonicalJson({ a: undefined })).toThrow();
    expect(() => canonicalJson([undefined])).toThrow();
    expect(() => canonicalJson(Array(1))).toThrow();
  });
  it("preserves supplementary Unicode and UTF-8 identity without normalization", () => {
    const expected = '{"😀":"café","\uE000":"é"}';
    expect(canonicalJson({ "\uE000": "é", "😀": "café" })).toBe(expected);
    expect(
      new TextEncoder().encode(canonicalJson({ "😀": "café", "\uE000": "é" })),
    ).toEqual(new TextEncoder().encode(expected));
    expect(canonicalJson("é")).not.toBe(canonicalJson("é"));
    for (const value of [
      "\uD800",
      "\uDC00",
      { "\uD800": "x" },
      { a: "\uDC00" },
    ])
      expect(() => canonicalJson(value)).toThrow();
  });
  it("rejects unsupported JSON values and noncanonical numbers", () => {
    for (const value of [
      NaN,
      Infinity,
      -0,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      1n,
      new Date(),
      new Map(),
      () => 1,
      Symbol("x"),
    ])
      expect(() => canonicalJson(value)).toThrow();
    expect(canonicalJson(Number.MAX_SAFE_INTEGER)).toBe("9007199254740991");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow();
  });
});
