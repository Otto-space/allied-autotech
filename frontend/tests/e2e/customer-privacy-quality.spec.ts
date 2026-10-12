import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { privacyFixture, privacyId, privacyRecord } from "../fixtures/customer-privacy";
const review = (page: Page) =>
  page.getByRole("button", { name: "Review privacy request", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh privacy requests", exact: true });
const send = (page: Page) =>
  page.getByRole("button", { name: "Send privacy request", exact: true });
async function fill(page: Page, kind = "ANONYMIZATION") {
  await page.getByLabel("Request type", { exact: true }).selectOption(kind);
  await page
    .getByLabel("Why are you making this request?")
    .fill("Please review the personal information connected with my account.");
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`privacy composition and navigation at ${width}px`, async ({ page }) => {
    const state = await privacyFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) errors.push(m.text());
    });
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/dashboard/privacy");
    await expect(review(page)).toBeEnabled();
    await expect(page).toHaveTitle("Privacy requests · Allied AutoTech");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.locator(".cpv-record")).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.getByRole("link", { name: "Manage your profile" })).toHaveAttribute(
      "href",
      "/dashboard/profile",
    );
    expect(state.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
for (const width of [320, 390, 768, 1440])
  test(`privacy accessibility and modal at ${width}px`, async ({ page }) => {
    await privacyFixture(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dashboard/privacy");
    await expect(review(page)).toBeEnabled();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await fill(page);
    await review(page).click();
    await expect(
      page.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(review(page)).toBeFocused();
  });
test("cancel writes nothing; exact confirmation saves one request and clears persisted draft", async ({
  page,
}) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  await page.getByRole("button", { name: "Go back" }).click();
  expect(s.writes).toEqual([]);
  await review(page).click();
  await send(page).click();
  await expect(page.getByText(/Your privacy request is recorded/)).toBeVisible();
  expect(s.writes).toEqual([
    {
      kind: "ANONYMIZATION",
      reason: "Please review the personal information connected with my account.",
    },
  ]);
  await expect(page.locator(".cpv-record")).toHaveCount(2);
  await expect(page.getByLabel("Why are you making this request?")).toHaveValue("");
  await page.reload();
  await expect(review(page)).toBeEnabled();
  await expect(page.getByLabel("Why are you making this request?")).toHaveValue("");
});
test("existing request returns its original explanation", async ({ page }) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await fill(page, "DELETION");
  await review(page).click();
  await send(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".cpv-record")).toHaveCount(1);
  await expect(page.locator(".cpv-record")).toContainText(privacyRecord().reason);
  expect(s.writes).toHaveLength(1);
});
test("required and whitespace validation focuses the invalid field", async ({ page }) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await review(page).click();
  await expect(page.getByLabel("Request type", { exact: true })).toBeFocused();
  await page.getByLabel("Request type", { exact: true }).selectOption("DELETION");
  await page.getByLabel("Why are you making this request?").fill("             ");
  await review(page).click();
  await expect(page.getByLabel("Why are you making this request?")).toBeFocused();
  await expect(page.getByLabel("Why are you making this request?")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(s.writes).toEqual([]);
});
for (const mode of ["empty", "error", "offline", "denied", "foreign", "malformed"])
  test(`privacy ${mode} state is honest`, async ({ page }) => {
    const s = await privacyFixture(page);
    s.mode = mode;
    await page.goto("/dashboard/privacy");
    if (mode === "empty") {
      await expect(page.getByText("No privacy requests yet")).toBeVisible();
      await expect(review(page)).toBeEnabled();
    } else {
      await expect(page.locator(".customer-privacy [role=alert]")).toBeVisible();
      await expect(review(page)).toBeDisabled();
      await expect(page.locator(".cpv-record")).toHaveCount(0);
    }
    s.mode = "normal";
    await refresh(page).click();
    await expect(review(page)).toBeEnabled();
    expect(s.writes).toEqual([]);
  });
