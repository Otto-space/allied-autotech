import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { AuditEvent } from "@/lib/api/audit-schemas";
const id = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const eventFixture = (): AuditEvent => ({
  id: id(1),
  userId: id(2),
  action: "UPDATE",
  entityType: "ORDER",
  entityId: id(3),
  requestId: "isolated-audit-request",
  createdAt: time,
  user: { role: "ADMIN" },
  oldValues: null,
  newValues: {
    enabled: false,
    count: 0,
    description: "",
    missing: null,
    literal: '<img src="https://untrusted.invalid/pixel" onerror="alert(1)">',
    lines: Array.from({ length: 80 }, (_, n) => ({
      line: n,
      note: "Recorded detail " + "x".repeat(120),
    })),
  },
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "audit-test" },
    },
  });
async function fixture(
  page: Page,
  handler: (route: Route) => Promise<void>,
  role = "ADMIN",
  mfaVerifiedAt: string | null = time,
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/admin/audit") return handler(route);
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: { id: id(11), email: "audit@example.test", role },
        mfaRequired: true,
        mfaVerifiedAt,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    await route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
test("staff cannot read audit events or see the administrator navigation link", async ({
  page,
}) => {
  let calls = 0;
  await fixture(
    page,
    async (route) => {
      calls++;
      await reply(route, { items: [] });
    },
    "STAFF",
  );
  await page.goto("/admin/audit");
  await expect(
    page.getByText("Administrator access is required to view these records."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit log", exact: true })).toHaveCount(0);
  expect(calls).toBe(0);
});
test("administrator without verified MFA is redirected before any audit read", async ({
  page,
}) => {
  let calls = 0;
  await fixture(
    page,
    async (route) => {
      calls++;
      await reply(route, { items: [] });
    },
    "ADMIN",
    null,
  );
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/mfa$/);
  await expect(page.getByRole("heading", { name: "Audit log", exact: true })).toHaveCount(
    0,
  );
  expect(calls).toBe(0);
});
test("failed reads recover, cursor pages work and applied private filters reset pagination", async ({
  page,
}) => {
  let fail = true;
  const queries: Record<string, string>[] = [];
  await fixture(page, async (route) => {
    expect(route.request().method()).toBe("GET");
    const query = Object.fromEntries(new URL(route.request().url()).searchParams);
    queries.push(query);
    if (fail)
      return void (await route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      }));
    await reply(route, {
      items: query.action
        ? []
        : [{ ...eventFixture(), id: query.cursor ? id(4) : id(1) }],
      ...(query.cursor || query.action ? {} : { nextCursor: id(1) }),
    });
  });
  await page.goto("/admin/audit");
  await expect(
    page.getByRole("alert").filter({ hasText: "The request could not be completed" }),
  ).toBeVisible();
  await expect(page.getByText("No audit events on this page")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Refresh audit log" }).click();
  await expect(page.getByRole("heading", { name: "UPDATE · ORDER" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Audit log pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText(id(4), { exact: true })).toBeVisible();
  expect(queries.at(-1)?.cursor).toBe(id(1));
  await page.getByLabel("Action", { exact: true }).selectOption("READ");
  await page.getByLabel("Record type", { exact: true }).selectOption("USER");
  await page.getByLabel("User reference (optional)").fill(id(20));
  await page.getByLabel("Record reference (optional)").fill("private-record-reference");
  await page.getByLabel("Request reference (optional)").fill("private-request-reference");
  await page.getByRole("button", { name: "Apply audit filters" }).click();
  await expect(page.getByText("No events match these filters")).toBeVisible();
  expect(queries.at(-1)).toEqual({
    limit: "25",
    userId: id(20),
    action: "READ",
    entityType: "USER",
    entityId: "private-record-reference",
    requestId: "private-request-reference",
  });
  expect(new URL(page.url()).search).toBe("");
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear audit filters" }).click();
  await expect(page.getByRole("heading", { name: "UPDATE · ORDER" })).toBeVisible();
  expect(queries.at(-1)).toEqual({ limit: "25" });
});
test("invalid references and long ranges focus their field without fetching; one-sided dates retain Lagos offset", async ({
  page,
}) => {
  const queries: Record<string, string>[] = [];
  await fixture(page, async (route) => {
    queries.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    await reply(route, { items: [] });
  });
  await page.goto("/admin/audit");
  await expect(page.getByText("No audit events on this page")).toBeVisible();
  const initialReads = queries.length;
  await page.getByLabel("User reference (optional)").fill("invalid");
  await page.getByRole("button", { name: "Apply audit filters" }).click();
  await expect(page.getByLabel("User reference (optional)")).toBeFocused();
  expect(queries).toHaveLength(initialReads);
  await page.getByLabel("User reference (optional)").fill("");
  await page.getByLabel("From date and time (Lagos)").fill("2026-01-01T10:00");
  await page.getByLabel("Through date and time (Lagos)").fill("2026-04-01T10:01");
  await page.getByRole("button", { name: "Apply audit filters" }).click();
  await expect(page.getByText("Keep a date range within 90 days.")).toBeVisible();
  await expect(page.getByLabel("Through date and time (Lagos)")).toBeFocused();
  expect(queries).toHaveLength(initialReads);
  await page.getByLabel("Through date and time (Lagos)").fill("2026-04-01T10:00");
  await page.getByRole("button", { name: "Apply audit filters" }).click();
  await expect
    .poll(() => queries.at(-1))
    .toEqual({
      limit: "25",
      from: "2026-01-01T10:00:00+01:00",
      to: "2026-04-01T10:00:00+01:00",
    });
  await page.getByLabel("From date and time (Lagos)").fill("");
  await page.getByRole("button", { name: "Apply audit filters" }).click();
  await expect
    .poll(() => queries.at(-1))
    .toEqual({ limit: "25", to: "2026-04-01T10:00:00+01:00" });
});
test("recorded JSON is lazy, literal, keyboard-scrollable and accessible on mobile and desktop", async ({
  page,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("untrusted.invalid")) external.push(request.url());
  });
  await fixture(page, async (route) => {
    await reply(route, { items: [eventFixture()] });
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/admin/audit");
  await expect(page.getByText("Actor’s current role", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "After", exact: true })).toHaveCount(0);
  await page.locator("summary").filter({ hasText: "Recorded values" }).focus();
  await page.keyboard.press("Enter");
  const after = page.getByRole("region", { name: "After", exact: true });
  await expect(after).toContainText('"enabled": false');
  await expect(after).toContainText('"count": 0');
  await expect(after).toContainText('"description": ""');
  await expect(after).toContainText('"missing": null');
  await expect(page.getByRole("region", { name: "Before", exact: true })).toHaveText(
    "null",
  );
  expect(await after.textContent()).toBe(
    JSON.stringify(eventFixture().newValues, null, 2),
  );
  await expect(after.locator("img")).toHaveCount(0);
  await after.focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => after.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("Home");
  await after.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-audit-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-audit-desktop.png"),
    fullPage: true,
  });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("nullable actors remain unknown and only supported internal current-record links are offered", async ({
  page,
}) => {
  await fixture(page, async (route) => {
    await reply(route, {
      items: [
        eventFixture(),
        {
          ...eventFixture(),
          id: id(5),
          entityType: "USER",
          entityId: "https://untrusted.invalid",
          userId: null,
          user: null,
          requestId: null,
        },
        { ...eventFixture(), id: id(6), entityType: "PAYMENT" },
        { ...eventFixture(), id: id(7), entityId: "https://untrusted.invalid" },
      ],
    });
  });
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "UPDATE · USER" })).toBeVisible();
  await expect(page.getByText("Not available", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open current record" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open current record" })).toHaveAttribute(
    "href",
    `/admin/orders/${id(3)}`,
  );
  await expect(page.locator('a[href*="untrusted.invalid"]')).toHaveCount(0);
});
test("session invalidation clears expanded history and private filter drafts before revalidation", async ({
  page,
}) => {
  let changed = false;
  await fixture(page, async (route) => {
    await reply(route, { items: changed ? [] : [eventFixture()] });
  });
  await page.goto("/admin/audit");
  await page.locator("summary").filter({ hasText: "Recorded values" }).click();
  await expect(page.getByRole("region", { name: "After", exact: true })).toBeVisible();
  await page.getByLabel("Request reference (optional)").fill("previous-private-draft");
  changed = true;
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("region", { name: "After", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify session again" }).click();
  await expect(page.getByText("No audit events on this page")).toBeVisible();
  await expect(page.getByLabel("Request reference (optional)")).toHaveValue("");
});
