import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerSupportFixture } from "../fixtures/customer-support";

const marker = "aat:support-create:v1:d5000000-0000-4000-8000-000000000021:enquiries";
const opener = (page: Page) =>
  page.getByRole("button", { name: "Review enquiry", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh support records", exact: true });
const acknowledge = (page: Page) =>
  page.getByRole("button", { name: "I have checked my records", exact: true });

test("related-record draft restores type, source and text then clears after success", async ({
  page,
}) => {
  const state = await customerSupportFixture(page);
  await page.goto("/dashboard/support");
  await page.getByLabel("Enquiry type").selectOption("BOOKING");
  await page
    .getByLabel("Related record", { exact: true })
    .selectOption("d5000000-0000-4000-8000-000000000033");
  await page.getByLabel("Subject", { exact: true }).fill("Booking draft");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Please check my selected booking.");
  await page.reload();
  await expect(page.getByLabel("Enquiry type")).toHaveValue("BOOKING");
  await expect(page.getByLabel("Related record", { exact: true })).toHaveValue(
    "d5000000-0000-4000-8000-000000000033",
  );
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Please check my selected booking.",
  );
  await opener(page).click();
  await send(page);
  await expect(page).toHaveURL(/\/dashboard\/support\/enquiries\//);
  expect(state.writes[0].body.bookingId).toBe("d5000000-0000-4000-8000-000000000033");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
  await page.goto("/dashboard/support");
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Enquiry type")).toHaveValue("GENERAL");
});

test("loading does not announce empty history", async ({ page }) => {
  const state = await customerSupportFixture(page);
  state.delayList = true;
  await page.goto("/dashboard/support");
  await expect(
    page.getByText("Checking support records…", { exact: true }),
  ).toBeAttached();
  await expect(page.getByText("No enquiries yet", { exact: true })).toHaveCount(0);
  await expect(opener(page)).toBeDisabled();
  state.delayList = false;
  state.releaseList.forEach((release) => release());
  await expect(
    page.getByRole("link", { name: "Test enquiry", exact: true }),
  ).toBeVisible();
});

for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} does not read customer support history`, async ({ page }) => {
    const state = await customerSupportFixture(page, role);
    await page.goto("/dashboard/support");
    await expect(page).toHaveURL(/\/admin/);
    expect(state.reads.filter((value) => value.startsWith("/customers/support"))).toEqual(
      [],
    );
  });
}

test("long records and confirmation fit a short narrow viewport with reduced motion", async ({
  page,
}) => {
  const state = await customerSupportFixture(page);
  state.records.enquiries.subject = "LongSupportReference".repeat(8);
  await page.setViewportSize({ width: 320, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/support");
  await expect(
    page.getByRole("link", { name: state.records.enquiries.subject, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await compose(page);
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.x).toBeGreaterThanOrEqual(0);
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(320);
  expect(dialog!.height).toBeLessThanOrEqual(480);
  await page.keyboard.press("Escape");
  await expect(opener(page)).toBeFocused();
});
async function compose(page: Page) {
  await page
    .getByLabel("Handling branch")
    .selectOption("d5000000-0000-4000-8000-000000000002");
  await page.getByLabel("Subject", { exact: true }).fill("Question about my booking");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Please help me confirm the details of my visit.");
  await opener(page).click();
}
async function send(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
}
async function uncertain(page: Page) {
  const state = await customerSupportFixture(page);
  state.unknown = true;
  await page.goto("/dashboard/support");
  await compose(page);
  await send(page);
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  await expect(page.getByRole("region", { name: "Submission recovery" })).toBeVisible();
  return state;
}

test("stale selected source blocks sending until its read recovers", async ({ page }) => {
  const state = await customerSupportFixture(page);
  await page.goto("/dashboard/support");
  await page.getByLabel("Enquiry type").selectOption("BOOKING");
  await page
    .getByLabel("Related record", { exact: true })
    .selectOption("d5000000-0000-4000-8000-000000000033");
  await page.getByLabel("Subject", { exact: true }).fill("Check booking");
  await page.getByLabel("Your message", { exact: true }).fill("Please check my booking.");
  await opener(page).click();
  state.failSource = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".cc-form").getByRole("alert")).toBeAttached();
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(opener(page)).toBeDisabled();
  state.failSource = false;
  await page
    .getByRole("button", { name: "Refresh related records", exact: true })
    .click();
  await expect(opener(page)).toBeEnabled();
});

test("another customer's recovery marker does not lock this account", async ({
  page,
}) => {
  await customerSupportFixture(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "aat:support-create:v1:d5000000-0000-4000-8000-000000000022:enquiries",
      "pending",
    ),
  );
  await page.goto("/dashboard/support");
  await expect(opener(page)).toBeEnabled();
  await expect(page.getByRole("region", { name: "Submission recovery" })).toHaveCount(0);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`customer care fits ${width}px`, async ({ page }) => {
    await customerSupportFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/support");
    await expect(
      page.getByRole("link", { name: "Test enquiry", exact: true }),
    ).toBeVisible();
    await expect(opener(page)).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    if (width >= 1280) {
      const form = await page.locator(".cc-form").boundingBox();
      const history = await page.locator(".cc-history").boundingBox();
      expect(Math.abs(form!.y - history!.y)).toBeLessThan(2);
      expect(history!.x).toBeGreaterThan(form!.x + form!.width);
    }
  });
}
for (const width of [390, 768, 1280, 1440]) {
  test(`customer care and confirmation accessible at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = await customerSupportFixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/dashboard/support");
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
    expect(state.writes).toHaveLength(0);
    expect(errors).toEqual([]);
  });
}
test("unknown creation survives reload, category switches and explicit history recovery", async ({
  page,
}) => {
  const state = await uncertain(page);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBe(
    "pending",
  );
  await page.getByLabel("Record category").selectOption("complaints");
  await expect(
    page.getByRole("button", { name: "Review complaint", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Record category").selectOption("enquiries");
  await page.reload();
  await expect(opener(page)).toBeDisabled();
  await expect(acknowledge(page)).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(acknowledge(page)).toBeDisabled();
  await refresh(page).click();
  await expect(acknowledge(page)).toBeEnabled();
  await acknowledge(page).click();
  await expect(opener(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
});
test("failed manual recovery cannot be replaced with background success", async ({
  page,
}) => {
  const state = await uncertain(page);
  state.failList = true;
  await refresh(page).click();
  await expect(page.locator(".cc-history").getByRole("alert")).toBeVisible();
  state.failList = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("link", { name: "Test enquiry", exact: true }),
  ).toBeVisible();
  await expect(acknowledge(page)).toBeDisabled();
  await refresh(page).click();
  await expect(acknowledge(page)).toBeEnabled();
});
test("recovery refresh resets filtered and paged history", async ({ page }) => {
  const state = await uncertain(page);
  state.listMore = true;
  await page.getByLabel("Record status").selectOption("CLOSED");
  await expect(
    page.getByText("No support records match this page and filters."),
  ).toBeVisible();
  await refresh(page).click();
  await expect(page.getByLabel("Record status")).toHaveValue("");
  await expect(acknowledge(page)).toBeEnabled();
  const pages = page.getByRole("navigation", { name: "Support records pages" });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(acknowledge(page)).toBeDisabled();
  await refresh(page).click();
  await expect(pages).toContainText("Page 1");
  await expect(acknowledge(page)).toBeEnabled();
});
for (const mode of ["identity", "role", "unavailable"] as const) {
  test(`fresh session ${mode} blocks support creation`, async ({ page }) => {
    const state = await customerSupportFixture(page);
    await page.goto("/dashboard/support");
    await compose(page);
    if (mode === "identity") state.userId = "d5000000-0000-4000-8000-000000000022";
    if (mode === "role") state.sessionRole = "STAFF";
    if (mode === "unavailable") state.failSession = true;
    await send(page);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    expect(state.writes).toHaveLength(0);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
  });
}
test("unavailable recovery storage blocks POST", async ({ page }) => {
  const state = await customerSupportFixture(page);
  await page.goto("/dashboard/support");
  await compose(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:support-create:")) throw new Error("Unavailable");
      return original.call(this, key, value);
    };
  });
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("Retry-After pauses creation after known rejection", async ({ page }) => {
  const state = await customerSupportFixture(page);
  state.rateLimit = true;
  await page.goto("/dashboard/support");
  await compose(page);
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener(page)).toBeDisabled();
  await expect(opener(page)).toBeEnabled({ timeout: 7000 });
  expect(state.writes).toHaveLength(1);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
});
test("stale history preserves rows and blocks the open confirmation", async ({
  page,
}) => {
  const state = await customerSupportFixture(page);
  await page.goto("/dashboard/support");
  await compose(page);
  state.failList = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".cc-history").getByRole("alert")).toBeAttached();
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "Test enquiry", exact: true }),
  ).toBeVisible();
  await expect(opener(page)).toBeDisabled();
});
test("failed later page still permits previous navigation", async ({ page }) => {
  const state = await customerSupportFixture(page);
  state.listMore = true;
  await page.goto("/dashboard/support");
  const pages = page.getByRole("navigation", { name: "Support records pages" });
  await expect(pages.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  state.failList = true;
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".cc-history").getByRole("alert")).toBeVisible();
  state.failList = false;
  await pages.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Test enquiry", exact: true }),
  ).toBeVisible();
  await expect(pages).toContainText("Page 1");
});
test("stale selected branch blocks confirmation and can be refreshed", async ({
  page,
}) => {
  const state = await customerSupportFixture(page);
  await page.goto("/dashboard/support");
  await compose(page);
  state.failBranch = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".cc-form").getByRole("alert")).toBeAttached();
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(opener(page)).toBeDisabled();
  state.failBranch = false;
  await page.getByRole("button", { name: "Retry branch choices", exact: true }).click();
  await expect(opener(page)).toBeEnabled();
});
for (const mode of ["empty", "error", "complaint", "uncertain"] as const) {
  test(`${mode} customer care state is accessible`, async ({ page }) => {
    if (mode === "uncertain") await uncertain(page);
    else {
      const state = await customerSupportFixture(page);
      state.empty = mode === "empty";
      state.failList = mode === "error";
      await page.goto("/dashboard/support");
      if (mode === "complaint")
        await page.getByLabel("Record category").selectOption("complaints");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".cc-history")).toHaveAttribute("aria-busy", "false");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}
