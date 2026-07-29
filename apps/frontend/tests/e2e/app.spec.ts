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
  await expect(page.getByRole("link", { name: "View listing" })).toHaveCount(0);

  await page.getByRole("button", { name: /Carrera 54/i }).hover();

  await expect(
    page.getByRole("link", {
      name: /View listing example\.com\/rent-yield\/listings\/baq-001/i,
    }),
  ).toHaveAttribute("href", /\/rent-yield\/listings\/baq-001/);
});
