import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workServicesFixture, bookingId } from "../fixtures/work-services";
import { verifyConsole } from "../fixtures/preview-console";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

test.beforeEach(async ({ request, page }) => {
  await bookingRuntimeCapabilities(request, page);
});

for (const width of [320, 768, 1440])
  test(`service estimates distinguish unassessed from zero and persist reviewed buffers at ${width}px`, async ({
    page,
  }) => {
    const { state } = await workServicesFixture(page);
    const errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
      if (message.type() === "warning") warnings.push(message.text());
    });
    const row = state.records[1];
    row.preparationMinutes = null;
    row.cleanupMinutes = null;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/admin/services/${bookingId(901)}?view=edit`);
    await expect(page).toHaveURL(/\/admin\/services\/.*view=edit/);
    await expect(page).toHaveTitle(/Allied/i);
    const prep = page.getByLabel("Preparation before arrival (minutes, optional)", {
      exact: true,
    });
    const cleanup = page.getByLabel("Cleanup after work (minutes, optional)", {
      exact: true,
    });
    await expect(prep).toHaveValue("");
    await expect(cleanup).toHaveValue("");
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Not assessed");
    expect(state.writes).toEqual([]);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page
      .getByLabel("Estimated job time in minutes (optional)", { exact: true })
      .fill("45");
    await prep.fill("10");
    await cleanup.fill("0");
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("10 minutes");
    await expect(page.getByRole("dialog")).toContainText("0 minutes");
    await expect(page.getByRole("dialog")).toContainText(
      "saved timing remains unchanged",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include("dialog[open]")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    await expect(page.getByText("Service saved.", { exact: true }).first()).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body).toMatchObject({
      expectedVersion: 1,
      durationMinutes: 45,
      preparationMinutes: 10,
      cleanupMinutes: 0,
    });
    await page.reload();
    await expect(
      page.getByText("Preparation before arrival", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("10 minutes", { exact: true })).toBeVisible();
    await expect(page.getByText("0 minutes", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit service", exact: true }).click();
    await expect(prep).toHaveValue("10");
    await expect(cleanup).toHaveValue("0");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await verifyConsole(page, errors, warnings);
  });
