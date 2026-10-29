import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { validateAdapterCandidate } from "./adapter-candidate.js";

describe("example adapter candidate artifact", () => {
  it("satisfies the builder candidate contract", async () => {
    const text = await readFile(
      new URL(
        "../fixtures/candidates/example-baq-rentals.json",
        import.meta.url,
      ),
      "utf8",
    );

    expect(validateAdapterCandidate(JSON.parse(text))).toMatchObject({
      kind: "accepted",
      candidate: {
        sourceKey: "example-baq-rentals",
        supportedOperations: ["rent"],
      },
    });
  });
});
