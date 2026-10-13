# Allowlisted discovery capture runbook

## Purpose

This runbook operates one bounded discovery capture as a structured discovery
observation. It is for the Ciencuadras Barranquilla long-term-rental canary.
The command reads one configured discovery response in memory, retains only
configured canonical listing-candidate URLs, and writes one validated
observation. It never writes a page fixture, HTML, DOM fragment, rejected URL,
headers, cookies, token, contact detail, exact address, or raw response body.

The active Storage profile owns the source scope, robots-first two-request
budget, permitted media types, extractor identity, candidate hosts, and exact
candidate path prefixes. Command flags select only the source key, profile
file, and an explicit observation-output location; they cannot widen that
configuration.

## Current live status

Live execution is blocked. The current Ciencuadras profile has an
`unreviewed` extraction rule, so it intentionally supplies no candidate
host/path policy to the extractor. The 2026-10-12 bounded response established
only that robots-first transport completed; its whole-page capture was rejected
and no artifact was retained. It cannot be used to infer a candidate route.

The next unblocker is a reviewed, versioned Storage extraction rule with the
exact candidate host and non-empty path-prefix allowlist, an extractor version
matching the shipped generic extractor, and passing offline profile,
extractor, observation-writer, and command checks. A successful dry run then
verifies that exact configuration without network access. It does not itself
authorize a request or broaden the rule.

## Preconditions

- The merged tree contains the approved extraction profile with one exact,
  non-empty candidate path-prefix allowlist. A same-host rule alone is not
  sufficient.
- The configured output directory is an existing absolute writable directory,
  is not a symbolic link, and has no existing observation with the proposed
  identifier.
- The local kill switch is off.
- The profile, contracts, extractor, command, and output-writer tests pass.
- A dry run has passed from the same merged tree and profile file.
- The standing authorization covers one bounded live Ciencuadras command.

## Network-free preflight

Use the command's dry-run mode before any live invocation:

```sh
pnpm --filter @rent-yield/crawlers discovery-observation -- --dry-run \
  --source-key ciencuadras \
  --profile "$PWD/packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json" \
  --observations "$PWD/.discovery-observations" \
  --observation-id ciencuadras-barranquilla-001
```

Dry run performs no DNS lookup, HTTP request, response decoding, or output
write. Its one JSON result is limited to the source key, scope, transport
budget, permitted media types, profile provenance, extractor version/hash,
candidate host/path allowlist, and output identity. It never prints source
content, arbitrary URLs, or rejected candidates.

Stop if the output location, active profile, extractor configuration, profile
provenance, or candidate route policy is unavailable or inconsistent. Correct
the reviewed configuration and repeat the offline check; do not discover a
route from a live response.

## One bounded live invocation

After preflight succeeds, execute exactly one `--live` command with the same
inputs. The command obtains robots first and then makes at most one configured
discovery request. It has no automatic retry, browser, authentication, proxy,
redirect workaround, pagination, detail request, or source switch.

The completed output is a sanitized receipt and one structured observation.
The observation contains only its contract/capture identity, scope and profile
provenance, extractor identity, sanitized discovery response URL and
digest/byte-length metadata, sorted unique allowlisted candidate URLs, and
aggregate candidate counts. `no_candidates` remains a typed result; it does
not authorize broadening the allowlist or sending another request.

## Stops and review

Stop without retry or output on robots denial, `401`, `403`, `429`, login,
CAPTCHA/challenge, DNS/host/path/redirect/budget/media failure, unsafe response
encoding, extractor rejection, output validation failure, or local kill
switch. Preserve only the typed receipt/result. Do not log, commit, inspect,
or recover original bytes.

After a successful write, inspect the structured observation only. Verify its
source/scope and profile provenance, extractor identity, response digest and
byte length, candidate ordering/uniqueness, and every candidate's HTTPS,
credential-free, query-free, fragment-free host/path conformance. Record the
sanitized result and next action in the review task; no second source request
is implied.
