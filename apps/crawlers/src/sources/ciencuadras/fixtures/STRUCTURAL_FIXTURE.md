# Ciencuadras structural fixture

`rental-discovery.structural.html` is a parser test fixture, not a retained
crawler response or source-data archive.

On 2026-10-26, bounded in-memory inspection confirmed these source structures:

- `script#breadcrumb-schema` with `itemListElement[*].name`;
- `script#searchResults-schema` with `itemListElement[*].@id`;
- `itemListElement[*].item.url`; and
- `itemListElement[*].item.offers.price`, `priceCurrency`, `url`, and
  `itemOffered.numberOfBathroomsTotal`.

The fixture preserves only that nesting and those field names. Listing-specific
scalars, including IDs, URLs, prices, and names, are deterministic non-source
test values. It retains only the confirmed page-level city literal required to
prove an explicit city mapping. It must never be treated as crawler output,
evidence, or a retained source fixture.
