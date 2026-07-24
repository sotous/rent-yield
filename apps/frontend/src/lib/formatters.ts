const compactCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  currency: "COP",
  maximumFractionDigits: 0,
  notation: "compact",
  style: "currency",
});

const percentFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: "percent",
});

export function formatCurrency(value: number | null): string {
  if (value == null) {
    return "Unavailable";
  }

  return compactCurrencyFormatter.format(value);
}

export function formatPercent(value: number | null): string {
  if (value == null) {
    return "Unavailable";
  }

  return percentFormatter.format(value);
}
