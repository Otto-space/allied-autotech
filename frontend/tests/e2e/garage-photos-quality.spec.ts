import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  photoFixture,
  photoRoute,
  photoFile,
  photoRecord,
} from "../fixtures/garage-photos";

async function open(page: Page) {
  await page.goto(photoRoute);
  await expect(
    page.getByRole("heading", { name: "Photo 1 · Cover", exact: true }),
  ).toBeVisible();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
}
async function prepare(page: Page, slot = 1) {
  const group = page.getByRole("group", { name: `Photo upload ${slot}`, exact: true });
  await group.locator('input[type="file"]').setInputFiles(photoFile);
  await group.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    group.getByRole("button", { name: "Add photo", exact: true }),
  ).toBeEnabled();
  return group;
}

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`photo workspace and confirmation fit ${width}px`, async ({ page }) => {
    await photoFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await expect(page).toHaveTitle(/Vehicle photos/);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb", exact: true })
        .locator('[aria-current="page"]'),
    ).toHaveText("2021 Toyota Camry");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Remove photo", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await expect(
      dialog.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove photo", exact: true }).first(),
    ).toBeFocused();
    await page.getByRole("button", { name: "Add photos", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Add a vehicle photo", exact: true }),
    ).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
for (const width of [390, 768, 1280, 1440]) {
  test(`photo accessibility ${width}`, async ({ page }) => {
    await photoFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Remove photo", exact: true }).first().click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}
test("edit, reorder, cover and removal persist with original version and CSRF", async ({
  page,
}) => {
  const state = await photoFixture(page);
  await open(page);
  const first = page.getByRole("article").first();
  await first.getByLabel("Image description").fill("  Front bumper  ");
  await first.getByLabel("Display order").fill("5");
  await first.getByRole("button", { name: "Save image details" }).click();
  await confirm(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("article").last().getByLabel("Image description"),
  ).toHaveValue("Front bumper");
  expect(state.writes[0].body).toEqual({
    expectedVersion: 2,
    altText: "Front bumper",
    sortOrder: 5,
  });
  expect(state.writes[0].csrf).toBeTruthy();
  await page.getByRole("button", { name: "Make cover", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("article").first().getByRole("heading")).toHaveText(
    "Photo 1 · Cover",
  );
  await page.reload();
  await open(page);
  await page.getByRole("button", { name: "Remove photo", exact: true }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  expect(state.images).toHaveLength(2);
  await page.getByRole("button", { name: "Remove photo", exact: true }).first().click();
  await confirm(page);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").getByRole("heading")).toHaveText(
    "Photo 1 · Cover",
  );
});
test("order validation prevents invalid requests and blank description becomes null", async ({
  page,
}) => {
  const state = await photoFixture(page);
  await open(page);
  const card = page.getByRole("article").first();
  for (const value of ["-1", "10001", "1.5", ""]) {
    await card.getByLabel("Display order").fill(value);
    await card.getByRole("button", { name: "Save image details" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  expect(state.writes).toHaveLength(0);
  await card.getByLabel("Display order").fill("0");
  await card.getByLabel("Image description").fill("   ");
  await card.getByRole("button", { name: "Save image details" }).click();
  await confirm(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.writes[0].body.altText).toBeNull();
});
test("pending removal locks repeated confirmation and Escape", async ({ page }) => {
  const state = await photoFixture(page);
  state.mutation = "hold";
  await open(page);
  await page.getByRole("button", { name: "Remove photo", exact: true }).first().click();
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Submitting…", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.writes).toHaveLength(1);
  state.releaseMutation!();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
for (const mode of ["stale", "error", "malformed"]) {
  test(`unconfirmed or rejected ${mode} mutation cannot report success or repeat`, async ({
    page,
  }) => {
    const state = await photoFixture(page);
    state.mutation = mode;
    await open(page);
    await page.getByRole("button", { name: "Make cover", exact: true }).click();
    await confirm(page);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change", exact: true }),
    ).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: mode === "stale" ? "Go back" : "Close & review record",
        exact: true,
      })
      .click();
    await expect.poll(() => state.reads).toBeGreaterThan(1);
  });
}
test("independent uploads preserve prepared file after attaching another", async ({
  page,
}) => {
  const state = await photoFixture(page);
  await open(page);
  await page.getByRole("button", { name: "Prepare another photo", exact: true }).click();
  const one = await prepare(page, 1),
    two = await prepare(page, 2);
  await one.getByRole("button", { name: "Add photo", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(two.getByRole("button", { name: "Add photo", exact: true })).toBeEnabled();
  await two.getByRole("button", { name: "Add photo", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("article")).toHaveCount(4);
  expect(state.transfers).toBe(2);
});
test("lost attachment response retries exact body and attaches once", async ({
  page,
}) => {
  const state = await photoFixture(page);
  await open(page);
  const group = await prepare(page);
  state.mutation = "lost-response";
  await group.getByRole("button", { name: "Add photo", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Retry same request", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  const attempts = state.writes.filter((w) => w.path.endsWith("/images"));
  expect(attempts).toHaveLength(2);
  expect(attempts[0].body).toEqual(attempts[1].body);
  expect(state.images).toHaveLength(3);
});
test("upload failure can retry without attaching an image", async ({ page }) => {
  const state = await photoFixture(page);
  state.storage = "error";
  await open(page);
  const group = page.getByRole("group", { name: "Photo upload 1", exact: true });
  await group.locator('input[type="file"]').setInputFiles(photoFile);
  await group.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(group.getByRole("alert")).toBeVisible();
  await expect(
    group.getByRole("button", { name: "Add photo", exact: true }),
  ).toBeDisabled();
  expect(state.images).toHaveLength(2);
  state.storage = "normal";
  await group.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect(
    group.getByRole("button", { name: "Add photo", exact: true }),
  ).toBeEnabled();
  await group.getByRole("button", { name: "Discard this upload" }).click();
  await expect(page.locator('input[type="file"]')).toHaveValue("");
});
test("cancel upload leaves the gallery unchanged and attachment unavailable", async ({
  page,
}) => {
  const state = await photoFixture(page);
  state.storage = "hold";
  await open(page);
  const group = page.getByRole("group", { name: "Photo upload 1", exact: true });
  await group.locator('input[type="file"]').setInputFiles(photoFile);
  await group.getByRole("button", { name: "Upload selected file", exact: true }).click();
  await expect.poll(() => state.transfers).toBe(1);
  await group.getByRole("button", { name: "Cancel upload", exact: true }).click();
  state.releaseStorage!();
  await expect(
    group.getByRole("button", { name: "Cancel upload", exact: true }),
  ).not.toBeVisible();
  await expect(
    group.getByRole("button", { name: "Add photo", exact: true }),
  ).toBeDisabled();
  expect(state.images).toHaveLength(2);
  expect(state.writes.filter((w) => w.path.endsWith("/images"))).toHaveLength(0);
});
test("bad file never prepares and full gallery disables upload", async ({ page }) => {
  const state = await photoFixture(page);
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(
    page.getByText("Choose a JPEG, PNG or WebP image.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  state.images = Array.from({ length: 12 }, (_, i) => photoRecord(i + 1));
  await page.reload();
  await expect(
    page.getByText("Your gallery is full. Remove a photo before adding another."),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Prepare another photo", exact: true }),
  ).toBeDisabled();
});
test("empty, loading and manual errors retain no actionable old photos", async ({
  page,
}) => {
  const state = await photoFixture(page);
  state.mode = "hold";
  await page.goto(photoRoute);
  await expect(page.getByText("Loading vehicle photos…", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  state.mode = "normal";
  state.images = [];
  state.release!();
  await expect(page.getByRole("heading", { name: "No photos yet" })).toBeVisible();
  await page.getByRole("button", { name: "Add your first photo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add a vehicle photo", exact: true }),
  ).toBeFocused();
  state.images = [photoRecord(1)];
  await page.getByRole("button", { name: "Refresh photos", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  state.mode = "error";
  await page.getByRole("button", { name: "Refresh photos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vehicle photos unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove photo", exact: true }),
  ).toHaveCount(0);
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry photos", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
});
test("background errors label stale data and prevent writes", async ({ page }) => {
  const state = await photoFixture(page);
  await open(page);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "These photos may be out of date. Refresh before making changes.",
  );
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Make cover", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Image description").first()).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
});
test("short confirmation contains keyboard focus with visible footer", async ({
  page,
}) => {
  await photoFixture(page);
  await page.setViewportSize({ width: 390, height: 480 });
  await open(page);
  await page.getByRole("button", { name: "Remove photo", exact: true }).first().click();
  const dialog = page.getByRole("dialog"),
    last = dialog.getByRole("button", { name: "Confirm change", exact: true });
  await last.focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close vehicle dialog", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
  const box = await last.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(480);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot read private gallery`, async ({ page }) => {
    const state = await photoFixture(page, role);
    await page.goto(photoRoute);
    await page.getByRole("heading", { level: 1 }).waitFor();
    expect(state.reads).toBe(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

for (const mode of ["denied", "malformed"])
  test(`${mode} read hides all private controls`, async ({ page }) => {
    const state = await photoFixture(page);
    state.mode = mode;
    await page.goto(photoRoute);
    await expect(
      page.getByRole("heading", { name: "Vehicle photos unavailable" }),
    ).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(0);
  });
test("failed private image has a labelled fallback without stock substitution", async ({
  page,
}) => {
  const state = await photoFixture(page);
  state.mode = "broken-image";
  await open(page);
  await expect(
    page.getByRole("img", { name: /photo 1: image unavailable/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Photo unavailable", { exact: true }).first(),
  ).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "Refresh photos", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("article img")
        .first()
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
});
test("session changes remove pending private dialogs and ignore late success", async ({
  page,
}) => {
  const state = await photoFixture(page);
  state.mutation = "hold";
  await open(page);
  await page.getByRole("button", { name: "Make cover", exact: true }).click();
  await confirm(page);
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByRole("dialog")).not.toBeVisible();
  state.releaseMutation!();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByText("Your garage photos have been updated.", { exact: true }),
  ).toHaveCount(0);
});
