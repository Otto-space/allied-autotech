import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { profileFixture, profileId } from "../fixtures/customer-profile";
const path = "/dashboard/profile";
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`profile layout ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    const s = await profileFixture(page);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Your profile", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Amara");
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(s.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
for (const width of [390, 768, 1280, 1440])
  test(`profile accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await profileFixture(page);
    await page.goto(path);
    await expect(page.getByLabel("First name", { exact: true })).toBeEnabled();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("save sends changed fields only; clearing address is explicit null", async ({
  page,
}) => {
  const s = await profileFixture(page);
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByLabel("Street address (optional)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Your profile has been updated.", { exact: true }).first(),
  ).toBeVisible();
  expect(s.writes.filter((w) => w.method === "PATCH")).toEqual([
    {
      method: "PATCH",
      path: "/customers/profile",
      body: { firstName: "Ada", address: null },
    },
  ]);
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Ada");
});
test("discard restores saved details without a mutation", async ({ page }) => {
  const s = await profileFixture(page);
  await page.goto(path);
  await page.getByLabel("Phone number", { exact: true }).fill("08039999999");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Phone number", { exact: true })).toHaveValue(
    "08031234567",
  );
  expect(s.writes).toEqual([]);
});
test("invalid name and phone focus the field without writing", async ({ page }) => {
  const s = await profileFixture(page);
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toBeFocused();
  await expect(page.getByLabel("First name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(s.writes).toEqual([]);
});
for (const mode of ["error", "denied", "missing", "malformed", "offline"])
  test(`initial ${mode} exposes no editable profile`, async ({ page }) => {
    const s = await profileFixture(page);
    s.mode = mode;
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Your profile is unavailable" }),
    ).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toHaveCount(0);
    expect(s.writes).toEqual([]);
  });
test("profile loading shows skeleton and no form", async ({ page }) => {
  const s = await profileFixture(page);
  s.mode = "hold";
  await page.goto(path);
  await expect(page.locator(".cp-skeleton")).toBeVisible();
  await expect(page.getByLabel("First name", { exact: true })).toHaveCount(0);
  s.mode = "normal";
  s.held?.();
  await expect(page.getByLabel("First name", { exact: true })).toBeEnabled();
});
test("background refresh preserves draft and stale failure locks editing", async ({
  page,
}) => {
  const s = await profileFixture(page);
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("Draft");
  s.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText(
      "Your previous details are shown below. Refresh your profile before making changes.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Draft");
  await expect(page.getByLabel("First name", { exact: true })).toBeDisabled();
  s.mode = "normal";
  await page.getByRole("button", { name: "Refresh profile", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Draft");
});
test("denied refresh removes all private profile content", async ({ page }) => {
  const s = await profileFixture(page);
  await page.goto(path);
  await expect(page.getByLabel("First name", { exact: true })).toBeEnabled();
  s.mode = "denied";
  await page.getByRole("button", { name: "Refresh profile", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveCount(0);
  await expect(page.locator(".cp-identity")).toHaveCount(0);
});
test("lost PATCH response locks repeat saves until saved details reload", async ({
  page,
}) => {
  const s = await profileFixture(page);
  s.saveMode = "lost";
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reload saved details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload saved details", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Ada");
  await expect(page.getByLabel("First name", { exact: true })).toBeEnabled();
  expect(s.writes.filter((w) => w.method === "PATCH")).toHaveLength(1);
});
test("pending save prevents duplicate submission, photo edits and refresh", async ({
  page,
}) => {
  const s = await profileFixture(page);
  s.saveMode = "hold";
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh profile", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("First name", { exact: true })).toBeDisabled();
  s.held?.();
  await expect(page.getByLabel("First name", { exact: true })).toBeEnabled();
  expect(s.writes.filter((w) => w.method === "PATCH")).toHaveLength(1);
});
test("Retry-After disables saving until the deadline", async ({ page }) => {
  const s = await profileFixture(page);
  s.saveMode = "rate";
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText(/Try again in [12] seconds/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  s.saveMode = "normal";
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeEnabled();
  expect(s.writes.filter((w) => w.method === "PATCH")).toHaveLength(1);
});
test("foreign profile response fails closed", async ({ page }) => {
  const s = await profileFixture(page);
  s.record.user.id = profileId(99);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Your profile is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".cp-identity")).toHaveCount(0);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} never requests customer profile`, async ({ page }) => {
    const s = await profileFixture(page);
    s.role = role;
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin/);
    expect(s.reads).toBe(0);
    expect(s.writes).toEqual([]);
  });
test("session change discards private profile and draft", async ({ page }) => {
  await profileFixture(page);
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("Private draft");
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByLabel("First name", { exact: true })).toHaveCount(0);
  await expect(page.locator(".cp-identity")).toHaveCount(0);
});
test("photo failure shows initials; removal is reviewed and versioned", async ({
  page,
}) => {
  const s = await profileFixture(page);
  s.record.mediaVersion = 7;
  s.record.photo = {
    id: profileId(7),
    url: "/api/v1/customers/media/images/" + profileId(7),
    altText: null,
    sortOrder: 0,
    isPrimary: true,
    width: 80,
    height: 80,
  };
  await page.goto(path);
  await expect(page.locator(".cp-initials")).toHaveText("AO");
  await page.getByRole("button", { name: "Remove profile photo", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(s.writes).toEqual([]);
  await page.getByRole("button", { name: "Remove profile photo", exact: true }).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove profile photo", exact: true }),
  ).toHaveCount(0);
  expect(s.writes.find((w) => w.method === "DELETE")?.body).toEqual({
    expectedVersion: 7,
  });
});
test("mobile photo disclosure and invalid file remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const s = await profileFixture(page);
  await page.goto(path);
  await expect(page.locator("#profile-photo-file")).not.toBeVisible();
  await page.locator(".cp-photo summary").click();
  await page
    .locator("#profile-photo-file")
    .setInputFiles({
      name: "wrong.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a photo"),
    });
  await expect(
    page.getByText("Choose a JPEG, PNG or WebP image.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save profile photo", exact: true }),
  ).toBeDisabled();
  expect(s.writes).toEqual([]);
});
test("short viewport keeps form actions and keyboard focus reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 500 });
  await profileFixture(page);
  await page.goto(path);
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  const save = page.getByRole("button", { name: "Save profile", exact: true });
  await save.focus();
  await expect(save).toBeFocused();
  await expect
    .poll(() =>
      save.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
