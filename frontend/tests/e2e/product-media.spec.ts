import { test, expect, type Page } from "@playwright/test";
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
async function signIn(page: Page) {
  const { sessions } = JSON.parse(readFileSync(sessionFile!, "utf8"));
  await page.context().addCookies([
    {
      name: "aat_session",
      value: sessions.ADMIN,
      url: process.env.PLAYWRIGHT_BASE_URL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.route("https://media.example.test/**", async (route) => {
    const request = route.request();
    const response = await page.request.put(
      `http://127.0.0.1:5011/api/v1/__test/storage${new URL(request.url()).pathname}`,
      {
        data: request.postDataBuffer()!,
        headers: { "content-type": request.headers()["content-type"] },
      },
    );
    await route.fulfill({
      status: response.status(),
      headers: { "access-control-allow-origin": "*" },
      body: "",
    });
  });
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function openEditor(page: Page, name: string) {
  await page.goto("/admin/products");
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Compatibility & images", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Compatibility & images · ${name}`, exact: true }),
  ).toBeVisible();
}
async function upload(page: Page, invalid = false) {
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await page.locator("#product-image-file").setInputFiles({
    name: "product.png",
    mimeType: "image/png",
    buffer: invalid ? Buffer.from("invalid image") : readFileSync(imageFile!),
  });
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await page
    .getByLabel("Image description (optional)", { exact: true })
    .fill("Uploaded brake assembly");
  await page.getByRole("checkbox", { name: "Primary image", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Review uploaded image", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Review uploaded image", exact: true }).click();
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
    await page.getByRole("button", { name: "Cancel file upload", exact: true }).click();
  } else await confirm(page);
}
test("product file uploads share hosted gallery editing, primary selection and removal", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  const origin = process.env.PLAYWRIGHT_BASE_URL!;
  const csrfResponse = await page.request.post("/api/v1/auth/csrf", {
    headers: { origin },
  });
  expect(csrfResponse.status()).toBe(200);
  const headers = { origin, "x-csrf-token": (await csrfResponse.json()).data.csrfToken };
  const categoryResponse = await page.request.post("/api/v1/admin/catalog/categories", {
    headers,
    data: {
      name: "Browser product media",
      slug: `media-${randomUUID()}`,
      isActive: true,
    },
  });
  expect(categoryResponse.status()).toBe(201);
  const name = `Brake assembly ${randomUUID().slice(0, 8)}`;
  const created = await page.request.post("/api/v1/admin/catalog/products", {
    headers,
    data: {
      categoryId: (await categoryResponse.json()).data.id,
      name,
      slug: `media-${randomUUID()}`,
      sku: `MEDIA-${randomUUID()}`,
      priceKobo: "150000",
      currency: "NGN",
      isActive: true,
      featured: false,
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.id as string;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page, name);
  await page.getByRole("button", { name: "Use hosted image URL", exact: true }).click();
  await page
    .getByLabel("Public image URL", { exact: true })
    .fill("https://unapproved.invalid/external-part.jpg");
  await page
    .getByLabel("Image description (optional)", { exact: true })
    .fill("Hosted reference image");
  await page.getByLabel("Sort position", { exact: true }).fill("5");
  await page.getByRole("checkbox", { name: "Primary image", exact: true }).check();
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await confirm(page);
  const gallery = page
    .getByRole("heading", { name: "Recorded product images", exact: true })
    .locator("..");
  await expect(gallery.getByRole("article")).toHaveCount(1);
  await upload(page);
  await expect(gallery.getByRole("article")).toHaveCount(2);
  const uploadedImage = gallery.locator('img[src*="/admin/catalog/products/"]');
  await expect
    .poll(() => uploadedImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const adminUrl = (await uploadedImage.getAttribute("src"))!;
  await upload(page, true);
  await expect(gallery.getByRole("article")).toHaveCount(2);
  await expect(uploadedImage).toHaveAttribute("src", adminUrl);
  await gallery.getByRole("button", { name: "Edit image 1", exact: true }).click();
  await expect(page.getByLabel("Public image URL", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Image description (optional)", { exact: true })
    .fill("Front brake assembly");
  await page.getByLabel("Sort position", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await confirm(page);
  await expect(gallery.getByRole("article").last()).toContainText("Front brake assembly");
  await gallery.getByRole("button", { name: "Edit image 1", exact: true }).click();
  await page
    .getByLabel("Public image URL", { exact: true })
    .fill("https://unapproved.invalid/updated-external.jpg");
  await page.getByRole("checkbox", { name: "Primary image", exact: true }).check();
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await confirm(page);
  await expect(gallery.getByRole("article").first().getByRole("heading")).toContainText(
    "primary",
  );
  await gallery.getByRole("button", { name: "Edit image 2", exact: true }).click();
  await page.getByRole("checkbox", { name: "Primary image", exact: true }).check();
  await page.getByRole("button", { name: "Review product image", exact: true }).click();
  await confirm(page);
  await expect(gallery.getByRole("article").last().getByRole("heading")).toContainText(
    "primary",
  );
  await gallery.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg05-product-admin-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, name);
  await expect(gallery.getByRole("article")).toHaveCount(2);
  await gallery.scrollIntoViewIfNeeded();
  await expect
    .poll(() => uploadedImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg05-product-admin-mobile.png"),
    fullPage: true,
  });
  const publicContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
  });
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`/parts/${id}`);
  await expect(publicPage.getByRole("heading", { name, exact: true })).toBeVisible();
  const publicImage = publicPage
    .locator('img[src*="/public/catalog/products/images/"]')
    .first();
  await expect(publicImage).toBeVisible();
  await expect
    .poll(() => publicImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const publicUrl = (await publicImage.getAttribute("src"))!;
  expect((await publicPage.request.get(publicUrl)).headers()["cache-control"]).toContain(
    "no-store",
  );
  await publicPage.screenshot({
    path: path.join(os.tmpdir(), "allied-bg05-product-public-mobile.png"),
    fullPage: true,
  });
  await page.bringToFront();
  await openEditor(page, name);
  await gallery.getByRole("button", { name: "Remove image 2", exact: true }).click();
  await confirm(page);
  await expect(gallery.getByRole("article")).toHaveCount(1);
  expect((await publicPage.request.get(publicUrl)).status()).toBe(404);
  await expect(gallery.getByRole("article").getByRole("heading")).not.toContainText(
    "primary",
  );
  await gallery.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await confirm(page);
  await expect(gallery.getByText("No product images are saved.")).toBeVisible();
  expect(errors).toEqual([]);
  await publicContext.close();
});
