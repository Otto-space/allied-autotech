import { test, expect } from "@playwright/test";
import { allieConversationFixture } from "../fixtures/allie-conversation";

for (const width of [320, 1440]) {
  test(`Allie privacy explanation is readable before starting AI at ${width}px`, async ({
    page,
  }) => {
    const state = await allieConversationFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/help");
    await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
    const panel = page.getByRole("dialog");
    await expect(
      panel.getByRole("button", { name: "Start help conversation" }),
    ).toBeVisible();
    await panel.getByText("What is shared and kept?", { exact: true }).click();
    const explanation = panel.locator(".allie-privacy");
    await expect(explanation).toContainText("depends on scheduled cleanup");
    await expect(explanation).toContainText("15 minutes");
    await expect(explanation).toContainText("one hour overall");
    await expect(explanation).toContainText("does not promise provider deletion");
    await expect(explanation).not.toContainText(/payload|retention worker|turn receipts/);
    expect(state.writes).toHaveLength(0);
    await explanation.getByRole("link", { name: "Website privacy notice" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { name: "Privacy notice", exact: true }),
    ).toBeVisible();
    const notice = page.locator("#privacy-ai + p + p");
    await expect(notice).toContainText("depends on scheduled cleanup");
    await expect(notice).toContainText("15 minutes");
    await expect(notice).toContainText("one hour overall");
    await expect(notice).toContainText("backups follow their own policy");
    await expect(notice).toContainText("does not promise provider deletion");
    await expect(notice).not.toContainText(/payload|retention worker|turn receipts/);
    expect(state.writes).toHaveLength(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}
