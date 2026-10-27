import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import {
  workforceEnquiriesFixture,
  enquiryFixtureId as id,
} from "../fixtures/workforce-enquiries";
import { aftercareSnapshot } from "../fixtures/workforce-aftercare-data";
import { verifyConsole } from "../fixtures/preview-console";
const contact = {
  name: "Synthetic private customer",
  email: "synthetic-private-contact@example.test",
  phone: "+2348000000000",
  customerId: id(600),
};
for (const width of [390, 1440])
  for (const mode of ["redacted", "foreign-list", "foreign-detail", "permitted"] as const)
    test(`${mode} Care contact stays within the case branch at ${width}px`, async ({
      page,
    }) => {
      const f = await workforceEnquiriesFixture(page, "SALES_CASHIER");
      const assignment = f.base.access.assignments[0];
      f.base.access.assignments.push({
        ...assignment,
        id: id(601),
        template: "CUSTOMER_SERVICE",
        scope: "BRANCH",
        branchId: mode === "permitted" ? assignment.branchId : id(602),
      });
      f.base.access.permissions = [
        "SALES_ENQUIRIES",
        "CUSTOMER_ENQUIRIES",
        "COMPLAINTS",
        "BOOKINGS_READ",
        "ORDERS_READ",
      ];
      Object.assign(f.base.access, aftercareSnapshot(f.base.access, "STAFF"));
      const errors: string[] = [],
        warnings: string[] = [],
        external: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
        if (m.type() === "warning") warnings.push(m.text());
      });
      page.on("request", (r) => {
        if (
          /^https?:/.test(r.url()) &&
          !["127.0.0.1", "localhost"].includes(new URL(r.url()).hostname)
        )
          external.push(r.url());
      });
      if (mode === "foreign-list" || mode === "permitted")
        Object.assign(f.items[0], { contact });
      if (mode === "foreign-detail")
        await page.route(
          new RegExp(`/api/v1/staff/workforce/enquiries/${f.items[0].id}(?:\\?|$)`),
          (route) => {
            if (route.request().method() !== "GET") return route.fallback();
            const messages = [...f.messages].sort(
              (a, b) =>
                b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
            );
            return route.fulfill({
              json: {
                success: true,
                message: "Isolated invalid cross-branch contact fixture",
                data: {
                  ...f.items[0],
                  contact,
                  access: f.base.access,
                  generatedAt: new Date().toISOString(),
                  latestMessageId: messages[0].id,
                  messages: { items: messages },
                  emailDeliveries: { items: [] },
                },
                meta: { requestId: "contact-scope-fixture" },
              },
            });
          },
        );
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `/admin/workforce/enquiries${mode === "foreign-list" ? "" : `?selected=${f.items[0].id}`}`,
      );
      if (mode === "foreign-list")
        await expect(
          page.getByRole("heading", {
            name: "Enquiries could not be refreshed",
            exact: true,
          }),
        ).toBeVisible();
      else if (mode === "foreign-detail")
        await expect(
          page.getByRole("heading", {
            name: "Enquiry could not be verified",
            exact: true,
          }),
        ).toBeVisible();
      else {
        await expect(page.locator("#wfe-body")).toBeEditable();
        if (mode === "permitted")
          await expect(page.locator("main")).toContainText(contact.email);
        else
          await expect(
            page.getByText("Customer identity not available in this scope", {
              exact: true,
            }),
          ).toBeVisible();
      }
      if (mode !== "permitted")
        for (const value of [contact.name, contact.email, contact.phone])
          expect(await page.locator("main").textContent()).not.toContain(value);
      expect(f.writes).toEqual([]);
      expect(external).toEqual([]);
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
      if (mode === "redacted")
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-care-contact-scoped-${width}.png`),
        });
      await verifyConsole(page, errors, warnings);
    });
