import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import App from "../../src/App";

vi.mock("../../src/components/ExplorerMap", () => ({
  ExplorerMap: ({ activeAreaLabel }: { activeAreaLabel: string }) => (
    <section aria-label={`Property map for ${activeAreaLabel}`}>
      Mock property map for {activeAreaLabel}
    </section>
  ),
}));

describe("frontend scaffold", () => {
  it("renders the Rent Yield explorer shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Barranquilla rent return explorer",
      }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("Barranquilla demo areas")
        .querySelector('[aria-pressed="false"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Yearly rent return" }),
    ).toBeVisible();
  });
});
