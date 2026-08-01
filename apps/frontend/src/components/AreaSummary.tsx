import type {
  AreaSummary as AreaSummaryRecord,
  AreaType,
} from "../domain/propertyTypes";
import { formatCurrency, formatPercent } from "../lib/formatters";
import "./rentYieldComponents.css";

type AreaSummaryProps = {
  summary:
    (AreaSummaryRecord & { area_type: AreaType; data_label: string }) | null;
};

function formatAreaType(areaType: string) {
  return areaType.replaceAll("_", " ");
}

export function AreaSummary({ summary }: AreaSummaryProps) {
  if (!summary) {
    return (
      <section
        className="ry-card ry-summary"
        aria-labelledby="area-summary-title"
      >
        <div className="ry-card__header">
          <div>
            <p className="ry-eyebrow">Selected area</p>
            <h2 className="ry-title" id="area-summary-title">
              No area selected
            </h2>
          </div>
        </div>
        <p className="ry-empty">
          Choose a Barranquilla demo area to see its prototype summary.
        </p>
      </section>
    );
  }

  return (
    <section
      className="ry-card ry-summary"
      aria-labelledby="area-summary-title"
    >
      <div className="ry-card__header">
        <div>
          <p className="ry-eyebrow">
            Selected {formatAreaType(summary.area_type)}
          </p>
          <h2 className="ry-title" id="area-summary-title">
            {summary.display_name}
          </h2>
        </div>
        <span className="ry-badge">{summary.data_label}</span>
      </div>

      <dl className="ry-summary__grid">
        <div className="ry-summary__metric">
          <dt className="ry-summary__label">Properties</dt>
          <dd className="ry-summary__value">{summary.property_count}</dd>
        </div>
        <div className="ry-summary__metric">
          <dt className="ry-summary__label">Median sale price</dt>
          <dd className="ry-summary__value">
            {formatCurrency(summary.median_sale_price_amount)}
          </dd>
        </div>
        <div className="ry-summary__metric">
          <dt className="ry-summary__label">Median monthly rent</dt>
          <dd className="ry-summary__value">
            {formatCurrency(summary.median_monthly_rent_amount)}
          </dd>
        </div>
        <div className="ry-summary__metric">
          <dt className="ry-summary__label">Typical rent return</dt>
          <dd className="ry-summary__value">
            {formatPercent(summary.median_gross_rent_yield)}
          </dd>
        </div>
      </dl>

      <p className="ry-summary__note ry-muted">
        {summary.average_gross_rent_yield == null
          ? "Prototype summary based on the currently visible API property set."
          : `Average rent return is ${formatPercent(
              summary.average_gross_rent_yield,
            )}.`}
      </p>
    </section>
  );
}
