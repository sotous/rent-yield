import { describe, expect, it } from "vitest";

import {
  buildSourceAdapter,
  validateAdapterCandidate,
} from "@rent-yield/source-adapter-builder";

describe("public source-adapter-builder entry point", () => {
  it("exports candidate validation and adapter construction", () => {
    expect(typeof validateAdapterCandidate).toBe("function");
    expect(typeof buildSourceAdapter).toBe("function");
  });
});
