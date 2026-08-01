import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RankedYieldChart } from "../../../src/components/RankedYieldChart";
import type { PropertyRecord } from "../../../src/domain/propertyTypes";

const makeProperty = (
  overrides: Partial<PropertyRecord> = {},
): PropertyRecord => ({
  property_id: "property-1",
  country_code: "CO",
  city_name: "Barranquilla",
  area_id: "alto-prado",
  neighborhood_name: "Alto Prado",
  locality_name: null,
  address_label: "Carrera 54 apartment",
  listing_url: "https://example.com/listings/property-1",
  latitude: 11.0061,
  longitude: -74.8097,
  property_type: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  interior_area_sqm: 82,
  sale_price_amount: 420000000,
  sale_price_currency: "COP",
  monthly_rent_amount: 2800000,
  monthly_rent_currency: "COP",
  annual_rent: 33600000,
  gross_rent_yield: 0.08,
  sale_to_rent_ratio: 12.5,
  listing_status: "for_sale",
  rent_source_type: "observed_listing",
  sale_price_source_type: "observed_listing",
  metric_status: "valid",
  observed_at: null,
  ...overrides,
});

function renderChart(
  properties: PropertyRecord[],
  options: {
    highlightedPropertyId?: string | null;
    selectedPropertyId?: string | null;
    onHighlightProperty?: (propertyId: string | null) => void;
    onSelectProperty?: (propertyId: string) => void;
  } = {},
) {
  return render(
    <RankedYieldChart
      properties={properties}
      highlightedPropertyId={options.highlightedPropertyId ?? null}
      selectedPropertyId={options.selectedPropertyId ?? null}
      onHighlightProperty={options.onHighlightProperty ?? vi.fn()}
      onSelectProperty={options.onSelectProperty ?? vi.fn()}
    />,
  );
}

describe("RankedYieldChart", () => {
  it("renders the empty state without a ranked list", () => {
    renderChart([]);

    expect(
      screen.getByText(
        "No properties are available for this area in the prototype dataset.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("list", {
        name: "Properties ranked by yearly rent return",
      }),
    ).not.toBeInTheDocument();
  });

  it("highlights on hover and reveals listing details only when a URL exists", () => {
    const onHighlightProperty = vi.fn();
    const propertyWithListing = makeProperty();
    const propertyWithoutListing = makeProperty({
      property_id: "property-2",
      address_label: "Calle 79 apartment",
      listing_url: null,
      gross_rent_yield: 0.06,
    });

    const { rerender } = renderChart(
      [propertyWithListing, propertyWithoutListing],
      {
        onHighlightProperty,
      },
    );

    const firstRow = screen.getByRole("button", {
      name: /Carrera 54 apartment/i,
    });
    fireEvent.mouseEnter(firstRow);

    expect(onHighlightProperty).toHaveBeenLastCalledWith("property-1");
    rerender(
      <RankedYieldChart
        properties={[propertyWithListing, propertyWithoutListing]}
        highlightedPropertyId="property-1"
        selectedPropertyId={null}
        onHighlightProperty={onHighlightProperty}
        onSelectProperty={vi.fn()}
      />,
    );
    expect(document.querySelector(".ry-chart__detail")?.textContent).toMatch(
      /annual gross rent return/,
    );
    expect(
      screen.getByRole("link", {
        name: /View listing example\.com\/listings\/property-1/i,
      }),
    ).toHaveAttribute("href", propertyWithListing.listing_url);

    fireEvent.mouseLeave(firstRow);
    expect(onHighlightProperty).toHaveBeenLastCalledWith(null);

    rerender(
      <RankedYieldChart
        properties={[propertyWithListing, propertyWithoutListing]}
        highlightedPropertyId={null}
        selectedPropertyId={null}
        onHighlightProperty={onHighlightProperty}
        onSelectProperty={vi.fn()}
      />,
    );

    const secondRow = screen.getByRole("button", {
      name: /Calle 79 apartment/i,
    });
    fireEvent.mouseEnter(secondRow);
    expect(onHighlightProperty).toHaveBeenLastCalledWith("property-2");
    rerender(
      <RankedYieldChart
        properties={[propertyWithListing, propertyWithoutListing]}
        highlightedPropertyId="property-2"
        selectedPropertyId={null}
        onHighlightProperty={onHighlightProperty}
        onSelectProperty={vi.fn()}
      />,
    );
    expect(document.querySelectorAll(".ry-chart__detail")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /View listing/i }),
    ).not.toBeInTheDocument();
  });

  it("marks the selected row and calls the selection handler", () => {
    const onSelectProperty = vi.fn();
    const property = makeProperty();
    const { rerender } = renderChart([property], { onSelectProperty });
    const rowButton = screen.getByRole("button", {
      name: /Carrera 54 apartment/i,
    });

    expect(rowButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(rowButton);

    expect(onSelectProperty).toHaveBeenCalledWith("property-1");

    rerender(
      <RankedYieldChart
        properties={[property]}
        highlightedPropertyId={null}
        selectedPropertyId="property-1"
        onHighlightProperty={vi.fn()}
        onSelectProperty={onSelectProperty}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Carrera 54 apartment/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".ry-chart__detail")?.textContent).toMatch(
      /annual gross rent return/,
    );
  });
});
