export type CountryCode = "CO";
export type CityName = "Barranquilla";
export type AreaType =
  "country" | "city" | "locality" | "neighborhood" | "viewport";

export type BoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type Area = {
  area_id: string;
  country_code: CountryCode;
  area_type: AreaType;
  display_name: string;
  city_name: CityName;
  description: string | null;
  parent_area_id: string | null;
  centroid_latitude: number;
  centroid_longitude: number;
  zoom: number;
  bounding_box: BoundingBox | null;
  geometry_reference: string | null;
};
