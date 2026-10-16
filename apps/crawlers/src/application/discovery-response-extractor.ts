import { createHash } from "node:crypto";
import { parseFragment } from "parse5";
export type DiscoveryExtractionRuleV1 =
  | { state: "unreviewed" }
  | {
      state: "reviewed";
      kind: "html_anchor_href";
      extractor_version: string;
      candidate_hosts: string[];
      candidate_path_prefixes: string[];
      allow_no_candidates: boolean;
    };

export type HtmlAnchorHrefExtractionRule = Extract<
  DiscoveryExtractionRuleV1,
  { state: "reviewed" }
>;

const canonicalExtractorDefinition = JSON.stringify({
  kind: "html_anchor_href",
  version: "html-anchor-href-v1",
  input: "bounded_utf8_html_response_bytes",
  selection: "anchor_href_only",
  resolution: "WHATWG_URL_against_response_url",
  retention:
    "sorted_unique_https_credential_free_query_free_fragment_free_allowlisted_urls_only",
  disposal: "zero_original_bytes_on_every_exit",
});

/**
 * Identity of this generic extractor implementation. The SHA-256 is derived
 * from the canonical descriptor above, so it is stable and independently
 * reproducible without exposing any source response.
 */
export const htmlAnchorHrefExtractor = {
  kind: "html_anchor_href" as const,
  version: "html-anchor-href-v1",
  sha256: createHash("sha256")
    .update(canonicalExtractorDefinition, "utf8")
    .digest("hex"),
};

export type DiscoveryExtractionResult =
  | { ok: true; candidates: string[] }
  | {
      ok: false;
      error: {
        code:
          | "extraction_rule_unavailable"
          | "extraction_rule_unreviewed"
          | "extractor_version_mismatch"
          | "invalid_response_url"
          | "invalid_utf8"
          | "unsupported_media_type";
      };
    };

type HtmlNode = {
  nodeName?: string;
  tagName?: string;
  attrs?: ReadonlyArray<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

function isHtml(contentType: string | null): boolean {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() === "text/html";
}

function pathAllowed(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => {
    if (prefix === "/") return true;
    if (pathname === prefix) return true;
    const boundary = prefix.endsWith("/") ? prefix : `${prefix}/`;
    return pathname.startsWith(boundary);
  });
}

function canonicalCandidate(
  href: string,
  responseUrl: URL,
  rule: HtmlAnchorHrefExtractionRule,
): string | null {
  let url: URL;
  try {
    url = new URL(href, responseUrl);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !rule.candidate_hosts.includes(url.hostname.toLowerCase()) ||
    !pathAllowed(url.pathname, rule.candidate_path_prefixes)
  ) {
    return null;
  }
  return url.href;
}

function collectAnchorHrefs(
  node: HtmlNode,
  responseUrl: URL,
  rule: HtmlAnchorHrefExtractionRule,
  candidates: Set<string>,
): void {
  if (node.tagName === "a") {
    const href = node.attrs?.find(
      (attribute) => attribute.name === "href",
    )?.value;
    if (href !== undefined) {
      const candidate = canonicalCandidate(href, responseUrl, rule);
      if (candidate) candidates.add(candidate);
    }
  }
  for (const child of node.childNodes ?? []) {
    collectAnchorHrefs(child, responseUrl, rule, candidates);
  }
}

/**
 * Extracts the only source-derived payload permitted for a discovery
 * observation. The HTML and all rejected hrefs remain local to this function;
 * every raw input byte is cleared before it returns.
 */
export function extractDiscoveryCandidates(input: {
  content_type: string | null;
  response_url: string;
  original_bytes: Uint8Array;
  rule?: DiscoveryExtractionRuleV1;
}): DiscoveryExtractionResult {
  try {
    if (!input.rule) {
      return { ok: false, error: { code: "extraction_rule_unavailable" } };
    }
    if (input.rule.state !== "reviewed") {
      return { ok: false, error: { code: "extraction_rule_unreviewed" } };
    }
    if (input.rule.extractor_version !== htmlAnchorHrefExtractor.version) {
      return { ok: false, error: { code: "extractor_version_mismatch" } };
    }
    if (!isHtml(input.content_type)) {
      return { ok: false, error: { code: "unsupported_media_type" } };
    }
    let responseUrl: URL;
    try {
      responseUrl = new URL(input.response_url);
    } catch {
      return { ok: false, error: { code: "invalid_response_url" } };
    }
    let html: string;
    try {
      html = new TextDecoder("utf-8", { fatal: true }).decode(
        input.original_bytes,
      );
    } catch {
      return { ok: false, error: { code: "invalid_utf8" } };
    }
    const candidates = new Set<string>();
    collectAnchorHrefs(
      parseFragment(html),
      responseUrl,
      input.rule,
      candidates,
    );
    return { ok: true, candidates: [...candidates].sort() };
  } finally {
    input.original_bytes.fill(0);
  }
}
