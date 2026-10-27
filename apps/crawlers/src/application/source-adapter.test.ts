import { describe, expect, it, vi } from "vitest";
import { parseSourceFixture, type SourceAdapter } from "./source-adapter.js";
import {
  makeListingInput,
  makeSourceFixture,
} from "../testing/source-adapter.js";

const listing = makeListingInput({
  source_key: "example-source",
  source_listing_id: "listing-1",
});

function adapter(overrides: Partial<SourceAdapter> = {}): SourceAdapter {
  return {
    source_key: "example-source",
    supported_content_types: ["application/json"],
    parseFixture: () => ({ kind: "listed", listings: [listing] }),
    ...overrides,
  };
}

describe("SourceAdapter fixture boundary", () => {
  it("returns ListingInput records in source order after validating them", () => {
    const first = makeListingInput({
      source_key: "example-source",
      source_listing_id: "listing-1",
    });
    const second = makeListingInput({
      source_key: "example-source",
      source_listing_id: "listing-2",
    });

    expect(
      parseSourceFixture(
        adapter({
          parseFixture: () => ({ kind: "listed", listings: [first, second] }),
        }),
        makeSourceFixture({ source_key: "example-source" }),
      ),
    ).toEqual({ kind: "listed", listings: [first, second] });
  });

  it("returns an explicit empty result for a recognized empty fixture", () => {
    expect(
      parseSourceFixture(
        adapter({ parseFixture: () => ({ kind: "listed", listings: [] }) }),
        makeSourceFixture({ source_key: "example-source" }),
      ),
    ).toEqual({ kind: "listed", listings: [] });
  });

  it("fails before parsing a fixture for another source or unsupported content type", () => {
    const parseFixture = vi.fn<SourceAdapter["parseFixture"]>(() => ({
      kind: "listed",
      listings: [listing],
    }));
    const subject = adapter({ parseFixture });

    expect(
      parseSourceFixture(
        subject,
        makeSourceFixture({ source_key: "other-source" }),
      ),
    ).toEqual({ kind: "parse_failed", code: "source_mismatch" });
    expect(
      parseSourceFixture(
        subject,
        makeSourceFixture({
          source_key: "example-source",
          content_type: "text/html",
        }),
      ),
    ).toEqual({ kind: "parse_failed", code: "unsupported_content_type" });
    expect(parseFixture).not.toHaveBeenCalled();
  });

  it("preserves typed parser failures and blocks invalid successful records", () => {
    expect(
      parseSourceFixture(
        adapter({
          parseFixture: () => ({
            kind: "parse_failed",
            code: "unsupported_shape",
          }),
        }),
        makeSourceFixture({ source_key: "example-source" }),
      ),
    ).toEqual({ kind: "parse_failed", code: "unsupported_shape" });

    expect(
      parseSourceFixture(
        adapter({
          parseFixture: () => ({
            kind: "listed",
            listings: [{ ...listing, source_key: "other-source" }],
          }),
        }),
        makeSourceFixture({ source_key: "example-source" }),
      ),
    ).toEqual({ kind: "parse_failed", code: "invalid_listing_input" });

    expect(
      parseSourceFixture(
        adapter({
          parseFixture: () => ({
            kind: "listed",
            listings: [{ ...listing, monthly_asking_rent_cop: "0" }],
          }),
        }),
        makeSourceFixture({ source_key: "example-source" }),
      ),
    ).toEqual({ kind: "parse_failed", code: "invalid_listing_input" });
  });
});
