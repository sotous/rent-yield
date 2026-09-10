import { readFile } from "node:fs/promises";

import type { ResidentialListing } from "./contracts.js";
import { inspectListingForRentModel } from "./workbench.js";

const inputPath = readInputPath(process.argv.slice(2));
const rawInput = await readFile(inputPath, "utf8");
const listing = JSON.parse(rawInput) as ResidentialListing;
const report = inspectListingForRentModel(listing);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function readInputPath(args: string[]): string {
  const inputIndex = args.indexOf("--input");
  const inputPath = inputIndex === -1 ? undefined : args[inputIndex + 1];

  if (!inputPath) {
    throw new Error("Usage: rent-model --input <listing.json>");
  }

  return inputPath;
}
