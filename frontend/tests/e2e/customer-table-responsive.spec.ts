import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { workCustomersFixture } from "../fixtures/work-customers";
import { notificationsFixture } from "../fixtures/customer-notifications";

const evidence = path.join(os.tmpdir(), "allied-customer-table-20261026");
const baseline = process.env.AAT_TABLE_BASELINE === "true";

for (const width of [1184, 1200, 1280, 1366, 1440, 1920]) {
  test(`customer rows stay compact across sidebar toggles at ${width}px`, async ({
    page,
  }) => {
    fs.mkdirSync(evidence, { recursive: true });
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = await workCustomersFixture(page);
    fixture.customers.records = fixture.customers.records.slice(0, 3);
    fixture.customers.records[1].firstName = "Directory QA";
    fixture.customers.records[1].lastName = "Acceptance";
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/admin/customers");
    await expect(page).toHaveTitle(/Customers/);
    await expect(page.getByRole("table")).toBeVisible();
    const results = [];
    for (const collapsed of [false, true, false]) {
      const toggle = page.getByRole("button", {
        name: collapsed ? "Collapse sidebar" : "Expand sidebar",
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await expect(page.locator(".dashboard")).toHaveAttribute(
        "data-sidebar-collapsed",
        String(collapsed),
      );
      await expect(page.locator(".dashboard-navigation-container")).toHaveCSS(
        "scrollbar-width",
        "none",
      );
      await expect(page.locator(".wc-records")).toHaveCSS("scrollbar-width", "none");
      const metrics = await page.locator(".wc-records").evaluate((region) => ({
        width: region.clientWidth,
        scrollWidth: region.scrollWidth,
        pageWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        rows: [...region.querySelectorAll("tbody tr")].map((row) => {
          const link = row.querySelector("td:last-child a")!;
          const account = row.querySelector(".care-account-menu > summary")!;
          const actions = link.parentElement!;
          const linkBox = link.getBoundingClientRect();
          const accountBox = account.getBoundingClientRect();
          const status = row.querySelector("[data-status]")!.getBoundingClientRect();
          return {
            height: row.getBoundingClientRect().height,
            actionDirection: getComputedStyle(actions).flexDirection,
            actionWidth: actions.getBoundingClientRect().width,
            actionY: linkBox.y,
            accountY: accountBox.y,
            linkHeight: linkBox.height,
            accountHeight: accountBox.height,
            actionRight: Math.max(linkBox.right, accountBox.right),
            cellRight: actions.parentElement!.getBoundingClientRect().right,
            statusHeight: status.height,
          };
        }),
      }));
      results.push({ collapsed, ...metrics });
      if (!baseline) {
        expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewport);
        for (const row of metrics.rows) {
          expect(row.actionDirection).toBe("row");
          expect(Math.abs(row.actionY - row.accountY)).toBeLessThanOrEqual(1);
          expect(row.actionRight).toBeLessThanOrEqual(row.cellRight);
          expect(row.statusHeight).toBeLessThanOrEqual(36);
        }
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
      }
      if (results.length < 3) {
        await page
          .getByRole("region", { name: "Customer results", exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(
            evidence,
            `${baseline ? "before" : "after"}-${width}-${collapsed ? "collapsed" : "expanded"}.png`,
          ),
        });
      }
    }
    if (!baseline) {
      expect(results[1].rows.map((row) => row.height)).toEqual(
        results[0].rows.map((row) => row.height),
      );
      expect(results[2].rows.map((row) => row.height)).toEqual(
        results[0].rows.map((row) => row.height),
      );
      const first = page.locator("tbody tr").first();
      const summary = first.locator(".care-account-menu > summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(first.getByRole("button", { name: /Suspend account/ })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(summary).toBeFocused();
      expect(fixture.customers.writes).toEqual([]);
      expect(errors).toEqual([]);
      if (width === 1200) {
        expect(
          (
            await new AxeBuilder({ page })
              .include("main")
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
    }
    fs.writeFileSync(
      path.join(evidence, `${baseline ? "before" : "after"}-${width}.json`),
      JSON.stringify(results, null, 2),
    );
  });
}

for (const width of [320, 390, 768, 1024]) {
  test(`narrow customer table keeps long identities and row controls reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = await workCustomersFixture(page);
    fixture.customers.records = fixture.customers.records.slice(0, 3);
    const name = "Synthetic customer with several unusually long family names";
    fixture.customers.records[0].firstName = name;
    fixture.customers.records[0].lastName = "Acceptance";
    await page.goto("/admin/customers");
    const region = page.getByRole("region", { name: "Customer results", exact: true });
    await expect(region).toHaveCSS("overflow-x", "auto");
    const first = page.locator("tbody tr").first();
    await expect(
      first.getByRole("link", { name: `${name} Acceptance`, exact: true }),
    ).toBeVisible();
    await region.focus();
    await expect(region).toBeFocused();
    const link = first.getByRole("link", { name: /View details/ });
    for (
      let step = 0;
      step < 6 && !(await link.evaluate((el) => el === document.activeElement));
      step++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(link).toBeFocused();
    // The scroll region must expose controls, without a pinned cell covering them.
    await expect
      .poll(() =>
        link.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
          );
        }),
      )
      .toBe(true);
    const summary = first.locator(".care-account-menu > summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(first.getByRole("button", { name: /Suspend account/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(summary).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(fixture.customers.writes).toEqual([]);
    await page.screenshot({ path: path.join(evidence, `after-mobile-${width}.png`) });
  });
}

for (const customer of [false, true]) {
  test(`${customer ? "customer" : "admin"} sidebar hides its track and retains keyboard scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (customer) await notificationsFixture(page);
    else await workCustomersFixture(page);
    await page.goto(customer ? "/dashboard/notifications" : "/admin/customers");
    const navigation = page.locator("#dashboard-navigation");
    for (const summary of await navigation.locator("details > summary").all()) {
      if (!(await summary.evaluate((el) => el.parentElement!.hasAttribute("open"))))
        await summary.click();
    }
    await expect(navigation).toHaveCSS("scrollbar-width", "none");
    const last = navigation.getByRole("link").last();
    await last.focus();
    await expect(last).toBeFocused();
    await expect.poll(() => navigation.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    const box = await last.boundingBox();
    const scroller = await navigation.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(scroller!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(scroller!.y + scroller!.height + 1);
    await expect(
      page.locator(".sidebar").getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(evidence, `after-sidebar-${customer ? "customer" : "admin"}.png`),
    });
  });
}

test("mobile navigation hides its track and retains scrolling and Escape focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await workCustomersFixture(page);
  await page.goto("/admin/customers");
  const opener = page.getByRole("button", {
    name: "Open dashboard navigation",
    exact: true,
  });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Dashboard navigation", exact: true });
  const navigation = drawer.locator(".dashboard-drawer-content");
  await expect(navigation).toHaveCSS("scrollbar-width", "none");
  for (const summary of await navigation.locator("details > summary").all()) {
    if (!(await summary.evaluate((el) => el.parentElement!.hasAttribute("open"))))
      await summary.click();
  }
  await navigation.getByRole("link").last().focus();
  await expect.poll(() => navigation.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(opener).toBeFocused();
});
