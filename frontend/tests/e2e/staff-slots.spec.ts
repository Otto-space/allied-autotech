import { test, expect, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const branch = { id: id(1), name: "Isolated slot branch", code: "SLOT-TEST" };
const service = {
  id: id(2),
  name: "Isolated fixed service",
  slug: "isolated-fixed-service",
  description: null,
  shortDescription: null,
  pricingType: "FIXED",
  priceKobo: "10000",
  currency: "NGN",
  durationMinutes: 60,
  version: 0,
};
const staff = { id: id(3), firstName: "Test", lastName: "Operator" };
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated fixture",
      data,
      meta: { requestId: "slot-test" },
    },
  });

test("staff without a profile cannot publish appointment slots", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(7),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-24T09:00:00Z",
        user: { id: id(8), email: "staff@example.test", role: "STAFF" },
      });
    if (endpoint === "/staff/profile")
      return reply(route, {
        id: id(8),
        email: "staff@example.test",
        role: "STAFF",
        status: "ACTIVE",
        staffProfile: null,
      });
    return reply(route, { items: [] });
  });
  await page.goto("/admin/booking-slots");
  await expect(
    page.getByText("A staff profile is required", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review new slot" })).toBeDisabled();
});
for (const { role, loseResponse } of [
  { role: "STAFF", loseResponse: false },
  { role: "STAFF", loseResponse: true },
  { role: "SUPER_ADMIN", loseResponse: false },
  { role: "ADMIN", loseResponse: false },
]) {
  test(
    loseResponse
      ? "uncertain slot publication reconciles saved availability without resubmitting"
      : `${role} publishes and closes a slot${role === "STAFF" ? "" : " without a staff profile"} with Lagos time and a versioned confirmation`,
    async ({ page }) => {
      let created = false;
      let status = "OPEN";
      let creates = 0;
      let updates = 0;
      const slot = (own: boolean) => ({
        id: own ? id(4) : id(5),
        branchId: branch.id,
        serviceId: service.id,
        startsAt: "2027-01-01T09:00:00Z",
        endsAt: "2027-01-01T10:00:00Z",
        version: updates,
        status: own ? status : "OPEN",
        service,
        branch,
        staff: own ? staff : { ...staff, id: id(6), firstName: "Other" },
      });
      await page.route("**/api/v1/**", async (route) => {
        const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
        if (endpoint === "/auth/session")
          return reply(route, {
            id: id(7),
            expiresAt: "2027-01-01T00:00:00Z",
            idleExpiresAt: "2027-01-01T00:00:00Z",
            mfaRequired: true,
            mfaVerifiedAt: "2026-09-13T09:00:00Z",
            user: { id: id(8), email: "staff@example.test", role },
          });
        if (endpoint === "/auth/csrf")
          return reply(route, { csrfToken: "isolated-test-token-".repeat(3) });
        if (endpoint === "/staff/profile")
          return reply(route, {
            id: id(8),
            email: "staff@example.test",
            role,
            status: "ACTIVE",
            staffProfile: role === "STAFF" ? { ...staff, branchId: branch.id } : null,
          });
        if (endpoint === "/admin/staff")
          return reply(route, {
            items: [
              {
                id: id(10),
                email: "technician@example.test",
                role: "STAFF",
                status: "ACTIVE",
                staffProfile: { ...staff, branchId: branch.id },
              },
            ],
          });
        if (endpoint === "/staff/bookings") return reply(route, { items: [] });
        if (endpoint === "/public/branches") return reply(route, { items: [branch] });
        if (endpoint === "/public/services")
          return reply(route, {
            items: [
              service,
              {
                ...service,
                id: id(9),
                name: "Unconfigured service",
                durationMinutes: null,
              },
            ],
          });
        if (endpoint === "/staff/booking-slots") {
          if (route.request().method() === "POST") {
            creates++;
            expect(route.request().postDataJSON()).toEqual({
              branchId: branch.id,
              serviceId: service.id,
              staffId: staff.id,
              startsAt: "2027-01-01T10:00:00+01:00",
            });
            created = true;
            return loseResponse ? route.abort("failed") : reply(route, slot(true));
          }
          const filter = new URL(route.request().url()).searchParams.get("status");
          const items = [
            ...(role === "STAFF" ? [slot(false)] : []),
            ...(created ? [slot(true)] : []),
          ].filter((item) => !filter || item.status === filter);
          return reply(route, { items });
        }
        if (endpoint === `/staff/booking-slots/${id(4)}`) {
          expect(route.request().method()).toBe("PATCH");
          expect(route.request().postDataJSON()).toEqual({
            expectedVersion: 0,
            status: "CLOSED",
          });
          updates++;
          status = "CLOSED";
          return reply(route, slot(true));
        }
        return route.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        });
      });
      if (role !== "STAFF") {
        await page.goto("/admin/bookings");
        await expect(
          page.getByRole("heading", { name: "Workshop bookings", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Your account does not have permission for this action."),
        ).toHaveCount(0);
      }
      await page.goto("/admin/booking-slots");
      await expect(
        page.getByRole("heading", { name: "Appointment slots", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("A staff profile is required", { exact: false }),
      ).toHaveCount(0);
      if (role === "STAFF")
        await expect(
          page.getByText("Assigned staff or administrator manages this slot."),
        ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Close slot", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Review new slot" }).click();
      await expect(page.getByLabel("Appointment branch")).toBeFocused();
      await page.getByLabel("Appointment branch").selectOption(branch.id);
      await expect(
        page.getByLabel("Appointment service").locator(`option[value='${id(9)}']`),
      ).toHaveCount(0);
      await page.getByLabel("Appointment service").selectOption(service.id);
      await page.getByLabel("Appointment staff member").selectOption(staff.id);
      await page.getByLabel("Appointment starts (Lagos time)").fill("2027-01-01T10:00");
      await page.getByRole("button", { name: "Review new slot" }).click();
      await expect(
        page.getByRole("dialog").getByText(/calculate the end time/),
      ).toBeVisible();
      expect(creates).toBe(0);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change" })
        .click();
      if (loseResponse) {
        await expect(
          page.getByRole("dialog").getByText(/outcome could not be confirmed/),
        ).toBeVisible();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close & review record" })
          .click();
        await expect(
          page.getByRole("button", { name: "Review new slot" }),
        ).toBeDisabled();
        await expect(
          page.getByRole("button", { name: "Close slot", exact: true }),
        ).toBeVisible();
        expect(creates).toBe(1);
        return;
      }
      await expect(
        page.getByRole("button", { name: "Close slot", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close slot", exact: true }).click();
      await expect(
        page.getByRole("dialog").getByText(/does not cancel an existing booking/),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change" })
        .click();
      await expect(
        page.getByRole("button", { name: "Open slot", exact: true }),
      ).toBeVisible();
      expect(creates).toBe(1);
      expect(updates).toBe(1);
      await page.getByLabel("Slot status").selectOption("CLOSED");
      await expect(page.getByRole("row")).toHaveCount(2);
      await page.setViewportSize({ width: 320, height: 740 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      if (role === "SUPER_ADMIN")
        await page.screenshot({
          path: path.join(os.tmpdir(), "allied-super-admin-slots.png"),
          fullPage: true,
        });
    },
  );
}
