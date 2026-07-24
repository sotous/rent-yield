# Rent Yield Frontend

This app is the first runnable frontend prototype for `rent-yield`.

It is a fake-data-first Barranquilla explorer with:

- named demo-area selection
- MapLibre property markers
- area summary metrics
- ranked rent-return rows
- metric explanation copy

Run from the repository root:

```sh
pnpm install
pnpm dev
```

Useful checks:

```sh
pnpm check
pnpm --filter @rent-yield/frontend test:e2e
```

The prototype currently uses local fake data under `src/data`. Backend payload
contracts should be derived after the frontend interaction model has been
reviewed.
