# Business Model and Market Validation

**Research date:** 2026-08-05  
**Scope:** Colombia, with Barranquilla as the initial market  
**Plan:** `plan/business-model-market-validation.md`

## Executive conclusion

Rent Yield has a credible market opportunity, but not as a generic property portal or standalone rental-yield calculator. The strongest opportunity is a Colombia-first investment search layer that joins property discovery with transparent rental evidence and a defensible comparison workflow.

The recommended beachhead is investor-facing brokers and boutique inmobiliarias in Barranquilla. They have recurring, monetizable needs: comparing opportunities for clients, explaining investment cases, and producing credible recommendations quickly. Active individual rental investors are the strongest secondary audience and the best source of direct product feedback.

The business is promising but not yet validated. The largest unresolved risk is data economics: current, property-level rental evidence and reliable listing normalization may require licensed sources, partnerships, or a manual data operation before software revenue is possible.

## Evidence snapshot

- DANE reports that renting or sub-renting was the predominant housing tenure for Colombian households in 2025 at 40.8%, with 18.9 million households nationally. [DANE ECV 2025](https://www.dane.gov.co/files/operaciones/ECV/cp-ECV-2025.pdf)
- BBVA Research estimates around 7.3 million Colombian households in rental housing versus 7.1 million in owned housing and describes rental housing as an increasingly important investment market. [BBVA Research, Situación Inmobiliaria Colombia 2025](https://www.bbvaresearch.com/publicaciones/colombia-situacion-inmobiliaria-2025/)
- Barranquilla reported 10,870 new-home sales in 2025 versus 6,863 in 2024, a 58.39% increase. This is a strong market-activity signal, but it includes owner-occupier and subsidized demand and does not prove rental-investor demand. [Alcaldía de Barranquilla](https://barranquilla.gov.co/mi-barranquilla/barranquilla-crece-46-veces-mas-en-la-venta-de-vivienda-nueva-que-el-resto-del-pais)
- Fincaraíz reports that Barranquilla’s 2025 portal demand was 67% arriendo and 33% venta, while its apartment supply was split approximately evenly between rental and sale interest. It also identifies Riomar, Alto Prado, and Villa Santos as the most consulted Barranquilla neighborhoods. [Fincaraíz market report](https://www.fincaraiz.com.co/blog/radiografia-del-mercado-inmobiliario-2025/)
- The Barranquilla cadastral observatory shows substantial spatial variation in property and rent values, supporting a neighborhood-level comparison use case. [Observatorio Catastro Barranquilla](https://catastro.barranquilla.gov.co/observatorio-catastro/)

These signals establish a large and active housing context. They do not yet establish willingness to pay for Rent Yield, which requires direct customer validation.

## Audience prioritization

| Rank | Audience                                           | Why it matters                                                                                      | Initial offer hypothesis                                                       | Main risk                                                   |
| ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1    | Investor-facing brokers and boutique inmobiliarias | Recurring analysis need; better analysis can help win or close investor clients                     | Team subscription, branded/shareable reports, investor comparison workspace    | They may expect CRM or lead generation rather than analysis |
| 2    | Active individual rental investors                 | Strongest direct product fit; repeatedly compare neighborhoods, properties, financing, and expenses | Free explorer plus paid saved research, alerts, reports, and scenario analysis | Many will expect a free calculator                          |
| 3    | Property managers                                  | Can use benchmarking for owner reports, repricing, and acquisition advice                           | Portfolio analytics, owner reports, data/API access                            | Existing management software already owns their budget      |
| 4    | Analysts and research teams                        | High value per account and demand for granular, exportable data                                     | Professional data subscription, exports, methodology and custom geographies    | High standards for provenance and consistency               |
| 5    | Curious buyers                                     | Broad acquisition funnel and SEO audience                                                           | Free educational explorer, one-time report, or partner referral                | Episodic use and low willingness to pay                     |

The audience recommendation is a hypothesis inferred from recurring workflows, market structure, and existing product pricing. It is not a substitute for interviews or paid pilots.

## Competitive assessment

### Colombian portals and substitutes

FincaRaíz, Metrocuadrado, and Ciencuadras already provide the core discovery layer: location search, sale/rent inventory, filters, maps or location context, listing pages, and advertiser contact. Their primary incentives are listings, leads, financing, appraisal, insurance, and transaction services. Public workflows generally do not provide a neutral, transparent ranking of existing listings by gross rent yield.

LaHaus Pro is the strongest direct feature competitor: it offers investment-oriented search and projected profitability for selected development inventory and rental strategies. Its narrower, developer-led inventory creates room for a neutral resale and cross-source comparison product.

STR Radar Colombia is an especially important local competitor. It already advertises Colombian sale/rent comparables, estimated rent using two methods, hedonic pricing, an interactive map, saved investments, PDFs, and Barranquilla coverage. This means “Colombia + map + rental analysis” is not an uncontested position. [STR Radar Colombia](https://analizandopropiedades.com/)

Inmovalue, InmoPredict, Renteo, and several calculator products further validate that Colombian users can find investment analysis, rent estimation, and scenario tools today. They also show that the calculator itself is not a durable differentiator.

### International benchmarks

Mashvisor sets the benchmark for map-based property discovery, rental estimates, comps, heatmaps, opportunity scores, and ROI analysis, but its comprehensive coverage is primarily the United States and its paid plans start around USD 49.99/month. [Mashvisor pricing](https://www.mashvisor.com/pricing)

DealCheck demonstrates the expected underwriting depth, but documents that automated property data and comps are US-only; outside the US, users manually enter property and comp information. [DealCheck international support](https://help.dealcheck.io/en/articles/2023022-can-i-use-dealcheck-to-analyze-properties-in-canada-australia-europe-or-other-countries)

PropertyData demonstrates that deep geographic localization can be a product moat, while AirDNA demonstrates the value of transparent confidence, comparable listings, and scenario assumptions for short-term rentals. These are benchmarks, not direct Colombia competitors.

## Differentiation that remains credible

Rent Yield should not position itself as “another portal” or “the best calculator.” The credible positioning is:

> A transparent Colombia-first map for finding and comparing residential rental-yield opportunities.

The differentiators to test are:

- Join sale and rental evidence by neighborhood, property type, bedrooms, and area.
- Rank opportunities by a visible gross-yield calculation.
- Show the comparable rental listings behind each estimate.
- Preserve source listing URLs and timestamps.
- Detect duplicates, stale listings, and low-confidence estimates.
- Start with traditional rental yield and clearly separate asking-price yield from conservative estimated yield.
- Add administration as the first important cost adjustment, followed by vacancy and maintenance assumptions.
- Provide a shareable investment case for a broker, partner, or client.

The defensible asset is the structured, deduplicated, time-stamped relationship between Colombian listings, neighborhoods, sale prices, rents, and assumptions.

## Business-model recommendation

### Recommended sequence

1. Keep the public explorer free enough to acquire search demand and collect usage feedback.
2. Sell a professional plan to investor-facing brokers and boutique inmobiliarias, centered on branded reports, saved comparisons, and team usage.
3. Add an individual-investor paid tier for alerts, historical neighborhood views, scenario analysis, and exportable reports.
4. Explore property-management and analyst/API offerings only after the data panel is reliable.
5. Treat brokerage, mortgage, insurance, and property-management referrals as later options, not the initial product identity.

### Why this sequence

Consumer traffic is useful but likely low-value per user and episodic. Brokers have a direct economic reason to pay if the product improves conversion or makes investor recommendations more credible. This creates a more testable early revenue hypothesis than relying on advertising or transaction commissions before there is meaningful traffic.

### Pricing hypothesis

Do not set final pricing from competitor list prices alone. Test three offers with real prospects:

- Individual research: low-cost monthly or one-time report.
- Broker: per-seat monthly plan with branded reports and saved client comparisons.
- Boutique team: higher-priced workspace with shared data, exports, and usage limits.

The first pricing test should measure paid conversion or a meaningful commitment such as a deposit, signed pilot, or recurring weekly use—not survey enthusiasm.

## Viability risks

### Data availability and licensing

Official sources are useful for macro context: DANE housing-price indicators, DANE household and rent data, Camacol market activity, and the Barranquilla cadastral observatory. They do not provide a single open feed of current realized rents by neighborhood and property attributes.

The product will likely need a combination of licensed feeds, agency partnerships, user-provided data, and carefully governed listing observations. Portal scraping or republishing should not be assumed to be commercially permissible.

### Trust and metric interpretation

Gross yield excludes vacancy, administration, maintenance, insurance, taxes, financing, and transaction costs. It is appropriate as a first-pass ranking metric, but the UI must label it as gross and estimated. Confidence, freshness, sample size, and source provenance should be first-class product information.

### Competitive response

FincaRaíz, Metrocuadrado, and Ciencuadras possess distribution and inventory advantages. LaHaus Pro and STR Radar already demonstrate analytical overlap. Rent Yield must win through a focused workflow and better evidence, not inventory breadth or feature count.

### Local-market concentration

Barranquilla is a good data-quality wedge, but it may be too small for a consumer-only subscription business. A broker-led model or later expansion to Cartagena, Medellín, Bogotá, and Cali may be necessary after validating the workflow.

## Recommended validation experiments

1. Interview 10 investor-facing brokers or boutique inmobiliarias in Barranquilla. Ask them to walk through their last investor recommendation and show the actual tools, spreadsheets, and data sources used.
2. Run a concierge pilot with 3–5 brokers: manually prepare a ranked yield comparison for their real listings and measure whether they reuse it with clients.
3. Interview 10 active rental investors who have evaluated a property in the last 12 months. Test whether they would pay for trusted comparisons, not merely a calculator.
4. Build a small, manually verified Barranquilla dataset for three neighborhoods and compare Rent Yield’s estimates against portal asking rents and broker judgment.
5. Test three landing-page offers: free explorer, one-time investor report, and broker workspace. Measure qualified signups, report purchases, pilot commitments, and repeat use.
6. Before scaling ingestion, validate source rights and obtain at least one data partnership or explicit permission pathway.

## Retrospective

The research met the plan’s audience, market, competitor, and business-model objectives. It also changed the initial framing in two important ways:

- The opportunity is not an empty category; local competitors already offer parts of the workflow.
- Data provenance and professional workflow value are more important than adding more financial metrics.

The outcome is ergonomically sound for the current v1 map-and-chart concept, provided the product communicates uncertainty and keeps gross yield as an exploratory signal rather than presenting it as an investment verdict.

The next iteration should happen before broad feature expansion: validate broker demand, validate data rights, and test whether manually verified comparisons create repeated value. Authentication, advanced underwriting, and national coverage should remain out of scope until those tests produce evidence.

## Documentation impact

The product specs should be updated to reflect:

- investor-facing brokers as a primary commercial audience;
- active rental investors as a secondary audience;
- source provenance, freshness, duplicate status, and confidence as product requirements;
- shareable comparison/report output as a likely post-v1 validation feature;
- gross yield as a first-pass signal that should eventually be complemented by net-yield assumptions.

These changes should be made through a separate product-spec update after the validation experiments confirm the workflow.
