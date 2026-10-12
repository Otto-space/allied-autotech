import { expect, test, type Page } from "@playwright/test";
import { customerReviewsFixture } from "../fixtures/customer-reviews";

const marker = "aat:review-write:v1:c4000000-0000-4000-8000-000000000011";
async function submit(page: Page) {
  await page.getByLabel("Rating", { exact: true }).selectOption("5");
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Keep my exact original feedback.");
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  await page.getByRole("button", { name: "Submit for moderation", exact: true }).click();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
}
async function openRecovery(page: Page) {
  await page
    .getByRole("button", { name: "Review original submission", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Keep my exact original feedback.",
  );
}

for (const target of ["BUSINESS", "ORDER"]) {
  test(`${target}: dropped committed response recovers original key after reload and moderation`, async ({
    page,
  }) => {
    const state = await customerReviewsFixture(page);
    state.rows = [];
    state.dropCommitted = true;
    await page.goto("/dashboard/reviews");
    if (target === "ORDER") {
      await page.getByLabel("Review type", { exact: true }).selectOption(target);
      await page
        .getByLabel("Completed record", { exact: true })
        .selectOption("c4000000-0000-4000-8000-000000000002");
    }
    await submit(page);
    const original = state.writes[0];
    expect(
      JSON.parse((await page.evaluate((key) => sessionStorage.getItem(key), marker))!)
        .key,
    ).toBe(original.key);
    state.rows[0].status = "APPROVED";
    state.rows[0].version = 1;
    await page.reload();
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    expect(state.writes).toHaveLength(1);
    await expect(
      page.getByRole("button", { name: "I have checked my submissions", exact: true }),
    ).toHaveCount(0);
    await openRecovery(page);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    expect(state.writes).toHaveLength(1);
    await openRecovery(page);
    await page
      .getByRole("button", { name: "Send or recover review", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1].key).toBe(original.key);
    expect(state.writes[1].body).toEqual(original.body);
    expect(state.rows).toHaveLength(1);
    await expect(page.getByRole("region", { name: "Review recovery" })).toHaveCount(0);
    await expect(page.getByLabel("Your review", { exact: true })).toHaveValue("");
    expect(await page.evaluate((key) => sessionStorage.getItem(key), marker)).toBeNull();
  });
}

test("an uncommitted original request is sent once only after explicit recovery confirmation", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  state.rows = [];
  state.unknown = true;
  await page.goto("/dashboard/reviews");
  await submit(page);
  await page.reload();
  state.unknown = false;
  await openRecovery(page);
  await page.getByRole("button", { name: "Send or recover review", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.rows).toHaveLength(1);
  expect(state.writes[1].key).toBe(state.writes[0].key);
});

test("expired recovery becomes history-only and never sends a fresh key automatically", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  state.unknown = true;
  await page.goto("/dashboard/reviews");
  await submit(page);
  await page.evaluate((key) => {
    const value = JSON.parse(sessionStorage.getItem(key)!);
    value.key = value.key.replace(/\.\d{13}\./, `.${Date.now() - 25 * 3600000}.`);
    sessionStorage.setItem(key, JSON.stringify(value));
  }, marker);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review original submission", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "I have checked my submissions", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Refresh submissions", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "I have checked my submissions", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

test("account change during recovery cannot send the retained request", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  state.unknown = true;
  await page.goto("/dashboard/reviews");
  await submit(page);
  await openRecovery(page);
  state.userId = "c4000000-0000-4000-8000-000000000099";
  await page.getByRole("button", { name: "Send or recover review", exact: true }).click();
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), marker)).toBe("pending");
  expect(state.writes).toHaveLength(1);
});
