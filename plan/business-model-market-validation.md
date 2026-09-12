# Business Model and Market Validation

## Objective

Determine whether Rent Yield solves a sufficiently valuable and underserved problem for a reachable audience, beginning with Colombia and Barranquilla, and identify whether existing software already satisfies the core use case.

## Product hypothesis

Rent Yield helps people move from area discovery to property comparison by combining a map with a ranked view of estimated gross rent yield. Version one is an exploratory product using COP-denominated residential data, not a transaction flow, authentication product, or advanced underwriting tool.

## Questions to answer

1. Which audiences experience the problem often enough to seek a dedicated tool?
2. Which audience has the strongest willingness and ability to pay?
3. How do Colombian users currently discover properties, estimate rent, and compare returns?
4. Which existing portals, calculators, analytics products, spreadsheets, or professional workflows already solve parts or all of the job?
5. Is the map-plus-ranked-yield workflow meaningfully differentiated, or merely a convenient aggregation of existing features?
6. What data quality, trust, freshness, and legal/commercial constraints could prevent viability?
7. What is the smallest viable business model and beachhead market for testing demand?

## Research scope

### Audience segments

- Individual residential investors and aspiring investors
- Real estate agents and brokers serving investor clients
- Property managers and rental operators
- Real estate analysts, acquisition teams, and small developers
- Curious buyers evaluating rental potential

### Competitive set

- Colombian property portals and listing marketplaces
- Real estate valuation, rent-estimation, and market-data products
- Investment calculators and underwriting tools
- Broker, analyst, and investor spreadsheet workflows
- General search and listing aggregation as substitute behavior

### Geography

- Primary: Barranquilla
- Secondary validation: Colombia-wide market and comparable cities
- Analogues: international products only when they clarify category expectations or monetization

## Proposed approach

1. Establish the jobs-to-be-done and rank candidate segments by pain, frequency, reachability, and monetization potential.
2. Audit current software and manual substitutes against the exact v1 workflow: select area, see properties, compare rent return, inspect source listing.
3. Gather market, pricing, and audience evidence from authoritative public sources and product documentation.
4. Identify the minimum trustable data product and the operational burden required to maintain it.
5. Produce a business-model recommendation with a beachhead segment, value proposition, pricing hypothesis, risks, and validation experiments.

## Initial hypotheses to test

- The strongest initial user may be a repeat investor or investor-focused broker rather than a casual buyer.
- Existing Colombian portals likely solve listing discovery but may not provide normalized, comparable rental-return ranking across an area.
- International underwriting tools may solve return calculations but may be too expensive, too advanced, or poorly localized for the Colombia-first use case.
- Data provenance and freshness may matter more to adoption than adding more financial metrics.

## Success criteria

The research is decision-useful when it can state:

- a primary beachhead audience and why it wins;
- the core job and evidence of current pain;
- the closest existing products and the precise gap, if one exists;
- a credible first monetization path;
- the largest viability risks and how to test them;
- whether v1 should proceed unchanged, narrow its audience, change its workflow, or stop.

## Likely outputs

- Audience segmentation and prioritization
- Competitor/substitute matrix
- Differentiation and defensibility assessment
- Business-model options and recommended beachhead
- Demand-validation experiment backlog
- Updates to product/domain documentation if research changes the current scope

## Research status and current conclusion

Completed on 2026-08-05. The evidence supports continuing with focused validation, not yet committing to broad product expansion.

- Recommended beachhead: investor-facing brokers and boutique inmobiliarias in Barranquilla.
- Secondary audience: active individual rental investors.
- Market signal: positive, with strong housing activity and structurally important rental demand.
- Competitive signal: the category is active; LaHaus Pro and STR Radar are direct threats, while FincaRaíz, Metrocuadrado, and Ciencuadras own distribution and inventory.
- Differentiation hypothesis: transparent, localized, time-stamped, deduplicated sale/rent evidence and shareable investment comparisons.
- Primary blocker: commercial data rights and reliable property-level rental evidence.
- Next decision: run broker interviews, concierge pilots, and data-rights validation before expanding the product scope.

See the research memo at [docs/research/business-model-market-validation.md](../docs/research/business-model-market-validation.md).

## Risks and assumptions

- Public listing data may be incomplete, duplicated, stale, or difficult to license.
- Gross rent yield excludes vacancy, maintenance, taxes, financing, and transaction costs; users may overinterpret it as net investment performance.
- A useful product may require a data-collection operation before software revenue is possible.
- Current v1 scope assumes exploration is valuable before authentication, saved searches, or transaction workflows are introduced.
