import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { workforceAccessFixture as fixture, id } from "../fixtures/workforce-access";
test("combined Operations home stays compact and never fetches finance or broad legacy data", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operational overview" })).toBeVisible();
  await expect(page.getByText("Position vacant", { exact: true })).toHaveCount(2);
  const nav = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(nav.getByRole("link", { name: "Overview", exact: true })).toHaveCount(1);
  await expect(nav).not.toContainText("Finance");
  await expect(nav).not.toContainText("Team & Access");
  await page.getByRole("searchbox", { name: "Search dashboard pages" }).fill("enquiries");
  await page
    .locator(".dashboard-search-results")
    .getByRole("link", { name: /^Enquiries Customers/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Enquiries", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: /^Synthetic parts enquiry/ }),
  ).toBeVisible();
  expect(
    state.reads.every(
      (p) =>
        p.startsWith("/auth/") ||
        p.startsWith("/staff/workforce/") ||
        p === "/staff/notifications/summary",
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-workforce-desktop.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("technician updates only technical fields using the existing review modal", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/admin/workforce/jobs");
  await page.getByRole("link", { name: "WO-SYNTHETIC-20", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Technical work", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Assign technician", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Synthetic vibration diagnosis");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Synthetic vibration diagnosis",
  );
  await page.getByLabel("Progress", { exact: true }).selectOption("IN_PROGRESS");
  await page
    .getByRole("button", { name: "Review technical update", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("dd").filter({ hasText: "Synthetic vibration diagnosis" }),
  ).toBeVisible();
  expect(state.writes).toEqual([
    {
      path: `/staff/workforce/jobs/${id(20)}/work`,
      body: {
        expectedVersion: 0,
        diagnosis: "Synthetic vibration diagnosis",
        status: "IN_PROGRESS",
      },
    },
  ]);
});
test("direct forbidden URLs do not mount legacy finance or fetch its data", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/admin/payments");
  await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
  await expect(
    page.getByText(
      "Your current responsibilities do not permit that page. You can continue with the tools available here.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.reads).not.toContain("/staff/payments");
  expect(state.reads).not.toContain("/staff/overview");
});
test("permission loading and revocation discard old-tab content and navigation", async ({
  page,
}) => {
  const state = await fixture(page);
  state.hold = true;
  await page.goto("/admin");
  await expect(
    page.getByText("Checking current responsibility access…", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operational overview" })).toHaveCount(
    0,
  );
  expect(state.reads).not.toContain("/staff/workforce/overview");
  state.hold = false;
  state.release?.();
  await expect(page.getByRole("heading", { name: "Operational overview" })).toBeVisible();
  state.access.permissions = ["BOOKINGS_READ", "ORDERS_READ"];
  state.access.assignments = [state.access.assignments[0]];
  state.access.version++;
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Customer Service Officer", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("navigation", { name: "Administration", exact: true }),
  ).not.toContainText("Customers & Enquiries");
  state.denied = true;
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("heading", { name: "Operational overview" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Your account does not have permission for this action." }),
  ).toBeVisible();
});
test("mobile technician navigation and job queue stay accessible without horizontal overflow", async ({
  page,
}) => {
  await fixture(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operational overview" })).toBeVisible();
  const menu = page.getByRole("button", {
    name: /Open.*menu|Open.*navigation|Open menu/i,
  });
  await menu.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "My work", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workshop jobs", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-workforce-mobile.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
