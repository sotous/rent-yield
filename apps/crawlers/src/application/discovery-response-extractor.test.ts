import { describe, expect, it } from "vitest";
import {
  extractDiscoveryCandidates,
  htmlAnchorHrefExtractor,
} from "./discovery-response-extractor.js";

const rule = {
  state: "reviewed" as const,
  kind: "html_anchor_href" as const,
  extractor_version: "html-anchor-href-v1",
  candidate_hosts: ["listings.example.com"],
  candidate_path_prefixes: ["/rentals"],
  allow_no_candidates: true,
};

function bytes(html: string): Uint8Array {
  return new TextEncoder().encode(html);
}

describe("discovery response extractor", () => {
  it("exposes a stable, reproducible generic extractor identity", () => {
    expect(htmlAnchorHrefExtractor).toEqual({
      kind: "html_anchor_href",
      version: "html-anchor-href-v1",
      sha256: "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
    });
  });

  it("extracts only allowed anchor hrefs as sorted unique canonical HTTPS URLs", () => {
    const original = bytes(`
      <a href="/rentals/second">second</a>
      <a href="https://listings.example.com/rentals/first">first</a>
      <a href="/rentals/second">duplicate</a>
    `);

    expect(
      extractDiscoveryCandidates({
        content_type: "text/html; charset=utf-8",
        response_url: "https://listings.example.com/search",
        original_bytes: original,
        rule,
      }),
    ).toEqual({
      ok: true,
      candidates: [
        "https://listings.example.com/rentals/first",
        "https://listings.example.com/rentals/second",
      ],
    });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("drops foreign, unsafe, out-of-scope, and non-anchor links without retaining them", () => {
    const original = bytes(`
      <a href="https://foreign.example/rentals/one">foreign</a>
      <a href="http://listings.example.com/rentals/two">http</a>
      <a href="https://user:listings.example.com@evil.example/rentals/three">credentials</a>
      <a href="https://listings.example.com/rentals/four?tracking=1">query</a>
      <a href="https://listings.example.com/rentals/five#section">fragment</a>
      <a href="https://listings.example.com/sale/six">out of scope</a>
      <link href="https://listings.example.com/rentals/seven" rel="next">
    `);

    expect(
      extractDiscoveryCandidates({
        content_type: "text/html",
        response_url: "https://listings.example.com/search",
        original_bytes: original,
        rule,
      }),
    ).toEqual({ ok: true, candidates: [] });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("fails closed for a non-HTML response and disposes its original bytes", () => {
    const original = bytes('{"unretained":true}');

    expect(
      extractDiscoveryCandidates({
        content_type: "application/json",
        response_url: "https://listings.example.com/search",
        original_bytes: original,
        rule,
      }),
    ).toEqual({ ok: false, error: { code: "unsupported_media_type" } });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("fails closed without a Storage-provided extraction rule and disposes its original bytes", () => {
    const original = bytes('<a href="/rentals/one">one</a>');

    expect(
      extractDiscoveryCandidates({
        content_type: "text/html",
        response_url: "https://listings.example.com/search",
        original_bytes: original,
      }),
    ).toEqual({ ok: false, error: { code: "extraction_rule_unavailable" } });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("fails closed for an unreviewed Storage rule and disposes its original bytes", () => {
    const original = bytes('<a href="/rentals/one">one</a>');

    expect(
      extractDiscoveryCandidates({
        content_type: "text/html",
        response_url: "https://listings.example.com/search",
        original_bytes: original,
        rule: { state: "unreviewed" },
      }),
    ).toEqual({ ok: false, error: { code: "extraction_rule_unreviewed" } });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("fails closed when Storage requests a different extractor version", () => {
    const original = bytes('<a href="/rentals/one">one</a>');

    expect(
      extractDiscoveryCandidates({
        content_type: "text/html",
        response_url: "https://listings.example.com/search",
        original_bytes: original,
        rule: { ...rule, extractor_version: "another-extractor-v1" },
      }),
    ).toEqual({ ok: false, error: { code: "extractor_version_mismatch" } });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("fails closed for malformed UTF-8 and disposes its original bytes", () => {
    const original = new Uint8Array([0xc3, 0x28]);

    expect(
      extractDiscoveryCandidates({
        content_type: "text/html",
        response_url: "https://listings.example.com/search",
        original_bytes: original,
        rule,
      }),
    ).toEqual({ ok: false, error: { code: "invalid_utf8" } });
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });
});
