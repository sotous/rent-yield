export type ListingRole = "for_sale" | "for_rent";

export type PropertyType =
  "apartment" | "house" | "studio" | "other_residential";

export type ResidentialListing = {
  source_name: string;
  source_listing_id: string;
  listing_url: string | null;
  listing_role: ListingRole;
  country_code: "CO";
  city_name: string;
  area_id: string | null;
  neighborhood_name: string | null;
  property_type: PropertyType;
  built_area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  social_stratum: number | null;
  sale_asking_price_cop: number | null;
  monthly_asking_rent_cop: number | null;
  observed_at: string | null;
};

export type RentModelSubject = {
  source_listing_key: string;
  country_code: "CO";
  city_name: string;
  area_id: string | null;
  property_type: PropertyType;
  built_area_sqm: number;
  bedrooms: number | null;
  bathrooms: number | null;
  social_stratum: number | null;
};

export type RentModelRequest = {
  subject: RentModelSubject;
  as_of_date: string;
  sale_price_excluded: true;
};

export type RequirementLevel = "required" | "recommended" | "optional";

export type DataRequirement = {
  field: string;
  level: RequirementLevel;
  reason: string;
  required_for: Array<"subject" | "rental_evidence" | "benchmark">;
};

export type CrawlerRequirement = {
  listing_role: ListingRole;
  fields: string[];
  reason: string;
};

export type WorkbenchReport = {
  subject_ready: boolean;
  missing_subject_fields: string[];
  data_requirements: DataRequirement[];
  crawler_requirements: CrawlerRequirement[];
  server_request: RentModelRequest | null;
};
