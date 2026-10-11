import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { fixture, id, factor, codes } from "../fixtures/security";
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
async function fillPasswords(page: Page) {
  await page
    .getByLabel("Current password", { exact: true })
    .fill("old-isolated-passphrase");
  await page.getByLabel("New password", { exact: true }).fill("new-isolated-passphrase");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("new-isolated-passphrase");
}
async function changeAccount(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
}

test("security reads distinguish partial failure, malformed data and true empty results", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failSessions = true;
  state.malformedFactors = true;
  await page.goto("/dashboard/security");
  await expect(page.getByText("No MFA factors are registered.")).toHaveCount(0);
  await expect(page.getByText(/No active sessions were returned/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh sessions" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Replace recovery codes" }),
  ).toBeDisabled();
  state.malformedFactors = false;
  await page.getByRole("button", { name: "Refresh MFA factors" }).click();
  await expect(
    page.getByRole("heading", { name: "Test authenticator", exact: true }),
  ).toBeVisible();
  state.failSessions = false;
  await page.getByRole("button", { name: "Refresh sessions" }).click();
  await expect(page.getByRole("heading", { name: /Current browser/ })).toBeVisible();
  state.factors = [];
  await page.getByRole("button", { name: "Refresh MFA factors" }).click();
  await expect(page.getByText("No MFA factors are registered.")).toBeVisible();
});

