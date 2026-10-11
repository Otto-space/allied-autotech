import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, codes } from "../fixtures/security";
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`customer security fits ${width}px`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dashboard/security");
    await expect(
      page.getByRole("heading", { name: "Test authenticator", exact: true }),
    ).toBeVisible();
    for (const control of await page
      .locator(
        ".customer-security button,.customer-security a,.customer-security input,.customer-security summary",
      )
      .all())
      if (await control.isVisible())
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page
      .getByRole("navigation", { name: "Security sections" })
      .getByRole("link", { name: "Active sessions" })
      .click();
    await expect(page.locator("#security-sessions")).toBeInViewport();
    const detail = page.locator(".security-sessions details").first();
    await detail.locator("summary").click();
    await expect(detail.getByText("Created", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
for (const width of [320, 390, 768, 1440])
  test(`customer security accessibility ${width}px`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/security");
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
test("password reveals are independent and a review never exposes credentials", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/security");
  await page
    .getByLabel("Current password", { exact: true })
    .fill("private-current-passphrase");
  await page.getByLabel("New password", { exact: true }).fill("private-new-passphrase");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("private-new-passphrase");
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
  await expect(page.getByLabel("Current password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await expect(page.getByRole("dialog")).not.toContainText("private-");
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  for (const label of ["Current password", "New password", "Confirm new password"])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("private-");
});
test("factor password reveal does not bypass review and clears on cancel", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/security");
  await page
    .getByRole("button", { name: "Remove Test authenticator", exact: true })
    .click();
  await page
    .getByLabel("Current password to remove this factor")
    .fill("private-factor-password");
  await page.getByRole("button", { name: "Show factor-removal password" }).click();
  await expect(page.getByLabel("Current password to remove this factor")).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Review factor removal" }).click();
  await expect(page.getByLabel("Current password to remove this factor")).toHaveAttribute(
    "type",
    "password",
  );
  await expect(page.getByRole("dialog")).not.toContainText("private-factor-password");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Current password to remove this factor")).toHaveValue("");
  expect(state.writes).toEqual([]);
});
test("restoring a page clears recovery codes and requires session verification", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/dashboard/security");
  await page.getByRole("button", { name: "Replace recovery codes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByLabel("New recovery codes")).toHaveValue(codes.join("\n"));
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
});
test("password review and factor removal remain usable at short heights", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/dashboard/security");
  await page
    .getByLabel("Current password", { exact: true })
    .fill("private-old-passphrase");
  await page.getByLabel("New password", { exact: true }).fill("private-new-passphrase");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("private-new-passphrase");
  await page.getByRole("button", { name: "Review password change" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("hidden pages re-mask each revealed password", async ({ page }) => {
  await fixture(page);
  await page.goto("/dashboard/security");
  await page.getByRole("button", { name: "Show current password", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByLabel("Current password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
});

for (const role of ["CUSTOMER", "STAFF"]) {
  test(`${role} can review and revoke a new session without activity`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    state.sessions[1].lastUsedAt = null;
    await page.goto(role === "CUSTOMER" ? "/dashboard/security" : "/admin/security");
    await expect(page.getByText("No activity recorded", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Sign out Test browser 11 session", exact: true })
      .click();
    const review = page.getByRole("dialog");
    await expect(review.getByText("No activity recorded", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign out Test browser 11 session", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Current browser", { exact: false })).toBeVisible();
  });
}
