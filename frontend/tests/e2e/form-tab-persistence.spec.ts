import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const id = "fa000000-0000-4000-8000-000000000002";
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} keeps an unfinished form after switching browser tabs and reloading`, async ({
    page,
    context,
  }) => {
    let sessions = 0;
    let reads = 0;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/**", async (route) => {
      const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
      let data: unknown = { items: [] };
      if (endpoint === "/auth/session") {
        sessions++;
        data = {
          id,
          mfaRequired: role !== "CUSTOMER",
          mfaVerifiedAt: "2026-09-30T08:00:00Z",
          expiresAt: "2027-01-01T00:00:00Z",
          idleExpiresAt: "2027-01-01T00:00:00Z",
          user: { id, email: "form@example.test", role },
        };
      }
      if (endpoint === "/staff/profile")
        data = {
          id,
          email: "form@example.test",
          role,
          status: "ACTIVE",
          capabilities: [],
          staffProfile: { id, firstName: "Test", lastName: "Staff", branchId: id },
        };
      if (endpoint === "/customers/profile") {
        reads++;
        data = {
          firstName: "Ada",
          lastName: "Okoro",
          phone: "+2348000000000",
          address: null,
          city: "Lagos",
          state: "Lagos",
          country: "Nigeria",
          photo: null,
          mediaVersion: 0,
          profileVersion: 0,
          user: { id, email: "form@example.test" },
        };
      }
      if (endpoint === "/public/branches") {
        reads++;
        data = { items: [{ id, name: "Test branch" }] };
      }
      await route.fulfill({
        json: {
          success: true,
          message: "Form persistence fixture",
          data,
          meta: { requestId: "form-persistence-test" },
        },
      });
    });
    const customer = role === "CUSTOMER";
    const target = customer ? "/dashboard/profile" : "/admin/vehicles/new";
    await page.goto(target);
    await expect(page).toHaveTitle(customer ? /Your profile/ : /Add vehicle record/);
    await expect(
      page.getByRole("heading", {
        name: customer ? "Your profile" : "Add vehicle record",
        exact: true,
      }),
    ).toBeVisible();
    const first = page.getByLabel(customer ? "First name" : "Make", { exact: true });
    const second = page.getByLabel(customer ? "City (optional)" : "Model", {
      exact: true,
    });
    await first.fill("Unsaved value");
    await second.fill("Still editing");
    const beforeSessions = sessions;
    const beforeReads = reads;
    const otherTab = await context.newPage();
    await otherTab.goto("about:blank");
    await otherTab.bringToFront();
    await page.bringToFront();
    // Explicitly exercise the browser visibility event as headless browsers may
    // keep all pages visible despite changing the frontmost tab.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => sessions).toBeGreaterThan(beforeSessions);
    if (role !== "STAFF") await expect.poll(() => reads).toBeGreaterThan(beforeReads);
    await expect(first).toHaveValue("Unsaved value");
    await expect(second).toHaveValue("Still editing");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(first).toHaveValue("Unsaved value");
    await expect(second).toHaveValue("Still editing");
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await page.reload();
    await expect(first).toHaveValue("Unsaved value");
    await expect(second).toHaveValue("Still editing");
    if (role === "SUPER_ADMIN" || customer) {
      await page.setViewportSize({ width: customer ? 390 : 1440, height: 1000 });
      await first.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-form-tab-${role.toLowerCase()}.png`),
      });
    }
    expect(errors).toEqual([]);
    await otherTab.close();
  });
}
