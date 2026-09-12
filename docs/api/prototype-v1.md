# Prototype v1 API

## Summary

This is the practical frontend-facing API guide for the prototype v1 explorer.

The API is read-only and Barranquilla-first. It is designed to replace the
current frontend fake data with backend-served areas, summaries, and ranked
property records.

For the formal contract, see
[backend-api-spec.md](../../specs/backend-api-spec.md).

For the scoped frontend consumer boundary, see
[prototype-v1-consumer-contract.md](prototype-v1-consumer-contract.md).

## Flow

The frontend should load data in two steps:

1. Request available Barranquilla areas.
2. Request the full map-plus-chart payload for the selected area.

```text
GET /api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla
GET /api/v1/explorer/areas/{area_id}
```

## Bootstrap Example

### Request

```http
GET /api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla
```

### Response

```json
{
  "default_area_id": "barranquilla",
  "data_label": "Prototype data",
  "areas": [
    {
      "area_id": "barranquilla",
      "country_code": "CO",
      "area_type": "city",
      "display_name": "Barranquilla",
      "city_name": "Barranquilla",
      "description": "City-level prototype area for Barranquilla.",
      "parent_area_id": null,
      "centroid_latitude": 10.9878,
      "centroid_longitude": -74.7889,
      "zoom": 12,
      "bounding_box": null,
      "geometry_reference": null
    },
    {
      "area_id": "alto-prado",
      "country_code": "CO",
      "area_type": "neighborhood",
      "display_name": "Alto Prado",
      "city_name": "Barranquilla",
      "description": "Named prototype area around Alto Prado.",
      "parent_area_id": "barranquilla",
      "centroid_latitude": 11.004,
      "centroid_longitude": -74.811,
      "zoom": 14,
      "bounding_box": null,
      "geometry_reference": null
    }
  ]
}
```

## Selected Area Example

### Request

```http
GET /api/v1/explorer/areas/alto-prado
```

### Response

```json
{
  "data_label": "Prototype data",
  "area": {
    "area_id": "alto-prado",
    "country_code": "CO",
    "area_type": "neighborhood",
    "display_name": "Alto Prado",
    "city_name": "Barranquilla",
    "description": "Named prototype area around Alto Prado.",
    "parent_area_id": "barranquilla",
    "centroid_latitude": 11.004,
    "centroid_longitude": -74.811,
    "zoom": 14,
    "bounding_box": null,
    "geometry_reference": null
  },
  "summary": {
    "area_id": "alto-prado",
    "display_name": "Alto Prado",
    "area_type": "neighborhood",
    "property_count": 2,
    "median_sale_price_amount": 550000000,
    "median_monthly_rent_amount": 3350000,
    "median_gross_rent_yield": 0.07441176470588234,
    "average_gross_rent_yield": 0.07441176470588234,
    "min_gross_rent_yield": 0.0688235294117647,
    "max_gross_rent_yield": 0.08,
    "median_sale_to_rent_ratio": 13.514957264957264,
    "data_coverage_score": null
  },
  "sort": {
    "metric": "gross_rent_yield",
    "direction": "desc",
    "tie_breakers": [
      {
        "metric": "sale_to_rent_ratio",
        "direction": "asc"
      },
      {
        "metric": "monthly_rent_amount",
        "direction": "desc"
      }
    ]
  },
  "properties": [
    {
      "property_id": "baq-001",
      "country_code": "CO",
      "city_name": "Barranquilla",
      "area_id": "alto-prado",
      "neighborhood_name": "Alto Prado",
      "locality_name": null,
      "address_label": "Carrera 54 near Parque Washington",
      "listing_url": "https://example.com/rent-yield/listings/baq-001",
      "latitude": 11.0061,
      "longitude": -74.8097,
      "property_type": "apartment",
      "bedrooms": 2,
      "bathrooms": 2,
      "interior_area_sqm": 82,
      "sale_price_amount": 420000000,
      "sale_price_currency": "COP",
      "monthly_rent_amount": 2800000,
      "monthly_rent_currency": "COP",
      "annual_rent": 33600000,
      "gross_rent_yield": 0.08,
      "sale_to_rent_ratio": 12.5,
      "listing_status": "for_sale",
      "rent_source_type": "estimated_model",
      "sale_price_source_type": "observed_listing",
      "metric_status": "estimated_input",
      "observed_at": null
    },
    {
      "property_id": "baq-002",
      "country_code": "CO",
      "city_name": "Barranquilla",
      "area_id": "alto-prado",
      "neighborhood_name": "Alto Prado",
      "locality_name": null,
      "address_label": "Calle 79 corridor apartment",
      "listing_url": "https://example.com/rent-yield/listings/baq-002",
      "latitude": 11.0019,
      "longitude": -74.8114,
      "property_type": "apartment",
      "bedrooms": 3,
      "bathrooms": 3,
      "interior_area_sqm": 118,
      "sale_price_amount": 680000000,
      "sale_price_currency": "COP",
      "monthly_rent_amount": 3900000,
      "monthly_rent_currency": "COP",
      "annual_rent": 46800000,
      "gross_rent_yield": 0.0688235294117647,
      "sale_to_rent_ratio": 14.52991452991453,
      "listing_status": "for_sale",
      "rent_source_type": "observed_listing",
      "sale_price_source_type": "observed_listing",
      "metric_status": "valid",
      "observed_at": null
    }
  ]
}
```

## Empty Area Example

An empty area is a successful response, not an error.

```json
{
  "data_label": "Prototype data",
  "area": {
    "area_id": "sample-empty-area",
    "country_code": "CO",
    "area_type": "neighborhood",
    "display_name": "Sample Empty Area",
    "city_name": "Barranquilla",
    "description": null,
    "parent_area_id": "barranquilla",
    "centroid_latitude": 11,
    "centroid_longitude": -74.8,
    "zoom": 14,
    "bounding_box": null,
    "geometry_reference": null
  },
  "summary": {
    "area_id": "sample-empty-area",
    "display_name": "Sample Empty Area",
    "area_type": "neighborhood",
    "property_count": 0,
    "median_sale_price_amount": null,
    "median_monthly_rent_amount": null,
    "median_gross_rent_yield": null,
    "average_gross_rent_yield": null,
    "min_gross_rent_yield": null,
    "max_gross_rent_yield": null,
    "median_sale_to_rent_ratio": null,
    "data_coverage_score": null
  },
  "sort": {
    "metric": "gross_rent_yield",
    "direction": "desc",
    "tie_breakers": [
      {
        "metric": "sale_to_rent_ratio",
        "direction": "asc"
      },
      {
        "metric": "monthly_rent_amount",
        "direction": "desc"
      }
    ]
  },
  "properties": []
}
```

## Error Example

```json
{
  "error": {
    "code": "area_not_found",
    "message": "We could not find that area for the prototype explorer.",
    "request_id": "req_123"
  }
}
```

## Frontend Integration Notes

- Keep showing `rent return`, `yearly rent return`, `best rent returns`, and
  `typical rent return` in the UI.
- Treat `gross_rent_yield` as a decimal payload value. Format `0.08` as `8.0%`.
- Keep the explorer frame visible during loading, empty, and error states.
- Show estimated labels when `metric_status` is `estimated_input` or a source
  type is `estimated_model`.
- Show `listing_url` only as a contextual `View listing` link when a property is
  hovered, focused, or selected.
- Preserve backend sorting unless a later frontend interaction explicitly allows
  the user to change the order.
