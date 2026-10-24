import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

// All identities are synthetic, served locally. No operational actions are submitted.
async function session(page: Page, role = "anonymous") {
  const state = { role, delay: 0, requests: [] as string[] };
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/"))
      state.requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.route("**/api/v1/auth/session", async (route) => {
    const current = state.role;
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (current === "anonymous" || current === "error")
      return route.fulfill({
        status: current === "anonymous" ? 401 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated UI QA",
        meta: { requestId: "help-launch-quality" },
        data: {
          user:
            current === "malformed"
              ? { id: "invalid", role: "OWNER" }
              : { id: "c9000000-0000-4000-8000-000000000001", role: current },
          mfaRequired: false,
          mfaVerifiedAt: null,
          expiresAt: "2099-01-01T00:00:00Z",
          idleExpiresAt: "2099-01-01T00:00:00Z",
        },
      },
    });
  });
  return state;
}
async function ask(page: Page, question: string) {
  await page.getByRole("button", { name: "Quick help", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "How can we help?" });
  await dialog.getByLabel("Your question").fill(question);
  await dialog.getByRole("button", { name: "Find an answer", exact: true }).click();
  return dialog;
}
for (const width of [320, 390, 768, 1024, 1440])
  test(`enquiry guidance and modal keyboard layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1024 ? 600 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await session(page);
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("401"))
        consoleErrors.push(message.text());
    });
    expect((await page.goto("/help/shop-and-collection"))?.status()).toBe(200);
    await expect(page).toHaveURL(/\/help\/shop-and-collection$/);
    await expect(page).toHaveTitle(/How do I order the right part/);
    await expect(page.locator(".ha-answer")).toContainText(
      "Online checkout is not available",
    );
    await expect(page.locator(".ha-answer")).toContainText("only a verified fit");
    await expect(page.locator(".ha-answer")).toContainText(
      "collection from the workshop",
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(os.tmpdir(), `help-launch-article-${width}.png`),
      fullPage: true,
    });
    const dialog = await ask(page, "parts compatibility stock");
    await expect(dialog.locator(".notice")).toContainText(
      "Online checkout is not available",
    );
    await expect(dialog.locator(".notice a")).toHaveAttribute("href", "/parts");
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
    await dialog.getByLabel("Your question").focus();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) => element.contains(document.activeElement)),
      ).toBe(true);
    }
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await dialog.evaluate((element) => element.contains(document.activeElement)),
      ).toBe(true);
    }
    await dialog.locator(".notice a").focus();
    const focused = await dialog.locator(".notice a").boundingBox();
    expect(focused!.y).toBeGreaterThanOrEqual(0);
    expect(focused!.y + focused!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.screenshot({
      path: path.join(os.tmpdir(), `help-launch-quick-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Quick help", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Quick help", exact: true }).click();
    await expect(dialog.getByLabel("Your question")).toHaveValue(
      "parts compatibility stock",
    );
    await expect(dialog.locator(".notice")).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await expect(page.locator("[data-nextjs-dialog-overlay]")).not.toBeVisible();
  });

test("anonymous account shortcut closes Quick Help and preserves the sign-in destination", async ({
  page,
}) => {
  await session(page);
  await page.goto("/help");
  await expect(page).toHaveTitle(/Help centre/);
  const dialog = await ask(page, "protect my account mfa");
  await dialog.getByRole("link", { name: "Sign in to continue", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fsecurity$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "How can we help?" })).not.toBeVisible();
});

for (const role of ["anonymous", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`Quick Help uses the correct account destination for ${role}`, async ({
    page,
  }) => {
    const state = await session(page, role);
    await page.goto("/help");
    const dialog = await ask(page, "protect my account mfa");
    const href =
      role === "anonymous"
        ? "/login?next=%2Fdashboard%2Fsecurity"
        : role === "CUSTOMER"
          ? "/dashboard/security"
          : "/admin/security";
    await expect(dialog.locator(".notice a")).toHaveAttribute("href", href);
    if (!["anonymous", "CUSTOMER"].includes(role)) {
      await dialog.getByLabel("Your question").fill("garage profile registration");
      await dialog.getByRole("button", { name: "Find an answer", exact: true }).click();
      await expect(dialog.locator(".notice")).toContainText(
        "available to customer accounts",
      );
      await expect(dialog.locator(".notice a")).toHaveAttribute(
        "href",
        "/contact#enquiry",
      );
    }
    expect(state.requests.filter((item) => item !== "GET /api/v1/auth/session")).toEqual(
      [],
    );
  });

for (const role of ["error", "malformed"])
  test(`Quick Help keeps the answer and recovers from ${role} identity`, async ({
    page,
  }) => {
    const state = await session(page, role);
    await page.goto("/help");
    const dialog = await ask(page, "protect my account mfa");
    await expect(
      dialog.getByRole("button", { name: "Retry account check" }),
    ).toBeVisible();
    await expect(dialog.locator(".notice a")).toHaveCount(0);
    await expect(dialog.locator(".notice")).toContainText(
      "Save newly issued recovery codes privately",
    );
    state.role = "CUSTOMER";
    state.delay = 600;
    await dialog.getByRole("button", { name: "Retry account check" }).click();
    await expect(dialog.getByRole("status")).toContainText(
      "Checking your account options",
    );
    await expect(dialog.locator(".notice a")).toHaveCount(0);
    await expect(dialog.locator(".notice a")).toHaveAttribute(
      "href",
      "/dashboard/security",
    );
    await expect(dialog.getByLabel("Your question")).toHaveValue(
      "protect my account mfa",
    );
  });

test("session changes discard stale answers and external fallback explains its destination", async ({
  page,
}) => {
  const state = await session(page, "CUSTOMER");
  await page.goto("/help");
  const dialog = await ask(page, "protect my account mfa");
  await expect(dialog.locator(".notice a")).toHaveAttribute(
    "href",
    "/dashboard/security",
  );
  state.role = "STAFF";
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(dialog).not.toBeVisible();
  await ask(page, "protect my account mfa");
  await expect(dialog.locator(".notice a")).toHaveAttribute("href", "/admin/security");
  await dialog.getByLabel("Your question").fill("zzzzzz");
  await dialog.getByRole("button", { name: "Find an answer", exact: true }).click();
  const fallback = dialog.locator(".notice a");
  await expect(fallback).toHaveAttribute("target", "_blank");
  await expect(fallback).toHaveAttribute("rel", /noopener/);
  await expect(fallback).toHaveAccessibleName(/opens in a new tab/);
  await expect(fallback).toHaveAttribute("href", /^https:\/\/wa.me\//);
});

test("Help search and article preparations explain the limited launch", async ({
  page,
}) => {
  await session(page);
  await page.goto("/help");
  await expect(page.locator(".help-intro")).toContainText("check parts compatibility");
  await page.goto("/help?q=parts");
  const result = page
    .locator(".help-answers details")
    .filter({ hasText: "How do I order the right part?" });
  await result.locator("summary").click();
  await expect(result).toContainText("Online checkout is not available");
  await page.goto("/help/pending-payments");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Can I pay online?");
  await expect(page.locator(".ha-preparation")).not.toContainText(
    "When you attempted the payment",
  );
  await expect(page.locator(".ha-action a")).toHaveAttribute("href", "/contact#enquiry");
  await page.goto("/help/booking-a-service");
  await expect(page.locator(".ha-preparation")).toContainText(
    "before confirming an appointment",
  );
});
