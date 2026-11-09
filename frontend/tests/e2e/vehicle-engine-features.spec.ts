import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workVehicleDetailFixture, bookingId } from "../fixtures/work-vehicle-detail";

const engineDetails = "2.0L I-4 DI, DOHC, VVT, TURBO, PREMIUM, 252HP";
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`vehicle engine and individual features survive review, save and reload at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    const fixture = await workVehicleDetailFixture(page);
    Object.assign(fixture.detail.record, {
      engineDetails,
      engineCapacityCc: 1998,
      powertrain: "HEV",
      features: ["Audio, navigation", "Heated seats"],
      ownerReportedIssues: "Owner reports broken air conditioning.",
    });
    await page.goto(`/admin/vehicles/${bookingId(7000)}`);
    await expect(
      page.getByRole("heading", { name: "Vehicle details", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Engine & drive" }).first(),
    ).toContainText("1,998 cc");
    await page.getByText("Edit vehicle specifications", { exact: true }).click();
    await expect(page.getByLabel("Feature 1", { exact: true })).toHaveValue(
      "Audio, navigation",
    );
    await page.getByLabel("Engine / Power type (optional)").selectOption("BEV");
    await expect(page.getByLabel("Engine capacity (optional, cc)")).toHaveValue("1998");
    await expect(page.getByLabel("Engine details (optional)")).toHaveValue(engineDetails);
    await page.getByLabel("Feature 2", { exact: true }).fill("Parking assistance");
    await page.getByRole("button", { name: "Add feature", exact: true }).click();
    await expect(page.getByLabel("Feature 3", { exact: true })).toBeFocused();
    await page.keyboard.type("Sunroof");
    await page
      .getByRole("button", { name: "Review vehicle changes", exact: true })
      .click();
    const review = page.getByRole("dialog");
    await expect(review).toContainText(engineDetails);
    await expect(review).toContainText("Audio, navigation");
    await expect(review).toContainText("Fully electric (EV)");
    expect(fixture.detail.writes).toHaveLength(0);
    await review.getByRole("button", { name: "Go back", exact: true }).click();
    expect(fixture.detail.record.features).toEqual(["Audio, navigation", "Heated seats"]);
    await page
      .getByRole("button", { name: "Review vehicle changes", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect.poll(() => fixture.detail.writes.length).toBe(1);
    expect(fixture.detail.writes[0]).toMatchObject({
      engineDetails,
      engineCapacityCc: 1998,
      powertrain: "BEV",
      features: ["Audio, navigation", "Parking assistance", "Sunroof"],
    });
    await page.reload();
    await page.getByText("Edit vehicle specifications", { exact: true }).click();
    await expect(page.getByLabel("Feature 1", { exact: true })).toHaveValue(
      "Audio, navigation",
    );
    await expect(page.getByLabel("Feature 2", { exact: true })).toHaveValue(
      "Parking assistance",
    );
    await expect(page.getByLabel("Engine details (optional)")).toHaveValue(engineDetails);
    await expect(page.getByLabel("Owner-reported known issues (optional)")).toHaveValue(
      "Owner reports broken air conditioning.",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
