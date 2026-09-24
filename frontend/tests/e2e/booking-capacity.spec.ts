import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
const id = (n: number) => `e3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic response",
      data,
      meta: { requestId: "capacity-test" },
    },
  });
async function fixture(
  page: Page,
  handler: (route: Route, endpoint: string) => Promise<boolean | void>,
  role = "SUPER_ADMIN",
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(2),
        user: { id: id(3), email: "owner@example.test", role },
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-24T09:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "capacity-csrf-token-".repeat(4) });
    if (endpoint === "/admin/branches")
      return reply(route, {
        items: [{ id: id(1), name: "Synthetic workshop", isActive: true }],
      });
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
async function enterPolicy(page: Page) {
  await page.getByLabel("Maximum confirmed bookings per day").fill("4");
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Tuesday", { exact: true }).check();
  await page.getByLabel("Closed dates (optional)").fill("2027-01-01\n2027-04-02");
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic workshop owner approval");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic signed capacity approval TEST-001.");
}
function recorded(body: Record<string, unknown>) {
  return {
    id: id(4),
    key: `booking-capacity:${id(1)}`,
    version: 1,
    approvalStatus: "APPROVED",
    source: body.source,
    sourceQuestion: "Q5",
    sourceSignatory: null,
    approvedByUserId: id(3),
    effectiveAt: body.effectiveAt,
    recordedAt: new Date().toISOString(),
    settings: body.settings,
    approvalEvidence: body.approvalEvidence,
  };
}
test("owner publishes reviewed branch capacity and sees the actual recorded history", async ({
  page,
}) => {
  const history: ReturnType<typeof recorded>[] = [];
  const writes: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  await fixture(page, async (route, endpoint) => {
    if (endpoint !== "/admin/policies") return;
    if (route.request().method() === "GET") {
      expect(new URL(route.request().url()).searchParams.get("key")).toBe(
        `booking-capacity:${id(1)}`,
      );
      await reply(route, history);
    } else {
      const body = route.request().postDataJSON();
      writes.push(body);
      history.push(recorded(body));
      await reply(route, history[0]);
    }
    return true;
  });
  await page.goto("/admin/booking-capacity");
  await expect(page).toHaveTitle(/Booking capacity/);
  await page.getByLabel("Workshop branch").selectOption(id(1));
  await expect(page.getByText(/No booking capacity policy is recorded/)).toBeVisible();
  await expect(page.getByLabel("Maximum confirmed bookings per day")).toHaveValue("");
  await expect(page.getByLabel("Monday", { exact: true })).not.toBeChecked();
  await enterPolicy(page);
  await page
    .getByLabel("Effective date and time (Lagos time, optional)")
    .fill("2027-01-05T08:30");
  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Review capacity approval" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Monday, Tuesday", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
  expect(writes).toEqual([]);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-capacity-review-390.png"),
  });
  await dialog.getByRole("button", { name: "Approve capacity", exact: true }).click();
  await expect(page.getByText("Latest recorded version: 1.")).toBeVisible();
  expect(writes).toEqual([
    {
      kind: "BRANCH_CAPACITY",
      branchId: id(1),
      expectedVersion: 0,
      effectiveAt: "2027-01-05T07:30:00.000Z",
      source: "Synthetic workshop owner approval",
      approvalEvidence: "Synthetic signed capacity approval TEST-001.",
      settings: {
        dailyLimit: 4,
        openingDays: [1, 2],
        opensAt: "08:00",
        closesAt: "18:00",
        holidays: ["2027-01-01", "2027-04-02"],
        timezone: "Africa/Lagos",
      },
    },
  ]);
  await page.getByText("Policy history", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Version 1 · APPROVED" })).toBeVisible();
  await expect(page.getByLabel("Written approval or reference")).toHaveValue("");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(os.tmpdir(), "allied-capacity-1440.png") });
  expect(errors).toEqual([]);
});
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot load or approve branch capacity`, async ({ page }) => {
    let reads = 0;
    await fixture(
      page,
      async (route, endpoint) => {
        if (endpoint.startsWith("/admin/")) {
          reads++;
          await reply(route, []);
          return true;
        }
      },
      role,
    );
    await page.goto("/admin/booking-capacity");
    await expect(page.getByText(/Super Admin access is required/)).toBeVisible();
    await expect(page.getByLabel("Workshop branch")).toHaveCount(0);
    expect(reads).toBe(0);
  });
for (const outcome of ["stale", "interrupted", "mismatched"] as const)
  test(`capacity approval handles a ${outcome} outcome without a second submission`, async ({
    page,
  }) => {
    let writes = 0;
    await fixture(page, async (route, endpoint) => {
      if (endpoint !== "/admin/policies") return;
      if (route.request().method() === "GET") await reply(route, []);
      else {
        writes++;
        if (outcome === "interrupted") await route.abort("failed");
        else if (outcome === "stale")
          await route.fulfill({
            status: 409,
            json: { success: false, error: { code: "CONFLICT" } },
          });
        else
          await reply(route, {
            ...recorded(route.request().postDataJSON()),
            key: `booking-capacity:${id(99)}`,
          });
      }
      return true;
    });
    await page.goto("/admin/booking-capacity");
    await page.getByLabel("Workshop branch").selectOption(id(1));
    await enterPolicy(page);
    await page.getByRole("button", { name: "Review capacity approval" }).click();
    const confirm = page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve capacity", exact: true });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(
      page.getByText("Booking capacity approved.", { exact: true }),
    ).toHaveCount(0);
    if (outcome !== "stale") {
      await page.getByRole("button", { name: "Close & review record" }).click();
      await expect(
        page.getByRole("button", { name: "Review capacity approval" }),
      ).toBeDisabled();
    }
    expect(writes).toBe(1);
  });
test("capacity validation focuses missing opening days and rejects malformed closed dates", async ({
  page,
}) => {
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/policies") {
      if (route.request().method() === "POST") writes++;
      await reply(route, []);
      return true;
    }
  });
  await page.goto("/admin/booking-capacity");
  await page.getByLabel("Workshop branch").selectOption(id(1));
  await enterPolicy(page);
  await page.getByLabel("Monday", { exact: true }).uncheck();
  await page.getByLabel("Tuesday", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Review capacity approval" }).click();
  await expect(page.getByLabel("Sunday", { exact: true })).toBeFocused();
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Closed dates (optional)").fill("2027-02-30");
  await page.getByRole("button", { name: "Review capacity approval" }).click();
  await expect(page.getByLabel("Closed dates (optional)")).toBeFocused();
  expect(writes).toBe(0);
});
