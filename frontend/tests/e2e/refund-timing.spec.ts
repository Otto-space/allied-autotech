import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";

const id = (n: number) => `e8000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const settings = {
  startEvent: "REQUESTED",
  businessDays: 10,
  countingConvention: "EXCLUDE_START_SAME_LOCAL_TIME",
  bankingDays: [1, 2, 3, 4, 5],
  holidays: ["2026-10-01"],
  timezone: "Africa/Lagos",
};
const initial = () => ({
  id: id(3),
  key: "bank_refund_clock",
  version: 4,
  approvalStatus: "APPROVED",
  source: "Synthetic approved source",
  sourceQuestion: "Q6",
  sourceSignatory: null,
  approvedByUserId: id(2),
  effectiveAt: "2026-01-01T00:00:00Z",
  recordedAt: "2026-01-01T00:00:00Z",
  approvalEvidence: "Synthetic signed refund timing",
  settings,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Synthetic response",
      meta: { requestId: "refund-timing-test" },
    },
  });
async function fixture(
  page: Page,
  options: { role?: string; outcome?: "stale" | "interrupted" | "mismatched" } = {},
) {
  const state = {
    reads: 0,
    writes: [] as Record<string, unknown>[],
    history: [initial()],
    failRead: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(1),
        user: {
          id: id(2),
          email: "synthetic@example.test",
          role: options.role ?? "SUPER_ADMIN",
        },
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-24T09:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "refund-timing-csrf-".repeat(4) });
    if (endpoint === "/admin/policies" && route.request().method() === "GET") {
      state.reads++;
      expect(url.searchParams.get("key")).toBe("bank_refund_clock");
      expect(url.searchParams.get("limit")).toBe("100");
      if (state.failRead)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      return reply(route, state.history);
    }
    if (endpoint === "/admin/policies" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.writes.push(body);
      expect(route.request().headers()["x-csrf-token"]).toBe(
        "refund-timing-csrf-".repeat(4),
      );
      if (options.outcome === "stale")
        return route.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      if (options.outcome === "interrupted") return route.abort("failed");
      const saved = {
        ...initial(),
        id: id(4),
        version: 5,
        source: body.source,
        approvalEvidence: body.approvalEvidence,
        effectiveAt: body.effectiveAt,
        settings: body.settings,
      };
      state.history = [saved, ...state.history];
      return reply(
        route,
        options.outcome === "mismatched" ? { ...saved, version: 6 } : saved,
      );
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
async function fill(page: Page) {
  await page.getByLabel("I confirm that these banking days").check();
  await page.getByLabel("Clock starts when", { exact: true }).selectOption("APPROVED");
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic approval TEST-CLOCK");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic written refund timing TEST-001.");
}
test("owner reviews banking calendar and publishes exact settings with version protection", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  await page.goto("/admin/refund-timing");
  await expect(page).toHaveTitle(/Bank refund timing/);
  await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveValue(
    "REQUESTED",
  );
  await fill(page);
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2027-01-05T08:30");
  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-refund-timing-1440.png"),
  });
  await page.getByRole("button", { name: "Review refund timing" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Refund approved", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
  expect(state.writes).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-refund-timing-review-390.png"),
  });
  await dialog
    .getByRole("button", { name: "Approve refund timing", exact: true })
    .click();
  await expect(page.getByText("Latest recorded version: 5.")).toBeVisible();
  expect(state.writes).toEqual([
    {
      kind: "BANK_REFUND_CLOCK",
      expectedVersion: 4,
      effectiveAt: "2027-01-05T07:30:00.000Z",
      source: "Synthetic approval TEST-CLOCK",
      approvalEvidence: "Synthetic written refund timing TEST-001.",
      settings: { ...settings, startEvent: "APPROVED" },
    },
  ]);
  await expect(page.getByLabel("Written approval or reference")).toHaveValue("");
  await page.getByText("Refund timing history", { exact: true }).click();
  await expect(page.getByRole("heading", { name: /Version 5/ })).toBeVisible();
  expect(errors).toEqual([]);
});
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot read or publish owner refund timing`, async ({ page }) => {
    const state = await fixture(page, { role });
    await page.goto("/admin/refund-timing");
    await expect(
      page.getByText("Super Admin access is required to configure bank refund timing."),
    ).toBeVisible();
    expect(state.reads).toBe(0);
    expect(state.writes).toEqual([]);
  });
