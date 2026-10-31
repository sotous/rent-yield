# Crawler PoC

`@rent-yield/crawler` connects a saved `AdapterCandidate` JSON file to its
generated source adapter. It fetches each configured operation once, parses the
actual response through the adapter, and writes a schema-versioned local run
artifact. It does not paginate, retry, schedule, persist to a database, or call
the Rent Model.

## Run a candidate

From the repository root:

```sh
pnpm --filter @rent-yield/crawler crawl \
  --candidate apps/crawlers/source-adapter-builder/candidates/dc-colombia.json
```

Choose an explicit output path with `--output`:

```sh
pnpm --filter @rent-yield/crawler crawl \
  --candidate apps/crawlers/source-adapter-builder/candidates/ciencuadras.json \
  --output data/crawler-runs/ciencuadras/manual-smoke.json
```

Paths are resolved from the repository root unless absolute. The default output
is `data/crawler-runs/<sourceKey>/<startedAt>.json`. The crawler uses exclusive
file creation and never replaces an existing artifact. Generated run artifacts
are ignored by Git.

## Fetch and parse behavior

The crawler sends one GET to each configured operation URL, in rent then sale
order where present. Requests use a 30-second timeout and a 10 MiB response
limit. Redirects are followed only when they remain on credential-free HTTPS,
for at most five hops. The parser receives the configured request URL, actual
response content type, response body as text, operation, and UTC observation
timestamp. Raw response bodies are not written to artifacts.

An operation is recorded as `parsed`, `fetch_failed`, or `parse_failed`. Failures
do not stop later operations. Successful listings are retained in a partial
artifact, and the command exits nonzero if any configured operation fails. A
valid empty response is successful with zero listings. Invalid candidates fail
before network access and do not produce artifacts.

The command prints one JSON summary containing source key, run status, operation
statuses and listing counts, total listing count, and artifact path. Candidate
and adapter contracts are documented in the
[source-adapter builder guide](../source-adapter-builder/README.md); the
[crawler PoC spec](../../../docs/specs/crawler-poc-spec.md) is authoritative for
the artifact shape and behavior.
