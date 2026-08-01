import type { DemoArea } from "../domain/propertyTypes";

export const barranquillaDemoAreas: DemoArea[] = [
  {
    area_id: "barranquilla",
    area_type: "city",
    display_name: "Barranquilla",
    city_name: "Barranquilla",
    country_code: "CO",
    description:
      "City-wide prototype view with north and central demo listings.",
    parent_area_id: null,
    centroid_latitude: 10.9878,
    centroid_longitude: -74.7889,
    zoom: 12,
    bounding_box: null,
    geometry_reference: null,
  },
  {
    area_id: "alto-prado",
    area_type: "neighborhood",
    display_name: "Alto Prado",
    city_name: "Barranquilla",
    country_code: "CO",
    description: "Established north Barranquilla area with higher sale prices.",
    parent_area_id: "barranquilla",
    centroid_latitude: 11.0057,
    centroid_longitude: -74.8091,
    zoom: 14,
    bounding_box: null,
    geometry_reference: null,
  },
  {
    area_id: "riomar",
    area_type: "locality",
    display_name: "Riomar",
    city_name: "Barranquilla",
    country_code: "CO",
    description:
      "Northwest demo area with modern apartments and premium rents.",
    parent_area_id: "barranquilla",
    centroid_latitude: 11.0147,
    centroid_longitude: -74.8277,
    zoom: 13.5,
    bounding_box: null,
    geometry_reference: null,
  },
  {
    area_id: "villa-santos",
    area_type: "neighborhood",
    display_name: "Villa Santos",
    city_name: "Barranquilla",
    country_code: "CO",
    description: "Residential demo area near Buenavista and major corridors.",
    parent_area_id: "barranquilla",
    centroid_latitude: 11.0118,
    centroid_longitude: -74.8342,
    zoom: 14,
    bounding_box: null,
    geometry_reference: null,
  },
];

export const defaultArea = barranquillaDemoAreas[0]!;
