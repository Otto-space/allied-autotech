import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`customer overview fits ${width}px and exposes current care first`, async ({
    page,
  }) => {
    await fixture(page, "CUSTOMER");
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard");
    await expect(
      page.getByRole("link", { name: "View current booking", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    for (const control of await page
      .locator(
        ".customer-overview a,.customer-overview button,.customer-overview select,.customer-overview input,.customer-overview summary",
      )
      .all())
      if (await control.isVisible())
        expect(
          (await control.boundingBox())?.height,
          await control.getAttribute("class"),
        ).toBeGreaterThanOrEqual(44);
    const care = await page.locator(".customer-care").boundingBox();
    const activity = await page.locator(".customer-activity-heading").boundingBox();
    expect(care!.y + care!.height).toBeLessThan(activity!.y);
    await expect(page.locator(".customer-overview a[href^='/admin']")).toHaveCount(0);
    await expect(page.locator(".care-timeline li")).toHaveCount(3);
    expect(errors).toEqual([]);
  });

for (const width of [320, 390, 768, 1440])
  test(`customer overview accessibility ${width}px`, async ({ page }) => {
    await fixture(page, "CUSTOMER");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await expect(page.locator(".customer-care")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

test("historical dates never replace current care with a zero state", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  await page.goto("/dashboard");
  await expect(page.locator(".customer-care")).toBeVisible();
  const care = await page.locator(".customer-care").innerText();
  state.mode = "period_empty";
  await page.getByLabel("From", { exact: true }).fill("2000-01-01");
  await page.getByLabel("To", { exact: true }).fill("2000-01-02");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(
    page.getByText("No new bookings or orders in this period.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".customer-care")).toHaveText(care, { useInnerText: true });
  expect(state.reads.at(-1)?.searchParams.get("from")).toBe("2000-01-01");
});

test("an empty account has clear next actions without invented progress", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  state.mode = "empty";
  await page.goto("/dashboard");
  await expect(page.getByText("No service in progress", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No open payment request to show.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage garage", exact: true }),
  ).toHaveAttribute("href", "/dashboard/vehicles");
  const browseParts = page.getByRole("link", { name: "Browse parts", exact: true });
  await expect(browseParts).toHaveAttribute("href", "/parts");
  await expect(page.locator(".care-timeline")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View payment", exact: true })).toHaveCount(
    0,
  );
  await browseParts.click();
  await expect(page).toHaveURL(/\/parts$/);
  await expect(
    page.getByRole("heading", { name: "We couldn’t find that page." }),
  ).toHaveCount(0);
});

for (const mode of ["missingCare", "malformedCare", "wrongScope", "error"])
  test(`${mode} is an error, never an empty or private care summary`, async ({
    page,
  }) => {
    const state = await fixture(page, "CUSTOMER");
    state.mode = mode;
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your overview" }),
    ).toBeVisible();
    await expect(page.locator(".customer-care,.overview-metric")).toHaveCount(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry overview" }).click();
    await expect(page.locator(".customer-care")).toBeVisible();
  });

test("account invalidation discards care and a late response", async ({ page }) => {
  const state = await fixture(page, "CUSTOMER");
  await page.goto("/dashboard");
  await expect(page.locator(".customer-care")).toBeVisible();
  state.mode = "hold";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => !!state.held).toBe(true);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  state.held?.();
  await expect(page.locator(".customer-care")).toHaveCount(0);
});

test("long records and exact large money remain readable on short mobile screens", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  state.care!.vehicle!.model = "ExtendedVehicleName".repeat(12);
  state.care!.quote!.totalKobo = "9007199254740993";
  state.care!.notification!.title = "Your latest workshop update ".repeat(20);
  state.care!.inspection!.title = "InspectionVehicleName".repeat(12);
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/dashboard");
  await expect(page.locator(".care-review")).toContainText("NGN 90,071,992,547,409.93");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page
    .getByRole("link", { name: "View payment", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("link", { name: "View payment", exact: true }),
  ).toBeInViewport();
});

test("current-care detail links use owned records and distinguish requested times", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  await page.goto("/dashboard");
  await expect(page.locator(".customer-care")).toBeVisible();
  for (const [name, href] of [
    ["View current booking", `/dashboard/bookings/${state.care!.currentBooking!.id}`],
    ["View next booking", `/dashboard/bookings/${state.care!.nextBooking!.id}`],
    ["View vehicle", `/dashboard/vehicles/${state.care!.vehicle!.id}`],
    ["View quotation", `/dashboard/bookings/${state.care!.quote!.bookingId}`],
    ["View payment", `/dashboard/payments/${state.care!.payment!.id}`],
    ["View order", `/dashboard/orders/${state.care!.order!.id}`],
  ])
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute(
      "href",
      href,
    );
  await expect(page.locator(".customer-care-next")).toContainText(
    "Requested time; awaiting confirmation.",
  );
  await expect(page.locator(".customer-care-secondary")).toContainText("Preferred date:");
  await expect(page.locator(".customer-care")).not.toContainText(
    /Delivered|Quality check|Paid in full/,
  );
});
