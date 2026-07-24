import type { PropertyRecord } from "./propertyTypes";

export function sortByGrossRentYield(
  properties: readonly PropertyRecord[],
): PropertyRecord[] {
  return [...properties].sort((left, right) => {
    const yieldDelta = right.gross_rent_yield - left.gross_rent_yield;

    if (yieldDelta !== 0) {
      return yieldDelta;
    }

    const ratioDelta = left.sale_to_rent_ratio - right.sale_to_rent_ratio;

    if (ratioDelta !== 0) {
      return ratioDelta;
    }

    return right.monthly_rent_amount - left.monthly_rent_amount;
  });
}
