import { test, expect } from "@playwright/test";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { workVehicleCreateFixture, bookingId } from "../fixtures/work-vehicle-create";
import { workVehicleDetailFixture } from "../fixtures/work-vehicle-detail";
test.setTimeout(120000);

test("prepared owner draft enters review without unknown-value inventions or an implicit write", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const fixture = await workVehicleCreateFixture(page);
  await page.goto("/admin/vehicles/new");
  await page.getByLabel("Workshop branch", { exact: true }).selectOption(bookingId(101));
  await page.getByText("Import a prepared vehicle draft", { exact: true }).click();
  await page
    .getByLabel("Prepared stock JSON (up to 16 KB)")
    .setInputFiles(path.resolve("../backend/data/vehicle-drafts/bmw-120i-2007.json"));
  await expect(page.getByLabel("Stock number", { exact: true })).toHaveValue(
    "OWNER-BMW120I-2007-01",
  );
  await expect(page.getByLabel("Engine code (optional)")).toHaveValue("N46");
  await expect(page.getByLabel("Cylinders (optional)")).toHaveValue("4");
  await expect(page.getByLabel("Mileage (optional, km)")).toHaveValue("");
  await expect(page.getByLabel("Transmission (optional)", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Owner-reported known issues (optional)")).toHaveValue(
    /AC not working/,
  );
  expect(fixture.state.posts).toHaveLength(0);
  await page.getByRole("button", { name: "Review new vehicle", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review).toContainText("AC not working");
  await expect(review).toContainText("Not recorded");
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/vehicles/${bookingId(9000)}#vehicle-photos$`),
    { timeout: 45000 },
  );
  expect(fixture.state.posts).toHaveLength(1);
  expect(fixture.state.posts[0]).toMatchObject({
    cylinders: 4,
    engineCode: "N46",
    mileageKm: null,
    transmission: null,
    fuelType: null,
    ownerReportedIssues:
      "AC not working. Owner reports a leak. Diagnosis and repair required.",
  });
  expect(fixture.state.posts[0]).not.toHaveProperty("priceKobo");
});

for (const width of [390, 1440])
  test(`saved draft preview and owner-note correction at ${width}px`, async ({
    page,
  }) => {
    const fixture = await workVehicleDetailFixture(page);
    fixture.detail.record.ownerReportedCondition =
      "Owner describes the cabin as excellent.";
    fixture.detail.record.ownerReportedIssues =
      "AC not working. Owner reports a leak. Diagnosis and repair required.";
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/admin/vehicles/${bookingId(7000)}`);
    await page.getByText("Preview listing content", { exact: true }).first().click();
    const preview = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Preview listing content" }) })
      .first();
    await expect(preview).toContainText("AC not working");
    await expect(preview.locator("img").first()).toHaveAttribute(
      "src",
      /\/staff\/vehicles\/.*\/content/,
    );
    await page.getByText("Edit vehicle specifications", { exact: true }).click();
    await page
      .getByLabel("Owner-reported known issues (optional)")
      .fill("Owner correction: AC still not working; diagnosis pending.");
    await page
      .getByRole("button", { name: "Review vehicle changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Owner correction: AC still not working",
    );
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect.poll(() => fixture.detail.writes.length).toBe(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
