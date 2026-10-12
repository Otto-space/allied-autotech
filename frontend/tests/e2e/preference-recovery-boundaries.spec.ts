import { expect, test } from "@playwright/test";
import { notificationsFixture } from "../fixtures/customer-notifications";
const slot = "aat:notification-write:v1:b3000000-0000-4000-8000-000000000020:preferences";
for (const mode of ["expired", "account changed"] as const)
  test(`${mode}: original preference request is never sent under invalid recovery state`, async ({
    page,
  }) => {
    const state = await notificationsFixture(page);
    state.unknown = true;
    await page.goto("/dashboard/notifications");
    await page
      .getByRole("button", { name: "Enable marketing email", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    if (mode === "expired") {
      await page.evaluate((key) => {
        const intent = JSON.parse(sessionStorage.getItem(key)!);
        intent.key = intent.key.replace(/\.\d{13}\./, `.${Date.now() - 86400001}.`);
        sessionStorage.setItem(key, JSON.stringify(intent));
      }, slot);
      await page.reload();
      await expect(
        page.getByRole("button", {
          name: "Review original preference change",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "I've checked preferences", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Refresh preferences", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "I've checked preferences", exact: true }),
      ).toBeEnabled();
    } else {
      await page
        .getByRole("button", { name: "Review original preference change", exact: true })
        .click();
      state.sessionUserId = "b3000000-0000-4000-8000-000000000099";
      await page
        .getByRole("button", { name: "Send or recover preference", exact: true })
        .click();
      await expect(
        page.getByText("Your session changed. Verify your account to continue."),
      ).toBeVisible();
      expect(await page.evaluate((key) => sessionStorage.getItem(key), slot)).toBe(
        "pending",
      );
    }
    expect(state.writes).toHaveLength(1);
  });
