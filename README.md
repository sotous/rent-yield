# rent-yield

`rent-yield` is a monorepo for a fullstack real estate application focused on helping users explore residential properties through rental return signals.

The first version is centered on a simple visual workflow:

1. Select an area on a map.
2. Load the properties in that area.
3. Rank those properties on a chart by `gross rent yield`.

## Why This Exists

Real estate users can often find sale prices and rent estimates, but they usually cannot compare properties in one area through a single clear investment-oriented visual ranking.

`rent-yield` is designed to close that gap with a map-plus-chart explorer that helps answer:

`In this area, which properties appear to offer the strongest rental return relative to their sale price?`

## Version One

Version one is intentionally narrow.

- Geography: `Colombia`
- First supported region: `Barranquilla`
- Core view: `map + ranked property chart`
- Primary metric: `gross rent yield`
- Secondary metric in domain only: `sale-to-rent ratio`
- No authentication in v1
- No advanced underwriting in v1

## Product Principles

- The map answers `where`.
- The chart answers `which`.
- The default metric should be easy to interpret.
- Estimated values should be labeled clearly.
- Version one should stay ergonomically simple.

## Repository Structure

- `apps/frontend`: frontend application
- `apps/backend`: backend application
- `specs`: product and technical specifications

## Specs

- [Frontend Product Spec](/Users/soto/Documents/rent-yield/specs/frontend-spec.md)
- [Shared Domain Spec](/Users/soto/Documents/rent-yield/specs/domain-spec.md)

These specs are the current source of truth for product framing, domain language, and version-one scope.

## Development Approach

This repository is being developed through spec-driven development.

That means we define:

1. product behavior,
2. shared domain rules,
3. interaction design,
4. backend responsibilities,
5. implementation details.

In that order whenever possible.

## Current Status

The repository is currently in the planning and specification phase.

What already exists:

- monorepo structure
- initial README
- frontend product spec
- shared domain spec

What comes next:

- root LLM context files
- frontend interaction spec
- Colombia scope refinement
- backend specification
- application scaffolding

## Long-Term Direction

Future versions may expand into:

- richer area analytics
- more comparison tools
- better rent estimation workflows
- additional Colombian cities
- deeper financial modeling

## License

No license has been defined yet.
