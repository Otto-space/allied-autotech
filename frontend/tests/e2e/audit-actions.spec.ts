import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";
import { overviewFixture } from "../fixtures/overview";
import { workThreadFixture, bookingId } from "../fixtures/work-support-detail";
import { workComplaintPolicyFixture } from "../fixtures/work-complaint-policy";
import { workDisputePolicyFixture } from "../fixtures/work-dispute-policy";
import { workExceptionFixture } from "../fixtures/work-payment-exceptions";
import { workDisputeOverviewFixture } from "../fixtures/work-payment-disputes";
import { profileFixture } from "../fixtures/customer-profile";
import { customerReviewsFixture } from "../fixtures/customer-reviews";
import { garageFixture } from "../fixtures/customer-garage";
import { savedFixture } from "../fixtures/saved-items";
import os from "node:os";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const directory = path.join(os.tmpdir(), "allied-audit-actions-20261025");
const restricted =
  /\/dashboard\/(cart|orders|bookings|payments|invoices|inspections|vehicle-transactions)(\/|$)/;
test.beforeAll(async () => {
  await mkdir(directory, { recursive: true });
});
test.use({ reducedMotion: "reduce" });

test("changed flows have no application console errors or warnings", async ({ page }) => {
  const problems: string[] = [];
  const failedReads: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400)
      failedReads.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) problems.push(message.text());
  });
  for (const [route, setup] of [
    ["/dashboard", (p: Page) => fixture(p, "CUSTOMER")],
    ["/dashboard/profile", profileFixture],
    ["/dashboard/reviews", customerReviewsFixture],
    ["/admin/complaint-policy", workComplaintPolicyFixture],
    ["/admin/dispute-policy", workDisputePolicyFixture],
    [`/admin/support/complaints/${bookingId(60000)}`, workThreadFixture],
  ] as const) {
    await page.goto("about:blank");
    await page.unrouteAll({ behavior: "wait" });
    await setup(page);
    await page.route("**/api/v1/*/notifications/summary", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Isolated header summary",
          meta: { requestId: "audit-health" },
          data: { unreadCount: 0, groups: [], destinations: [] },
        },
      }),
    );
    await page.goto(route);
    const ready =
      route === "/dashboard"
        ? ".customer-care"
        : route === "/dashboard/profile"
          ? ".cp-private"
          : route === "/dashboard/reviews"
            ? ".cr-form"
            : route.includes("complaint-policy")
              ? "#policy-escalationUserId"
              : route.includes("dispute-policy")
                ? "#policy-primaryUserId"
                : ".support-audience";
    await expect(page.locator(ready)).toBeVisible();
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("nextjs-portal")).not.toContainText(
      /Build Error|Runtime Error/,
    );
  }
  expect(problems, failedReads.join("\n")).toEqual([]);
});

