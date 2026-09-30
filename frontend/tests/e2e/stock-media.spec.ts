import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
const sessionFile = process.env.BG_DIRECTORY_SESSION_FILE;
const imageFile = process.env.BG_MEDIA_IMAGE_FILE;
test.skip(
  !sessionFile || !imageFile,
  "Requires isolated API, byte storage and synthetic sessions",
);
test.setTimeout(180000);
async function setup(page: Page) {
  const data = JSON.parse(readFileSync(sessionFile!, "utf8"));
  const origin = process.env.PLAYWRIGHT_BASE_URL!;
  await page.context().addCookies([
    {
      name: "aat_session",
      value: data.sessions.STAFF,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.route("https://media.example.test/**", async (route) => {
    const request = route.request();
    const result = await page.request.put(
      `http://127.0.0.1:5011/api/v1/__test/storage${new URL(request.url()).pathname}`,
      {
        data: request.postDataBuffer()!,
        headers: { "content-type": request.headers()["content-type"] },
      },
    );
    await route.fulfill({
      status: result.status(),
      body: "",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  const csrf = await page.request.post("/api/v1/auth/csrf", { headers: { origin } });
  expect(csrf.status()).toBe(200);
  const headers = { origin, "x-csrf-token": (await csrf.json()).data.csrfToken };
  const body = {
    branchId: data.stockBranchId,
    stockNumber: `BG-${randomUUID().slice(0, 12)}`,
    make: "Toyota",
    model: "Corolla",
    year: 2023,
  };
  const created = await page.request.post("/api/v1/staff/vehicles", {
    headers,
    data: body,
  });
  expect(created.status()).toBe(201);
  expect(
    (
      await page.request.post("/api/v1/staff/vehicles", {
        headers,
        data: {
          ...body,
          branchId: data.otherStockBranchId,
          stockNumber: `BG-${randomUUID().slice(0, 12)}`,
        },
      })
    ).status(),
  ).toBe(403);
  const id = (await created.json()).data.id as string;
  await page.goto(`/admin/vehicles/${id}`);
  await expect(page.getByRole("heading", { name: "Manage vehicle stock" })).toBeVisible();
  await expect(page.getByText("No photos have been attached.")).toBeVisible();
  return { id, headers, origin };
}
async function adminHeaders(request: APIRequestContext) {
  const { sessions } = JSON.parse(readFileSync(sessionFile!, "utf8"));
  const origin = process.env.PLAYWRIGHT_BASE_URL!;
  const cookie = `aat_session=${sessions.ADMIN}`;
  const result = await request.post("/api/v1/auth/csrf", { headers: { origin, cookie } });
  expect(result.status()).toBe(200);
  return { origin, cookie, "x-csrf-token": (await result.json()).data.csrfToken };
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function upload(page: Page, alt: string, invalid = false, order = 0) {
  const gallery = page.getByRole("region", { name: "Vehicle photos", exact: true });
  await gallery.getByLabel("Vehicle photo file").setInputFiles({
    name: "vehicle.png",
    mimeType: "image/png",
    buffer: invalid ? Buffer.from("invalid image bytes") : readFileSync(imageFile!),
  });
  await gallery
    .getByRole("button", { name: "Upload selected file", exact: true })
    .click();
  await expect(
    gallery.getByText("File uploaded. Ready to attach", { exact: false }),
  ).toBeVisible();
  await gallery.getByLabel("Photo description (optional)").fill(alt);
  await gallery.getByLabel("Photo display order").fill(String(order));
  await gallery
    .getByRole("button", { name: "Review photo attachment", exact: true })
    .click();
  if (invalid) {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Go back", exact: true })
      .click();
  } else await confirm(page);
}
test("branch staff edit, replace and remove real stock images with publication protection", async ({
  page,
  browser,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { id, origin } = await setup(page);
  const gallery = page.getByRole("region", { name: "Vehicle photos", exact: true });
  if (!(await gallery.locator("details").evaluate((el) => el.hasAttribute("open"))))
    await gallery.getByText("Add a vehicle photo", { exact: true }).click();
  await upload(page, "Front view");
  await expect(gallery.getByRole("article")).toHaveCount(1);
  await expect(
    gallery.getByRole("img", { name: "Front view", exact: true }),
  ).toBeVisible();
  // Authenticated preview works before publication.
  const preview = (await gallery
    .getByRole("img", { name: "Front view", exact: true })
    .getAttribute("src"))!;
  const imageId = preview.split("/").at(-2)!;
  await expect.poll(async () => (await page.request.get(preview)).status()).toBe(200);
  if (!(await gallery.locator("details").evaluate((el) => el.hasAttribute("open"))))
    await gallery.getByText("Add a vehicle photo", { exact: true }).click();
  await upload(page, "Side view", false, 5);
  await expect(gallery.getByRole("article")).toHaveCount(2);
  await gallery.getByRole("button", { name: "Edit photo 2", exact: true }).click();
  await gallery.getByLabel("Photo description (optional)").fill("Approved side view");
  await gallery.getByLabel("Photo display order").fill("10");
  await gallery.getByLabel("Use as the primary photo").check();
  await gallery
    .getByRole("button", { name: "Review photo changes", exact: true })
    .click();
  await confirm(page);
  await expect(gallery.getByRole("article").last()).toContainText("Primary photo");
  const listingResponse = await request.post("/api/v1/staff/vehicles/listings", {
    headers: await adminHeaders(request),
    data: {
      vehicleId: id,
      title: `Browser stock ${randomUUID().slice(0, 8)}`,
      slug: `stock-${randomUUID()}`,
      priceKobo: "1200000000",
    },
  });
  expect(listingResponse.status()).toBe(201);
  const listing = (await listingResponse.json()).data;
  expect(
    (
      await request.post(`/api/v1/staff/vehicles/listings/${listing.id}/status`, {
        headers: await adminHeaders(request),
        data: { expectedVersion: 0, status: "AVAILABLE" },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Refresh stock record", exact: true }).click();
  await expect(page.getByRole("link", { name: "View public listing" })).toBeVisible();
  const publicContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
  });
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`/vehicles/${listing.id}`);
  await expect(
    publicPage.getByRole("heading", { name: listing.title, exact: true }),
  ).toBeVisible();
  const publicImage = publicPage.locator('img[src*="/public/vehicles/images/"]').first();
  await expect
    .poll(() => publicImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const publicResponse = await publicPage.request.get(
    `/api/v1/public/vehicles/images/${imageId}`,
  );
  expect(publicResponse.status()).toBe(200);
  expect(publicResponse.headers()["cache-control"]).toBe("private, no-store");
  expect((await publicPage.request.get(preview)).status()).toBe(401);
  await publicPage.screenshot({
    path: path.join(os.tmpdir(), "allied-bg06-stock-public-mobile.png"),
    fullPage: true,
  });
  await page.bringToFront();
  await page.goto(`/admin/vehicles/${id}`);
  await gallery.getByRole("button", { name: "Remove photo 1", exact: true }).click();
  await confirm(page);
  await expect(gallery.getByRole("article")).toHaveCount(1);
  expect(
    (await publicPage.request.get(`/api/v1/public/vehicles/images/${imageId}`)).status(),
  ).toBe(404);
  await expect(
    gallery.getByRole("button", { name: "Remove photo 1", exact: true }),
  ).toBeDisabled();
  const oldPreview = (await gallery
    .getByRole("img", { name: "Approved side view", exact: true })
    .getAttribute("src"))!;
  await gallery.getByRole("button", { name: "Replace photo 1", exact: true }).click();
  await upload(page, "Invalid replacement", true);
  await gallery
    .getByRole("button", { name: "Cancel photo replacement", exact: true })
    .click();
  expect((await page.request.get(oldPreview)).status()).toBe(200);
  await gallery.getByRole("button", { name: "Replace photo 1", exact: true }).click();
  await upload(page, "New approved side view");
  await expect(gallery.getByRole("article")).toHaveCount(1);
  await expect(gallery.getByRole("article")).toContainText("Primary photo");
  expect((await page.request.get(oldPreview)).status()).toBe(404);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gallery.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg06-stock-admin-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await gallery.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg06-stock-admin-mobile.png"),
    fullPage: true,
  });
  expect(
    (
      await request.post(`/api/v1/staff/vehicles/listings/${listing.id}/status`, {
        headers: await adminHeaders(request),
        data: { expectedVersion: 1, status: "INACTIVE" },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Refresh stock record", exact: true }).click();
  await expect(
    gallery.getByRole("button", { name: "Remove photo 1", exact: true }),
  ).toBeEnabled();
  await gallery.getByRole("button", { name: "Remove photo 1", exact: true }).click();
  await confirm(page);
  await expect(gallery.getByText("No photos have been attached.")).toBeVisible();
  expect(errors).toEqual([]);
  await publicContext.close();
});
test("stock media keeps stale drafts and requires the refreshed vehicle version", async ({
  page,
  request,
}) => {
  const { id } = await setup(page);
  const gallery = page.getByRole("region", { name: "Vehicle photos", exact: true });
  if (!(await gallery.locator("details").evaluate((el) => el.hasAttribute("open"))))
    await gallery.getByText("Add a vehicle photo", { exact: true }).click();
  await upload(page, "Original photo");
  await gallery.getByRole("button", { name: "Edit photo 1", exact: true }).click();
  await gallery.getByLabel("Photo description (optional)").fill("My retained draft");
  const current = (await (await page.request.get(`/api/v1/staff/vehicles/${id}`)).json())
    .data;
  expect(
    (
      await request.patch(
        `/api/v1/staff/vehicles/${id}/images/${current.images[0].id}`,
        {
          headers: await adminHeaders(request),
          data: {
            expectedVersion: current.version,
            altText: "Another operator's description",
          },
        },
      )
    ).status(),
  ).toBe(200);
  await gallery
    .getByRole("button", { name: "Review photo changes", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    /changed|refresh|reload/i,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  await expect(
    gallery.getByText("The stock record changed.", { exact: false }),
  ).toBeVisible();
  await expect(gallery.getByLabel("Photo description (optional)")).toHaveValue(
    "My retained draft",
  );
  await expect(
    gallery.getByRole("button", { name: "Review photo changes", exact: true }),
  ).toBeDisabled();
  await gallery.getByRole("button", { name: "Cancel photo edit", exact: true }).click();
  await gallery.getByRole("button", { name: "Edit photo 1", exact: true }).click();
  await expect(gallery.getByLabel("Photo description (optional)")).toHaveValue(
    "Another operator's description",
  );
});
