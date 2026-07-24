import { expect, test } from "@playwright/test";

test("loads the frontend app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Rent Yield Prototype/i);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Barranquilla rent return explorer",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("Barranquilla demo areas")
      .getByRole("button", { name: /Alto Prado Established north/i }),
  ).toBeVisible();
});
