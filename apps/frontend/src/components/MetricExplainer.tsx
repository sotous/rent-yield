import "./rentYieldComponents.css";

type MetricExplainerProps = {
  defaultOpen?: boolean;
};

export function MetricExplainer({ defaultOpen = false }: MetricExplainerProps) {
  return (
    <details className="ry-card ry-explainer" open={defaultOpen}>
      <summary className="ry-card__header">
        <span>
          <span className="ry-eyebrow">Metric guide</span>
          <span className="ry-title">How to read rent return</span>
        </span>
        <span className="ry-badge">Keyboard reachable</span>
      </summary>

      <div className="ry-explainer__body">
        <section className="ry-explainer__item">
          <h3>Rent return</h3>
          <p>
            This shows how much rent a home may bring in each year compared with
            its sale price. Higher usually means stronger income potential.
          </p>
          <span className="ry-explainer__formula">
            Also known as gross rent yield
          </span>
        </section>

        <section className="ry-explainer__item">
          <h3>Years of rent vs. price</h3>
          <p>
            This is a backup signal for how expensive the home looks compared
            with the rent it may earn. Lower is usually better.
          </p>
          <span className="ry-explainer__formula">
            Sale price compared with yearly rent
          </span>
        </section>

        <section className="ry-explainer__item">
          <h3>Estimated values</h3>
          <p>
            Prototype records label estimated rent because the chart should not
            treat observed and modeled values as equally certain.
          </p>
        </section>
      </div>
    </details>
  );
}
