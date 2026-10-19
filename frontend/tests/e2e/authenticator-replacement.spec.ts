import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { fixture, id, codes } from "../fixtures/mfa";

async function replacementFixture(page: Parameters<typeof fixture>[0]) {
  const state = await fixture(page);
  state.role = "CUSTOMER";
  state.factors = [11, 12].map((index) => ({
    id: id(index),
    name: index === 11 ? "Deleted phone entry" : "Backup authenticator",
    type: "TOTP",
    status: "ACTIVE",
    createdAt: "2026-09-17T12:00:00Z",
    verifiedAt: "2026-09-17T12:00:00Z",
    lastUsedAt: null,
  }));
  return state;
}

for (const width of [390, 1440])
  test(`re-register authenticator through recovery and replace only the selected factor at ${width}px`, async ({
    page,
  }) => {
    const state = await replacementFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/mfa");
    await page
      .getByRole("button", { name: "Set up authenticator again", exact: true })
      .click();
    await expect(page.getByText(/Verify with a saved recovery code/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Check first-factor setup" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
    await page.getByRole("button", { name: "Recovery code", exact: true }).click();
    await page
      .getByLabel("Recovery code", { exact: true })
      .fill("isolated-recovery-code");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(
      page.getByRole("heading", { name: "Replace authenticator." }),
    ).toBeVisible();
    await expect(page.getByLabel("Authenticator to replace")).toHaveValue(id(11));
    await expect(page.getByRole("button", { name: "Scan a new QR code" })).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Scan a new QR code" }).click();
    await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
    await expect(page.locator(".authenticator-qr canvas")).toBeVisible();
    expect(state.factors.map((factor) => factor.id)).toEqual([id(11), id(12)]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-authenticator-replacement-${width}.png`),
      fullPage: true,
    });
    state.rejectCode = true;
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.getByText(/This code or challenge is invalid/)).toBeVisible();
    expect(state.factors).toHaveLength(2);
    state.rejectCode = false;
    state.delay = true;
    await page.getByLabel("6-digit code").fill("654321");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.getByLabel("Authenticator to replace")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel replacement" })).toBeDisabled();
    await expect.poll(() => !!state.release).toBe(true);
    state.release?.();
    await expect(page.getByLabel("New recovery codes")).toHaveValue(codes.join("\n"));
    expect(state.writes.at(-1)?.body).toEqual({
      factorId: id(20),
      code: "654321",
      replaceFactorId: id(11),
    });
    expect(state.factors.map((factor) => factor.id)).toEqual([id(12)]);
    await page.getByRole("button", { name: /I saved these codes/ }).click();
    await expect(
      page.getByText(/Authenticator replaced. Your previous registration/),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

test("direct replacement URL cannot show a QR code before verification", async ({
  page,
}) => {
  const state = await replacementFixture(page);
  await page.goto("/mfa?replace=1");
  await expect(
    page.getByRole("button", { name: "Recovery code", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan a new QR code" })).toHaveCount(0);
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test("already verified sessions can reconnect; changing selection or restored pages discards QR details", async ({
  page,
}) => {
  const state = await replacementFixture(page);
  state.verified = true;
  await page.goto("/mfa?replace=1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Scan a new QR code" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
  await page.getByLabel("Authenticator to replace").selectOption(id(12));
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Scan a new QR code" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  expect(state.factors).toHaveLength(2);
});
