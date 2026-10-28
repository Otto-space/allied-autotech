import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workRefundFixture, id } from "../fixtures/work-refunds";
import { managedIndependentFixture } from "../fixtures/workforce-independent";
import { workDisputeHandlingFixture } from "../fixtures/work-dispute-handling";
import { workFinancePolicyFixture } from "../fixtures/work-finance-policy";
import { workPrivacyFixture } from "../fixtures/work-privacy";
import { verifyConsole } from "../fixtures/preview-console";

for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [390, 768, 1440])
    test(`managed ${role} retains independent refund work and loses it on recheck at ${width}`, async ({
      page,
    }) => {
      const f = await workRefundFixture(page, role);
      f.grants = ["REFUND_APPROVE"];
      f.records = f.records.filter((record) => record.status === "REQUESTED");
      await managedIndependentFixture(page, role, () => f.grants);
      const errors: string[] = [],
        warnings: string[] = [],
        external: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
        if (message.type() === "warning") warnings.push(message.text());
      });
      page.on("request", (request) => {
        if (
          /^https?:/.test(request.url()) &&
          !["localhost", "127.0.0.1"].includes(new URL(request.url()).hostname)
        )
          external.push(request.url());
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/admin/refunds?refundId=${id(200000)}`);
      await expect(page.locator(".wr-handling")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Review refund decision", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Payment records", exact: true }),
      ).toHaveCount(0);
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (role === "STAFF" && width !== 768) {
        await page
          .locator(".wr-handling")
          .evaluate((element) => element.scrollIntoView({ block: "start" }));
        await page
          .getByRole("button", { name: "Review refund decision", exact: true })
          .focus();
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-independent-refunds-${width}.png`),
        });
      }
      await page
        .getByRole("button", { name: "Review refund decision", exact: true })
        .click();
      // This opens review only; the test never confirms a monetary action.
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(f.writes).toEqual([]);
      f.grants = [];
      await page.evaluate(() => window.dispatchEvent(new Event("aat:workforce-recheck")));
      await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator(".wr-handling")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "No work queues available" }),
      ).toBeVisible();
      expect(await page.locator("body").innerText()).not.toContain(
        f.records[0].refundNumber,
      );
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
      await page.getByRole("button", { name: "Refresh overview", exact: true }).focus();
      if (role === "STAFF" && width !== 768)
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-independent-revoked-${width}.png`),
        });
      expect(f.writes).toEqual([]);
      await verifyConsole(page, errors, warnings);
      expect(external).toEqual([]);
    });

for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [390, 1440])
    for (const workflow of ["disputes", "privacy", "financial-policy"] as const)
      test(`managed ${role} uses populated ${workflow} and loses only its grant at ${width}`, async ({
        page,
      }) => {
        let grants: string[], writes: unknown[], route: string;
        if (workflow === "disputes") {
          const f = await workDisputeHandlingFixture(page, role);
          grants = f.base.grants;
          writes = f.writes;
          route = `/admin/payment-disputes/work?selected=${id(220001)}`;
        } else if (workflow === "privacy") {
          const f = await workPrivacyFixture(page, role);
          grants = ["PRIVACY_REVIEW"];
          writes = f.privacy.writes;
          route = "/admin/privacy";
        } else {
          const f = await workFinancePolicyFixture(page, role);
          grants = f.grants;
          writes = f.writes;
          route = "/admin/finance-policy";
        }
        await managedIndependentFixture(page, role, () => grants);
        const errors: string[] = [],
          warnings: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
          if (message.type() === "warning") warnings.push(message.text());
        });
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(route);
        if (workflow === "disputes") {
          await expect(page.locator(".wh-identity")).toBeVisible();
          await expect(
            page.getByRole("link", { name: "View dispute overview", exact: true }),
          ).toHaveCount(0);
          await expect(page.getByLabel("Primary operator", { exact: true })).toHaveCount(
            role === "ADMIN" ? 1 : 0,
          );
        } else if (workflow === "privacy") {
          await expect(page.locator(".wpr-record")).toHaveCount(3);
          await page
            .locator(".wpr-record")
            .first()
            .getByRole("button", { name: "Review request", exact: true })
            .click();
          await expect(page.getByLabel("Response visible to the customer")).toBeVisible();
        } else {
          await expect(
            page.getByLabel("Invoice business name", { exact: true }),
          ).toBeEnabled();
          await expect(
            page.getByRole("region", { name: "Current policy" }),
          ).toContainText("Version 2");
        }
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
        expect(writes).toEqual([]);
        grants = [];
        await page.evaluate(() =>
          window.dispatchEvent(new Event("aat:workforce-recheck")),
        );
        await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
        await expect(
          page.getByRole("heading", { name: "No work queues available" }),
        ).toBeVisible();
        expect(writes).toEqual([]);
        await verifyConsole(page, errors, warnings);
      });
