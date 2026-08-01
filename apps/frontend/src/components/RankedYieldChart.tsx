import type { CSSProperties } from "react";

import type { PropertyRecord } from "../domain/propertyTypes";
import { formatCurrency, formatPercent } from "../lib/formatters";
import "./rentYieldComponents.css";

type RankedYieldChartProps = {
  properties: PropertyRecord[];
  highlightedPropertyId: string | null;
  selectedPropertyId: string | null;
  onHighlightProperty: (propertyId: string | null) => void;
  onSelectProperty: (propertyId: string) => void;
};

function formatPropertyType(propertyType: string) {
  return propertyType.replaceAll("_", " ");
}

function isEstimated(property: PropertyRecord) {
  return (
    property.metric_status === "estimated_input" ||
    property.rent_source_type === "estimated_model"
  );
}

function propertyFacts(property: PropertyRecord) {
  const facts = [formatPropertyType(property.property_type)];

  if (property.bedrooms != null) {
    facts.push(`${property.bedrooms} hab.`);
  }

  if (property.bathrooms != null) {
    facts.push(`${property.bathrooms} baths`);
  }

  if (property.interior_area_sqm != null) {
    facts.push(`${property.interior_area_sqm} m2`);
  }

  return facts;
}

function formatListingUrl(listingUrl: string) {
  try {
    const url = new URL(listingUrl);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return listingUrl;
  }
}

function getReturnStrength(value: number, minValue: number, maxValue: number) {
  if (maxValue === minValue) {
    return {
      fill: "100%",
      tone: "strong",
    };
  }

  const relativeStrength = (value - minValue) / (maxValue - minValue);
  const minimumVisibleFill = 18;
  const fill =
    minimumVisibleFill + relativeStrength * (100 - minimumVisibleFill);

  if (relativeStrength >= 0.72) {
    return {
      fill: `${fill}%`,
      tone: "strong",
    };
  }

  if (relativeStrength >= 0.38) {
    return {
      fill: `${fill}%`,
      tone: "steady",
    };
  }

  return {
    fill: `${fill}%`,
    tone: "soft",
  };
}

export function RankedYieldChart({
  properties,
  highlightedPropertyId,
  selectedPropertyId,
  onHighlightProperty,
  onSelectProperty,
}: RankedYieldChartProps) {
  const rankedProperties = properties;
  const maxYield = Math.max(
    ...rankedProperties.map((property) => property.gross_rent_yield),
    0,
  );
  const minYield = Math.min(
    ...rankedProperties.map((property) => property.gross_rent_yield),
    maxYield,
  );

  return (
    <section className="ry-card ry-chart" aria-labelledby="ranked-yield-title">
      <div className="ry-card__header">
        <div>
          <p className="ry-eyebrow">Best rent returns</p>
          <h2 className="ry-title" id="ranked-yield-title">
            Yearly rent return
          </h2>
        </div>
        <span className="ry-badge">Highest first</span>
      </div>

      {rankedProperties.length === 0 ? (
        <p className="ry-empty">
          No properties are available for this area in the prototype dataset.
        </p>
      ) : (
        <>
          <div className="ry-chart__scale" aria-hidden="true">
            <span>{formatPercent(minYield)}</span>
            <span>{formatPercent(maxYield)}</span>
          </div>

          <ol
            className="ry-chart__list"
            aria-label="Properties ranked by yearly rent return"
          >
            {rankedProperties.map((property, index) => {
              const highlighted =
                highlightedPropertyId === property.property_id;
              const selected = selectedPropertyId === property.property_id;
              const shouldShowDetail = highlighted || selected;
              const rentQualifier = isEstimated(property)
                ? "estimated monthly rent"
                : "monthly rent";
              const returnStrength = getReturnStrength(
                property.gross_rent_yield,
                minYield,
                maxYield,
              );

              return (
                <li
                  key={property.property_id}
                  className="ry-chart__row"
                  data-highlighted={highlighted}
                  data-selected={selected}
                  data-return-strength={returnStrength.tone}
                  style={{ "--bar-fill": returnStrength.fill } as CSSProperties}
                  onMouseEnter={() => onHighlightProperty(property.property_id)}
                  onMouseLeave={() => onHighlightProperty(null)}
                >
                  <button
                    type="button"
                    className="ry-chart__row-main"
                    aria-pressed={selected}
                    aria-describedby={
                      shouldShowDetail
                        ? `${property.property_id}-yield-detail`
                        : undefined
                    }
                    onBlur={() => onHighlightProperty(null)}
                    onClick={() => onSelectProperty(property.property_id)}
                    onFocus={() => onHighlightProperty(property.property_id)}
                  >
                    <span>
                      <span className="ry-chart__rank">{index + 1}</span>
                      <span className="ry-chart__name">
                        {property.address_label}
                      </span>
                      <span className="ry-chart__meta">
                        <span>{property.neighborhood_name}</span>
                        {propertyFacts(property).map((fact) => (
                          <span key={fact}>/ {fact}</span>
                        ))}
                      </span>
                      <span className="ry-chart__numbers">
                        <span>
                          Sale {formatCurrency(property.sale_price_amount)}
                        </span>
                        <span>
                          Rent {formatCurrency(property.monthly_rent_amount)}
                          /mo.
                        </span>
                        {isEstimated(property) ? (
                          <span className="ry-badge">Estimated rent</span>
                        ) : null}
                      </span>
                    </span>

                    <span className="ry-chart__bar-column" aria-hidden="true">
                      <span className="ry-chart__yield">
                        {formatPercent(property.gross_rent_yield)}
                      </span>
                      <span className="ry-chart__bar-track">
                        <span className="ry-chart__bar-fill">
                          <span className="ry-chart__bar-shine" />
                        </span>
                      </span>
                    </span>

                    {shouldShowDetail ? (
                      <span
                        className="ry-chart__detail"
                        id={`${property.property_id}-yield-detail`}
                      >
                        {formatPercent(property.gross_rent_yield)} annual gross
                        rent return from{" "}
                        {formatCurrency(property.monthly_rent_amount)}{" "}
                        {rentQualifier} against{" "}
                        {formatCurrency(property.sale_price_amount)} sale price.
                        That is about {property.sale_to_rent_ratio.toFixed(1)}{" "}
                        years of rent compared with the price.
                      </span>
                    ) : null}
                  </button>
                  {shouldShowDetail && property.listing_url != null ? (
                    <a
                      className="ry-chart__listing-link"
                      href={property.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View listing ${formatListingUrl(
                        property.listing_url,
                      )}`}
                      onFocus={() => onHighlightProperty(property.property_id)}
                      onBlur={() => onHighlightProperty(null)}
                    >
                      <span>View listing</span>
                      <span className="ry-chart__listing-url">
                        {formatListingUrl(property.listing_url)}
                      </span>
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
