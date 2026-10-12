import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const sessionFile = process.env.BG_DIRECTORY_SESSION_FILE;
const imageFile = process.env.BG_MEDIA_IMAGE_FILE;
test.skip(
  !sessionFile || !imageFile,
  "Requires isolated API, injected byte storage and synthetic sessions",
);
test.setTimeout(120_000);
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
      headers: { "access-control-allow-origin": "*" },
      body: "",
    });
  });
}
async function upload(page: Page, name: string, buffer: Buffer) {
  await page
    .locator("#profile-photo-file")
    .setInputFiles({ name, mimeType: "image/png", buffer });
  await page.getByRole("button", { name: "Upload selected file" }).click();
  await expect(
    page.getByRole("button", { name: "Save profile photo", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save profile photo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
}
test("private profile photo upload, refresh, failed replacement, replacement and removal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard/profile");
  await expect(
    page.getByRole("heading", { name: "Profile photo", exact: true }),
  ).toBeVisible();
  await upload(page, "profile.png", readFileSync(imageFile!));
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const image = page.locator('img[src*="/customers/media/images/"]');
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const original = await image.getAttribute("src");
  await page.reload();
  await expect(image).toHaveAttribute("src", original!);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg02-profile-desktop.png"),
    fullPage: true,
  });
  await upload(page, "invalid.png", Buffer.from("invalid image content"));
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(image).toHaveAttribute("src", original!);
  await upload(page, "replacement.png", readFileSync(imageFile!));
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(image).not.toHaveAttribute("src", original!);
  const replacement = await image.getAttribute("src");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(image).toHaveAttribute("src", replacement!);
  await page.locator(".cp-photo summary").click();
  await expect(
    page.getByRole("heading", { name: "Profile photo", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg02-profile-mobile.png"),
    fullPage: true,
  });
  await signIn(page, "OTHER");
  expect((await page.request.get(replacement!)).status()).toBe(404);
  await signIn(page);
  await page.getByRole("button", { name: "Remove profile photo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(image).toHaveCount(0);
  await page.reload();
  await page.locator(".cp-photo summary").click();
  await expect(
    page.getByRole("button", { name: "Remove profile photo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Profile photo", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("loading, storage failure, conflict and lost confirmation recover safely", async ({
  page,
}) => {
  await signIn(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/v1/customers/profile",
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  await page.goto("/dashboard/profile");
  await expect(page.getByText("Loading your profile…", { exact: true })).toBeVisible();
  release();
  await expect(page.locator("#profile-photo-file")).toBeEnabled();
  const reject = (status: number, code: string) => ({
    status,
    json: {
      success: false,
      error: { code, message: "Synthetic recovery-state test" },
      meta: { requestId: "media-browser-state" },
    },
  });
  await page.route(
    "**/api/v1/customers/profile/photo/upload",
    (route) => route.fulfill(reject(503, "MEDIA_STORAGE_UNAVAILABLE")),
    { times: 1 },
  );
  await page.locator("#profile-photo-file").setInputFiles({
    name: "profile.png",
    mimeType: "image/png",
    buffer: readFileSync(imageFile!),
  });
  await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    page.getByText(/Image storage is temporarily unavailable/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save profile photo", exact: true }),
  ).toBeDisabled();
  await page.route(
    "**/api/v1/customers/profile/photo",
    (route) => route.fulfill(reject(409, "STALE_VERSION")),
    { times: 1 },
  );
  await upload(page, "profile.png", readFileSync(imageFile!));
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await page.getByRole("button", { name: "Refresh profile", exact: true }).click();
  await page.route(
    "**/api/v1/customers/profile/photo",
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await upload(page, "profile.png", readFileSync(imageFile!));
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Retry same request" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retry same request" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator('img[src*="/customers/media/images/"]')).toBeVisible();
  await page.getByRole("button", { name: "Remove profile photo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.locator('img[src*="/customers/media/images/"]')).toHaveCount(0);
});
