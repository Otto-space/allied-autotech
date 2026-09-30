import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
const sessionFile = process.env.BG_DIRECTORY_SESSION_FILE;
const imageFile = process.env.BG_MEDIA_IMAGE_FILE;
test.skip(
  !sessionFile || !imageFile,
  "Requires isolated API, byte storage and synthetic sessions",
);
test.setTimeout(120000);
async function signIn(page: Page, role = "CUSTOMER") {
  const { sessions } = JSON.parse(readFileSync(sessionFile!, "utf8"));
  await page.context().addCookies([
    {
      name: "aat_session",
      value: sessions[role],
      url: process.env.PLAYWRIGHT_BASE_URL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function confirm(page: Page) {
  const response = page.waitForResponse(
    (result) =>
      result.request().method() !== "GET" &&
      new URL(result.url()).pathname.includes("/images"),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function prepare(page: Page, name: string, slot: number, retry = false) {
  const group = page.getByRole("group", { name: `Photo upload ${slot}`, exact: true });
  await group
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name, mimeType: "image/png", buffer: readFileSync(imageFile!) });
  await group.getByRole("button", { name: "Upload selected file", exact: true }).click();
  if (retry) {
    await expect(group.getByText(/Storage did not confirm the upload/)).toBeVisible();
    await expect(
      group.getByRole("button", { name: "Add photo", exact: true }),
    ).toBeDisabled();
    await group
      .getByRole("button", { name: "Upload selected file", exact: true })
      .click();
  }
  await expect(
    group.getByRole("button", { name: "Add photo", exact: true }),
  ).toBeEnabled();
  return group;
}
test("garage photos persist, reorder, change cover and revoke access on vehicle removal", async ({
  page,
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
  const created = await page.request.post("/api/v1/customers/vehicles", {
    headers: { origin, "x-csrf-token": csrf },
    data: { make: "Toyota", model: "Gallery", year: 2020 },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.id as string;
  let transfers = 0;
  await page.route("https://media.example.test/**", async (route) => {
    transfers++;
    if (transfers === 2) return route.fulfill({ status: 503, body: "" });
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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard/vehicles");
  await page.locator(`a[href="/dashboard/vehicles/${id}"]`).click();
  await expect(page).toHaveTitle(/Vehicle photos/, { timeout: 45000 });
  await expect(
    page.getByText("No photos yet. Add your first vehicle photo below."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prepare another photo" }).click();
  const frontUpload = await prepare(page, "front.png", 1);
  const sideUpload = await prepare(page, "side.png", 2, true);
  await frontUpload.getByRole("button", { name: "Add photo", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    sideUpload.getByRole("button", { name: "Add photo", exact: true }),
  ).toBeEnabled();
  await sideUpload.getByRole("button", { name: "Add photo", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("article")).toHaveCount(2);
  const first = page.getByRole("article").first();
  await page.route(
    `**/api/v1/customers/vehicles/${id}/images/*`,
    (route) =>
      route.fulfill({
        status: 409,
        json: {
          success: false,
          error: { code: "STALE_VERSION" },
          meta: { requestId: "garage-stale-ui" },
        },
      }),
    { times: 1 },
  );
  await first.getByLabel("Display order").fill("10");
  await first.getByRole("button", { name: "Save image details" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await page.getByRole("button", { name: "Refresh photos" }).click();
  await expect(page.getByRole("button", { name: "Refresh photos" })).toBeEnabled();
  await first.getByLabel("Display order").fill("10");
  await first.getByRole("button", { name: "Save image details" }).click();
  await confirm(page);
  await expect(page.getByRole("article").first().getByLabel("Display order")).toHaveValue(
    "1",
  );
  const side = page.getByRole("article").first();
  await side.getByLabel("Image description").fill("Passenger side");
  await side.getByRole("button", { name: "Save image details" }).click();
  await confirm(page);
  await side.getByRole("button", { name: "Make cover" }).click();
  await confirm(page);
  await page.reload();
  await expect(side.getByRole("heading")).toHaveText("Photo 1 · Cover");
  await expect(side.getByLabel("Image description")).toHaveValue("Passenger side");
  const privateUrl = await side.getByRole("img").getAttribute("src");
  await expect
    .poll(() =>
      side.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg03-garage-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg03-garage-mobile.png"),
    fullPage: true,
  });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await signIn(page, "OTHER");
  expect((await page.request.get(privateUrl!)).status()).toBe(404);
  expect((await page.request.get(`/api/v1/customers/vehicles/${id}`)).status()).toBe(404);
  await signIn(page);
  await side.getByRole("button", { name: "Remove photo" }).click();
  await confirm(page);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").getByRole("heading")).toHaveText(
    "Photo 1 · Cover",
  );
  const remainingUrl = await page
    .getByRole("article")
    .getByRole("img")
    .getAttribute("src");
  await page.getByRole("link", { name: "Back to your vehicles" }).click();
  const record = page
    .getByRole("article")
    .filter({ has: page.locator(`a[href="/dashboard/vehicles/${id}"]`) });
  await record.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await expect(page.locator(`a[href="/dashboard/vehicles/${id}"]`)).toHaveCount(0);
  expect((await page.request.get(remainingUrl!)).status()).toBe(404);
  expect(errors).toEqual([]);
});

test("garage loading and cross-customer access keep image controls unavailable", async ({
  page,
}) => {
  const { garageIds } = JSON.parse(readFileSync(sessionFile!, "utf8"));
  await signIn(page, "OTHER");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/v1/customers/vehicles/${garageIds.CUSTOMER}`,
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  await page.goto(`/dashboard/vehicles/${garageIds.CUSTOMER}`);
  await expect(page.getByText("Loading vehicle photos…", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  release();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "This record is unavailable or you no longer have access to it.",
  );
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh photos" })).toBeEnabled();
});
