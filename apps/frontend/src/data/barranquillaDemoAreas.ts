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
    centroid_latitude: 10.9878,
    centroid_longitude: -74.7889,
    zoom: 12,
  },
  {
    area_id: "alto-prado",
    area_type: "neighborhood",
    display_name: "Alto Prado",
    city_name: "Barranquilla",
    country_code: "CO",
    description: "Established north Barranquilla area with higher sale prices.",
    centroid_latitude: 11.0057,
    centroid_longitude: -74.8091,
    zoom: 14,
  },
  {
    area_id: "riomar",
    area_type: "locality",
    display_name: "Riomar",
    city_name: "Barranquilla",
    country_code: "CO",
    description:
      "Northwest demo area with modern apartments and premium rents.",
    centroid_latitude: 11.0147,
    centroid_longitude: -74.8277,
    zoom: 13.5,
  },
  {
    area_id: "villa-santos",
    area_type: "neighborhood",
    display_name: "Villa Santos",
    city_name: "Barranquilla",
    country_code: "CO",
    description: "Residential demo area near Buenavista and major corridors.",
    centroid_latitude: 11.0118,
    centroid_longitude: -74.8342,
    zoom: 14,
  },
];

export const defaultArea = barranquillaDemoAreas[0]!;
