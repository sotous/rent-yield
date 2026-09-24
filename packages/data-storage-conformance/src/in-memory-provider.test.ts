import {
  durableSubmissionV2Vector,
  runDurableSubmissionV2Conformance,
} from "@rent-yield/listing-storage-contracts";
import { describe, expect, it } from "vitest";
import { InMemoryDurableSubmissionV2Provider } from "./in-memory-provider.js";

describe("InMemoryDurableSubmissionV2Provider", () => {
  it("passes the shared DurableSubmissionV2 runner and vectors", async () => {
    const provider = new InMemoryDurableSubmissionV2Provider();

    await expect(
      runDurableSubmissionV2Conformance(provider, provider),
    ).resolves.toEqual({ passed: true });
  });

  it("keeps receipt progress terminal and receipt references isolated", async () => {
    const provider = new InMemoryDurableSubmissionV2Provider();
    const receipt = await provider.accept(durableSubmissionV2Vector);
    if ("code" in receipt) throw new Error("expected accepted receipt");

    await expect(provider.progress("unknown-receipt")).resolves.toEqual([]);
    expect(() =>
      provider.recordTerminalProgress("unknown-receipt", {
        occurred_at: "2026-09-24T00:00:00.000Z",
        state: "failed",
        code: "unknown_receipt",
        reason: "Receipt was not accepted.",
      }),
    ).toThrow("Unknown receipt");

    const committed = provider.recordTerminalProgress(receipt.receipt_id, {
      occurred_at: "2026-09-24T00:00:00.000Z",
      state: "committed",
      code: null,
      reason: null,
    });
    await expect(provider.progress(receipt.receipt_id)).resolves.toEqual([
      committed,
    ]);
    expect(() =>
      provider.recordTerminalProgress(receipt.receipt_id, {
        occurred_at: "2026-09-24T00:01:00.000Z",
        state: "failed",
        code: "later_failure",
        reason: "A terminal event already exists.",
      }),
    ).toThrow("Terminal progress already recorded");
    await expect(provider.progress(receipt.receipt_id, 1)).resolves.toEqual([]);
  });
});
