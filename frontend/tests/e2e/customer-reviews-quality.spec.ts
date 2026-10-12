import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerReviewsFixture, customerReviewRow } from "../fixtures/customer-reviews";

const marker = "aat:review-write:v1:c4000000-0000-4000-8000-000000000011";
const opener = (page: Page) =>
  page.getByRole("button", { name: "Review submission", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh submissions", exact: true });
const acknowledge = (page: Page) =>
  page.getByRole("button", { name: "I have checked my submissions", exact: true });
async function compose(page: Page) {
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Clear advice and careful work.");
  await opener(page).click();
}
async function send(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit for moderation", exact: true })
    .click();
}
async function unknown(page: Page) {
  const state = await customerReviewsFixture(page);
  state.unknown = true;
  await page.goto("/dashboard/reviews");
  await compose(page);
  await send(page);
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  // Retain explicit coverage for pre-idempotency drafts that stored only a marker.
  await page.evaluate((key) => sessionStorage.setItem(key, "pending"), marker);
  await page.reload();
  await expect(page.getByRole("region", { name: "Review recovery" })).toBeVisible();
  return state;
}

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`customer reviews fit ${width}px`, async ({ page }) => {
    await customerReviewsFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/reviews");
    await expect(
      page.getByRole("heading", { name: "Isolated review", exact: true }),
    ).toBeVisible();
    await expect(opener(page)).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    if (width >= 1280) {
      const form = await page.locator(".cr-form").boundingBox();
      const history = await page.locator(".cr-history").boundingBox();
      expect(Math.abs(form!.y - history!.y)).toBeLessThan(2);
      expect(history!.x).toBeGreaterThan(form!.x + form!.width);
    }
  });
}

for (const width of [390, 768, 1280, 1440]) {
  test(`page and confirmation accessible at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await customerReviewsFixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/dashboard/reviews");
    await expect(opener(page)).toBeEnabled();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await compose(page);
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
    await page.keyboard.press("Escape");
    await expect(opener(page)).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test("uncertain submission survives reload and needs explicit successful refresh and acknowledgement", async ({
  page,
}) => {
  const state = await unknown(page);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBe(
    "pending",
  );
  await page.reload();
  await expect(opener(page)).toBeDisabled();
  await expect(acknowledge(page)).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(opener(page)).toBeDisabled();
  await expect(acknowledge(page)).toBeDisabled();
  await refresh(page).click();
  await expect(acknowledge(page)).toBeEnabled();
  await acknowledge(page).click();
  await expect(opener(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
});

test("failed manual recovery read cannot be acknowledged after background success", async ({
  page,
}) => {
  const state = await unknown(page);
  state.failList = true;
  await refresh(page).click();
  await expect(page.locator(".cr-history").getByRole("alert")).toBeVisible();
  state.failList = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("heading", { name: "Isolated review", exact: true }),
  ).toBeVisible();
  await expect(acknowledge(page)).toBeDisabled();
  await refresh(page).click();
  await expect(acknowledge(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

test("refreshing uncertain filtered history resets to the latest unfiltered page", async ({
  page,
}) => {
  const state = await unknown(page);
  state.pagination = true;
  await page.getByLabel("Moderation status").selectOption("APPROVED");
  await expect(page.getByText("No reviews match this page and status.")).toBeVisible();
  await refresh(page).click();
  await expect(page.getByLabel("Moderation status")).toHaveValue("");
  await expect(acknowledge(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

for (const mode of ["identity", "role", "unavailable"] as const) {
  test(`session ${mode} preflight prevents review POST`, async ({ page }) => {
    const state = await customerReviewsFixture(page);
    await page.goto("/dashboard/reviews");
    await compose(page);
    if (mode === "identity") state.userId = "c4000000-0000-4000-8000-000000000012";
    if (mode === "role") state.sessionRole = "STAFF";
    if (mode === "unavailable") state.failSession = true;
    await send(page);
    if (mode === "unavailable")
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    else {
      await expect(
        page.getByText("Your session changed. Verify your account to continue."),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    expect(state.writes).toHaveLength(0);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
  });
}

test("unavailable recovery storage prevents a submission", async ({ page }) => {
  const state = await customerReviewsFixture(page);
  await page.goto("/dashboard/reviews");
  await compose(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:review-write:")) throw new Error("disabled storage");
      original.call(this, key, value);
    };
  });
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("recovery marker cannot be cleared silently when storage removal fails", async ({
  page,
}) => {
  await unknown(page);
  await refresh(page).click();
  await expect(acknowledge(page)).toBeEnabled();
  await page.evaluate(() => {
    Storage.prototype.removeItem = () => {
      throw new Error("disabled");
    };
  });
  await acknowledge(page).click();
  await expect(opener(page)).toBeDisabled();
  await expect(page.getByText(/could not clear the recovery marker/)).toBeVisible();
});

test("another account's marker does not block this customer's form", async ({ page }) => {
  await customerReviewsFixture(page);
  await page.addInitScript(() =>
    sessionStorage.setItem("aat:review-write:v1:other-account", "pending"),
  );
  await page.goto("/dashboard/reviews");
  await expect(opener(page)).toBeEnabled();
  await expect(page.getByRole("region", { name: "Review recovery" })).toHaveCount(0);
});

test("rate rejection respects Retry-After without automatic replay", async ({ page }) => {
  const state = await customerReviewsFixture(page);
  state.rateLimit = true;
  await page.goto("/dashboard/reviews");
  await compose(page);
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(opener(page)).toBeDisabled();
  await expect(page.getByText(/Please wait .* seconds before submitting/)).toBeVisible();
  await expect(opener(page)).toBeEnabled({ timeout: 6000 });
  expect(state.writes).toHaveLength(1);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
});

test("background read failure preserves history and disables writes until refreshed", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  await page.goto("/dashboard/reviews");
  await expect(opener(page)).toBeEnabled();
  state.failList = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Your submissions are out of date/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Isolated review", exact: true }),
  ).toBeVisible();
  await expect(opener(page)).toBeDisabled();
  state.failList = false;
  await refresh(page).click();
  await expect(opener(page)).toBeEnabled();
});

test("history going stale while confirmation is open prevents submission", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  await page.goto("/dashboard/reviews");
  await compose(page);
  state.failList = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Your submissions are out of date/)).toBeVisible();
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("stale completed-record picker prevents a new review", async ({ page }) => {
  const state = await customerReviewsFixture(page);
  await page.goto("/dashboard/reviews");
  await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
  await page
    .getByLabel("Completed record", { exact: true })
    .selectOption("c4000000-0000-4000-8000-000000000002");
  state.failSource = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".cr-source").getByRole("alert")).toBeVisible();
  await expect(opener(page)).toBeDisabled();
  state.failSource = false;
  await page
    .getByRole("button", { name: "Refresh completed records", exact: true })
    .click();
  await expect(opener(page)).toBeEnabled();
});

test("failed later history page still permits previous navigation", async ({ page }) => {
  const state = await customerReviewsFixture(page);
  state.pagination = true;
  await page.goto("/dashboard/reviews");
  await expect(opener(page)).toBeEnabled();
  state.failList = true;
  await page
    .getByRole("navigation", { name: "Your reviews pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.locator(".cr-history").getByRole("alert")).toBeVisible();
  state.failList = false;
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Isolated review", exact: true }),
  ).toBeVisible();
});

test("history loading and empty states do not invent moderation status", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  state.delayList = true;
  state.rows = [];
  await page.goto("/dashboard/reviews");
  await expect(page.getByText("Checking your submissions...")).toBeVisible();
  await expect(opener(page)).toBeDisabled();
  state.delayList = false;
  state.releaseList?.();
  await expect(
    page.getByRole("heading", { name: "No reviews yet", exact: true }),
  ).toBeVisible();
  await expect(opener(page)).toBeEnabled();
});

test("long review and moderation text fit short mobile and dialog", async ({ page }) => {
  const state = await customerReviewsFixture(page);
  state.rows = [
    {
      ...customerReviewRow(),
      status: "REJECTED",
      comment: "Unbroken".repeat(250),
      moderationNote: "Response".repeat(120),
      moderatedAt: "2026-10-12T09:00:00Z",
    },
  ];
  await page.setViewportSize({ width: 320, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/reviews");
  await expect(page.getByRole("heading", { name: "Moderation update" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await compose(page);
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(481);
});

for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} cannot read the customer review collection`, async ({ page }) => {
    const state = await customerReviewsFixture(page, role);
    await page.goto("/dashboard/reviews");
    await expect(
      page.getByRole("heading", { name: "Write a review", exact: true }),
    ).toHaveCount(0);
    expect(
      state.reads.filter((value) => value.startsWith("/customers/support/reviews")),
    ).toEqual([]);
  });
}

