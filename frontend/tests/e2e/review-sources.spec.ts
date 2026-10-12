import { expect, test } from "@playwright/test";
import { customerReviewsFixture, customerReviewRow } from "../fixtures/customer-reviews";

for (const [target, id] of [
  ["PRODUCT", "c4000000-0000-4000-8000-000000000003"],
  ["SERVICE", "c4000000-0000-4000-8000-000000000005"],
  ["ORDER", "c4000000-0000-4000-8000-000000000002"],
  ["VEHICLE_TRANSACTION", "c4000000-0000-4000-8000-000000000007"],
]) {
  test(`${target}: selects an authoritative source and checks it again before submission`, async ({
    page,
  }) => {
    const state = await customerReviewsFixture(page);
    await page.goto("/dashboard/reviews");
    await page.getByLabel("Review type", { exact: true }).selectOption(target);
    await page.getByLabel("Completed record", { exact: true }).selectOption(id);
    await page.getByLabel("Rating", { exact: true }).selectOption("5");
    await page
      .getByLabel("Your review", { exact: true })
      .fill("Carefully handled purchase.");
    await page.getByRole("button", { name: "Review submission", exact: true }).click();
    await page
      .getByRole("button", { name: "Submit for moderation", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body.targetType).toBe(target);
    expect(state.reads).toContain(
      `/customers/support/review-sources?targetType=${target}&sourceId=${id}`,
    );
    expect(
      state.reads.some((path) =>
        /^\/customers\/(orders|bookings|vehicle-transactions)/.test(path),
      ),
    ).toBe(false);
  });
}

test("source reviewed after selection blocks submission without losing the draft", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  await page.goto("/dashboard/reviews");
  await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
  await page
    .getByLabel("Completed record", { exact: true })
    .selectOption("c4000000-0000-4000-8000-000000000002");
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page.getByLabel("Your review", { exact: true }).fill("Preserve my feedback.");
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
  state.sourceChanged = true;
  await page.getByRole("button", { name: "Submit for moderation", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Your review", { exact: true })).toHaveValue(
    "Preserve my feedback.",
  );
});

test("reviewed sources are unavailable regardless of history filter and pagination remains usable", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  state.rows = [
    {
      ...customerReviewRow(),
      targetType: "ORDER",
      status: "REJECTED",
      orderId: "c4000000-0000-4000-8000-000000000002",
    },
  ];
  await page.goto("/dashboard/reviews");
  await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
  await expect(
    page.getByText("No completed records available for review on this page."),
  ).toBeVisible();
  state.rows = [];
  state.sourcePagination = true;
  await page
    .getByRole("button", { name: "Refresh completed records", exact: true })
    .click();
  const navigation = page.getByRole("navigation", { name: "Completed records pages" });
  await navigation.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("No completed records available for review on this page."),
  ).toBeVisible();
  await navigation.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByLabel("Completed record", { exact: true }).locator("option"),
  ).toHaveCount(2);
  state.malformedSource = true;
  await page
    .getByRole("button", { name: "Refresh completed records", exact: true })
    .click();
  await expect(page.locator(".cr-source").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review submission", exact: true }),
  ).toBeDisabled();
});
