import { expect, test } from "@playwright/test";
import { notificationsFixture } from "../fixtures/customer-notifications";
const slot = "aat:notification-write:v1:b3000000-0000-4000-8000-000000000020:preferences";
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role}: reload recovery preserves a later withdrawal`, async ({ page }) => {
    const state = await notificationsFixture(page, role);
    state.dropCommitted = true;
    await page.goto(
      role === "CUSTOMER" ? "/dashboard/notifications" : "/admin/notifications",
    );
    await page
      .getByRole("button", { name: "Enable marketing email", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    expect(state.writes).toHaveLength(1);
    expect(state.preferences).toHaveLength(1);
    const first = state.writes[0];
    state.preferences[0] = { ...state.preferences[0], version: 2, enabled: false };
    await page.reload();
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    expect(state.writes).toHaveLength(1);
    await page
      .getByRole("button", { name: "Review original preference change", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Enabled");
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    expect(state.writes).toHaveLength(1);
    await page
      .getByRole("button", { name: "Review original preference change", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Send or recover preference", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1].key).toBe(first.key);
    expect(state.writes[1].body).toEqual(first.body);
    expect(state.preferences[0]).toMatchObject({ enabled: false, version: 2 });
    expect(state.receipts.size).toBe(1);
    await expect(
      page.getByText(
        "Original change confirmed. A newer preference is already saved; it has been preserved.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), slot)).toBeNull();
  });
test("stale confirmation conflicts and requires a fresh reviewed revision", async ({
  page,
}) => {
  const state = await notificationsFixture(page);
  await page.goto("/dashboard/notifications");
  await page.getByRole("button", { name: "Enable marketing email", exact: true }).click();
  state.preferences = [
    {
      category: "MARKETING",
      channel: "EMAIL",
      enabled: false,
      version: 1,
      consentedAt: null,
      updatedAt: new Date().toISOString(),
    },
  ];
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes[0].body.expectedVersion).toBe(0);
  expect(state.preferences[0].version).toBe(1);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByRole("button", { name: "Enable marketing email", exact: true }).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes[1].body.expectedVersion).toBe(1);
  expect(state.preferences[0].version).toBe(2);
});
