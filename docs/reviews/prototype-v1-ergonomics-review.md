# Prototype v1 Ergonomics Review

## Summary

The first runnable frontend prototype satisfies the core version-one ergonomic
goal: the map answers `where`, and the ranked chart answers `which`.

The implementation is strong enough to close the initial ergonomics review and
move to the backend prototype contract. A narrow follow-up iteration is still
worth tracking for stronger data states and browser coverage, but it does not
block the next planning step.

## Reviewed Against

- `README.md`
- `specs/frontend-spec.md`
- `specs/frontend-interaction-spec.md`
- `specs/domain-spec.md`
- `plan/prototype-v1-explorer-foundation.md`
- `docs/architecture/frontend-prototype-v1.md`

## What Works

The explorer keeps the first screen centered on the intended workflow:

- choose a Barranquilla demo area
- see the map preserve geographic context
- scan ranked properties beside the map
- compare homes by user-facing `rent return` language

The chart is doing the heaviest product work well. It sorts by
`gross_rent_yield`, displays exact percentages, uses relative bar length for
scanability, labels estimated rent plainly, and exposes a compact property
summary on hover, focus, or selection.

The most recent listing-link iteration fits the same ergonomics. The original
post URL stays hidden until a result is hovered, focused, or selected, so every
row is not overloaded. Once a user shows interest, `View listing` gives a direct
path to the source post without creating a property-detail page or transaction
flow.

The map and chart share property ids, so highlighting can move between the
geographic and ranking surfaces. That supports the product principle without
adding extra controls.

## Spec Alignment

The prototype aligns with the main frontend spec:

- one main explorer screen
- Colombia-first, Barranquilla-first framing
- map plus ranked property chart
- default ranking by `gross rent yield`
- user-facing `rent return` language
- estimated values labeled clearly
- no authentication, underwriting, comparison, metric toggle, or transaction
  flow

It also aligns with the interaction spec's first-pass model:

- local explorer state is explicit enough for the prototype
- named demo areas drive the active property set
- chart rows support hover and keyboard focus
- map markers and chart rows share highlighted and selected property ids
- responsive layout preserves the same map-plus-chart workflow

## Divergences And Caveats

The prototype does not yet model all data states explicitly. It handles the fake
data ready state and a chart empty state, but there is no fuller error-state
surface because no real backend request exists yet.

Viewport movement is tracked, but moving the map does not become the active area
selection. This is acceptable for v1 because named demo areas were allowed as
the simpler first implementation path.

Browser coverage is still smoke-level. It proves the app shell and contextual
listing link behavior, but it does not yet cover area switching, map/chart
cross-highlighting, or mobile layout assertions.

The map is useful as geographic context, but the named area controls currently
carry more of the selection burden than the map itself. That is acceptable for
the fake-data prototype, but it should be revisited once real geographic payloads
exist.

## Iteration Decision

Do not block the backend prototype contract on another frontend polish pass.

The right next step is to define the backend contract from the proven frontend
needs:

- area records
- property records
- area summaries
- listing source URLs
- metric values and metric status

Create a later frontend iteration task for stronger ergonomics once the backend
contract clarifies which states and payload shapes are real.

## Follow-Up Candidates

- Add browser coverage for named-area switching.
- Add browser coverage for map and chart cross-highlighting.
- Define the first real loading, empty, and error states when backend data is
  connected.
- Revisit whether map movement should become viewport-driven area selection.

## Verdict

Task 6, `Review prototype v1 ergonomics against the specs`, is complete.

The prototype is ergonomically sound for the first frontend slice, and the
remaining items are better handled as follow-up iteration after the backend
prototype contract is defined.
