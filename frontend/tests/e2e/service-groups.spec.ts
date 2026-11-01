import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = (n: number) => "f8000000-0000-4000-8000-" + String(n).padStart(12, "0");
const names = [
  "Tyre & Wheel Maintenance",
  "Vehicle Diagnostics & Inspections",
  "ECU Programming & Vehicle Electronics",
  "Suspension Repairs",
  "Engine & Drive System Maintenance",
  "Vehicle AC Maintenance",
  "Bodywork & Painting",
  "Interior Repairs",
];
for (const width of [390, 1440])
  test(
    "service groups preserve empty-group enquiry at " + width + "px",
    async ({ page }, info) => {
      const groups = names.map((name, i) => ({
        id: id(i + 1),
        name,
        slug: "group-" + i,
        image:
          i < 2
            ? {
                id: id(900 + i),
                url: `/api/v1/public/media/images/${id(900 + i)}`,
                altText: "Group workshop photo",
                width: 96,
                height: 64,
              }
            : null,
        description: "Discuss your vehicle and the work required with the workshop.",
      }));
      await page.route("**/api/v1/**", (route) => {
        const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
        if (path.startsWith("/public/media/images/"))
          return path.endsWith(id(900))
            ? route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="#a00"/></svg>',
              })
            : route.fulfill({ status: 404, body: "" });
        if (path === "/auth/session")
          return route.fulfill({
            status: 401,
            json: {
              success: false,
              message: "Sign in required",
              error: { code: "UNAUTHENTICATED" },
              meta: { requestId: "group-fixture" },
            },
          });
        let data: unknown = { items: [] };
        if (path === "/public/services/categories") data = { items: groups };
        if (path.startsWith("/public/services/categories/"))
          data = groups.find((g) => path.endsWith(g.id));
        if (path === "/public/services/discovery") data = { items: [], totalMatches: 0 };
        return route.fulfill({
          json: {
            success: true,
            data,
            message: "Isolated groups",
            meta: { requestId: "group-fixture" },
          },
        });
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/services");
      const cards = page.locator(".service-group-card");
      await expect(cards).toHaveCount(8);
      const photo = cards.first().getByRole("img");
      await photo.scrollIntoViewIfNeeded();
      await expect
        .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      await expect(photo).toHaveCSS("object-fit", "contain");
      expect((await photo.boundingBox())!.height).toBeLessThanOrEqual(240);
      await cards.nth(1).scrollIntoViewIfNeeded();
      await expect(
        cards.nth(1).getByRole("img", { name: "Service image unavailable" }),
      ).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).include(".service-groups").analyze()).violations,
      ).toEqual([]);
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("groups.png") });
      for (let index = 0; index < names.length; index += 1) {
        await cards.filter({ hasText: names[index] }).click();
        await expect(page).toHaveURL(new RegExp("categoryId=" + id(index + 1)));
        await expect(
          page.getByRole("link", { name: "Request a visit", exact: true }),
        ).toHaveAttribute("href", `/services/request?serviceGroup=${id(index + 1)}`);
        await expect(
          page.getByRole("link", { name: "Ask a question", exact: true }),
        ).toHaveAttribute("href", `/contact?serviceGroup=${id(index + 1)}#enquiry`);
        await page.goBack();
        await expect(cards).toHaveCount(8);
      }
      await cards.filter({ hasText: "Vehicle AC Maintenance" }).click();
      await expect(page).toHaveURL(new RegExp("categoryId=" + id(6)));
      const retry = page.getByRole("button", { name: "Retry services", exact: true });
      if (await retry.isVisible()) await retry.click();
      await expect(
        page.getByRole("heading", { name: "Discuss this work with the workshop" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Ask a question", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("serviceGroup=" + id(6)));
      await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
        "Service request: Vehicle AC Maintenance",
      );
      await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
        "I would like to discuss Vehicle AC Maintenance.\n\nVehicle and concern:",
      );
      await page.reload();
      await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
        "Service request: Vehicle AC Maintenance",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("group-enquiry.png") });
    },
  );

test("signed-in main-service question creates an owned structured request", async ({
  page,
}, info) => {
  const owner = id(800),
    category = id(6),
    branch = id(801),
    enquiry = id(802);
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown = { items: [] };
    if (path === "/auth/session")
      data = {
        user: { id: owner, role: "CUSTOMER", email: "fixture@example.test" },
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
    if (path === "/auth/csrf") data = { csrfToken: "c".repeat(48) };
    if (path === "/customers/profile")
      data = {
        profileVersion: 0,
        mediaVersion: 0,
        photo: null,
        firstName: "Fixture",
        lastName: "Customer",
        phone: "08030000000",
        address: null,
        city: null,
        state: null,
        country: "Nigeria",
        user: { id: owner, email: "fixture@example.test" },
      };
    if (path === `/public/services/categories/${category}`)
      data = {
        id: category,
        name: "Vehicle AC Maintenance",
        slug: "vehicle-ac",
        description: "Discuss vehicle cooling with the workshop.",
        image: null,
      };
    if (path === "/public/branches")
      data = { items: [{ id: branch, name: "Fixture workshop" }] };
    if (path === "/customers/support/enquiries" && request.method() === "POST") {
      const body = request.postDataJSON();
      writes.push(body);
      expect(request.headers()["x-csrf-token"]).toBe("c".repeat(48));
      expect(request.headers()["idempotency-key"]).toMatch(/^support-create-v1\./);
      data = {
        ...body,
        id: enquiry,
        serviceId: null,
        productId: null,
        bookingId: null,
        quoteId: null,
        vehicleListingId: null,
        vehicleEnquiryIntent: null,
        status: "OPEN",
        version: 0,
        assignedStaffId: null,
        assignedStaff: null,
        branch: { id: branch, name: "Fixture workshop", code: "FIX" },
        resolvedAt: null,
        closedAt: null,
        createdAt: "2026-11-01T12:00:00Z",
        updatedAt: "2026-11-01T12:00:00Z",
        replayed: false,
        serviceCategory: { id: category, name: "Vehicle AC Maintenance" },
      };
    }
    return route.fulfill({
      status: request.method() === "POST" ? 201 : 200,
      json: {
        success: true,
        data,
        message: "Isolated request fixture",
        meta: { requestId: "service-owner-test" },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`/contact?serviceGroup=${category}#enquiry`);
  await expect(page.getByText(/Sending as Fixture Customer/)).toBeVisible();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Main service: Vehicle AC Maintenance", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("The air conditioning is not cooling. Please assess it.");
  await page.getByRole("button", { name: /Review enquiry/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Request received", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Request received", exact: true }),
  ).toBeFocused();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    type: "SERVICE",
    serviceCategoryId: category,
    branchId: branch,
  });
  expect(writes[0]).not.toHaveProperty("serviceId");
  expect(writes[0].message).not.toMatch(/[0-9a-f]{8}-|categoryId|https?:/);
  await expect(page.getByRole("link", { name: "Open your request" })).toHaveAttribute(
    "href",
    `/dashboard/support/enquiries/${enquiry}`,
  );
  await page.screenshot({ path: info.outputPath("owned-service-request.png") });
});