test("transaction review draft restores its type and completed source after reload", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  await page.goto("/dashboard/reviews");
  await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
  await page
    .getByLabel("Completed record", { exact: true })
    .selectOption("c4000000-0000-4000-8000-000000000002");
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page
    .getByLabel("Your review", { exact: true })
    .fill("My completed order feedback.");
  await page.reload();
  await expect(page.getByLabel("Review type", { exact: true })).toHaveValue("ORDER");
  await expect(page.getByLabel("Completed record", { exact: true })).toHaveValue(
    "c4000000-0000-4000-8000-000000000002",
  );
  await expect(page.getByLabel("Your review", { exact: true })).toHaveValue(
    "My completed order feedback.",
  );
  await opener(page).click();
  await send(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes[0].body.targetType).toBe("ORDER");
  await page.reload();
  await expect(page.getByLabel("Your review", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Review type", { exact: true })).toHaveValue("BUSINESS");
});

for (const mode of ["empty", "error", "rejected", "uncertain"] as const) {
  test(`${mode} review state meets accessibility checks`, async ({ page }) => {
    const state = await customerReviewsFixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    if (mode === "empty") state.rows = [];
    if (mode === "error") state.failList = true;
    if (mode === "rejected")
      state.rows = [
        {
          ...customerReviewRow(),
          status: "REJECTED",
          moderationNote: "Please remove private contact information.",
          moderatedAt: "2026-10-12T09:00:00Z",
        },
      ];
    if (mode === "uncertain")
      await page.addInitScript((key) => sessionStorage.setItem(key, "pending"), marker);
    await page.goto("/dashboard/reviews");
    if (mode === "empty")
      await expect(
        page.getByRole("heading", { name: "No reviews yet", exact: true }),
      ).toBeVisible();
    if (mode === "error")
      await expect(page.locator(".cr-history").getByRole("alert")).toBeVisible();
    if (mode === "rejected")
      await expect(
        page.getByRole("heading", { name: "Moderation update" }),
      ).toBeVisible();
    if (mode === "uncertain")
      await expect(page.getByRole("region", { name: "Review recovery" })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}
