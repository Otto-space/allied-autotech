import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { inspectionFixture } from "../fixtures/inspection";
import type { StaffVehicle, StaffListing } from "@/lib/api/staff-vehicle-schemas";
const id = (value: number) =>
  `80000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const stock = (): StaffVehicle => ({
  id: id(1),
  branchId: id(2),
  stockNumber: "ISOLATED-STOCK-001",
  make: "Isolated",
  model: "Vehicle",
  trim: null,
  year: 2024,
  mileageKm: null,
  transmission: null,
  fuelType: null,
  condition: "USED",
  bodyType: null,
  engineSize: null,
  driveType: null,
  color: null,
  doors: null,
  seats: null,
  vin: null,
  chassisNumber: null,
  registrationNumber: null,
  acquisitionCostKobo: null,
  acquisitionCurrency: "NGN",
  acquiredAt: null,
  version: 0,
  branch: { id: id(2), code: "ISOLATED", name: "Isolated branch", isActive: true },
  listings: [],
  images: [],
  documents: [],
  conditionReports: [],
});
const listing = (): StaffListing => ({
  id: id(3),
  title: "Isolated listing",
  slug: "isolated-listing",
  priceKobo: "1234567891",
  currency: "NGN",
  description: null,
  featured: false,
  status: "DRAFT",
  version: 7,
  publishedAt: null,
  reservedAt: null,
  soldAt: null,
  archivedAt: null,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      meta: { requestId: "vehicle-stock-test" },
      data,
    },
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
        id: id(4),
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-17T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        user: { id: id(5), email: "stock@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-stock-token-".repeat(4) });
    if (endpoint === "/staff/profile")
      return reply(route, {
        id: id(5),
        email: "stock@example.test",
        role,
        status: "ACTIVE",
        staffProfile: {
          id: id(6),
          firstName: "Isolated",
          lastName: "Staff",
          branchId: id(2),
        },
      });
    if (endpoint === "/public/branches")
      return reply(route, { items: [{ id: id(2), name: "Isolated branch" }] });
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
async function fillRecord(page: Page) {
  await page.getByLabel("Stock number", { exact: true }).fill("isolated-stock-001");
  await page.getByLabel("Make", { exact: true }).fill("Isolated");
  await page.getByLabel("Model", { exact: true }).fill("Vehicle");
  await page.getByLabel("Model year", { exact: true }).fill("2024");
}

test("condition report creation reviews public findings and links a paged eligible inspection", async ({
  page,
}) => {
  const vehicle = stock();
  vehicle.listings = [listing()];
  const inspection = inspectionFixture();
  inspection.status = "COMPLETED";
  inspection.vehicleListing.id = vehicle.listings[0].id;
  inspection.vehicleListing.branchId = vehicle.branchId;
  let written: Record<string, unknown> | undefined;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint === "/staff/vehicle-inspections") {
      const query = new URL(route.request().url()).searchParams;
      expect(query.get("status")).toBe("COMPLETED");
      expect(query.get("branchId")).toBe(vehicle.branchId);
      await reply(
        route,
        query.has("cursor") ? { items: [inspection] } : { items: [], nextCursor: id(81) },
      );
      return true;
    }
    if (endpoint.endsWith("/condition-reports")) {
      written = route.request().postDataJSON();
      vehicle.conditionReports = [
        {
          id: id(82),
          inspectedAt: "2026-09-17T13:05:00+01:00",
          summary: "Isolated observed condition",
          odometerKm: null,
          conditionScore: 0,
          findings: { Tyres: "Inspected", Warning: false, Measurement: 0, Unknown: null },
        },
      ];
      await reply(route, { id: id(82) });
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  await page.getByText("Record a condition report", { exact: true }).click();
  await page.getByRole("button", { name: "Review condition report" }).click();
  await expect(page.getByLabel("Inspected at (Lagos time)")).toBeFocused();
  await page.getByLabel("Inspected at (Lagos time)").fill("2026-09-17T13:05");
  await page.getByLabel("Condition score (optional, 0–100)").fill("101");
  await page.getByLabel("Public condition summary").fill("Isolated observed condition");
  await page.getByRole("button", { name: "Review condition report" }).click();
  await expect(page.getByLabel("Condition score (optional, 0–100)")).toBeFocused();
  await page.getByLabel("Condition score (optional, 0–100)").fill("0");
  for (const [index, name, type, answer] of [
    [1, "Tyres", "TEXT", "Inspected"],
    [2, "Tyres", "NO", ""],
    [3, "Measurement", "NUMBER", "0"],
    [4, "Unknown", "NOT_RECORDED", ""],
  ] as const) {
    await page.getByRole("button", { name: "Add a finding" }).click();
    await page.getByLabel(`Finding ${index} name`, { exact: true }).fill(name);
    await page
      .getByLabel(`Finding ${index} answer type`, { exact: true })
      .selectOption(type);
    if (answer)
      await page.getByLabel(`Finding ${index} answer`, { exact: true }).fill(answer);
  }
  await page.getByRole("button", { name: "Review condition report" }).click();
  await expect(page.getByLabel("Finding 2 name", { exact: true })).toBeFocused();
  await page.getByLabel("Finding 2 name", { exact: true }).fill("Warning");
  await page
    .getByLabel("Link this report to a completed inspection", { exact: true })
    .check();
  await page
    .getByRole("navigation", { name: "Completed inspection choices pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await page
    .getByLabel("Link a completed inspection (optional)")
    .selectOption(inspection.id);
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
  await page.getByRole("button", { name: "Review condition report" }).click();
  await expect(page.getByRole("dialog")).toContainText("approved public information");
  expect(written).toBeUndefined();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("button", { name: "Record another condition report" }),
  ).toBeVisible();
  expect(written).toEqual({
    summary: "Isolated observed condition",
    inspectedAt: "2026-09-17T13:05:00+01:00",
    odometerKm: null,
    conditionScore: 0,
    inspectionId: inspection.id,
    findings: { Tyres: "Inspected", Warning: false, Measurement: 0, Unknown: null },
  });
  await page.getByText("Record a condition report", { exact: true }).click();
  const summary = page.getByRole("region", { name: "Latest condition report" });
  await expect(summary).toContainText("0 / 100");
  await page.setViewportSize({ width: 1280, height: 900 });
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-condition-report-desktop.png"),
    fullPage: false,
  });
});

test("unconfirmed condition report creation stays locked when the latest report cannot establish its outcome", async ({
  page,
}) => {
  const vehicle = stock();
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint.endsWith("/condition-reports")) {
      writes++;
      await route.abort("failed");
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  await page.getByText("Record a condition report", { exact: true }).click();
  await page.getByLabel("Inspected at (Lagos time)").fill("2026-09-15T10:00");
  await page.getByLabel("Public condition summary").fill("Isolated earlier report");
  await page.getByRole("button", { name: "Review condition report" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(
    page.getByText("Report creation is unconfirmed.", { exact: false }),
  ).toBeVisible();
  await page.getByText("Record a condition report", { exact: true }).click();
  await page.getByText("Record a condition report", { exact: true }).click();
  await page.getByRole("button", { name: "Refresh stock record" }).click();
  await expect(
    page.getByRole("button", { name: "Review condition report" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
});

const vehicleDocument = (): StaffVehicle["documents"][number] => ({
  id: id(71),
  type: "OWNERSHIP",
  verificationStatus: "PENDING",
  mimeType: "application/pdf",
  sizeBytes: "4096",
  issuedAt: null,
  expiresAt: null,
  verifiedAt: null,
  rejectionReason: null,
  version: 4,
  createdAt: "2026-09-17T09:00:00Z",
});

test("lost document attachment responses reconcile saved records and lock unresolved submissions", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires isolated storage allowlist.",
  );
  const vehicle = stock();
  const pdf = Buffer.from("%PDF-1.4\nIsolated uncertain attachment\n%%EOF");
  let writes = 0;
  await page.route("https://storage.invalid/upload/uncertain-document", (route) =>
    route.fulfill({
      status: 200,
      body: "",
      headers: { "access-control-allow-origin": new URL(page.url()).origin },
    }),
  );
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint.endsWith("/assets/upload")) {
      await reply(route, {
        assetToken: "isolated-uncertain-ticket-".repeat(3),
        upload: {
          method: "PUT",
          url: "https://storage.invalid/upload/uncertain-document",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          headers: { "content-type": "application/pdf" },
        },
      });
      return true;
    }
    if (endpoint.endsWith("/documents")) {
      writes++;
      if (writes === 1) vehicle.documents = [vehicleDocument()];
      await route.abort("failed");
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  const section = page.getByRole("region", {
    name: "Private vehicle documents",
    exact: true,
  });
  await section.getByText("Add a private document", { exact: true }).click();
  for (const attempt of [1, 2]) {
    await section
      .getByLabel("Private vehicle document file")
      .setInputFiles({ name: "isolated.pdf", mimeType: "application/pdf", buffer: pdf });
    await section
      .getByRole("button", { name: "Upload selected file", exact: true })
      .click();
    await expect(section).toContainText("File uploaded. Ready to attach");
    await section.getByRole("button", { name: "Review document attachment" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change" })
      .click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
    ).toBeDisabled();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close & review record" })
      .click();
    await expect(section.locator(".status")).toHaveText("PENDING");
    expect(writes).toBe(attempt);
  }
  await expect(
    section.getByRole("button", { name: "Review document attachment" }),
  ).toBeDisabled();
  await section.getByText("Add a private document", { exact: true }).click();
  await section.getByText("Add a private document", { exact: true }).click();
  await page.getByRole("button", { name: "Refresh stock record" }).click();
  await expect(
    section.getByRole("button", { name: "Review document attachment" }),
  ).toBeDisabled();
  expect(writes).toBe(2);
});

test("vehicle documents use their own review version and preserve concurrent assessment drafts", async ({
  page,
}) => {
  const vehicle = stock();
  vehicle.documents = [vehicleDocument()];
  vehicle.conditionReports = [
    {
      id: id(72),
      odometerKm: 0,
      conditionScore: 0,
      summary: "Isolated public condition summary",
      findings: { Tyres: "Inspected", Warning: false, Missing: null },
      inspectedAt: "2026-09-17T09:00:00Z",
    },
  ];
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint.endsWith("/review")) {
      const body = route.request().postDataJSON();
      writes.push(body);
      vehicle.documents[0] = {
        ...vehicle.documents[0],
        verificationStatus: body.status,
        rejectionReason: body.rejectionReason ?? null,
        version: vehicle.documents[0].version + 1,
      };
      await reply(route, vehicle.documents[0]);
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  const section = page.getByRole("region", { name: "OWNERSHIP", exact: true });
  await expect(section).toContainText("4,096 bytes");
  await expect(
    page.getByRole("region", { name: "Latest condition report" }),
  ).toContainText("0 / 100");
  await section.getByText("Assess this document", { exact: true }).click();
  await section.getByLabel("Document assessment").selectOption("REJECTED");
  await section.getByRole("button", { name: "Review document assessment" }).click();
  await expect(section.getByLabel("Rejection reason", { exact: false })).toBeFocused();
  await section
    .getByLabel("Rejection reason", { exact: false })
    .fill("Isolated missing detail");
  vehicle.documents[0].version++;
  await page.getByRole("button", { name: "Refresh stock record" }).click();
  await expect(
    section.getByRole("button", { name: "Review document assessment" }),
  ).toBeDisabled();
  await expect(section.getByLabel("Rejection reason", { exact: false })).toHaveValue(
    "Isolated missing detail",
  );
  await section.getByRole("button", { name: "Reload document review" }).click();
  await section.getByLabel("Document assessment").selectOption("REJECTED");
  await section
    .getByLabel("Rejection reason", { exact: false })
    .fill("Isolated unreadable details");
  await section.getByRole("button", { name: "Review document assessment" }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(section.locator(".status")).toHaveText("REJECTED");
  expect(writes[0]).toEqual({
    expectedVersion: 5,
    status: "REJECTED",
    rejectionReason: "Isolated unreadable details",
  });
  await section.getByRole("button", { name: "Reload document review" }).click();
  await section
    .getByLabel("Rejection reason", { exact: false })
    .fill("Not sent when verified");
  await section.getByRole("button", { name: "Review document assessment" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(section.locator(".status")).toHaveText("VERIFIED");
  expect(writes[1]).toEqual({ expectedVersion: 6, status: "VERIFIED" });
});

test("approved photo upload attaches exact bytes with public review and primary selection", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires isolated storage allowlist.",
  );
  const vehicle = stock();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ9kAAAAASUVORK5CYII=",
    "base64",
  );
  const ticket = "isolated-photo-ticket-".repeat(4);
  let attachment: Record<string, unknown> | undefined;
  let uploads = 0;
  await page.route("https://storage.invalid/upload/photo", async (route) => {
    expect(route.request().postDataBuffer()).toEqual(png);
    expect(route.request().headers()["cookie"]).toBeUndefined();
    expect(route.request().headers()["x-csrf-token"]).toBeUndefined();
    expect(route.request().headers()["content-type"]).toBe("image/png");
    uploads++;
    await route.fulfill({
      status: 200,
      body: "",
      headers: { "access-control-allow-origin": new URL(page.url()).origin },
    });
  });
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint.endsWith("/assets/upload")) {
      expect(route.request().postDataJSON()).toEqual({
        kind: "IMAGE",
        mimeType: "image/png",
        sizeBytes: png.length,
        checksumSha256: createHash("sha256").update(png).digest("hex"),
      });
      await reply(route, {
        assetToken: ticket,
        upload: {
          method: "PUT",
          url: "https://storage.invalid/upload/photo",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          headers: { "content-type": "image/png" },
        },
      });
      return true;
    }
    if (endpoint.endsWith("/images")) {
      attachment = route.request().postDataJSON();
      vehicle.images = [
        {
          id: id(75),
          url: `/api/v1/public/vehicles/images/${id(75)}`,
          altText: "Isolated side view",
          isPrimary: true,
          sortOrder: 2,
        },
      ];
      await reply(route, vehicle.images[0]);
      return true;
    }
    if (endpoint === `/public/vehicles/images/${id(75)}`) {
      await route.fulfill({ contentType: "image/png", body: png });
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  const section = page.getByRole("region", { name: "Vehicle photos", exact: true });
  await section.getByText("Add a vehicle photo", { exact: true }).click();
  await section.getByLabel("Vehicle photo file").setInputFiles({
    name: "wrong.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-test"),
  });
  await expect(section).toContainText("Choose a JPEG, PNG or WebP image.");
  await section
    .getByLabel("Vehicle photo file")
    .setInputFiles({ name: "isolated.png", mimeType: "image/png", buffer: png });
  await section.getByRole("button", { name: "Review photo attachment" }).click();
  await expect(section).toContainText("Choose and upload a file before continuing");
  await section
    .getByRole("button", { name: "Upload selected file", exact: true })
    .click();
  await expect(section).toContainText("File uploaded. Ready to attach");
  await section.getByLabel("Photo description (optional)").fill("Isolated side view");
  await section.getByLabel("Photo display order").fill("2");
  await section.getByLabel("Use as the primary photo").check();
  await section.getByRole("button", { name: "Review photo attachment" }).click();
  await expect(page.getByRole("dialog")).toContainText("all available listings");
  expect(attachment).toBeUndefined();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(section).toContainText("Primary photo");
  await expect(section).toContainText("Preview becomes available");
  expect(uploads).toBe(1);
  expect(attachment).toEqual({
    assetToken: ticket,
    altText: "Isolated side view",
    sortOrder: 2,
    isPrimary: true,
  });
  vehicle.listings = [{ ...listing(), status: "AVAILABLE" }];
  await page.getByRole("button", { name: "Refresh stock record" }).click();
  await expect(section.getByRole("img", { name: "Isolated side view" })).toBeVisible();
  vehicle.listings[0].status = "SOLD";
  vehicle.listings[0].version++;
  await page.getByRole("button", { name: "Refresh stock record" }).click();
  const saleListing = page.getByRole("region", { name: "Isolated listing", exact: true });
  await saleListing.getByText("Edit listing content", { exact: true }).click();
  await expect(saleListing).toContainText(
    "Sold and archived listing content cannot be edited",
  );
  await expect(
    saleListing.getByRole("button", { name: "Review listing changes" }),
  ).toHaveCount(0);
});

test("private document upload uses Lagos dates, pending review and authorized temporary access", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires isolated storage allowlist.",
  );
  const vehicle = stock();
  const pdf = Buffer.from("%PDF-1.4\nIsolated vehicle document\n%%EOF");
  const ticket = "isolated-vehicle-document-ticket-".repeat(3);
  let attached: Record<string, unknown> | undefined;
  let accessRequests = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://storage.invalid/upload/document", async (route) => {
    expect(route.request().postDataBuffer()).toEqual(pdf);
    await route.fulfill({
      status: 200,
      body: "",
      headers: { "access-control-allow-origin": new URL(page.url()).origin },
    });
  });
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint.endsWith("/assets/upload")) {
      expect(route.request().postDataJSON().kind).toBe("DOCUMENT");
      await reply(route, {
        assetToken: ticket,
        upload: {
          method: "PUT",
          url: "https://storage.invalid/upload/document",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          headers: { "content-type": "application/pdf" },
        },
      });
      return true;
    }
    if (endpoint.endsWith("/documents")) {
      attached = route.request().postDataJSON();
      vehicle.documents = [
        {
          ...vehicleDocument(),
          issuedAt: "2026-09-17T11:15:00+01:00",
          expiresAt: "2027-09-17T11:15:00+01:00",
        },
      ];
      await reply(route, vehicle.documents[0]);
      return true;
    }
    if (endpoint.endsWith("/access")) {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({});
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      accessRequests++;
      await reply(route, {
        url: "https://storage.invalid/download/document?signature=isolated",
        expiresInSeconds: 60,
      });
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  await expect(page).toHaveTitle(/vehicle/i);
  await expect(page.getByRole("heading", { name: "Manage vehicle stock" })).toBeVisible();
  const section = page.getByRole("region", {
    name: "Private vehicle documents",
    exact: true,
  });
  await section.getByText("Add a private document", { exact: true }).click();
  await section
    .getByLabel("Private vehicle document file")
    .setInputFiles({ name: "isolated.pdf", mimeType: "application/pdf", buffer: pdf });
  await section
    .getByRole("button", { name: "Upload selected file", exact: true })
    .click();
  await expect(section).toContainText("File uploaded. Ready to attach");
  await section.getByLabel("Document type", { exact: true }).selectOption("OWNERSHIP");
  await section
    .getByLabel("Document issued at", { exact: false })
    .fill("2026-09-17T11:15");
  await section
    .getByLabel("Document expires at", { exact: false })
    .fill("2027-09-17T11:15");
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
  await section.getByRole("button", { name: "Review document attachment" }).click();
  await expect(page.getByRole("dialog")).toContainText("pending review");
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-document-review-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(section.locator(".status")).toHaveText("PENDING");
  expect(attached).toEqual({
    assetToken: ticket,
    type: "OWNERSHIP",
    issuedAt: "2026-09-17T11:15:00+01:00",
    expiresAt: "2027-09-17T11:15:00+01:00",
  });
  expect(accessRequests).toBe(0);
  await section.getByRole("button", { name: "Request vehicle document" }).click();
  await expect(
    section.getByRole("link", { name: "Download vehicle document" }),
  ).toHaveAttribute(
    "href",
    "https://storage.invalid/download/document?signature=isolated",
  );
  expect(accessRequests).toBe(1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-private-vehicle-document-desktop.png"),
    fullPage: false,
  });
  expect(errors).toEqual([]);
});
for (const role of ["STAFF", "ADMIN"] as const)
  test(`${role} creates stock and edits vehicle details within its acquisition-cost permissions`, async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    const vehicle = stock();
    if (role === "STAFF") {
      delete vehicle.acquisitionCostKobo;
      delete vehicle.acquisitionCurrency;
    }
    const writes: { method: string; body: Record<string, unknown> }[] = [];
    await fixture(
      page,
      async (route, endpoint) => {
        if (endpoint === "/staff/vehicles" && route.request().method() === "POST") {
          const body = route.request().postDataJSON();
          writes.push({ method: "POST", body });
          Object.assign(vehicle, body);
          await reply(route, vehicle);
          return true;
        }
        if (endpoint === `/staff/vehicles/${vehicle.id}`) {
          if (route.request().method() === "PATCH") {
            const body = route.request().postDataJSON();
            writes.push({ method: "PATCH", body });
            Object.assign(vehicle, body);
            vehicle.version++;
          }
          await reply(route, vehicle);
          return true;
        }
      },
      role,
    );
    await page.goto("/admin/vehicles/new");
    await expect(page).toHaveTitle(/Add vehicle record/);
    await expect(page.getByRole("heading", { name: "Add vehicle record" })).toBeVisible();
    if (role === "STAFF") {
      await expect(
        page.getByText("Your assigned branch will be used", { exact: false }),
      ).toBeVisible();
      await expect(page.getByLabel("Workshop branch")).toHaveCount(0);
    } else await page.getByLabel("Workshop branch").selectOption(id(2));
    await page.getByRole("button", { name: "Review new vehicle" }).click();
    await expect(page.getByLabel("Stock number", { exact: true })).toBeFocused();
    await fillRecord(page);
    if (role === "ADMIN")
      await page.getByLabel("Acquisition cost (optional, NGN)").fill("99999999999999.99");
    else await expect(page.getByLabel("Acquisition cost (optional, NGN)")).toHaveCount(0);
    await page.getByLabel("Acquired at (optional, Lagos time)").fill("2026-09-16T14:05");
    await page.getByLabel("VIN (optional)").fill("invalid");
    await page.getByRole("button", { name: "Review new vehicle" }).click();
    await expect(page.getByLabel("VIN (optional)")).toBeFocused();
    await page.getByLabel("VIN (optional)").fill("1hgcm82633a004352");
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
    await page.getByRole("button", { name: "Review new vehicle" }).click();
    expect(writes).toHaveLength(0);
    await expect(page.getByRole("dialog")).toContainText("does not create or publish");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/vehicles/${vehicle.id}$`));
    expect(writes[0].body).toMatchObject({
      branchId: id(2),
      stockNumber: "ISOLATED-STOCK-001",
      ...(role === "ADMIN" ? { acquisitionCostKobo: "9999999999999999" } : {}),
      acquiredAt: "2026-09-16T14:05:00+01:00",
      vin: "1HGCM82633A004352",
      mileageKm: null,
    });
    if (role === "STAFF") {
      expect(writes[0].body).not.toHaveProperty("acquisitionCostKobo");
      await expect(
        page.getByText("Internal acquisition cost", { exact: true }),
      ).toHaveCount(0);
    } else
      await expect(
        page.getByText("Internal acquisition cost", { exact: true }),
      ).toBeVisible();
    await page.getByText("Edit vehicle specifications", { exact: true }).click();
    await page.getByLabel("Colour (optional)").fill("Red");
    await page.getByRole("button", { name: "Review vehicle changes" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change" })
      .click();
    await expect(
      page.getByText("Vehicle changes recorded.", { exact: false }),
    ).toBeVisible();
    expect(writes[1].body).toMatchObject({ expectedVersion: 0, color: "Red" });
    if (role === "STAFF")
      expect(writes[1].body).not.toHaveProperty("acquisitionCostKobo");
    else expect(writes[1].body.acquisitionCostKobo).toBe("9999999999999999");
    expect(writes[1].body).not.toHaveProperty("branchId");
    expect(writes[1].body).not.toHaveProperty("stockNumber");
    await page.getByLabel("Colour (optional)").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(
        os.tmpdir(),
        `allied-vehicle-record-${role.toLowerCase()}-mobile.png`,
      ),
      fullPage: false,
    });
    expect(runtimeErrors).toEqual([]);
  });

