import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { collectionOnlyOptions } from "../fixtures/fulfillment";

const id = (n: number) => `e8000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const settings = {
  collectionEnabled: true,
  collectionAddress: collectionOnlyOptions.collection.address,
  zones: [
    {
      id: "synthetic-area",
      label: "Synthetic area",
      city: "Port Harcourt",
      state: "Rivers",
      feeKobo: "10101",
    },
  ],
};
const initial = () => ({
  id: id(3),
  key: "delivery",
  version: 4,
  approvalStatus: "APPROVED",
  source: "Synthetic approved source",
  sourceQuestion: "Q9",
  sourceSignatory: null,
  approvedByUserId: id(2),
  effectiveAt: "2026-01-01T00:00:00Z",
  recordedAt: "2026-01-01T00:00:00Z",
  approvalEvidence: "Synthetic signed delivery approval",
  settings,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Synthetic response",
      meta: { requestId: "delivery-policy-test" },
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
      return reply(route, { csrfToken: "delivery-policy-csrf-".repeat(4) });
    if (endpoint === "/admin/policies" && route.request().method() === "GET") {
      state.reads++;
      expect(url.searchParams.get("key")).toBe("delivery");
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
        "delivery-policy-csrf-".repeat(4),
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
  await page.getByLabel("Delivery fee (NGN, before tax)").fill("202.02");
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic approval TEST-DEL");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic written delivery approval TEST-001.");
}
test("owner reviews approved areas and publishes exact fees with version protection", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  await page.goto("/admin/delivery-policy");
  await expect(page).toHaveTitle(/Delivery setup/);
  await expect(page.getByLabel("Delivery fee (NGN, before tax)")).toHaveValue("101.01");
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
    path: path.join(os.tmpdir(), "allied-delivery-policy-1440.png"),
  });
  await page.getByRole("button", { name: "Review delivery approval" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/202.02 before applicable tax/)).toBeVisible();
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
    path: path.join(os.tmpdir(), "allied-delivery-policy-review-390.png"),
  });
  await dialog.getByRole("button", { name: "Approve delivery", exact: true }).click();
  await expect(page.getByText("Latest recorded version: 5.")).toBeVisible();
  expect(state.writes).toEqual([
    {
      kind: "DELIVERY",
      expectedVersion: 4,
      effectiveAt: "2027-01-05T07:30:00.000Z",
      source: "Synthetic approval TEST-DEL",
      approvalEvidence: "Synthetic written delivery approval TEST-001.",
      settings: { ...settings, zones: [{ ...settings.zones[0], feeKobo: "20202" }] },
    },
  ]);
  await expect(page.getByLabel("Written approval or reference")).toHaveValue("");
  await page.getByText("Delivery policy history", { exact: true }).click();
  await expect(page.getByRole("heading", { name: /Version 5/ })).toBeVisible();
  expect(errors).toEqual([]);
});
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot read or publish owner delivery settings`, async ({ page }) => {
    const state = await fixture(page, { role });
    await page.goto("/admin/delivery-policy");
    await expect(
      page.getByText("Super Admin access is required to configure delivery."),
    ).toBeVisible();
    expect(state.reads).toBe(0);
    expect(state.writes).toEqual([]);
  });
for (const outcome of ["stale", "interrupted", "mismatched"] as const)
  test(`delivery approval handles ${outcome} without automatic replay`, async ({
    page,
  }) => {
    const state = await fixture(page, { outcome });
    await page.goto("/admin/delivery-policy");
    await fill(page);
    await page.getByRole("button", { name: "Review delivery approval" }).click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "Approve delivery", exact: true });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(
      page.getByText("Delivery policy approved.", { exact: true }),
    ).toHaveCount(0);
    const unknown = outcome !== "stale";
    await dialog
      .getByRole("button", { name: unknown ? "Close & review record" : "Go back" })
      .click();
    if (unknown) {
      await expect(
        page.getByRole("button", { name: "Review delivery approval" }),
      ).toBeDisabled();
      state.failRead = true;
      await page.getByRole("button", { name: "Refresh delivery policy" }).click();
      await expect(page.getByText(/The approval outcome is uncertain/)).toBeVisible();
      state.failRead = false;
      await page.getByRole("button", { name: "Refresh delivery policy" }).click();
      await expect(
        page.getByRole("button", { name: "Review delivery approval" }),
      ).toBeDisabled();
    }
    expect(state.writes).toHaveLength(1);
  });
test("owner must supply an area, valid fee and written approval", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/delivery-policy");
  await fill(page);
  await page.getByRole("button", { name: "Remove area 1" }).click();
  await page.getByRole("button", { name: "Review delivery approval" }).click();
  await expect(page.getByText("Add at least one approved delivery area.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add delivery area" })).toBeFocused();
  await page.getByRole("button", { name: "Add delivery area" }).click();
  await page.getByLabel("Area name", { exact: true }).fill("Synthetic replacement");
  await page.getByLabel("City", { exact: true }).fill("Port Harcourt");
  await page.getByLabel("State", { exact: true }).fill("Rivers");
  await page.getByLabel("Delivery fee (NGN, before tax)").fill("1.005");
  await page.getByRole("button", { name: "Review delivery approval" }).click();
  await expect(page.getByLabel("Delivery fee (NGN, before tax)")).toBeFocused();
  await page.getByLabel("Delivery fee (NGN, before tax)").fill("0");
  await page.getByLabel("Written approval or reference").fill(" ".repeat(20));
  await page.getByRole("button", { name: "Review delivery approval" }).click();
  await expect(page.getByLabel("Written approval or reference")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("delivery approval drafts clear when the account changes", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/delivery-policy");
  await fill(page);
  await page.getByRole("button", { name: "Review delivery approval" }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Written approval or reference")).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  expect(state.writes).toEqual([]);
});
