import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { StaffVehicleSale } from "@/lib/api/staff-vehicle-sales-schemas";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
const id = (value: number) =>
  `70000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const saleFixture = (): StaffVehicleSale => ({
  id: id(1),
  transactionNumber: "ISOLATED-SALE-001",
  customerId: id(2),
  customerName: "Isolated customer",
  status: "ENQUIRY",
  version: 0,
  askingPriceKobo: "9999999999999999",
  agreedPriceKobo: null,
  reservationRequiredKobo: null,
  currency: "NGN",
  reservationExpiresAt: null,
  termsVersion: null,
  termsAcceptedAt: null,
  paidAt: null,
  cancellationReason: null,
  createdAt: "2026-09-17T09:00:00Z",
  vehicleListing: {
    id: id(3),
    title: "Isolated sale vehicle",
    status: "AVAILABLE",
    branchId: id(4),
    vehicle: {
      id: id(5),
      stockNumber: "ISOLATED-STOCK",
      make: "Test make",
      model: "Test model",
      year: 2024,
    },
  },
  statusHistory: [],
  handover: null,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Isolated test response",
      meta: { requestId: "vehicle-sales-test" },
    },
  });
const handoverFixture = (): NonNullable<StaffVehicleSale["handover"]> => ({
  id: id(20),
  status: "PENDING",
  version: 4,
  recipientName: "Isolated recipient",
  recipientPhone: "+2348000000000",
  odometerKm: 43210,
  keysDelivered: 2,
  readyAt: null,
  completedAt: null,
  cancelledAt: null,
});
async function fixture(
  page: Page,
  handler: (route: Route, endpoint: string) => Promise<boolean | void>,
  role = "STAFF",
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(6),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: "2026-09-17T08:00:00Z",
        user: { id: id(7), email: "sale@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-sales-token-".repeat(3) });
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
test("vehicle negotiation sends exact kobo and cancellation follows the server lifecycle", async ({
  page,
}) => {
  const sale = saleFixture();
  const writes: { endpoint: string; body: unknown }[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/vehicle-transactions") {
      await reply(route, { items: [sale] });
      return true;
    }
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/negotiate")) {
      const body = route.request().postDataJSON();
      writes.push({ endpoint, body });
      sale.agreedPriceKobo = body.agreedPriceKobo;
      sale.reservationRequiredKobo = body.reservationRequiredKobo;
      sale.status = "NEGOTIATING";
      sale.version++;
      sale.statusHistory.push({
        id: id(8),
        fromStatus: "ENQUIRY",
        toStatus: "NEGOTIATING",
        reason: body.notes,
        createdAt: new Date().toISOString(),
      });
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/status")) {
      const body = route.request().postDataJSON();
      writes.push({ endpoint, body });
      sale.status = body.status;
      sale.cancellationReason = body.reason;
      sale.version++;
      await reply(route, sale);
      return true;
    }
  });
  await page.goto("/admin/vehicle-sales");
  await expect(page.getByLabel("Active branch filter")).toHaveCount(0);
  await page.getByRole("link", { name: sale.transactionNumber }).click();
  await expect(
    page.getByRole("heading", { name: sale.vehicleListing.title }),
  ).toBeVisible();
  await page.getByLabel("Agreed price (NGN)").fill("12345678.91");
  await page.getByLabel("Reservation amount (optional, NGN)").fill("12345679.00");
  await page.getByRole("button", { name: "Review negotiated price" }).click();
  await expect(page.getByLabel("Reservation amount (optional, NGN)")).toBeFocused();
  await expect(
    page.getByText("The reservation amount cannot exceed the agreed price."),
  ).toBeVisible();
  await page.getByLabel("Reservation amount (optional, NGN)").fill("100.01");
  await page
    .getByLabel("Negotiation notes (optional)")
    .fill("Isolated agreed-price record");
  await page.getByRole("button", { name: "Review negotiated price" }).click();
  await expect(page.getByRole("dialog")).toContainText("does not reserve the vehicle");
  expect(writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status").first()).toHaveText("NEGOTIATING");
  expect(writes[0].body).toEqual({
    expectedVersion: 0,
    agreedPriceKobo: "1234567891",
    reservationRequiredKobo: "10001",
    notes: "Isolated agreed-price record",
  });
  await expect(
    page.getByRole("option", { name: "PAYMENT PENDING", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("option", { name: "RESERVED", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Review purchase status" }).click();
  await expect(page.getByLabel("Reason (required for cancellation)")).toBeFocused();
  await page
    .getByLabel("Reason (required for cancellation)")
    .fill("Isolated customer cancellation");
  await page.getByRole("button", { name: "Review purchase status" }).click();
  await expect(page.getByRole("dialog")).toContainText("does not issue a refund");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status").first()).toHaveText("CANCELLED");
  expect(writes[1].body).toEqual({
    expectedVersion: 1,
    status: "CANCELLED",
    reason: "Isolated customer cancellation",
  });
  await expect(page.getByRole("button", { name: "Review negotiated price" })).toHaveCount(
    0,
  );
  await page.setViewportSize({ width: 320, height: 740 });
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
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-vehicle-sale-mobile.png"),
    fullPage: true,
  });
});

test("lost vehicle cancellation stays unconfirmed until the refreshed server record arrives", async ({
  page,
}) => {
  const sale = saleFixture();
  sale.status = "RESERVED";
  sale.agreedPriceKobo = "12345";
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/status")) {
      writes++;
      sale.status = "CANCELLED";
      sale.version++;
      sale.cancellationReason = "Isolated cancellation";
      await route.abort("failed");
      return true;
    }
  });
  await page.goto(`/admin/vehicle-sales/${sale.id}`);
  await page.getByLabel("Next purchase status").selectOption("CANCELLED");
  await page
    .getByLabel("Reason (required for cancellation)")
    .fill("Isolated cancellation");
  await page.getByRole("button", { name: "Review purchase status" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await expect(page.locator(".status").first()).toHaveText("RESERVED");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(page.locator(".status").first()).toHaveText("CANCELLED");
  await expect(page.getByRole("button", { name: "Review purchase status" })).toHaveCount(
    0,
  );
  expect(writes).toBe(1);
});

test("vehicle list errors stay separate from empty results and legacy handover fields remain readable", async ({
  page,
}) => {
  const sale = saleFixture();
  sale.status = "HANDOVER_PENDING";
  sale.handover = {
    id: id(9),
    status: "PENDING",
    version: 0,
    recipientPhone: null,
    cancelledAt: null,
    recipientName: null,
    odometerKm: null,
    keysDelivered: 0,
    readyAt: null,
    completedAt: null,
  };
  let recovered = false;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/vehicle-transactions") {
      if (!recovered)
        await route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      else
        await reply(route, {
          items: new URL(route.request().url()).searchParams.has("status") ? [] : [sale],
        });
      return true;
    }
    if (
      endpoint === `/staff/vehicle-transactions/${sale.id}` ||
      endpoint === `/customers/vehicle-transactions/${sale.id}`
    ) {
      await reply(route, sale);
      return true;
    }
  });
  await page.goto("/admin/vehicle-sales");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    page.getByRole("heading", { name: "No vehicle purchases on this page" }),
  ).toHaveCount(0);
  recovered = true;
  await page.getByRole("button", { name: "Refresh vehicle sales" }).click();
  await page.getByLabel("Purchase status").selectOption("CANCELLED");
  await expect(
    page.getByRole("heading", { name: "No purchases match these filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear purchase filters" }).click();
  await page.getByRole("link", { name: sale.transactionNumber }).click();
  await expect(page.getByRole("heading", { name: "Recorded handover" })).toBeVisible();
  await expect(page.locator("dt", { hasText: /^Odometer$/ }).locator("+ dd")).toHaveText(
    "Not recorded",
  );
  await expect(page.getByRole("button", { name: "Review purchase status" })).toHaveCount(
    0,
  );
  await page.route("**/api/v1/auth/session", (route) =>
    reply(route, {
      id: id(6),
      mfaRequired: false,
      mfaVerifiedAt: null,
      expiresAt: "2027-01-01T00:00:00Z",
      idleExpiresAt: "2027-01-01T00:00:00Z",
      user: { id: id(2), email: "customer@example.test", role: "CUSTOMER" },
    }),
  );
  await page.goto(`/dashboard/vehicle-transactions/${sale.id}`);
  await expect(
    page.getByRole("heading", { name: "Vehicle handover", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("dt", { hasText: /^Recorded odometer$/ }).locator("+ dd"),
  ).toHaveText("Not recorded");
});

test("paid vehicle handover is reviewed before creation and completed with its own version", async ({
  page,
}) => {
  const sale = saleFixture();
  sale.status = "PAID";
  sale.version = 15;
  sale.paidAt = "2026-09-17T09:10:00Z";
  sale.agreedPriceKobo = "1234567891";
  const writes: { endpoint: string; body: unknown }[] = [];
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/handovers")) {
      const body = route.request().postDataJSON();
      writes.push({ endpoint, body });
      sale.handover = { ...handoverFixture(), ...body };
      sale.status = "HANDOVER_PENDING";
      sale.version++;
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/status") && sale.handover) {
      const body = route.request().postDataJSON();
      writes.push({ endpoint, body });
      expect(body.expectedVersion).toBe(sale.handover.version);
      sale.handover.status = body.status;
      sale.handover.version++;
      if (body.status === "READY") sale.handover.readyAt = "2026-09-17T10:00:00Z";
      if (body.status === "COMPLETED") {
        sale.handover.completedAt = "2026-09-17T11:00:00Z";
        sale.status = "COMPLETED";
        sale.vehicleListing.status = "SOLD";
        sale.version++;
      }
      await reply(route, sale);
      return true;
    }
  });
  await page.goto(`/admin/vehicle-sales/${sale.id}`);
  await expect(page).toHaveURL(new RegExp(`/admin/vehicle-sales/${sale.id}$`));
  await expect(page).toHaveTitle(/Vehicle/);
  await expect(
    page.getByRole("heading", { name: "Manage vehicle purchase" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review new handover" }).click();
  await expect(page.getByLabel("Recipient name", { exact: true })).toBeFocused();
  await page.getByLabel("Recipient name", { exact: true }).fill("Isolated recipient");
  await page.getByLabel("Recipient phone (international format)").fill("+2348000000000");
  await page.getByLabel("Recorded odometer (km)").fill("10000001");
  await page.getByLabel("Number of keys").fill("2");
  await page.getByRole("button", { name: "Review new handover" }).click();
  await expect(page.getByLabel("Recorded odometer (km)")).toBeFocused();
  await page.getByLabel("Recorded odometer (km)").fill("43210");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole("button", { name: "Review new handover" }).click();
  await expect(page.getByRole("dialog")).toContainText("does not complete delivery");
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Go back" }),
  ).toBeFocused();
  expect(writes).toHaveLength(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-handover-review-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status").first()).toHaveText("HANDOVER PENDING");
  expect(writes[0].body).toEqual({
    recipientName: "Isolated recipient",
    recipientPhone: "+2348000000000",
    odometerKm: 43210,
    keysDelivered: 2,
  });
  await expect(page.getByRole("button", { name: "Review new handover" })).toHaveCount(0);
  await expect(page.getByLabel("Next handover status").locator("option")).toHaveText([
    "READY",
    "CANCELLED",
  ]);
  await page.getByRole("button", { name: "Review handover status" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "purchase remains handover pending",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByLabel("Next handover status")).toHaveValue("COMPLETED");
  expect(writes[1].body).toEqual({ status: "READY", expectedVersion: 4 });
  await page.getByRole("button", { name: "Review handover status" }).click();
  await expect(page.getByRole("dialog")).toContainText("marks the vehicle listing sold");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status").first()).toHaveText("COMPLETED");
  expect(writes[2].body).toEqual({ status: "COMPLETED", expectedVersion: 5 });
  await expect(page.getByRole("button", { name: "Review handover status" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(runtimeErrors).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("heading", { name: "Recorded handover" }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-handover-completed-desktop.png"),
    fullPage: false,
  });
});

test("lost handover creation is not resent and cancellation explains the recovery gap", async ({
  page,
}) => {
  const sale = saleFixture();
  sale.status = "PAID";
  sale.paidAt = "2026-09-17T09:10:00Z";
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/handovers")) {
      writes++;
      sale.handover = handoverFixture();
      sale.status = "HANDOVER_PENDING";
      sale.version++;
      await route.abort("failed");
      return true;
    }
    if (endpoint.endsWith("/status") && sale.handover) {
      expect(route.request().postDataJSON()).toEqual({
        status: "CANCELLED",
        expectedVersion: 4,
      });
      writes++;
      sale.handover.status = "CANCELLED";
      sale.handover.version++;
      sale.handover.cancelledAt = "2026-09-17T10:00:00Z";
      await reply(route, sale);
      return true;
    }
  });
  await page.goto(`/admin/vehicle-sales/${sale.id}`);
  await page.getByLabel("Recipient name", { exact: true }).fill("Isolated recipient");
  await page.getByLabel("Recipient phone (international format)").fill("+2348000000000");
  await page.getByLabel("Recorded odometer (km)").fill("43210");
  await page.getByLabel("Number of keys").fill("2");
  await page.getByRole("button", { name: "Review new handover" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await expect(page.locator(".status").first()).toHaveText("PAID");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(page.locator(".status").first()).toHaveText("HANDOVER PENDING");
  expect(writes).toBe(1);
  await page.getByLabel("Next handover status").selectOption("CANCELLED");
  await page.getByRole("button", { name: "Review handover status" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "cannot reopen or replace a cancelled handover",
  );
  await expect(page.getByRole("dialog")).toContainText("does not refund payment");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByText("The purchase is still handover pending.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".status").first()).toHaveText("HANDOVER PENDING");
  await expect(page.getByRole("button", { name: "Review new handover" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review handover status" })).toHaveCount(
    0,
  );
  expect(writes).toBe(2);
});

test("handover PDF is uploaded separately, attached by ticket and accessed through an expiring link", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires the isolated storage.invalid runtime allowlist and intercepted storage.",
  );
  const sale = saleFixture();
  sale.status = "PAID";
  const pdf = Buffer.from("%PDF-1.4\nIsolated handover fixture\n%%EOF");
  const ticket = "isolated-signed-document-ticket-".repeat(3);
  let uploadBody: unknown;
  let handoverBody: Record<string, unknown> | undefined;
  let storageWrites = 0;
  let accessRequests = 0;
  await page.route("https://storage.invalid/upload/**", async (route) => {
    expect(route.request().method()).toBe("PUT");
    const headers = route.request().headers();
    expect(headers["cookie"]).toBeUndefined();
    expect(headers["x-csrf-token"]).toBeUndefined();
    expect(headers["content-type"]).toBe("application/pdf");
    expect(headers["x-amz-checksum-sha256"]).toBe(
      createHash("sha256").update(pdf).digest("base64"),
    );
    expect(route.request().postDataBuffer()).toEqual(pdf);
    storageWrites++;
    await route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": new URL(page.url()).origin },
      body: "",
    });
  });
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/assets/upload")) {
      uploadBody = route.request().postDataJSON();
      await reply(route, {
        assetToken: ticket,
        upload: {
          method: "PUT",
          url: "https://storage.invalid/upload/handover?signature=isolated",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          headers: {
            "content-type": "application/pdf",
            "x-amz-checksum-sha256": createHash("sha256").update(pdf).digest("base64"),
            "x-amz-server-side-encryption": "AES256",
          },
        },
      });
      return true;
    }
    if (endpoint.endsWith("/handovers")) {
      handoverBody = route.request().postDataJSON();
      sale.handover = handoverFixture();
      sale.status = "HANDOVER_PENDING";
      sale.version++;
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/access")) {
      accessRequests++;
      expect(route.request().postDataJSON()).toEqual({});
      await reply(route, {
        url: "https://storage.invalid/download/handover?signature=isolated-private",
        expiresInSeconds: 2,
      });
      return true;
    }
  });
  await page.goto(`/admin/vehicle-sales/${sale.id}`);
  await page.getByLabel("Recipient name", { exact: true }).fill("Isolated recipient");
  await page.getByLabel("Recipient phone (international format)").fill("+2348000000000");
  await page.getByLabel("Recorded odometer (km)").fill("43210");
  await page.getByLabel("Number of keys").fill("2");
  const fileInput = page.getByLabel("Signed handover document (optional)");
  await fileInput.setInputFiles({
    name: "isolated.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("button", { name: "Review new handover" }).click();
  await expect(fileInput).toBeFocused();
  await expect(
    page.getByText("Upload the selected document before continuing", { exact: false }),
  ).toBeVisible();
  expect(handoverBody).toBeUndefined();
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    page.getByText("File uploaded. Ready to attach", { exact: false }),
  ).toBeVisible();
  expect(uploadBody).toEqual({
    kind: "HANDOVER",
    mimeType: "application/pdf",
    sizeBytes: pdf.length,
    checksumSha256: createHash("sha256").update(pdf).digest("hex"),
  });
  expect(storageWrites).toBe(1);
  expect(handoverBody).toBeUndefined();
  await page.setViewportSize({ width: 320, height: 740 });
  const overflow = await page.locator("main *").evaluateAll((elements) =>
    elements
      .filter((element) => element.getBoundingClientRect().right > innerWidth)
      .map((element) => ({
        tag: element.tagName,
        class: element.className,
        width: element.getBoundingClientRect().width,
      })),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    JSON.stringify(overflow),
  ).toBe(true);
  await fileInput.scrollIntoViewIfNeeded();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-handover-upload-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Review new handover" }).click();
  await expect(page.getByRole("dialog")).toContainText("isolated.pdf");
  await expect(page.getByRole("dialog")).not.toContainText(ticket);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status").first()).toHaveText("HANDOVER PENDING");
  expect(handoverBody?.assetToken).toBe(ticket);
  expect(handoverBody).not.toHaveProperty("file");
  expect(accessRequests).toBe(0);
  await page.getByRole("button", { name: "Request signed handover document" }).click();
  const download = page.getByRole("link", { name: "Download signed handover document" });
  await expect(download).toHaveAttribute(
    "href",
    "https://storage.invalid/download/handover?signature=isolated-private",
  );
  await expect(download).toHaveAttribute("rel", "noopener noreferrer");
  await expect(download).toHaveCount(0, { timeout: 5000 });
  expect(accessRequests).toBe(1);
  await page.getByRole("button", { name: "Request signed handover document" }).click();
  await expect(download).toBeVisible();
  expect(accessRequests).toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(download).toHaveCount(0);
});

test("failed upload stays unattached and unsafe or missing document links are not offered", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires the isolated storage.invalid runtime allowlist and intercepted storage.",
  );
  const sale = saleFixture();
  sale.status = "PAID";
  let uploadRequests = 0;
  let storageWrites = 0;
  let missing = false;
  await page.route("https://storage.invalid/upload/**", async (route) => {
    storageWrites++;
    await route.abort("failed");
  });
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/assets/upload")) {
      uploadRequests++;
      await reply(route, {
        assetToken: "isolated-ticket-".repeat(4),
        upload: {
          method: "PUT",
          url: "https://storage.invalid/upload/interrupted",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          headers: { "content-type": "application/pdf" },
        },
      });
      return true;
    }
    if (endpoint.endsWith("/access")) {
      if (missing)
        await route.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        });
      else
        await reply(route, {
          url: "https://unapproved.invalid/private?signature=must-not-leak",
          expiresInSeconds: 60,
        });
      return true;
    }
  });
  await page.goto(`/admin/vehicle-sales/${sale.id}`);
  const fileInput = page.getByLabel("Signed handover document (optional)");
  await fileInput.setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-a-pdf"),
  });
  await expect(page.getByText("Choose a PDF document.")).toBeVisible();
  expect(uploadRequests).toBe(0);
  await fileInput.setInputFiles({
    name: "isolated.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-isolated"),
  });
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    page.getByText("The upload was interrupted.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("File uploaded. Ready to attach", { exact: false }),
  ).toHaveCount(0);
  expect(uploadRequests).toBe(1);
  expect(storageWrites).toBe(1);
  await page.getByRole("button", { name: "Remove selected file" }).click();
  await expect(fileInput).toBeFocused();
  sale.handover = handoverFixture();
  sale.status = "HANDOVER_PENDING";
  sale.version++;
  await page.getByRole("button", { name: "Refresh vehicle purchase" }).click();
  await page.getByRole("button", { name: "Request signed handover document" }).click();
  await expect(
    page.getByText("The document access link could not be verified.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download signed handover document" }),
  ).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText("must-not-leak");
  missing = true;
  await page.getByRole("button", { name: "Request signed handover document" }).click();
  await expect(
    page.getByText("No accessible document was found.", { exact: false }),
  ).toBeVisible();
});

test("cancelling upload preparation prevents file transfer", async ({ page }) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires the isolated storage.invalid runtime allowlist and intercepted storage.",
  );
  const sale = saleFixture();
  sale.status = "PAID";
  let ticketRequests = 0;
  let storageWrites = 0;
  await page.route("https://storage.invalid/**", async (route) => {
    storageWrites++;
    await route.abort();
  });
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
    if (endpoint.endsWith("/assets/upload")) {
      ticketRequests++;
      return true;
    }
  });
  await page.goto(`/admin/vehicle-sales/${sale.id}`);
  await page.getByLabel("Signed handover document (optional)").setInputFiles({
    name: "isolated.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-isolated"),
  });
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect.poll(() => ticketRequests).toBe(1);
  await page.getByRole("button", { name: "Cancel upload" }).click();
  await expect(
    page.getByRole("button", { name: "Upload selected file", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("File uploaded. Ready to attach", { exact: false }),
  ).toHaveCount(0);
  expect(storageWrites).toBe(0);
  expect(ticketRequests).toBe(1);
});

test("unconfigured document storage leaves clear unavailable controls", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS === "true",
    "Requires the default empty storage allowlist.",
  );
  const sale = saleFixture();
  sale.status = "PAID";
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicle-transactions/${sale.id}`) {
      await reply(route, sale);
      return true;
    }
  });
  await page.goto(`/admin/vehicle-sales/${sale.id}`);
  await expect(page.getByLabel("Signed handover document (optional)")).toBeDisabled();
  await expect(
    page.getByText("Document uploads are unavailable.", { exact: false }),
  ).toBeVisible();
  sale.status = "HANDOVER_PENDING";
  sale.handover = handoverFixture();
  sale.version++;
  await page.getByRole("button", { name: "Refresh vehicle purchase" }).click();
  await expect(
    page.getByRole("button", { name: "Request signed handover document" }),
  ).toBeDisabled();
});
