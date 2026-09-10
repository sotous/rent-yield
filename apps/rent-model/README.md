# Rent Model Workbench

This package is the development workbench for the deterministic long-term
residential asking-rent model.

It does not crawl websites, connect to a database, run an HTTP server, or
calculate yield. It makes the model's data contract explicit before those
consumers exist.

Given a frozen listing-shaped record, the workbench reports:

- whether it can serve as a sale-subject input to the Rent Model;
- database fields the data lake must retain;
- fields each crawler must extract from sale and rental listings;
- the transport-neutral request that a future server can pass to the model;
- confirmation that sale price is excluded from the Rent Model request.

## Why both listing types are needed

```text
for-sale listing  -> subject property and observed sale asking price
for-rent listing  -> observed rental evidence for comparables
Rent Model        -> modeled monthly asking rent
```

The workbench accepts both listing roles, but a sale price never appears in the
Rent Model request. A future yield service may join it after rent estimation.

## Run

From the repository root:

```sh
corepack pnpm --filter @rent-yield/rent-model dev
corepack pnpm --filter @rent-yield/rent-model test
corepack pnpm --filter @rent-yield/rent-model typecheck
```

The included fixture is synthetic but shaped like a Barranquilla sale listing.
Replace it with a frozen, provenance-labeled source snapshot when crawler data
is available.
