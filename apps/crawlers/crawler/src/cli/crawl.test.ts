import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCrawlerCli } from "./crawl.js";

const candidate = {
  sourceKey: "fixture-source",
  sourceName: "Fixture Source",
  sourceUrl: "https://fixture.example",
  countryCode: "CO",
  cityName: "Barranquilla",
  operations: {
    rent: {
      requestUrl: "https://fixture.example/listings?operation=rent",
      extractionRecipe: {
        contentType: "application/json",
        listingCollectionPath: "results.items",
        fields: { id: "id", priceCop: "price" },
      },
    },
  },
};

const temporaryDirectories: string[] = [];

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "rent-yield-crawler-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("runCrawlerCli", () => {
  it("loads a candidate and writes a schema-versioned default artifact without modifying it", async () => {
    const repositoryRoot = await makeTempDirectory();
    const candidatePath = join(repositoryRoot, "candidate.json");
    const candidateText = JSON.stringify(candidate, null, 2);
    await writeFile(candidatePath, candidateText);
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: { items: [{ id: "rent-1", price: 1800000 }] },
          }),
          {
            headers: { "content-type": "application/json" },
          },
        ),
    );

    const result = await runCrawlerCli(["--candidate", "candidate.json"], {
      repositoryRoot,
      fetch,
      now: () => new Date("2026-10-30T12:00:00.000Z"),
    });

    expect(result.exitCode).toBe(0);
    expect(result.artifactPath).toBe(
      join(
        repositoryRoot,
        "data/crawler-runs/fixture-source/2026-10-30T12:00:00.000Z.json",
      ),
    );
    const written = JSON.parse(
      await readFile(result.artifactPath!, "utf8"),
    ) as {
      schemaVersion: number;
      status: string;
      listings: Array<{ sourceListingId: string }>;
    };
    expect(written).toMatchObject({
      schemaVersion: 1,
      status: "succeeded",
      listings: [{ sourceListingId: "rent-1" }],
    });
    expect(await readFile(candidatePath, "utf8")).toBe(candidateText);
  });

  it("writes a partial artifact and exits nonzero when an operation fails", async () => {
    const repositoryRoot = await makeTempDirectory();
    await writeFile(
      join(repositoryRoot, "candidate.json"),
      JSON.stringify(candidate),
    );
    const fetch = vi.fn(async () => new Response("oops", { status: 403 }));

    const result = await runCrawlerCli(
      ["--candidate", "candidate.json", "--output", "runs/partial.json"],
      { repositoryRoot, fetch },
    );

    expect(result.exitCode).toBe(1);
    expect(result.summary).toMatchObject({ status: "failed" });
    const artifact = JSON.parse(
      await readFile(join(repositoryRoot, "runs/partial.json"), "utf8"),
    );
    expect(artifact.operations.rent.status).toBe("fetch_failed");
  });

  it("refuses to overwrite an existing output file", async () => {
    const repositoryRoot = await makeTempDirectory();
    await writeFile(
      join(repositoryRoot, "candidate.json"),
      JSON.stringify(candidate),
    );
    await writeFile(join(repositoryRoot, "existing.json"), "keep me");

    const result = await runCrawlerCli(
      ["--candidate", "candidate.json", "--output", "existing.json"],
      { repositoryRoot, fetch: async () => new Response("{}") },
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toMatchObject({ code: "output_exists" });
    expect(await readFile(join(repositoryRoot, "existing.json"), "utf8")).toBe(
      "keep me",
    );
  });

  it("rejects duplicate, missing, and unknown arguments before file access", async () => {
    const repositoryRoot = await makeTempDirectory();
    const fetch = vi.fn();

    for (const args of [
      ["--candidate", "a.json", "--candidate", "b.json"],
      ["--candidate"],
      ["--candidate", "a.json", "--unknown", "value"],
    ]) {
      const result = await runCrawlerCli(args, { repositoryRoot, fetch });
      expect(result.exitCode).toBe(2);
      expect(result.error?.code).toBe("invalid_arguments");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not fetch or write when the candidate JSON is malformed", async () => {
    const repositoryRoot = await makeTempDirectory();
    await writeFile(join(repositoryRoot, "candidate.json"), "{");
    const fetch = vi.fn();

    const result = await runCrawlerCli(["--candidate", "candidate.json"], {
      repositoryRoot,
      fetch,
    });

    expect(result.exitCode).toBe(1);
    expect(result.error?.code).toBe("invalid_json");
    expect(fetch).not.toHaveBeenCalled();
  });
});
