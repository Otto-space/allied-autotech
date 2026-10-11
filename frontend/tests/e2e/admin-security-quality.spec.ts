import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { fixture, factor, codes } from "../fixtures/security";
const roles = ["STAFF", "ADMIN", "SUPER_ADMIN"];
for (const [index, width] of [
  320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536,
].entries()) {
  test(`work account security fits ${width}px`, async ({ page }) => {
    await fixture(page, roles[index % roles.length]);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin/security");
    await expect(
      page.getByRole("heading", { name: "Test authenticator", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Work accounts require at least one active MFA factor."),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      await page
        .locator(".account-security :is(button,a,summary)")
        .evaluateAll((es) =>
          es
            .filter(
              (e) =>
                e.getBoundingClientRect().height > 0 &&
                e.getBoundingClientRect().height < 44,
            )
            .map((e) => e.textContent),
        ),
    ).toEqual([]);
    await page
      .getByRole("navigation", { name: "Security sections" })
      .getByRole("link", { name: "Active sessions" })
      .click();
    await expect(page.locator("#security-sessions")).toBeInViewport();
    await page.locator(".security-sessions summary").first().click();
    await expect(
      page
        .locator(".security-sessions details")
        .first()
        .getByText("Created", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
for (const width of [320, 390, 768, 1440])
  test(`work account security accessibility ${width}px`, async ({ page }) => {
    await fixture(page, "ADMIN");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/security");
    await expect(
      page.getByRole("heading", { name: "Test authenticator", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
for (const role of roles)
  test(`${role} can remove a second factor but keeps the final factor`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    state.factors.push(factor(2));
    await page.goto("/admin/security");
    await page
      .getByRole("button", { name: "Remove Test security key", exact: true })
      .click();
    await page
      .getByLabel("Current password to remove this factor")
      .fill("synthetic-secret-password");
    await page.getByRole("button", { name: "Show factor-removal password" }).click();
    await expect(
      page.getByLabel("Current password to remove this factor"),
    ).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Review factor removal" }).click();
    await expect(page.getByRole("dialog")).not.toContainText("synthetic-secret-password");
    await expect(
      page.getByLabel("Current password to remove this factor"),
    ).toHaveAttribute("type", "password");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(
      page.getByText(/must keep at least one active MFA factor/),
    ).toBeVisible();
    expect(state.writes.filter((w) => w.method === "DELETE")).toHaveLength(1);
  });
test("pending and revoked factors do not expose removal controls", async ({ page }) => {
  const state = await fixture(page, "SUPER_ADMIN");
  state.factors.push(factor(2, "PENDING"), factor(3, "REVOKED"));
  await page.goto("/admin/security");
  await expect(page.getByText("Setup pending", { exact: true })).toBeVisible();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("a customer is redirected to their dashboard", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/security");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(state.writes).toEqual([]);
});
test("pending MFA cannot expose work account security forms", async ({ page }) => {
  const state = await fixture(page, "ADMIN");
  state.pendingMfa = true;
  await page.goto("/admin/security");
  await expect(page).toHaveURL(/\/mfa$/);
  await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
  expect(state.writes.filter((w) => w.endpoint.includes("password/change"))).toEqual([]);
});
test("private recovery codes download accurately and clear on restored pages", async ({
  page,
}) => {
  await fixture(page, "ADMIN");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/admin/security");
  await page.getByRole("button", { name: "Replace recovery codes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByLabel("New recovery codes")).toHaveValue(codes.join("\n"));
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery codes", exact: true })
    .click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("allied-autotech-recovery-codes.txt");
  expect(await readFile((await file.path())!, "utf-8")).toContain(codes.join("\n"));
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
});
test("password reveals and review remain usable on a short phone", async ({ page }) => {
  await fixture(page, "STAFF");
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/admin/security");
  for (const [label, secret] of [
    ["Current password", "synthetic-old-password"],
    ["New password", "synthetic-new-password"],
    ["Confirm new password", "synthetic-new-password"],
  ])
    await page.getByLabel(label, { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Show current password", exact: true }).click();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Show new password", exact: true }).click();
  await expect(page.getByLabel("Confirm new password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Review password change" }).click();
  await expect(page.getByRole("dialog")).not.toContainText("synthetic-old-password");
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeInViewport();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
