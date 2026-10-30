import { test, expect, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { StaffBooking } from "@/lib/api/staff-booking-schemas";
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const record = () => ({
  id: id(1),
  customerId: id(2),
  bookingSlotId: id(3),
  version: 7,
  status: "CONFIRMED",
  scheduledAt: "2026-09-25T09:00:00Z",
  service: {
    id: id(4),
    name: "Isolated workshop service",
    slug: "isolated-service",
    description: null,
    shortDescription: null,
    pricingType: "FIXED",
    priceKobo: "10000",
    currency: "NGN",
    durationMinutes: 60,
    version: 1,
  },
  branch: { id: id(5), name: "Isolated branch", code: "TEST" },
  assignedStaff: { id: id(6), firstName: "Test", lastName: "Technician" },
  vehicle: null,
  customerNotes: "Test appointment note",
  staffNotes: null,
  depositAmountKobo: "3000",
  depositPaidAt: "2026-09-13T09:00:00Z",
  paymentHoldExpiresAt: null,
  customerRescheduleCount: 0,
  disruptionRequestedAt: null,
  disruptionReason: null,
  disruptionResolution: null,
  depositPayment: { id: id(7), status: "SUCCEEDED", amountKobo: "3000" },
  quotes: [],
  workOrder: null,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated test",
      data,
      meta: { requestId: "staff-booking-test" },
    },
  });

