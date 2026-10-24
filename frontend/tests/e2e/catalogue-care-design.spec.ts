import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { garageFixture } from "../fixtures/customer-garage";
import { customerSupportFixture } from "../fixtures/customer-support";
import { workCustomersFixture } from "../fixtures/work-customers";
import { workSupportFixture } from "../fixtures/work-support";
for (const name of ["garage", "care", "customers", "work-care"] as const) {
  test(`scoped design review ${name}`, async ({ page }) => {
    const route =
      name === "garage"
        ? "/dashboard/vehicles"
        : name === "care"
          ? "/dashboard/support"
          : name === "customers"
            ? "/admin/customers"
            : "/admin/support";
    if (name === "garage") await garageFixture(page);
    if (name === "care") await customerSupportFixture(page);
    if (name === "customers") await workCustomersFixture(page);
    if (name === "work-care") await workSupportFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route + "$"));
    await expect(page.locator("h1")).toBeVisible();
    if (name === "garage")
      await expect(page.locator(".garage-record").first()).toBeVisible();
    if (name === "care")
      await expect(
        page.getByRole("link", { name: "Test enquiry", exact: true }),
      ).toBeVisible();
    if (name === "customers")
      await expect(page.locator(".wc-record").first()).toBeVisible();
    if (name === "work-care")
      await expect(page.locator(".wsu-record").first()).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.screenshot({
        path: path.join(
          os.tmpdir(),
          `scope-${process.env.UX_PHASE || "before"}-${name}-${width}.png`,
        ),
        fullPage: false,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

test("vehicle form starts with required identity and keeps guidance associated", async ({
  page,
}) => {
  await garageFixture(page);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Add a vehicle", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a vehicle", exact: true });
  await expect(page.locator("#garage-make")).toBeFocused();
  expect(await dialog.locator("fieldset").first().locator("legend").textContent()).toBe(
    "Vehicle details",
  );
  await expect(page.locator("#garage-make")).toHaveAccessibleDescription(/manufacturer/);
  await expect(page.locator("#garage-year")).toHaveAccessibleDescription(/model year/);
  await page.locator("#garage-make").fill("Toyota");
  await page.locator("#garage-model").fill("Corolla");
  await page.locator("#garage-year").fill("2018");
  await page.screenshot({
    path: path.join(os.tmpdir(), "scope-final-vehicle-form-390.png"),
  });
  await page.getByRole("button", { name: "Save vehicle", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close vehicle dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Add a vehicle", exact: true }),
  ).toBeFocused();
});

for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} removes one customer constraint and preserves the others`, async ({
    page,
  }) => {
    const f = await workCustomersFixture(page, role);
    await page.goto("/admin/customers?search=amina&verified=true");
    await expect(page.locator(".wc-record")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Remove Customer search", exact: true })
      .click();
    await expect(page.locator(".wc-record")).toHaveCount(14);
    await expect(page).toHaveURL(/verified=true/);
    expect(new URL(page.url()).searchParams.has("search")).toBe(false);
    await page
      .getByRole("button", { name: "Remove Email: verified", exact: true })
      .click();
    await expect(page.locator(".wc-record")).toHaveCount(25);
    const first = page.locator(".wc-record").first();
    await expect(first.locator(".record-references > div")).not.toBeVisible();
    await first.locator("summary").click();
    await expect(first.locator(".record-references > div")).toBeVisible();
    await expect(first).toContainText(f.customers.records[0].id);
    await page.getByLabel("Search by", { exact: true }).selectOption("phone");
    await expect(
      page.getByLabel("Search customers", { exact: true }),
    ).toHaveAccessibleDescription(/at least 3 phone digits/);
    expect(f.customers.writes).toHaveLength(0);
  });

for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} removes one care filter and opens full references`, async ({ page }) => {
    const f = await workSupportFixture(page, role);
    f.support.records.enquiries[0].status = "IN_PROGRESS";
    await page.goto("/admin/support?status=IN_PROGRESS&type=SERVICE");
    await expect(page.locator(".wsu-record")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Remove Status: In progress", exact: true })
      .click();
    await expect(page.locator(".wsu-record")).toHaveCount(25);
    await expect(page).toHaveURL(/type=SERVICE/);
    expect(new URL(page.url()).searchParams.has("status")).toBe(false);
    const first = page.locator(".wsu-record").first();
    await expect(first.locator(".record-references > div")).not.toBeVisible();
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(first.locator(".record-references > div")).toBeVisible();
    await expect(first.locator(".record-references")).toContainText(
      f.support.records.enquiries[0].id,
    );
    await page.getByRole("button", { name: "Remove Type: Service", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Remove Type: Service", exact: true }),
    ).toHaveCount(0);
    expect(f.support.writes).toHaveLength(0);
  });

test("customer care task links reach their sections without losing a draft", async ({
  page,
}) => {
  await customerSupportFixture(page);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/dashboard/support");
  await page.getByLabel("Subject", { exact: true }).fill("My vehicle question");
  await page.getByRole("link", { name: "View your records", exact: true }).click();
  await expect(page.locator("#support-list-heading")).toBeInViewport();
  await page.getByRole("link", { name: "Write a request", exact: true }).click();
  await expect(page.locator("#support-create-heading")).toBeInViewport();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "My vehicle question",
  );
  await expect(page.getByLabel("Subject", { exact: true })).toHaveAccessibleDescription(
    /short summary/,
  );
  await expect(
    page.getByLabel("Your message", { exact: true }),
  ).toHaveAccessibleDescription(/vehicle or part/);
  await page.setViewportSize({ width: 1440, height: 960 });
  const form = await page.locator(".cc-form-grid").boundingBox();
  const privacy = await page.locator(".cc-form-grid > .contact-field-wide").boundingBox();
  expect(privacy!.width).toBeGreaterThan(form!.width * 0.95);
});

test("removing a care branch also clears its staff constraint while keeping status", async ({
  page,
}) => {
  const f = await workSupportFixture(page);
  const record = f.support.records.enquiries[0];
  await page.goto(
    `/admin/support?status=OPEN&branchId=${record.branchId}&assignedStaffId=${record.assignedStaffId}`,
  );
  await expect(page.locator(".wsu-record").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove Branch filter", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Branch filter", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Assigned staff filter", exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/status=OPEN/);
  const params = new URL(page.url()).searchParams;
  expect(params.has("branchId")).toBe(false);
  expect(params.has("assignedStaffId")).toBe(false);
  await expect(page.locator("#wsu-records")).toBeFocused();
});

test("pending access hides managed work, retains a draft on success and discards it on scope change", async ({
  page,
}) => {
  const { workforceEnquiriesFixture, enquiryFixtureId } =
    await import("../fixtures/workforce-enquiries");
  const f = await workforceEnquiriesFixture(page);
  let hold = false;
  let release: (() => void) | undefined;
  await page.route("**/api/v1/staff/workforce/access", async (route) => {
    if (hold)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fallback();
  });
  await page.goto("/admin/workforce/enquiries?selected=" + enquiryFixtureId(1));
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Keep this reply while access is checked.");
  hold = true;
  await page.getByRole("button", { name: "Refresh enquiries", exact: true }).click();
  try {
    await expect(
      page.getByRole("heading", { name: "Checking work access", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
      "Keep this reply while access is checked.",
    );
    await expect(page.getByLabel("Message", { exact: true })).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review reply", exact: true }),
    ).toHaveCount(0);
  } finally {
    hold = false;
    release?.();
  }
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Keep this reply while access is checked.",
  );
  f.base.access.version++;
  await page.getByRole("button", { name: "Refresh enquiries", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  expect(f.writes).toHaveLength(0);
});