test("initial loading has a skeleton and blocks intake", async ({ page }) => {
  const s = await privacyFixture(page);
  s.mode = "hold";
  await page.goto("/dashboard/privacy");
  await expect(page.locator(".cpv-loading")).toBeVisible();
  await expect(review(page)).toBeDisabled();
  s.mode = "normal";
  s.release?.();
  await expect(review(page)).toBeEnabled();
});
test("background failure labels retained history stale and preserves the draft", async ({
  page,
}) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await fill(page);
  s.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Saved requests are out of date/)).toBeVisible();
  await expect(page.locator(".cpv-record")).toHaveCount(1);
  await expect(review(page)).toBeDisabled();
  s.mode = "normal";
  await refresh(page).click();
  await expect(review(page)).toBeEnabled();
  await expect(page.getByLabel("Why are you making this request?")).toHaveValue(
    /Please review/,
  );
});
test("denied refresh removes private history", async ({ page }) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await expect(review(page)).toBeEnabled();
  s.mode = "denied";
  await refresh(page).click();
  await expect(page.locator(".cpv-record")).toHaveCount(0);
  await expect(review(page)).toBeDisabled();
});
test("cursor traversal retains form text and uses server cursor", async ({ page }) => {
  const s = await privacyFixture(page);
  s.items = Array.from({ length: 11 }, (_, i) => privacyRecord(10 + i));
  await page.goto("/dashboard/privacy");
  await fill(page);
  await expect(page.locator(".cpv-record")).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".cpv-record")).toHaveCount(1);
  expect(s.reads.at(-1)?.searchParams.get("cursor")).toBe(privacyId(19));
  await expect(page.getByLabel("Why are you making this request?")).toHaveValue(
    /Please review/,
  );
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".cpv-record")).toHaveCount(10);
});
for (const outcome of ["unknown", "mismatch"])
  test(`${outcome} requires fresh history and acknowledgement, including after reload`, async ({
    page,
  }) => {
    const s = await privacyFixture(page);
    s.outcome = outcome;
    await page.goto("/dashboard/privacy");
    await fill(page);
    await review(page).click();
    await send(page).click();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await expect(review(page)).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "I have checked my requests" }),
    ).toBeDisabled();
    await refresh(page).click();
    await expect(
      page.getByRole("button", { name: "I have checked my requests" }),
    ).toBeEnabled();
    await page.reload();
    await expect(page.locator(".cpv-recovery")).toBeVisible();
    await expect(review(page)).toBeDisabled();
    await refresh(page).click();
    await page.getByRole("button", { name: "I have checked my requests" }).click();
    await expect(review(page)).toBeEnabled();
    expect(s.writes).toHaveLength(1);
  });
test("pending confirmation suppresses duplicates and prevents closing", async ({
  page,
}) => {
  const s = await privacyFixture(page);
  s.outcome = "hold";
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  await send(page).click();
  await expect(page.getByRole("button", { name: /Submitting/ })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(s.writes).toHaveLength(1);
  s.outcome = "normal";
  s.release?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("429 observes Retry-After without replay", async ({ page }) => {
  const s = await privacyFixture(page);
  s.outcome = "rate";
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  await send(page).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(review(page)).toBeDisabled();
  await expect(review(page)).toBeEnabled({ timeout: 5000 });
  expect(s.writes).toHaveLength(1);
});
test("account switch before confirmation sends no intake", async ({ page }) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  s.owner = privacyId(99);
  await send(page).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(s.writes).toEqual([]);
});
test("session event removes confirmation and private history", async ({ page }) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".cpv-record")).toHaveCount(0);
  expect(s.writes).toEqual([]);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot use customer privacy intake`, async ({ page }) => {
    const s = await privacyFixture(page, role);
    await page.goto("/dashboard/privacy");
    await expect(page).toHaveURL(/\/admin/);
    await expect(review(page)).toHaveCount(0);
    expect(s.writes).toEqual([]);
    expect(s.reads).toEqual([]);
  });
test("approved status is not completed deletion; long records and modal fit short mobile", async ({
  page,
}) => {
  const s = await privacyFixture(page);
  s.items = [privacyRecord(10, "APPROVED_PENDING_POLICY")];
  s.items[0].reason = "Long " + "R".repeat(1950);
  s.items[0].reviewNote = "Note " + "N".repeat(1950);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/privacy");
  await expect(page.getByText(/Your information has not been deleted/)).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await fill(page);
  await page
    .getByLabel("Why are you making this request?")
    .fill("Reason " + "X".repeat(1980));
  await review(page).click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate(
        (el) =>
          el.scrollWidth <= el.clientWidth &&
          el.getBoundingClientRect().height <= innerHeight,
      ),
  ).toBe(true);
});

test("background refresh cannot acknowledge an uncertain submission", async ({
  page,
}) => {
  const s = await privacyFixture(page);
  s.outcome = "unknown";
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  await send(page).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".cpv-record")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "I have checked my requests" }),
  ).toBeDisabled();
  expect(s.writes).toHaveLength(1);
});
test("recovery marker contains no explanation and is isolated by account", async ({
  page,
}) => {
  const s = await privacyFixture(page);
  s.outcome = "unknown";
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  await send(page).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      `aat:privacy-request:v1:${privacyId(2)}`,
    ),
  ).toBe("pending");
  s.owner = privacyId(99);
  s.items = [];
  await page.reload();
  await expect(review(page)).toBeEnabled();
  await expect(page.locator(".cpv-recovery")).toHaveCount(0);
});
test("unavailable recovery storage prevents an untracked submission", async ({
  page,
}) => {
  const s = await privacyFixture(page);
  await page.goto("/dashboard/privacy");
  await fill(page);
  await review(page).click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:privacy-request:")) throw new Error("Storage unavailable");
      return set.call(this, key, value);
    };
  });
  await send(page).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(s.writes).toEqual([]);
});
