import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import {
  discoveryObservationV1Schema,
  type DiscoveryObservationAppendResult,
  type DiscoveryObservationRepository,
  type DiscoveryObservationV1,
} from "@rent-yield/listing-storage-contracts";

/**
 * Writes one validated, body-free observation to an explicit absolute target.
 * Hard-linking a private temporary file reserves the target atomically, so a
 * later run cannot overwrite a prior observation.
 */
export class JsonFileDiscoveryObservationRepository implements DiscoveryObservationRepository {
  readonly #path: string;

  constructor(input: { path: string }) {
    if (!isAbsolute(input.path))
      throw new Error("Discovery observation path must be absolute");
    this.#path = input.path;
  }

  async append(
    input: DiscoveryObservationV1,
  ): Promise<DiscoveryObservationAppendResult> {
    const observation = discoveryObservationV1Schema.parse(input);
    const serialized = `${JSON.stringify(observation, null, 2)}\n`;

    try {
      const existing = await readFile(this.#path, "utf8");
      return this.#existing(existing, observation);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    await mkdir(dirname(this.#path), { recursive: true });
    const temporary = `${this.#path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporary, serialized, { encoding: "utf8", flag: "wx" });
      try {
        await link(temporary, this.#path);
        return { appended: true, observation };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        return this.#existing(await readFile(this.#path, "utf8"), observation);
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }

  #existing(
    serialized: string,
    observation: DiscoveryObservationV1,
  ): DiscoveryObservationAppendResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error("Discovery observation target contains invalid JSON");
    }
    const existing = discoveryObservationV1Schema.parse(parsed);
    if (JSON.stringify(existing) !== JSON.stringify(observation))
      throw new Error(
        "Discovery observation target already contains a different observation",
      );
    return { appended: false, observation: existing };
  }
}
