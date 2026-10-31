import {
  buildSourceAdapter,
  validateAdapterCandidate,
  type AdapterCandidate,
  type ListingInput,
  type ListingOperation,
} from "@rent-yield/source-adapter-builder";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
export const MAX_HTTPS_REDIRECTS = 5;

export type OperationFailureStatus = "fetch_failed" | "parse_failed";

export type ParsedOperationResult = {
  requestUrl: string;
  status: "parsed";
  listingCount: number;
};

export type FailedOperationResult = {
  requestUrl: string;
  status: OperationFailureStatus;
  error: { code: string; summary: string };
};

export type OperationRunResult = ParsedOperationResult | FailedOperationResult;

export type CrawlRunArtifact = {
  schemaVersion: 1;
  sourceKey: string;
  sourceName: string;
  cityName: string;
  startedAt: string;
  completedAt: string;
  status: "succeeded" | "failed";
  operations: Partial<Record<ListingOperation, OperationRunResult>>;
  listings: ListingInput[];
};

export type CrawlResult =
  | { kind: "candidate_failed"; code: string }
  | { kind: "completed"; artifact: CrawlRunArtifact };

type CrawlDependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

class OperationFetchError extends Error {
  constructor(
    readonly code: string,
    readonly summary: string,
  ) {
    super(summary);
  }
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The response is already unusable; the safe outcome is still a stop.
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await discardBody(response);
    throw new OperationFetchError(
      "response_too_large",
      `Response body exceeded the ${maxBytes}-byte limit.`,
    );
  }

  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw new OperationFetchError(
          "response_too_large",
          `Response body exceeded the ${maxBytes}-byte limit.`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof OperationFetchError) throw error;
    throw new OperationFetchError(
      "network_error",
      "The response body could not be read.",
    );
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

async function retrieveResponse(
  requestUrl: string,
  fetchImplementation: typeof fetch,
  options: { timeoutMs: number; maxResponseBytes: number },
): Promise<{ contentType: string; body: string }> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(
        new OperationFetchError(
          "timeout",
          `Request exceeded the ${options.timeoutMs}-ms timeout.`,
        ),
      );
    }, options.timeoutMs);
  });

  const request = async (): Promise<{ contentType: string; body: string }> => {
    let currentUrl = requestUrl;
    let redirects = 0;
    while (true) {
      const response = await fetchImplementation(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        await discardBody(response);
        if (location === null || redirects >= MAX_HTTPS_REDIRECTS) {
          throw new OperationFetchError(
            "redirect_policy",
            "The response exceeded the allowed HTTPS redirect policy.",
          );
        }
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, currentUrl);
        } catch {
          throw new OperationFetchError(
            "redirect_policy",
            "The response contained an invalid redirect location.",
          );
        }
        if (
          redirectUrl.protocol !== "https:" ||
          redirectUrl.username !== "" ||
          redirectUrl.password !== ""
        ) {
          throw new OperationFetchError(
            "redirect_policy",
            "Only credential-free HTTPS redirects are allowed.",
          );
        }
        currentUrl = redirectUrl.href;
        redirects += 1;
        continue;
      }

      if (!response.ok) {
        await discardBody(response);
        throw new OperationFetchError(
          "http_status",
          `The source returned HTTP status ${response.status}.`,
        );
      }

      return {
        contentType: response.headers.get("content-type") ?? "",
        body: await readBoundedBody(response, options.maxResponseBytes),
      };
    }
  };

  try {
    return await Promise.race([request(), timeout]);
  } catch (error) {
    if (error instanceof OperationFetchError) throw error;
    if (timedOut) {
      throw new OperationFetchError(
        "timeout",
        `Request exceeded the ${options.timeoutMs}-ms timeout.`,
      );
    }
    throw new OperationFetchError(
      "network_error",
      "The source request failed.",
    );
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function failedFetch(
  requestUrl: string,
  error: OperationFetchError,
): FailedOperationResult {
  return {
    requestUrl,
    status: "fetch_failed",
    error: { code: error.code, summary: error.summary },
  };
}

export async function crawlCandidate(
  input: unknown,
  dependencies: CrawlDependencies = {},
): Promise<CrawlResult> {
  const validation = validateAdapterCandidate(input);
  if (validation.kind === "rejected") {
    return { kind: "candidate_failed", code: validation.code };
  }

  const built = buildSourceAdapter(input as AdapterCandidate);
  if (built.kind !== "built") {
    return { kind: "candidate_failed", code: built.code };
  }

  const candidate = validation.candidate;
  const adapter = built.adapter;
  const fetchImplementation = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maxResponseBytes =
    dependencies.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const startedAt = nowIso(now);
  const operations: Partial<Record<ListingOperation, OperationRunResult>> = {};
  const listings: ListingInput[] = [];

  for (const operation of adapter.supportedOperations) {
    const requestUrl = adapter.sourceUrls[operation];
    if (requestUrl === undefined) {
      operations[operation] = {
        requestUrl: "",
        status: "fetch_failed",
        error: {
          code: "missing_request_url",
          summary:
            "The adapter has no configured request URL for this operation.",
        },
      };
      continue;
    }

    let response: { contentType: string; body: string };
    try {
      response = await retrieveResponse(requestUrl, fetchImplementation, {
        timeoutMs,
        maxResponseBytes,
      });
    } catch (error) {
      const fetchError =
        error instanceof OperationFetchError
          ? error
          : new OperationFetchError(
              "network_error",
              "The source request failed.",
            );
      operations[operation] = failedFetch(requestUrl, fetchError);
      continue;
    }

    const observedAt = nowIso(now);
    const parsed = adapter.parse({
      operation,
      sourceUrl: requestUrl,
      contentType: response.contentType,
      body: response.body,
      observedAt,
    });
    if (parsed.kind === "parse_failed") {
      operations[operation] = {
        requestUrl,
        status: "parse_failed",
        error: {
          code: parsed.code,
          summary: "The source adapter could not parse the response.",
        },
      };
      continue;
    }
    listings.push(...parsed.listings);
    operations[operation] = {
      requestUrl,
      status: "parsed",
      listingCount: parsed.listings.length,
    };
  }

  const completedAt = nowIso(now);
  const failed = Object.values(operations).some(
    (operation) => operation?.status !== "parsed",
  );
  return {
    kind: "completed",
    artifact: {
      schemaVersion: 1,
      sourceKey: adapter.sourceKey,
      sourceName: candidate.sourceName,
      cityName: candidate.cityName,
      startedAt,
      completedAt,
      status: failed ? "failed" : "succeeded",
      operations,
      listings,
    },
  };
}
