import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { profileFixture } from "../fixtures/customer-profile";
import os from "node:os";
import path from "node:path";

test("a newer tab read preserves the draft until explicit review and rebase", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const s = await profileFixture(page);
  await page.goto("/dashboard/profile");
  await expect(page).toHaveTitle(/Your profile/);
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  s.record.firstName = "Amaka";
  s.record.city = "Abuja";
  s.record.profileVersion++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("button", { name: "Reload saved details", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Ada");
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Ada");
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload saved details", exact: true }).click();
  await expect(page.locator(".cp-review")).toContainText("Amaka");
  await expect(page.locator(".cp-review")).toContainText("Abuja");
  expect(
    (await new AxeBuilder({ page }).include(".customer-profile").analyze()).violations,
  ).toEqual([]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-profile-conflict-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Keep my changes", exact: true }).click();
  await expect(page.getByLabel("City (optional)", { exact: true })).toHaveValue("Abuja");
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Ada");
  expect(s.writes.filter((w) => w.method === "PATCH")).toHaveLength(0);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Your profile has been updated.", { exact: true }).first(),
  ).toBeVisible();
  expect(s.writes.filter((w) => w.method === "PATCH")[0]?.body).toEqual({
    firstName: "Ada",
    expectedVersion: 1,
  });
  expect(s.record.city).toBe("Abuja");
  expect(s.record.profileVersion).toBe(2);
  expect(errors).toEqual([]);
});

test("a rejected stale save cannot be retried until saved details are reviewed", async ({
  page,
}) => {
  const s = await profileFixture(page);
  await page.goto("/dashboard/profile");
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  s.record.profileVersion++;
  s.record.firstName = "Amaka";
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reload saved details", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload saved details", exact: true }).click();
  await page.getByRole("button", { name: "Use saved details", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Amaka");
  expect(s.writes.filter((w) => w.method === "PATCH")).toHaveLength(1);
});

test("a lost response followed by reload and review does not create a second update", async ({
  page,
}) => {
  const s = await profileFixture(page);
  s.saveMode = "lost";
  await page.goto("/dashboard/profile");
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reload saved details", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload saved details", exact: true }).click();
  await page.getByRole("button", { name: "Keep my changes", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Ada");
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  expect(s.writes.filter((w) => w.method === "PATCH")).toHaveLength(1);
});
