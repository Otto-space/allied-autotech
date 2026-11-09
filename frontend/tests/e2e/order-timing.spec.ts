import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workOrderDetailFixture, bookingId } from "../fixtures/work-order-detail";
import { verifyConsole } from "../fixtures/preview-console";
import { timingLineSchema } from "../../lib/order-timing";
const path = `/admin/orders/${bookingId(1100)}`;

for (const width of [320, 1440])
  test(`order sourcing review saves genuine estimates and survives refresh at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
      if (message.type() === "warning") warnings.push(message.text());
    });
    const { detail } = await workOrderDetailFixture(page);
    const writes: unknown[] = [];
    await page.route("**/api/v1/admin/orders/*/timing", async (route) => {
      const body = route.request().postDataJSON();
      writes.push(body);
      const lines = body.lines.map((line: unknown) => {
        const value = timingLineSchema.parse(line);
        return {
          preparationMinutes: value.preparationMinutes,
          sourcingUntil: value.sourcingUntil,
          sourcingFrom: value.sourcingFrom,
          sourcingStatus: value.sourcingStatus,
          orderItemId: value.orderItemId,
        };
      });
      expect(body.expectedVersion).toBe(detail.record.version);
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      detail.record = {
        ...detail.record,
        version: detail.record.version + 1,
        timingUpdates: [
          {
            id: bookingId(9200),
            orderVersion: body.expectedVersion,
            lines,
            customerNote: body.customerNote,
            createdAt: "2026-11-09T12:00:00Z",
          },
        ],
      };
      await route.fulfill({
        json: {
          success: true,
          message: "Synthetic sourcing update",
          data: detail.record,
          meta: { requestId: "synthetic-order-timing" },
        },
      });
    });
    await page.goto(path);
    const editor = page.getByRole("region", {
      name: "Update this order’s sourcing",
      exact: true,
    });
    await expect(editor).toBeVisible();
    await editor.getByLabel("Sourcing status").first().selectOption("IN_TRANSIT");
    await editor
      .getByLabel("Estimated arrival from (Nigeria time)")
      .fill("2026-11-10T08:00");
    await editor
      .getByLabel("Estimated arrival by (Nigeria time)")
      .fill("2026-11-12T18:00");
    await editor
      .getByLabel("Preparation after arrival (minutes, optional)")
      .first()
      .fill("30");
    await editor
      .getByLabel("Update shown to the customer")
      .fill("Supplier confirms transit; we will confirm when ready.");
    await editor
      .getByLabel("Internal reason (not shown to the customer)")
      .fill("Private supplier call reference for this fixture");
    await editor.getByRole("button", { name: "Review sourcing update" }).click();
    let modal = page.getByRole("dialog", { name: "Update sourcing estimates?" });
    await expect(modal).toContainText("Brake pads");
    await expect(modal).toContainText("arrival unknown");
    await modal.getByRole("button", { name: "Go back" }).click();
    expect(writes).toHaveLength(0);
    await expect(editor.getByLabel("Update shown to the customer")).toHaveValue(
      "Supplier confirms transit; we will confirm when ready.",
    );
    await editor.getByRole("button", { name: "Review sourcing update" }).click();
    modal = page.getByRole("dialog", { name: "Update sourcing estimates?" });
    await modal
      .getByRole("button", { name: "Save sourcing update", exact: true })
      .click();
    const summary = page.getByRole("region", {
      name: "Sourcing and preparation",
      exact: true,
    });
    await expect(summary).toContainText("Supplier confirms transit");
    await expect(summary).not.toContainText("Private supplier call");
    expect(writes).toHaveLength(1);
    await page.reload();
    await expect(summary).toContainText("In transit");
    await expect(summary).toContainText("Preparation time not yet confirmed");
    await expect(page.locator(".work-order-summary")).toContainText("Processing");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include("[data-order-timing-summary]").analyze())
        .violations,
    ).toEqual([]);
    await summary.screenshot({ path: info.outputPath(`order-sourcing-${width}.png`) });
    await verifyConsole(page, errors, warnings);
  });

test("staff cannot author sourcing and ready orders cannot change estimates", async ({
  page,
}) => {
  const { detail } = await workOrderDetailFixture(page, "STAFF");
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Update this order’s sourcing" }),
  ).toHaveCount(0);
  detail.record.status = "READY";
  detail.record.allowedTransitions = ["COMPLETED"];
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Update this order’s sourcing" }),
  ).toHaveCount(0);
});

for (const outcome of ["stale", "contradictory"] as const)
  test(`sourcing ${outcome} outcome cannot report success or repeat a write`, async ({
    page,
  }) => {
    const { detail } = await workOrderDetailFixture(page);
    let writes = 0;
    await page.route("**/api/v1/admin/orders/*/timing", async (route) => {
      writes++;
      const body = route.request().postDataJSON();
      detail.record = {
        ...detail.record,
        version: detail.record.version + 1,
        timingUpdates: [
          {
            id: bookingId(9200),
            orderVersion: body.expectedVersion,
            lines: body.lines,
            customerNote: body.customerNote,
            createdAt: "2026-11-09T12:00:00Z",
          },
        ],
      };
      await route.fulfill({
        json: {
          success: true,
          data: { ...detail.record, id: bookingId(9999) },
          message: "Synthetic contradictory receipt",
          meta: { requestId: "synthetic-order-timing" },
        },
      });
    });
    await page.goto(path);
    const editor = page.getByRole("region", {
      name: "Update this order’s sourcing",
      exact: true,
    });
    await editor
      .getByLabel("Update shown to the customer")
      .fill("Supplier is checking the estimate.");
    await editor
      .getByLabel("Internal reason (not shown to the customer)")
      .fill("Synthetic staff call");
    await editor.getByRole("button", { name: "Review sourcing update" }).click();
    if (outcome === "stale") detail.record.version++;
    const modal = page.getByRole("dialog", { name: "Update sourcing estimates?" });
    await modal
      .getByRole("button", { name: "Save sourcing update", exact: true })
      .click();
    await expect(modal).toContainText("The outcome could not be confirmed");
    await expect(
      modal.getByRole("button", { name: "Save sourcing update", exact: true }),
    ).toBeDisabled();
    expect(writes).toBe(outcome === "stale" ? 0 : 1);
    await modal.getByRole("button", { name: "Go back", exact: true }).click();
    await page.reload();
    if (outcome === "contradictory")
      await expect(
        page.getByRole("region", { name: "Sourcing and preparation", exact: true }),
      ).toContainText("Supplier is checking");
    expect(writes).toBe(outcome === "stale" ? 0 : 1);
  });