test("draft listing creation, content, exact asking price and publication use independent versions", async ({
  page,
}) => {
  const vehicle = stock();
  const writes: { endpoint: string; body: Record<string, unknown> }[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint.startsWith("/staff/vehicles/listings")) {
      const body = route.request().postDataJSON();
      writes.push({ endpoint, body });
      if (endpoint === "/staff/vehicles/listings")
        vehicle.listings.push({ ...listing(), ...body });
      else {
        Object.assign(vehicle.listings[0], body);
        vehicle.listings[0].version++;
      }
      await reply(route, vehicle.listings[0]);
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  await page.getByText("Create a draft listing", { exact: true }).click();
  const create = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^Create a draft listing$/ }) });
  await create.getByLabel("Listing title").fill("Isolated listing");
  await create.getByLabel("Listing slug").fill("INVALID SLUG");
  await create.getByLabel("Asking price (NGN)").fill("12345678.91");
  await create.getByRole("button", { name: "Review draft listing" }).click();
  await expect(create.getByLabel("Listing slug")).toBeFocused();
  await create.getByLabel("Listing slug").fill("isolated-listing");
  await create.getByRole("button", { name: "Review draft listing" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "will not appear in the public catalogue",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  const region = page.getByRole("region", { name: "Isolated listing", exact: true });
  await expect(region.locator(".status")).toHaveText("DRAFT");
  expect(writes[0].body).toMatchObject({
    vehicleId: vehicle.id,
    priceKobo: "1234567891",
    featured: false,
  });
  await region.getByText("Edit listing content", { exact: true }).click();
  await region
    .getByLabel("Public description (optional)")
    .fill("Isolated factual description");
  await region.getByRole("button", { name: "Review listing details" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    region.getByText("Isolated factual description", { exact: true }),
  ).toBeVisible();
  expect(writes[1].body).toMatchObject({
    expectedVersion: 7,
    description: "Isolated factual description",
  });
  expect(writes[1].body).not.toHaveProperty("priceKobo");
  await region.getByText("Manage asking price", { exact: true }).click();
  await region.getByRole("button", { name: "Reload price fields" }).click();
  await region.getByLabel("New asking price (NGN)").fill("12345678.92");
  await region.getByRole("button", { name: "Review asking price" }).click();
  await expect(region.getByLabel("Price change reason")).toBeFocused();
  await region.getByLabel("Price change reason").fill("Isolated correction");
  await region.getByRole("button", { name: "Review asking price" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(region.getByText("₦12,345,678.92", { exact: true })).toBeVisible();
  expect(writes[2].body).toEqual({
    expectedVersion: 8,
    priceKobo: "1234567892",
    reason: "Isolated correction",
  });
  await region.getByRole("button", { name: "Review publication" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "available to customers while its branch is active",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(region.locator(".status")).toHaveText("AVAILABLE");
  expect(writes[3].body).toEqual({ expectedVersion: 9, status: "AVAILABLE" });
  await expect(region.getByRole("link", { name: "View public listing" })).toHaveAttribute(
    "href",
    `/vehicles/${id(3)}`,
  );
  const openSummaries = region.locator("details[open] > summary");
  while (await openSummaries.count()) await openSummaries.first().click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await region.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-vehicle-listing-desktop.png"),
    fullPage: false,
  });
  vehicle.listings[0].status = "RESERVED";
  vehicle.listings[0].version++;
  await page.getByRole("button", { name: "Refresh stock record" }).click();
  await expect(region.locator(".status")).toHaveText("RESERVED");
  if (
    !(await region
      .getByText("Asking-price changes are unavailable", { exact: false })
      .isVisible())
  )
    await region.getByText("Manage asking price", { exact: true }).click();
  await expect(
    region.getByText("Asking-price changes are unavailable", { exact: false }),
  ).toBeVisible();
  await expect(region.getByRole("button", { name: "Review publication" })).toHaveCount(0);
});

test("background record changes preserve drafts and require explicit reload before saving", async ({
  page,
}) => {
  const vehicle = stock();
  vehicle.listings = [listing()];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
  });
  await page.goto(`/admin/vehicles/${vehicle.id}`);
  await page.getByText("Edit vehicle specifications", { exact: true }).click();
  await page.getByLabel("Colour (optional)").fill("Unsaved red");
  const region = page.getByRole("region", { name: "Isolated listing", exact: true });
  await region.getByText("Edit listing content", { exact: true }).click();
  await region.getByLabel("Public description (optional)").fill("Unsaved description");
  vehicle.color = "Server blue";
  vehicle.version++;
  vehicle.listings[0].description = "Server description";
  vehicle.listings[0].version++;
  await page.getByRole("button", { name: "Refresh stock record" }).click();
  await expect(page.getByRole("button", { name: "Reload vehicle fields" })).toBeVisible();
  await expect(page.getByLabel("Colour (optional)")).toHaveValue("Unsaved red");
  await expect(
    page.getByRole("button", { name: "Review vehicle changes" }),
  ).toBeDisabled();
  await expect(region.getByLabel("Public description (optional)")).toHaveValue(
    "Unsaved description",
  );
  await expect(
    region.getByRole("button", { name: "Review listing details" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload vehicle fields" }).click();
  await expect(page.getByLabel("Colour (optional)")).toHaveValue("Server blue");
  await expect(
    page.getByRole("button", { name: "Review vehicle changes" }),
  ).toBeEnabled();
  await region.getByRole("button", { name: "Reload listing fields" }).click();
  await expect(region.getByLabel("Public description (optional)")).toHaveValue(
    "Server description",
  );
  await expect(
    region.getByRole("button", { name: "Review listing details" }),
  ).toBeEnabled();
});

test("stock filter errors, branch selection and cursor resets preserve honest results", async ({
  page,
}) => {
  const vehicle = stock();
  let fail = true;
  const queries: URLSearchParams[] = [];
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/staff/vehicles") {
        const query = new URL(route.request().url()).searchParams;
        queries.push(query);
        if (fail)
          await route.fulfill({
            status: 503,
            json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
          });
        else
          await reply(route, {
            items: query.get("search") ? [] : [vehicle],
            ...(!query.has("cursor") ? { nextCursor: id(10) } : {}),
          });
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/vehicles");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    page.getByRole("heading", { name: "No stock records on this page" }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Refresh vehicle stock" }).click();
  await page
    .getByRole("navigation", { name: "Vehicle stock pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect.poll(() => queries.at(-1)?.get("cursor")).toBe(id(10));
  await page.getByLabel("Active branch filter").selectOption(id(2));
  await page.getByLabel("Search stock records").fill("no-match");
  await page.getByRole("button", { name: "Apply stock filters" }).click();
  await expect(
    page.getByRole("heading", { name: "No vehicles match these filters" }),
  ).toBeVisible();
  expect(queries.at(-1)?.get("branchId")).toBe(id(2));
  expect(queries.at(-1)?.has("cursor")).toBe(false);
  await page.getByRole("button", { name: "Clear stock filters" }).click();
  await expect(page.getByRole("link", { name: vehicle.stockNumber })).toBeVisible();
  expect(queries.at(-1)?.has("search")).toBe(false);
});

test("lost stock creation cannot be replayed and a saved draft listing reconciles after a lost response", async ({
  page,
}) => {
  const vehicle = stock();
  let stockWrites = 0;
  let listingWrites = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/vehicles") {
      if (route.request().method() === "POST") {
        stockWrites++;
        await route.abort("failed");
      } else await reply(route, { items: [vehicle] });
      return true;
    }
    if (endpoint === `/staff/vehicles/${vehicle.id}`) {
      await reply(route, vehicle);
      return true;
    }
    if (endpoint === "/staff/vehicles/listings") {
      listingWrites++;
      vehicle.listings.push(listing());
      await route.abort("failed");
      return true;
    }
  });
  await page.goto("/admin/vehicles/new");
  await fillRecord(page);
  await page.getByRole("button", { name: "Review new vehicle" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(page.getByRole("button", { name: "Review new vehicle" })).toBeDisabled();
  await page.getByRole("link", { name: "Back to vehicle stock" }).click();
  await page.getByRole("link", { name: vehicle.stockNumber }).click();
  await page.getByText("Create a draft listing", { exact: true }).click();
  await page.getByLabel("Listing title").fill("Isolated listing");
  await page.getByLabel("Listing slug").fill("isolated-listing");
  await page.getByLabel("Asking price (NGN)").fill("12345678.91");
  await page.getByRole("button", { name: "Review draft listing" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Isolated listing", exact: true })
      .locator(".status"),
  ).toHaveText("DRAFT");
  expect(stockWrites).toBe(1);
  expect(listingWrites).toBe(1);
});