test("booking confirmation requires an active grant and a resource review, then refreshes the confirmed request", async ({
  page,
}) => {
  let permitted = false;
  let status = "REQUESTED";
  const writes: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(8),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-24T09:00:00Z",
        user: { id: id(9), email: "staff@example.test", role: "STAFF" },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-booking-csrf-".repeat(3) });
    if (endpoint === "/staff/profile")
      return reply(route, {
        id: id(9),
        email: "staff@example.test",
        role: "STAFF",
        status: "ACTIVE",
        capabilities: permitted ? ["BOOKING_CONFIRM"] : [],
        staffProfile: {
          id: id(6),
          firstName: "Test",
          lastName: "Technician",
          branchId: id(5),
        },
      });
    if (endpoint === `/staff/bookings/${id(1)}`)
      return reply(route, {
        ...record(),
        status,
        depositAmountKobo: null,
        depositPaidAt: null,
        depositPayment: null,
        disruptionRequestedAt: "2026-09-23T09:00:00Z",
        disruptionResolution: "TRANSFERRED",
        disruptionReason: "Prior appointment was moved at the workshop's request.",
      });
    if (endpoint === `/staff/bookings/${id(1)}/status`) {
      writes.push(route.request().postDataJSON());
      status = "CONFIRMED";
      return reply(route, {});
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/bookings/${id(1)}`);
  await expect(
    page.getByText(/Confirmation requires an active booking-confirmation permission/),
  ).toBeVisible();
  await expect(
    page.getByLabel("Next status").locator('option[value="CONFIRMED"]'),
  ).toHaveCount(0);
  permitted = true;
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(
    page.getByLabel("Next status").locator('option[value="CONFIRMED"]'),
  ).toHaveCount(1);
  await page.getByLabel("Next status").selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Review status change" }).click();
  await expect(
    page.getByLabel("People and equipment review", { exact: false }),
  ).toBeFocused();
  expect(writes).toEqual([]);
  await page
    .getByLabel("People and equipment review", { exact: false })
    .fill("Technician, bay and required diagnostic equipment are available.");
  await page.getByRole("button", { name: "Review status change" }).click();
  await expect(
    page.getByRole("dialog").getByText(/approved branch calendar/),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".booking-detail-status")).toHaveText("CONFIRMED");
  expect(writes).toEqual([
    {
      status: "CONFIRMED",
      expectedVersion: 7,
      staffNotes: null,
      resourceReviewNote:
        "Technician, bay and required diagnostic equipment are available.",
    },
  ]);
  await expect(
    page.getByRole("heading", { name: "Business-caused disruption" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

for (const paid of [false, true])
  test(`pending disruption offers the correct recovery for a ${paid ? "paid historical" : "no-deposit"} booking`, async ({
    page,
  }) => {
    await page.route("**/api/v1/**", async (route) => {
      const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
      if (endpoint === "/auth/session")
        return reply(route, {
          id: id(8),
          expiresAt: "2027-01-01T00:00:00Z",
          idleExpiresAt: "2027-01-01T00:00:00Z",
          mfaRequired: false,
          mfaVerifiedAt: null,
          user: { id: id(9), email: "customer@example.test", role: "CUSTOMER" },
        });
      if (endpoint === `/customers/bookings/${id(1)}`)
        return reply(route, {
          ...record(),
          disruptionRequestedAt: "2026-09-24T09:00:00Z",
          disruptionResolution: "PENDING",
          disruptionReason: "Required workshop equipment is unavailable.",
          ...(paid
            ? {}
            : { depositPayment: null, depositPaidAt: null, depositAmountKobo: null }),
        });
      if (endpoint === "/public/booking-policy")
        return reply(route, {
          version: "owner-booking-request-v2",
          minimumAdvanceHours: 2,
          maximumAdvanceHours: 720,
          paymentHoldMinutes: 0,
          depositBasisPoints: 0,
          depositRefundableForCustomerCancellation: true,
          customerRescheduleLimit: 1,
          customerRescheduleCutoffHours: 2,
          reminderHoursBeforeAppointment: [1],
        });
      return route.fulfill({
        status: 404,
        json: { success: false, error: { code: "NOT_FOUND" } },
      });
    });
    await page.goto(`/dashboard/bookings/${id(1)}`);
    await expect(
      page.getByRole("heading", { name: "Your appointment was disrupted" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose another slot" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Request refund", exact: true }),
    ).toHaveCount(paid ? 1 : 0);
    await expect(page.getByText("Cancel this booking", { exact: true })).toHaveCount(
      paid ? 0 : 1,
    );
  });
test("staff no-show requires explicit review, sends the version and cannot replay an uncertain result", async ({
  page,
}) => {
  let mutations = 0;
  let reads = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/auth/session")
      return reply(route, {
        id: id(8),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-13T09:00:00Z",
        user: {
          id: id(9),
          email: "staff@example.test",
          role: "STAFF",
          emailVerifiedAt: "2026-09-13T09:00:00Z",
        },
      });
    if (path === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-test-token-".repeat(3) });
    if (path === "/staff/profile")
      return reply(route, {
        id: id(9),
        email: "staff@example.test",
        role: "STAFF",
        status: "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: id(6),
          firstName: "Test",
          lastName: "Technician",
          branchId: id(5),
        },
      });
    if (path === `/staff/bookings/${id(1)}`) {
      reads++;
      return reply(route, {
        ...record(),
        depositPayment: undefined,
        ...(mutations ? { status: "NO_SHOW", version: 8 } : {}),
      });
    }
    if (path === `/staff/bookings/${id(1)}/status`) {
      mutations++;
      expect(route.request().postDataJSON()).toEqual({
        status: "NO_SHOW",
        expectedVersion: 7,
        staffNotes: null,
      });
      return route.abort("failed");
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/bookings/${id(1)}`);
  await expect(
    page.getByRole("heading", { name: "Isolated workshop service" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Next status").locator("option[value=CANCELLED]"),
  ).toHaveCount(1);
  await expect(page.getByLabel("Assigned staff member")).toHaveValue(id(6));
  await page.getByRole("button", { name: "Open dashboard navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Workshop bookings", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dashboard navigation" }).click();
  await page.getByLabel("Next status").selectOption("NO_SHOW");
  await page.getByRole("button", { name: "Review status change" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/no automatic fee or deposit forfeiture/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
  expect(mutations).toBe(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Confirm change" }).click();
  await expect(dialog.getByText(/outcome could not be confirmed/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm change" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Close & review record" }).click();
  await expect(page.locator(".booking-detail-status")).toHaveText("NO SHOW");
  await expect(page.getByLabel("Next status")).toHaveCount(0);
  expect(reads).toBeGreaterThan(1);
  expect(mutations).toBe(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
test("a legacy customer booking with no branch and no configured service duration remains readable", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/auth/session")
      return reply(route, {
        id: id(8),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: false,
        mfaVerifiedAt: null,
        user: { id: id(9), email: "customer@example.test", role: "CUSTOMER" },
      });
    if (path === "/customers/bookings")
      return reply(route, {
        items: [
          {
            ...record(),
            branch: null,
            service: { ...record().service, durationMinutes: null },
          },
        ],
      });
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  await page.goto("/dashboard/bookings");
  await expect(page.getByText("Isolated workshop service")).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("quotation issue and work-order milestones use revisions and refresh the parent booking", async ({
  page,
}) => {
  const reconciliationWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("same key")) reconciliationWarnings.push(message.text());
  });
  let quoteStatus = "DRAFT";
  let workStatus: string | null = null;
  let workVersion = 0;
  let workItems: unknown[] = [];
  let bookingStatus = "CONFIRMED";
  let diagnosis: string | null = null;
  let internalNotes: string | null = null;
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(8),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-13T09:00:00Z",
        user: { id: id(9), email: "staff@example.test", role: "STAFF" },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-test-token-".repeat(3) });
    if (endpoint === "/staff/profile")
      return reply(route, {
        id: id(9),
        email: "staff@example.test",
        role: "STAFF",
        status: "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: id(6),
          firstName: "Test",
          lastName: "Technician",
          branchId: id(5),
        },
      });
    if (endpoint === `/staff/bookings/${id(1)}`)
      return reply(route, {
        ...record(),
        status: bookingStatus,
        quotes: [
          {
            id: id(10),
            quoteNumber: "TEST-QUOTE",
            version: 2,
            revision: 3,
            status: quoteStatus,
            totalKobo: "12345",
            subtotalKobo: "12345",
            taxKobo: "0",
            expiresAt: "2027-01-01T00:00:00Z",
            notes: null,
            items: [
              {
                id: id(11),
                type: "LABOUR",
                productId: null,
                description: "Test labour",
                quantity: 1,
                unitPriceKobo: "12345",
                subtotalKobo: "12345",
              },
            ],
          },
        ],
        workOrder: workStatus
          ? {
              id: id(12),
              workOrderNumber: "TEST-WORK",
              status: workStatus,
              version: workVersion,
              diagnosis,
              internalNotes,
              items: workItems,
            }
          : null,
      });
    if (endpoint === `/staff/bookings/${id(1)}/quotes/${id(10)}/issue`) {
      expect(route.request().postDataJSON()).toEqual({ expectedRevision: 3 });
      quoteStatus = "ISSUED";
      return reply(route, {});
    }
    if (endpoint === `/staff/bookings/${id(1)}/work-orders`) {
      expect(route.request().postDataJSON()).toEqual({
        expectedBookingVersion: 7,
        diagnosis: "Test diagnosis",
        internalNotes: "Test internal note",
        items: [],
      });
      diagnosis = "Test diagnosis";
      internalNotes = "Test internal note";
      workStatus = "DRAFT";
      return reply(route, {});
    }
    if (
      endpoint === `/staff/bookings/${id(1)}/work-orders/${id(12)}` &&
      route.request().method() === "PUT"
    ) {
      expect(route.request().postDataJSON()).toEqual({
        expectedVersion: 0,
        addItems: [
          { type: "FEE", description: "Test fee", quantity: 1, unitPriceKobo: "125" },
        ],
      });
      workItems = [
        {
          id: id(13),
          type: "FEE",
          description: "Test fee",
          quantity: 1,
          unitPriceKobo: "125",
          subtotalKobo: "125",
          productId: null,
        },
      ];
      workVersion++;
      return reply(route, {});
    }
    if (endpoint === `/staff/bookings/${id(1)}/work-orders/${id(12)}/status`) {
      const body = route.request().postDataJSON();
      expect(body.expectedVersion).toBe(workVersion);
      expect(Object.keys(body).sort()).toEqual(["expectedVersion", "status"]);
      workVersion++;
      workStatus = body.status;
      if (workStatus === "IN_PROGRESS" || workStatus === "COMPLETED")
        bookingStatus = workStatus;
      return reply(route, {});
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  await page.goto(`/admin/bookings/${id(1)}`);
  await page.getByRole("button", { name: "Review issue", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText(/Other issued quotations/),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(/seven days from issuance/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm change" }).click();
  const issuedQuote = page.getByRole("article", { name: "TEST-QUOTE" });
  await expect(issuedQuote.getByText("Issued", { exact: true })).toBeVisible();
  await expect(issuedQuote.getByText("Version 2 · Revision 3")).toBeVisible();
  await page.getByLabel("Diagnosis (customer-visible)").fill("Test diagnosis");
  await page.getByLabel("Internal work-order notes").fill("Test internal note");
  await page.getByRole("button", { name: "Review draft work order" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Diagnosis is visible to the customer/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("heading", { name: "TEST-WORK" })).toBeVisible();
  await page.getByRole("button", { name: "Add work-order items" }).click();
  const workLine = page.getByRole("group", { name: "Line 1", exact: true });
  await workLine.getByLabel("Line type").selectOption("FEE");
  await workLine.getByLabel("Description", { exact: true }).fill("Test fee");
  await workLine.getByLabel("Unit price (NGN)").fill("1.25");
  await page.getByRole("button", { name: "Review additional items" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("cell", { name: "Test fee", exact: true })).toBeVisible();
  for (const milestone of ["approved", "in progress", "quality check", "completed"]) {
    await page.getByRole("button", { name: `Mark ${milestone}`, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(page.locator(".booking-detail-status")).toHaveText("COMPLETED");
  await expect(page.getByLabel("Internal work-order notes")).toHaveCount(0);
  expect(workVersion).toBe(5);
  expect(reconciliationWarnings).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-staff-booking-completed.png"),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

for (const lostOperation of ["none", "create", "replace"] as const) {
  test(
    lostOperation === "replace"
      ? "uncertain draft replacement restores quotation controls after reconciliation"
      : lostOperation === "create"
        ? "uncertain quotation creation blocks replay and reconciles the saved draft"
        : "quotation editing sends exact kobo, delegates part prices and replaces the draft by revision",
    async ({ page }) => {
      let quotes: StaffBooking["quotes"] = [];
      let creates = 0;
      let replacements = 0;
      const part = {
        id: id(20),
        name: "Test catalogue part",
        slug: "test-catalogue-part",
        sku: "TEST-PART-20",
        brand: null,
        manufacturerPartNumber: null,
        description: null,
        priceKobo: "12345",
        compareAtPriceKobo: null,
        currency: "NGN",
        category: {
          id: id(21),
          name: "Test category",
          slug: "test-category",
          description: null,
        },
        images: [],
        compatibilities: [],
        availability: [],
      };
      await page.route("**/api/v1/**", async (route) => {
        const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
        if (endpoint === "/auth/session")
          return reply(route, {
            id: id(8),
            expiresAt: "2027-01-01T00:00:00Z",
            idleExpiresAt: "2027-01-01T00:00:00Z",
            mfaRequired: true,
            mfaVerifiedAt: "2026-09-13T09:00:00Z",
            user: { id: id(9), email: "staff@example.test", role: "STAFF" },
          });
        if (endpoint === "/auth/csrf")
          return reply(route, { csrfToken: "isolated-test-token-".repeat(3) });
        if (endpoint === "/staff/profile")
          return reply(route, {
            id: id(9),
            email: "staff@example.test",
            role: "STAFF",
            status: "ACTIVE",
            capabilities: [],
            staffProfile: {
              id: id(6),
              firstName: "Test",
              lastName: "Technician",
              branchId: id(5),
            },
          });
        if (endpoint === `/staff/bookings/${id(1)}`)
          return reply(route, { ...record(), quotes });
        if (endpoint === "/public/catalog/products")
          return reply(route, { items: [part] });
        if (
          endpoint === `/staff/bookings/${id(1)}/quotes` ||
          endpoint === `/staff/bookings/${id(1)}/quotes/${id(22)}`
        ) {
          const replacing = route.request().method() === "PUT";
          const body = route.request().postDataJSON();
          expect(body).toEqual({
            items: [
              {
                type: "LABOUR",
                description: "Test labour",
                quantity: 2,
                unitPriceKobo: replacing ? "102" : "101",
              },
              {
                type: "PART",
                productId: part.id,
                quantity: 1,
                ...(replacing ? { description: part.name } : {}),
              },
            ],
            notes: null,
            expiresAt: "2027-01-01T10:00:00+01:00",
            ...(replacing ? { expectedRevision: 0 } : {}),
          });
          if (replacing) replacements++;
          else creates++;
          const saved: StaffBooking["quotes"][number] = {
            id: replacing ? id(23) : id(22),
            quoteNumber: replacing ? "TEST-REPLACEMENT" : "TEST-DRAFT",
            version: replacing ? 2 : 1,
            revision: 0,
            status: "DRAFT",
            subtotalKobo: replacing ? "12549" : "12547",
            totalKobo: replacing ? "13490" : "13488",
            taxKobo: "941",
            expiresAt: "2027-01-01T09:00:00Z",
            notes: null,
            items: [
              {
                id: id(24),
                type: "LABOUR",
                productId: null,
                description: "Test labour",
                quantity: 2,
                unitPriceKobo: replacing ? "102" : "101",
                subtotalKobo: replacing ? "204" : "202",
              },
              {
                id: id(25),
                type: "PART",
                productId: part.id,
                description: part.name,
                quantity: 1,
                unitPriceKobo: "12345",
                subtotalKobo: "12345",
              },
            ],
          };
          quotes = replacing
            ? [saved, { ...quotes[0], status: "VOID", revision: 1 }]
            : [saved];
          if (
            (lostOperation === "create" && !replacing) ||
            (lostOperation === "replace" && replacing)
          )
            return route.abort("failed");
          return reply(route, saved);
        }
        return route.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        });
      });
      await page.goto(`/admin/bookings/${id(1)}`);
      await page.getByRole("button", { name: "Create quotation" }).click();
      const first = page.getByRole("group", { name: "Line 1", exact: true });
      await first.getByLabel("Description", { exact: true }).fill("Test labour");
      await first.getByLabel("Quantity", { exact: true }).fill("2");
      await first.getByLabel("Unit price (NGN)").fill("1.01");
      await page.getByRole("button", { name: "Add line item" }).click();
      const second = page.getByRole("group", { name: "Line 2", exact: true });
      await second.getByLabel("Line type").selectOption("PART");
      await expect(
        second
          .getByLabel("Catalogue part", { exact: true })
          .locator(`option[value='${part.id}']`),
      ).toHaveCount(1);
      await second.getByLabel("Catalogue part", { exact: true }).selectOption(part.id);
      await expect(page.getByLabel("Tax amount (NGN)")).toHaveCount(0);
      await expect(
        page.getByText(/Tax is calculated by Allied AutoTech when the draft is saved/),
      ).toBeVisible();
      await page.getByLabel("Draft expiry (Lagos time)").fill("2027-01-01T10:00");
      if (lostOperation === "none") {
        await page.setViewportSize({ width: 320, height: 740 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page.locator(".line-entry-form").screenshot({
          path: path.join(os.tmpdir(), "allied-quotation-editor-mobile.png"),
        });
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(accessibility.violations).toEqual([]);
      }
      await page.getByRole("button", { name: "Review quotation draft" }).click();
      expect(creates).toBe(0);
      await expect(
        page.getByRole("dialog").getByText(/server calculates totals/),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change" })
        .click();
      if (lostOperation === "create") {
        await expect(
          page.getByRole("dialog").getByText(/outcome could not be confirmed/),
        ).toBeVisible();
        await expect(
          page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
        ).toBeDisabled();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close & review record" })
          .click();
        await expect(
          page.getByRole("heading", { name: "TEST-DRAFT", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Review quotation draft" }),
        ).toBeDisabled();
        await expect(page.getByLabel("Draft expiry (Lagos time)")).toBeDisabled();
        await expect(page.getByLabel("Quotation notes (optional)")).toBeDisabled();
        expect(creates).toBe(1);
        expect(replacements).toBe(0);
        return;
      }
      await expect(
        page.getByRole("heading", { name: "TEST-DRAFT", exact: true }),
      ).toBeVisible();
      expect(creates).toBe(1);
      const draftTotals = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name: "TEST-DRAFT", exact: true }) });
      await expect(draftTotals.locator("dd")).toContainText(["125.47", "9.41", "134.88"]);
      await page.getByRole("button", { name: "Edit draft" }).click();
      await expect(second.getByLabel("Catalogue part", { exact: true })).toHaveValue(
        part.id,
      );
      await expect(page.getByLabel("Draft expiry (Lagos time)")).toHaveValue(
        "2027-01-01T10:00",
      );
      await first.getByLabel("Unit price (NGN)").fill("1.02");
      await page.getByRole("button", { name: "Review quotation draft" }).click();
      await expect(
        page.getByRole("dialog").getByText(/voids the old draft/),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change" })
        .click();
      if (lostOperation === "replace") {
        await expect(
          page.getByRole("dialog").getByText(/outcome could not be confirmed/),
        ).toBeVisible();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close & review record" })
          .click();
        await expect(
          page.getByRole("button", { name: "Create quotation" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Edit draft", exact: true }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole("heading", { name: "TEST-REPLACEMENT", exact: true }),
      ).toBeVisible();
      const previousDraft = page.getByRole("article", { name: "TEST-DRAFT" });
      await expect(previousDraft.getByText("Void", { exact: true })).toBeVisible();
      await expect(previousDraft.getByText("Version 1 · Revision 1")).toBeVisible();
      expect(replacements).toBe(1);
    },
  );
}

for (const width of [390, 1440]) {
  test(`unclassified concern requires reviewed service assignment at ${width}px`, async ({
    page,
  }, info) => {
    let classified = false;
    const writes: unknown[] = [];
    const chosen = {
      ...record().service,
      pricingType: "QUOTE_REQUIRED",
      priceKobo: null,
    };
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", async (route) => {
      const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
      if (endpoint === "/auth/session")
        return reply(route, {
          id: id(8),
          expiresAt: "2027-01-01T00:00:00Z",
          idleExpiresAt: "2027-01-01T00:00:00Z",
          mfaRequired: true,
          mfaVerifiedAt: "2026-09-24T09:00:00Z",
          user: { id: id(9), email: "staff@example.test", role: "STAFF" },
        });
      if (endpoint === "/auth/csrf")
        return reply(route, { csrfToken: "isolated-booking-csrf-".repeat(3) });
      if (endpoint === "/staff/profile")
        return reply(route, {
          id: id(9),
          email: "staff@example.test",
          role: "STAFF",
          status: "ACTIVE",
          capabilities: ["BOOKING_CONFIRM"],
          staffProfile: {
            id: id(6),
            firstName: "Test",
            lastName: "Technician",
            branchId: id(5),
          },
        });
      if (endpoint === "/public/services") {
        expect(new URL(route.request().url()).searchParams.has("pricingType")).toBe(
          false,
        );
        return reply(route, { items: [chosen] });
      }
      if (endpoint === `/staff/bookings/${id(1)}`)
        return reply(route, {
          ...record(),
          status: "REQUESTED",
          version: classified ? 8 : 7,
          service: classified ? chosen : null,
          assignedStaff: classified ? record().assignedStaff : null,
          customerConcern: "The vehicle vibrates when braking",
          bookingSlotId: null,
          depositAmountKobo: null,
          depositPaidAt: null,
          depositPayment: null,
        });
      if (endpoint === `/staff/bookings/${id(1)}/assignment`) {
        writes.push(route.request().postDataJSON());
        classified = true;
        return reply(route, {});
      }
      return route.fulfill({
        status: 404,
        json: { success: false, error: { code: "NOT_FOUND" } },
      });
    });
    await page.goto(`/admin/bookings/${id(1)}`);
    await expect(
      page.getByText("The vehicle vibrates when braking", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Next status").locator('option[value="CONFIRMED"]'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Review assignment" }).click();
    await expect(page.getByLabel("Service for this concern")).toBeFocused();
    expect(writes).toEqual([]);
    await page.getByLabel("Service for this concern").selectOption(id(4));
    await page.getByRole("button", { name: "Review assignment" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Classify and assign this concern?" }),
    ).toBeVisible();
    await expect(
      dialog.getByText(/does not confirm the appointment or charge/),
    ).toBeVisible();
    expect(writes).toEqual([]);
    await dialog.getByRole("button", { name: "Confirm change" }).click();
    await expect(page.getByLabel("Service for this concern")).toHaveCount(0);
    await expect(
      page.getByLabel("Next status").locator('option[value="CONFIRMED"]'),
    ).toHaveCount(1);
    expect(writes).toEqual([
      { assignedStaffId: id(6), serviceId: id(4), expectedVersion: 7 },
    ]);
    await expect(page.locator(".booking-detail-status")).toHaveText("REQUESTED");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath("classified-concern.png") });
  });
}

for (const decision of ["ACCEPT", "DECLINE"] as const) {
  for (const width of [390, 1440]) {
    test(`alternative appointment ${decision} requires both reviews at ${width}px`, async ({
      page,
    }, info) => {
      let role = "STAFF";
      let version = 7;
      let alternativeStartsAt: string | null = null;
      let alternativeReason: string | null = null;
      let alternativeVersion: number | null = null;
      let scheduledAt = new Date(Date.now() + 8 * 86400000).toISOString();
      const originalTime = scheduledAt;
      const writes: { endpoint: string; body: Record<string, unknown> }[] = [];
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/api/v1/**", async (route) => {
        const req = route.request();
        const endpoint = new URL(req.url()).pathname.replace("/api/v1", "");
        if (endpoint === "/auth/session")
          return reply(route, {
            id: id(8),
            expiresAt: "2027-01-01T00:00:00Z",
            idleExpiresAt: "2027-01-01T00:00:00Z",
            mfaRequired: role === "STAFF",
            mfaVerifiedAt: role === "STAFF" ? "2026-10-30T09:00:00Z" : null,
            user: { id: id(9), email: "test@example.test", role },
          });
        if (endpoint === "/auth/csrf") return reply(route, { csrfToken: "s".repeat(64) });
        if (endpoint === "/staff/profile")
          return reply(route, {
            id: id(9),
            email: "test@example.test",
            role: "STAFF",
            status: "ACTIVE",
            capabilities: ["BOOKING_CONFIRM"],
            staffProfile: {
              id: id(6),
              firstName: "Test",
              lastName: "Technician",
              branchId: id(5),
            },
          });
        if (endpoint === "/public/booking-policy")
          return reply(route, {
            version: "test",
            minimumAdvanceHours: 168,
            maximumAdvanceHours: 336,
            paymentHoldMinutes: 0,
            depositBasisPoints: 0,
            depositRefundableForCustomerCancellation: true,
            customerRescheduleLimit: 1,
            customerRescheduleCutoffHours: 24,
            reminderHoursBeforeAppointment: [24],
          });
        if (
          [`/staff/bookings/${id(1)}`, `/customers/bookings/${id(1)}`].includes(endpoint)
        )
          return reply(route, {
            ...record(),
            status: "REQUESTED",
            version,
            scheduledAt,
            bookingSlotId: null,
            alternativeStartsAt,
            alternativeReason,
            alternativeVersion,
            depositAmountKobo: null,
            depositPaidAt: null,
            depositPayment: null,
          });
        if (endpoint.endsWith("/alternative")) {
          const body = req.postDataJSON();
          writes.push({ endpoint, body });
          alternativeStartsAt = body.preferredAt;
          alternativeReason = body.reason;
          version++;
          alternativeVersion = version;
          return reply(route, {});
        }
        if (endpoint.endsWith("/alternative-response")) {
          const body = req.postDataJSON();
          writes.push({ endpoint, body });
          if (body.decision === "ACCEPT") scheduledAt = alternativeStartsAt!;
          alternativeStartsAt = null;
          alternativeReason = null;
          alternativeVersion = null;
          version++;
          return reply(route, {});
        }
        return reply(route, { items: [] });
      });
      await page.goto(`/admin/bookings/${id(1)}`);
      const preferred = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 16);
      await page.getByLabel("Proposed time (Lagos)", { exact: true }).fill(preferred);
      await page
        .getByLabel("Reason shown to customer", { exact: true })
        .fill("Please review this alternative workshop time.");
      await page.getByRole("button", { name: "Review alternative time" }).click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("heading", { name: "Propose this alternative time?" }),
      ).toBeVisible();
      expect(writes).toHaveLength(0);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change" })
        .click();
      await expect(page.getByText(/Current proposal:/)).toBeVisible();
      expect(scheduledAt).toBe(originalTime);
      expect(writes[0].body.expectedVersion).toBe(7);
      const proposedTime = alternativeStartsAt;
      role = "CUSTOMER";
      await page.goto(`/dashboard/bookings/${id(1)}`);
      await expect(
        page.getByRole("heading", { name: "The workshop proposed another time" }),
      ).toBeVisible();
      await page
        .getByRole("heading", { name: "The workshop proposed another time" })
        .scrollIntoViewIfNeeded();
      expect(
        (await new AxeBuilder({ page }).include(".booking-changes").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({ path: info.outputPath("alternative-proposal.png") });
      await page
        .getByRole("button", {
          name: decision === "ACCEPT" ? "Review proposed time" : "Decline proposed time",
          exact: true,
        })
        .click();
      expect(writes).toHaveLength(1);
      await expect(page.getByRole("dialog")).toContainText(
        decision === "ACCEPT" ? "not a confirmed appointment" : "stay unchanged",
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change" })
        .click();
      await expect(
        page.getByRole("heading", { name: "The workshop proposed another time" }),
      ).toHaveCount(0);
      expect(writes[1].body).toEqual({ decision, expectedVersion: 8 });
      expect(scheduledAt).toBe(decision === "ACCEPT" ? proposedTime : originalTime);
      await expect(
        page.locator(".booking-appointment .booking-detail-status"),
      ).toHaveText(/Requested/);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    });
  }
}
