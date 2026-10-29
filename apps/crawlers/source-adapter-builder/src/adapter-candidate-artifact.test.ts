import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { validateAdapterCandidate } from "./adapter-candidate.js";
import { buildSourceAdapter } from "./source-adapter-builder.js";

describe("adapter candidate artifacts", () => {
  it.each([
    [
      "the synthetic rent-only candidate",
      "../fixtures/candidates/example-baq-rentals.json",
      "example-baq-rentals",
      ["rent"],
    ],
    [
      "the D.C. Colombia rent and sale candidate",
      "../candidates/dc-colombia.json",
      "dc-colombia",
      ["rent", "sale"],
    ],
  ])(
    "validates %s",
    async (_description, relativePath, sourceKey, operations) => {
      const text = await readFile(
        new URL(relativePath, import.meta.url),
        "utf8",
      );
      const candidate = JSON.parse(text);

      expect(validateAdapterCandidate(candidate)).toMatchObject({
        kind: "accepted",
        candidate: {
          sourceKey,
          supportedOperations: operations,
        },
      });
      expect(buildSourceAdapter(candidate).kind).toBe("built");
    },
  );
});
