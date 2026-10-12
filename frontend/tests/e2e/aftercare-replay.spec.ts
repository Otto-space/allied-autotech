import { test, expect, type Page } from "@playwright/test";
import { customerAftercareFixture } from "../fixtures/customer-aftercare";
const id = (n: number) => `ec000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const url = `/dashboard/orders/${id(1)}/aftercare`;
const marker = `aat:aftercare-create:v1:${id(7)}:${id(1)}`;
const reason = "Original explanation retained for request recovery.";
async function lost(page: Page, operation = "returns") {
  await page.goto(url);
  await page
    .getByLabel("Request type", { exact: true })
    .selectOption(operation === "returns" ? "RETURN" : "CANCELLATION");
  await page.getByLabel("Products to review").selectOption("ALL");
  await page.getByLabel("Reason for your request").fill(reason);
  await page.getByRole("button", { name: "Review order request", exact: true }).click();
  await page.getByRole("button", { name: "Send order request", exact: true }).click();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
}
for (const operation of ["returns", "aftercare"])
  for (const committed of [true, false])
    test(`${operation}: ${committed ? "later rejection outside history" : "uncommitted intake"} recovers once with the original details`, async ({
      page,
    }) => {
      const s = await customerAftercareFixture(page);
      s.unknownOnce = !committed;
      s.committedUnknownOnce = committed;
      await lost(page, operation);
      if (committed) {
        s.receipts.get(s.keys[0])!.status = "REJECTED";
        s.history = [];
      }
      await page.reload();
      expect(s.writes).toHaveLength(1);
      await page
        .getByLabel("Reason for your request")
        .fill("New draft must not replace the original explanation.");
      await page
        .getByRole("button", { name: "Review original request", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(reason);
      await page.getByRole("button", { name: "Go back", exact: true }).click();
      expect(s.writes).toHaveLength(1);
      await page
        .getByRole("button", { name: "Review original request", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Send or recover request", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(/Original order request confirmed/)).toBeVisible();
      if (committed)
        await expect(
          page.getByRole("region", { name: "Recovered order request" }),
        ).toContainText("Not approved");
      expect(s.writes).toHaveLength(2);
      expect(s.writes[1]).toEqual(s.writes[0]);
      expect(s.keys[1]).toBe(s.keys[0]);
      expect(s.receipts.size).toBe(1);
      expect(await page.evaluate((k) => sessionStorage.getItem(k), marker)).toBeNull();
      await page.reload();
      await expect(page.getByLabel("Reason for your request")).toHaveValue("");
    });
test("expired original request requires explicit history review without another POST", async ({
  page,
}) => {
  const s = await customerAftercareFixture(page);
  s.unknownOnce = true;
  await lost(page);
  await page.evaluate((k) => {
    const v = JSON.parse(sessionStorage.getItem(k)!);
    v.key = v.key.replace(/\.\d{13}\./, `.${Date.now() - 86400001}.`);
    sessionStorage.setItem(k, JSON.stringify(v));
  }, marker);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review original request", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "I have checked the saved requests", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Refresh order requests", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "I have checked the saved requests", exact: true }),
  ).toBeEnabled();
  expect(s.writes).toHaveLength(1);
});
test("changed account redacts original details and prevents recovery POST", async ({
  page,
}) => {
  const s = await customerAftercareFixture(page);
  s.unknownOnce = true;
  await lost(page);
  await page
    .getByRole("button", { name: "Review original request", exact: true })
    .click();
  s.sessionUserId = id(99);
  await page
    .getByRole("button", { name: "Send or recover request", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate((k) => sessionStorage.getItem(k), marker))
    .toBe("pending");
  expect(s.writes).toHaveLength(1);
});
test("unavailable ownership read hides recovery and prevents another POST", async ({
  page,
}) => {
  const s = await customerAftercareFixture(page);
  s.unknownOnce = true;
  await lost(page);
  s.failOrder = true;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review original request", exact: true }),
  ).toHaveCount(0);
  expect(s.writes).toHaveLength(1);
});
