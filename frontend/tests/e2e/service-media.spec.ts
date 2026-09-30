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
async function upload(page: Page, buffer = readFileSync(imageFile!)) {
  await page
    .locator("#service-image-file")
    .setInputFiles({ name: "service.png", mimeType: "image/png", buffer });
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save service image", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save service image", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function openEditor(page: Page, name: string) {
  await page.goto("/admin/services");
  await expect(
    page.getByRole("heading", { name: "Services", exact: true }),
  ).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: name });
  for (let index = 0; index < 30; index++) {
    await expect(
      page.getByRole("button", { name: "Refresh records", exact: true }),
    ).toBeEnabled();
    if (await row.count()) break;
    const next = page.getByRole("button", { name: "Next", exact: true });
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  await row.getByRole("button", { name: "Manage image" }).click();
  await expect(
    page.getByRole("heading", { name: `Image for ${name}`, exact: true }),
  ).toBeVisible();
}
test("service image upload, failed replacement, alt text, public display and removal", async ({
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
  const csrf = (await csrfResponse.json()).data.csrfToken;
  const name = `Workshop image ${randomUUID().slice(0, 8)}`;
  const created = await page.request.post("/api/v1/admin/services", {
    headers: { origin, "x-csrf-token": csrf },
    data: {
      name,
      slug: `media-${randomUUID()}`,
      pricingType: "QUOTE_REQUIRED",
      priceKobo: null,
      currency: "NGN",
      durationMinutes: 60,
      isActive: true,
      shortDescription: "Professional workshop care and diagnostics.",
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.id as string;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page, name);
  await expect(page.getByText("No service image yet.")).toBeVisible();
  await upload(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const image = page.locator('img[src*="/admin/services/"]');
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const original = await image.getAttribute("src");
  await upload(page, Buffer.from("invalid image"));
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(image).toHaveAttribute("src", original!);
  await upload(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(image).not.toHaveAttribute("src", original!);
  await expect(page.getByLabel("Image description (optional)")).toBeEnabled();
  await page
    .getByLabel("Image description (optional)")
    .fill("Technician inspecting workshop equipment");
  await page.getByRole("button", { name: "Save description", exact: true }).click();
  await confirm(page);
  await expect(image).toHaveAttribute("alt", "Technician inspecting workshop equipment");
  await image.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg04-service-admin-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, name);
  await expect(page.getByLabel("Image description (optional)")).toHaveValue(
    "Technician inspecting workshop equipment",
  );
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg04-service-admin-mobile.png"),
    fullPage: true,
  });
  const publicContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
  });
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`/services/${id}`);
  await expect(publicPage.getByRole("heading", { name, exact: true })).toBeVisible();
  const publicImage = publicPage.getByRole("img", {
    name: "Technician inspecting workshop equipment",
  });
  await expect(publicImage).toBeVisible();
  await expect
    .poll(() => publicImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const publicUrl = (await publicImage.getAttribute("src"))!;
  expect((await publicPage.request.get(publicUrl)).headers()["cache-control"]).toContain(
    "no-store",
  );
  expect(
    await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page: publicPage }).include("main").analyze()).violations,
  ).toEqual([]);
  await publicPage.screenshot({
    path: path.join(os.tmpdir(), "allied-bg04-service-public-mobile.png"),
    fullPage: true,
  });
  await publicPage.setViewportSize({ width: 1440, height: 1000 });
  await publicPage.goto("/services");
  const card = publicPage
    .getByRole("article")
    .filter({ has: publicPage.getByRole("heading", { name, exact: true }) });
  for (let index = 0; index < 30; index++) {
    await expect(publicPage.locator("main [aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    if (await card.count()) break;
    const next = publicPage.getByRole("button", { name: "Next", exact: true });
    if (!(await next.isEnabled())) break;
    const response = publicPage.waitForResponse(
      (result) => new URL(result.url()).pathname === "/api/v1/public/services",
    );
    await next.click();
    await response;
  }
  await expect(card.getByRole("img")).toHaveAttribute("src", publicUrl);
  await card.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      card.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await publicPage.screenshot({
    path: path.join(os.tmpdir(), "allied-bg04-service-cards-desktop.png"),
    fullPage: true,
  });
  await page.bringToFront();
  await openEditor(page, name);
  await page.getByRole("button", { name: "Remove service image", exact: true }).click();
  await confirm(page);
  await expect(page.getByText("No service image yet.")).toBeVisible();
  expect((await publicPage.request.get(publicUrl)).status()).toBe(404);
  await publicPage.goto(`/services/${id}`);
  await expect(publicPage.locator('img[src*="/public/media/images/"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  await publicContext.close();
});
