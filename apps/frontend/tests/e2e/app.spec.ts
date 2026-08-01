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
      .getByRole("button", { name: /Alto Prado Named prototype area/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Carrera 54/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /View listing/i })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: /Carrera 54/i }).hover();

  await expect(
    page.getByRole("link", {
      name: /View listing example\.com\/rent-yield\/listings\/baq-001/i,
    }),
  ).toHaveAttribute("href", /\/rent-yield\/listings\/baq-001/);
});

test("shows an empty ranking when the selected API area has no properties", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByLabel("Barranquilla demo areas")
    .getByRole("button", { name: /Sample Empty Area/i })
    .click();

  await expect(
    page.getByRole("heading", { name: "Sample Empty Area" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No properties are available for this area in the prototype dataset.",
    ),
  ).toBeVisible();
});

test("exposes the frontend consumer contract through the local API proxy", async ({
  page,
}) => {
  const bootstrapResponse = await page.request.get(
    "/api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla",
  );
  expect(bootstrapResponse.ok()).toBeTruthy();

  const bootstrap = await bootstrapResponse.json();
  expect(bootstrap).toEqual(
    expect.objectContaining({
      default_area_id: expect.any(String),
      areas: expect.any(Array),
      data_label: expect.any(String),
    }),
  );
  expect(bootstrap.areas[0]).toEqual(
    expect.objectContaining({
      area_id: expect.any(String),
      country_code: "CO",
      area_type: expect.any(String),
      display_name: expect.any(String),
      city_name: "Barranquilla",
    }),
  );

  const areaResponse = await page.request.get(
    `/api/v1/explorer/areas/${bootstrap.default_area_id}`,
  );
  expect(areaResponse.ok()).toBeTruthy();

  const areaPayload = await areaResponse.json();
  expect(areaPayload).toEqual(
    expect.objectContaining({
      area: expect.objectContaining({
        area_id: bootstrap.default_area_id,
        country_code: "CO",
      }),
      summary: expect.objectContaining({
        area_id: bootstrap.default_area_id,
        property_count: expect.any(Number),
      }),
      properties: expect.any(Array),
      sort: expect.objectContaining({
        metric: "gross_rent_yield",
        direction: "desc",
      }),
      data_label: expect.any(String),
    }),
  );
});

test("shows the frontend error state when the selected-area API fails", async ({
  page,
}) => {
  await page.route("**/api/v1/explorer/areas/barranquilla", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "prototype_unavailable",
          message: "Prototype API unavailable",
        },
      }),
    });
  });

  await page.goto("/");

  await expect(
    page.getByText("We could not load the prototype API."),
  ).toBeVisible();
  await expect(
    page.getByText("Prototype API request failed with 503"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Barranquilla rent return explorer",
    }),
  ).toBeVisible();
});
