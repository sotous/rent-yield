# Frontend API Integration Coverage

## Goal

Strengthen confidence in the frontend consumer integration by testing the
browser-to-backend path and the API response shape used by the explorer.

## Scope

- Verify the bootstrap and selected-area responses through the running Fastify
  API and Vite proxy.
- Verify the frontend handles a selected-area API failure while keeping the
  explorer shell available.
- Keep component and backend unit tests focused on their own boundaries.

## Relevant References

- `specs/frontend-spec.md`
- `specs/backend-api-spec.md`
- `apps/frontend/src/features/explorer/explorerApi.ts`
- `apps/frontend/playwright.config.ts`

## Approach

1. Add an end-to-end contract-shape test that asserts the response fields the
   frontend consumer relies on for bootstrap and selected-area payloads.
2. Add an end-to-end failure test that intercepts the selected-area response
   with a server error and verifies the frontend error state.
3. Run frontend unit tests, coverage, Playwright, typecheck, lint, formatting,
   and the repository check.

## Risks and Assumptions

- Playwright uses the real backend and fake repository, so the contract test
  validates the complete local integration without requiring external data.
- The failure test uses Playwright routing to isolate frontend error behavior;
  backend route error semantics remain covered by backend tests.

## Success Criteria

- The browser receives the expected API contract through the Vite proxy.
- A selected-area API failure produces the documented frontend error state.
- Existing tests and coverage thresholds remain green.