test("A01: the saved-items navigation label matches the actual page", async ({
  page,
}) => {
  await savedFixture(page);
  await page.goto("/dashboard/saved");
  const nav = page.getByRole("navigation", { name: "Customer dashboard", exact: true });
  await nav.getByRole("link", { name: "Saved items", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Saved items", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Saved items", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("A07: empty-message error and doubled text remain usable on a short phone", async ({
  page,
}) => {
  const f = await workThreadFixture(page, "STAFF");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
  const review = page.getByRole("button", { name: "Review reply", exact: true });
  await review.click();
  await expect(page.getByLabel("Reply text", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#support-reply-error")).not.toBeEmpty();
  await page.locator(".support-reply-compose").evaluate((el) => {
    const elements = Array.from(
      el.querySelectorAll("label, legend, p, textarea, button"),
    );
    const sizes = elements.map((node) => parseFloat(getComputedStyle(node).fontSize));
    elements.forEach((node, index) => {
      (node as HTMLElement).style.fontSize = `${sizes[index] * 2}px`;
    });
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await review.scrollIntoViewIfNeeded();
  await expect(review).toBeInViewport();
  expect(f.detail.writes).toEqual([]);
});
async function check(page: Page, name: string, width: number) {
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("nextjs-portal")).not.toContainText(
    /Build Error|Runtime Error/,
  );
  expect(await page.title()).not.toBe("");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  if ([390, 1440].includes(width))
    await page.screenshot({ path: path.join(directory, `after-${name}-${width}.png`) });
}

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`A01 A05: enquiry release preserves recorded activity without restricted links at ${width}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const state = await fixture(page, "CUSTOMER");
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/dashboard");
    await expect(page.locator(".customer-care")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Request a service visit", exact: true }),
    ).toHaveAttribute("href", "/services");
    await expect(page.locator(".overview-release-note")).toContainText(
      "payment collection are unavailable",
    );
    await expect(page.locator(".care-service")).toContainText(
      state.care!.currentBooking!.serviceName,
    );
    await expect(page.locator(".care-review")).toContainText("NGN 85,000.00");
    await expect(page.locator("#overview-preset")).toHaveValue("30");
    for (const href of await page
      .locator(".customer-overview a")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")!)))
      expect(href).not.toMatch(restricted);
    if (width <= 900)
      await page.getByRole("button", { name: "Open dashboard navigation" }).click();
    const nav = page.getByRole("navigation", { name: "Customer dashboard", exact: true });
    await expect(
      nav.getByRole("link", { name: "Saved items", exact: true }),
    ).toHaveAttribute("href", "/dashboard/saved");
    await expect(nav.getByText("My orders", { exact: true })).toHaveCount(0);
    if (width <= 900) await page.keyboard.press("Escape");
    await check(page, "overview", width);
    expect(errors).toEqual([]);
  });

  test(`A07: audience is explicit through keyboard, review and cancellation at ${width}`, async ({
    page,
  }) => {
    const f = await workThreadFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
    const visible = page.getByRole("radio", {
      name: "Customer-visible reply",
      exact: true,
    });
    const internal = page.getByRole("radio", {
      name: "Internal staff note",
      exact: true,
    });
    await expect(visible).toBeChecked();
    await visible.focus();
    await page.keyboard.press("ArrowRight");
    await expect(internal).toBeChecked();
    await expect(page.locator(".support-audience-summary")).toContainText("Staff only");
    await page
      .getByLabel("Reply text", { exact: true })
      .fill("Synthetic audience review only. No real message is sent.");
    await page.getByRole("button", { name: "Review internal note", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Staff only");
    await expect(
      dialog.getByRole("button", { name: "Save internal note", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue(
      /Synthetic audience/,
    );
    await visible.check();
    await page.getByRole("button", { name: "Review reply", exact: true }).click();
    await expect(dialog).toContainText("Customer-visible");
    await expect(
      dialog.getByRole("button", { name: "Send reply", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.locator(".support-audience").scrollIntoViewIfNeeded();
    await check(page, "support", width);
    expect(f.detail.writes).toEqual([]);
    expect(errors).toEqual([]);
  });

  for (const policy of ["complaint", "dispute"] as const)
    test(`A04: ${policy} contact refresh preserves selection at ${width}`, async ({
      page,
    }) => {
      const f = await (policy === "complaint"
        ? workComplaintPolicyFixture(page)
        : workDisputePolicyFixture(page));
      await page.setViewportSize({ width, height: 960 });
      await page.goto(`/admin/${policy}-policy`);
      const refresh = page.getByRole("button", {
        name: "Refresh contact directory",
        exact: true,
      });
      await expect(refresh).toBeEnabled();
      const selections = await page
        .locator("input[type=hidden]")
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value));
      const count = f.contactReads.length;
      await refresh.click();
      await expect.poll(() => f.contactReads.length).toBeGreaterThan(count);
      await expect(refresh).toBeEnabled();
      expect(
        await page
          .locator("input[type=hidden]")
          .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value)),
      ).toEqual(selections);
      expect((await refresh.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await refresh.focus();
      await expect(refresh).toBeFocused();
      await check(page, `${policy}-policy`, width);
      expect(f.writes).toEqual([]);
    });

  test(`A03: saved vehicle refresh is recognisable and does not change search at ${width}`, async ({
    page,
  }) => {
    await garageFixture(page);
    await page.route("**/api/v1/public/**", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Isolated empty catalogue",
          meta: { requestId: "audit-fixture" },
          data: {
            items: new URL(route.request().url()).pathname.endsWith("/fitment/makes")
              ? [
                  {
                    id: "a0000000-0000-4000-8000-000000000001",
                    name: "Toyota",
                    isActive: true,
                  },
                ]
              : [],
            totalMatches: 0,
          },
        },
      }),
    );
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/parts?vehicleMake=Toyota");
    await page
      .getByRole("button", { name: "Find parts for my car", exact: true })
      .click();
    const refresh = page.getByRole("button", {
      name: "Refresh saved vehicles",
      exact: true,
    });
    await expect(refresh).toBeVisible();
    const before = page.url();
    await refresh.click();
    await expect(refresh).toBeEnabled();
    expect(page.url()).toBe(before);
    expect((await refresh.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(
      page.getByRole("link", { name: "Manage saved vehicles", exact: true }),
    ).toHaveAttribute("href", "/dashboard/vehicles");
    await refresh.scrollIntoViewIfNeeded();
    await check(page, "parts", width);
  });
}

for (const [route, setup] of [
  ["payment-exceptions", workExceptionFixture],
  ["payment-disputes", workDisputeOverviewFixture],
] as const)
  test(`A02: ${route} returns to a real permitted overview`, async ({ page }) => {
    await setup(page, "ADMIN");
    await page.goto(`/admin/${route}`);
    const link = page.getByRole("link", { name: "Back to overview", exact: true });
    await expect(link).toHaveAttribute("href", "/admin");
    await page.route("**/api/v1/staff/overview?**", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          message: "Isolated overview",
          meta: { requestId: "audit-return" },
          data: overviewFixture("ADMIN"),
        },
      });
    });
    await link.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Workshop overview", exact: true }),
    ).toBeVisible();
  });

for (const mode of ["empty", "error"])
  test(`A05: ${mode} overview has truthful release guidance`, async ({ page }) => {
    const f = await fixture(page, "CUSTOMER");
    f.mode = mode;
    await page.goto("/dashboard");
    await expect(page.locator(".overview-release-note")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Request a service visit", exact: true }),
    ).toBeVisible();
    if (mode === "error")
      await expect(page.getByRole("button", { name: "Retry overview" })).toBeVisible();
    else
      await expect(
        page.getByText("No service in progress", { exact: true }),
      ).toBeVisible();
  });

for (const width of [390, 1440])
  test(`A06: profile, review and privacy disclosures agree at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await profileFixture(page);
    await page.goto("/dashboard/profile");
    await expect(page.locator(".cp-private")).toContainText("Approved public reviews");
    await expect(page.locator("main")).not.toContainText("visible only to you");
    await check(page, "profile", width);
    await page.unrouteAll({ behavior: "wait" });
    await customerReviewsFixture(page);
    await page.goto("/dashboard/reviews");
    await expect(page.locator(".cr-form-intro")).toContainText(
      "first and last name and current profile photo, if added",
    );
    await check(page, "reviews", width);
    await page.goto("/privacy");
    await expect(page.locator("main")).toContainText(
      "your profile first and last name and current profile photo",
    );
    await check(page, "privacy", width);
  });
