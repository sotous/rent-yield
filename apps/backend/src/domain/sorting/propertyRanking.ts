import type { PropertyRecord } from "../properties/propertyTypes.js";

export function rankPropertiesByRentReturn(properties: PropertyRecord[]) {
  return [...properties].sort((left, right) => {
    return (
      right.gross_rent_yield - left.gross_rent_yield ||
      left.sale_to_rent_ratio - right.sale_to_rent_ratio ||
      right.monthly_rent_amount - left.monthly_rent_amount
    );
  });
}
