import { expect, type Page } from "@playwright/test";
export async function showNotificationSettings(page: Page) {
  const close = page.getByRole("button", { name: "Hide settings", exact: true });
  if (await close.isVisible()) return;
  const open = page.getByRole("button", { name: "Notification settings", exact: true });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole("heading", { name: "Delivery preferences", exact: true })).toBeVisible();
}