for (const outcome of ["stale", "interrupted", "mismatched"] as const)
  test(`refund timing handles ${outcome} without automatic replay`, async ({ page }) => {
    const state = await fixture(page, { outcome });
    await page.goto("/admin/refund-timing");
    await fill(page);
    await page.getByRole("button", { name: "Review refund timing" }).click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", {
      name: "Approve refund timing",
      exact: true,
    });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(
      page.getByText("Bank refund timing approved.", { exact: true }),
    ).toHaveCount(0);
    const unknown = outcome !== "stale";
    await dialog
      .getByRole("button", { name: unknown ? "Close & review record" : "Go back" })
      .click();
    if (unknown) {
      await expect(
        page.getByRole("button", { name: "Review refund timing" }),
      ).toBeDisabled();
      state.failRead = true;
      await page.getByRole("button", { name: "Refresh refund timing" }).click();
      await expect(page.getByText(/The approval outcome is uncertain/)).toBeVisible();
      state.failRead = false;
      await page.getByRole("button", { name: "Refresh refund timing" }).click();
      await expect(
        page.getByRole("button", { name: "Review refund timing" }),
      ).toBeDisabled();
    }
    expect(state.writes).toHaveLength(1);
  });
test("calendar validation requires weekdays, valid dates and written approval", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/admin/refund-timing");
  await fill(page);
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    await page.getByLabel(day, { exact: true }).uncheck();
  await page.getByRole("button", { name: "Review refund timing" }).click();
  await expect(page.getByText("Choose at least one approved banking day.")).toBeVisible();
  await expect(page.getByLabel("Sunday", { exact: true })).toBeFocused();
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Excluded holiday dates").fill("2026-02-30");
  await page.getByRole("button", { name: "Review refund timing" }).click();
  await expect(page.getByLabel("Excluded holiday dates")).toBeFocused();
  await page.getByLabel("Excluded holiday dates").fill("");
  await page.getByLabel("Written approval or reference").fill(" ".repeat(20));
  await page.getByRole("button", { name: "Review refund timing" }).click();
  await expect(page.getByLabel("Written approval or reference")).toBeFocused();
  expect(state.writes).toEqual([]);
});

test("refund timing drafts clear when the account changes", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/refund-timing");
  await fill(page);
  await page.getByRole("button", { name: "Review refund timing" }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Written approval or reference")).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("missing configuration never invents an approved calendar", async ({ page }) => {
  const state = await fixture(page);
  state.history = [];
  await page.goto("/admin/refund-timing");
  await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page
    .getByLabel("Clock starts when", { exact: true })
    .selectOption("TRANSFER_RECORDED");
  await page.getByLabel("Saturday", { exact: true }).check();
  await page.getByLabel("I confirm that these banking days").check();
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic approval TEST-CLOCK");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic approved banking calendar with no holidays.");
  await page.getByRole("button", { name: "Review refund timing" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(page.getByRole("button", { name: "Review refund timing" })).toBeFocused();
  await expect(page.getByLabel("Clock starts when", { exact: true })).toHaveValue(
    "TRANSFER_RECORDED",
  );
  expect(state.writes).toEqual([]);
});

test("customer cannot load the owner timing screen or policy history", async ({
  page,
}) => {
  const state = await fixture(page, { role: "CUSTOMER" });
  await page.goto("/admin/refund-timing");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Bank refund timing" })).toHaveCount(0);
  expect(state.reads).toBe(0);
  expect(state.writes).toEqual([]);
});