test("password change validates confirmation, excludes credentials from review and acknowledges rotation", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/security");
  const otherTab = await page.context().newPage();
  await fixture(otherTab);
  await otherTab.goto("/dashboard/security");
  await expect(
    otherTab.getByRole("heading", { name: "Account security", exact: true }),
  ).toBeVisible();
  await page.bringToFront();
  await fillPasswords(page);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("different-passphrase");
  await page.getByRole("button", { name: "Review password change" }).click();
  await expect(page.getByLabel("Confirm new password", { exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("new-isolated-passphrase");
  await page.getByRole("button", { name: "Review password change" }).click();
  await expect(page.getByRole("dialog")).not.toContainText("old-isolated-passphrase");
  await expect(page.getByRole("dialog")).not.toContainText("new-isolated-passphrase");
  await confirm(page).click();
  await expect(
    page.getByText(/Password changed. Other sessions were signed out/),
  ).toBeVisible();
  await expect(
    otherTab.getByText("Your session changed. Verify your account to continue."),
  ).toBeVisible();
  await otherTab.close();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    endpoint: "/auth/password/change",
    body: {
      currentPassword: "old-isolated-passphrase",
      newPassword: "new-isolated-passphrase",
    },
  });
  expect(state.writes[0].csrf).toBeTruthy();
  await page.getByRole("button", { name: "Verify session again" }).click();
  await expect(page.getByRole("heading", { name: /Current browser/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out all other sessions" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Current password", { exact: true })).toBeEmpty();
});
test("cancelled password review clears secrets and restores keyboard focus", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/security");
  await fillPasswords(page);
  await page.getByRole("button", { name: "Review password change" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review password change" }),
  ).toBeFocused();
  await expect(page.getByLabel("New password", { exact: true })).toBeEmpty();
  expect(state.writes).toEqual([]);
});
for (const rejection of ["wrongPassword", "passwordValidation"] as const)
  test(`${rejection} preserves the account, clears credentials and focuses the relevant password field`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state[rejection] = true;
    await page.goto("/dashboard/security");
    await fillPasswords(page);
    await page.getByRole("button", { name: "Review password change" }).click();
    await confirm(page).click();
    await expect(confirm(page)).toBeDisabled();
    await page.getByRole("button", { name: "Go back" }).click();
    await expect(
      page.getByRole("heading", { name: "Account security", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Current password", { exact: true })).toBeEmpty();
    await expect(page.getByLabel("New password", { exact: true })).toBeEmpty();
    await expect(
      page.getByLabel(
        rejection === "wrongPassword" ? "Current password" : "New password",
        { exact: true },
      ),
    ).toBeFocused();
    await expect(page.getByText("Never echo a secret password")).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
  });
for (const outcome of ["unknown", "malformedPassword"] as const)
  test(`${outcome} password outcome cannot be acknowledged or resent`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state[outcome] = true;
    await page.goto("/dashboard/security");
    await fillPasswords(page);
    await page.getByRole("button", { name: "Review password change" }).click();
    await confirm(page).click();
    await expect(confirm(page)).toBeDisabled();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await expect(
      page.getByRole("button", { name: "Review password change" }),
    ).toBeDisabled();
    await expect(page.getByLabel("New password", { exact: true })).toBeEmpty();
    expect(state.writes).toHaveLength(1);
  });

test("individual and all-other session revocation leave current access untouched", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/security");
  await expect(
    page.getByRole("button", { name: "Sign out Current browser session" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out Test browser 11 session" }).click();
  expect(state.writes).toEqual([]);
  await confirm(page).click();
  await expect(
    page.getByRole("heading", { name: "Test browser 11", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out all other sessions" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Every other session on this account/),
  ).toBeVisible();
  await confirm(page).click();
  await expect(
    page.getByRole("button", { name: "Sign out all other sessions" }),
  ).toBeDisabled();
  expect(state.sessions.map((item) => item.id)).toEqual([id(10)]);
  expect(state.writes.map((item) => [item.endpoint, item.method, item.body])).toEqual([
    [`/auth/sessions/${id(11)}`, "DELETE", {}],
    ["/auth/sessions", "DELETE", {}],
  ]);
});
test("unknown session revocation stays locked after refresh", async ({ page }) => {
  const state = await fixture(page);
  state.unknown = true;
  await page.goto("/dashboard/security");
  await page.getByRole("button", { name: "Sign out Test browser 11 session" }).click();
  await confirm(page).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await page.getByRole("button", { name: "Refresh sessions" }).click();
  await expect(
    page.getByRole("button", { name: "Sign out Test browser 11 session" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Sign out all other sessions" }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("staff security is reachable and protects the final active factor while pending factors are not removable", async ({
  page,
}) => {
  const state = await fixture(page, "STAFF");
  state.factors.push(factor(2, "PENDING"));
  await page.goto("/admin/security");
  await expect(
    page.getByRole("link", { name: "My account security", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Test authenticator", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Test security key", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/must keep at least one active/)).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("customer may remove the final factor only after password review and cannot reuse a rejected password", async ({
  page,
}) => {
  const state = await fixture(page);
  state.wrongPassword = true;
  await page.goto("/dashboard/security");
  await page
    .getByRole("button", { name: "Remove Test authenticator", exact: true })
    .click();
  await page.getByLabel("Current password to remove this factor").fill("wrong-password");
  await page.getByRole("button", { name: "Review factor removal" }).click();
  await confirm(page).click();
  await expect(
    page.getByRole("dialog").getByText(/current password could not be verified/),
  ).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel("Current password to remove this factor")).toBeEmpty();
  state.wrongPassword = false;
  await page
    .getByLabel("Current password to remove this factor")
    .fill("correct-password");
  await page.getByRole("button", { name: "Review factor removal" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/Existing sessions and recovery codes are not revoked/),
  ).toBeVisible();
  await confirm(page).click();
  await expect(page.getByText("No MFA factors are registered.")).toBeVisible();
  expect(state.writes[1]).toMatchObject({
    endpoint: `/auth/mfa/factors/${id(1)}`,
    method: "DELETE",
    body: { password: "correct-password" },
  });
});
test("recovery codes are explicitly replaced, privately displayed and forgotten on dismissal", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/security");
  await page.getByRole("button", { name: "Replace recovery codes", exact: true }).click();
  expect(state.writes).toEqual([]);
  await expect(
    page.getByRole("dialog").getByText(/Every previous recovery code will stop working/),
  ).toBeVisible();
  await confirm(page).click();
  await expect(
    page.getByRole("heading", { name: "Save your new recovery codes", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("New recovery codes", { exact: true })).toHaveValue(
    codes.join("\n"),
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        url: location.href,
        cookie: document.cookie,
      }),
    ),
  ).not.toContain(codes[0]);
  await page.getByRole("button", { name: /I saved these codes/ }).click();
  await expect(page.getByLabel("New recovery codes", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test("unknown recovery replacement requires a new explicit review; empty code responses never claim success", async ({
  page,
}) => {
  const state = await fixture(page);
  state.malformedCodes = true;
  await page.goto("/dashboard/security");
  await page.getByRole("button", { name: "Replace recovery codes", exact: true }).click();
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(page.getByLabel("New recovery codes", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  state.malformedCodes = false;
  await page.getByRole("button", { name: "Review another code replacement" }).click();
  await expect(
    page.getByRole("dialog").getByText(/last result was unknown/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await confirm(page).click();
  await expect(page.getByLabel("New recovery codes", { exact: true })).toHaveValue(
    codes.join("\n"),
  );
  expect(state.writes).toHaveLength(2);
});
test("cross-tab account change removes secrets and ignores late recovery codes", async ({
  page,
}) => {
  const state = await fixture(page);
  state.delayCodes = true;
  await page.goto("/dashboard/security");
  await fillPasswords(page);
  await page.getByRole("button", { name: "Replace recovery codes", exact: true }).click();
  await confirm(page).click();
  await expect.poll(() => !!state.releaseCodes).toBe(true);
  await changeAccount(page);
  state.releaseCodes?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("New recovery codes", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
});
test("expired security reads clear account-scoped information", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/dashboard/security");
  await expect(
    page.getByRole("heading", { name: "Test authenticator", exact: true }),
  ).toBeVisible();
  state.expireSessions = true;
  await page.getByRole("button", { name: "Refresh sessions" }).click();
  await expect(
    page.getByRole("heading", { name: "Test authenticator", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
});
test("security forms and review dialogs fit mobile and pass automated accessibility checks", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await fixture(page);
  await page.goto("/dashboard/security");
  await expect(
    page.getByRole("heading", { name: "Test authenticator", exact: true }),
  ).toBeVisible();
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
    path: path.join(os.tmpdir(), "allied-security-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out Test browser 11 session" }).click();
  await expect(page.getByRole("button", { name: "Go back" })).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page
      .getByRole("region", { name: "Review details" })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-security-review-mobile.png"),
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Sign out Test browser 11 session" }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-security-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
