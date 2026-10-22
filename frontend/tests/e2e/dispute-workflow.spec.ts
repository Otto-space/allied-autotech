import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { disputeId as id, disputeFixture } from "../fixtures/dispute-work";
import { formatKobo } from "@/lib/format/money";
import { disputeSchema } from "@/lib/api/operations-schemas";
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: { success: true, data, message: "Isolated", meta: { requestId: "dispute-qa" } },
  });
async function fixture(page: Page, role = "STAFF") {
  const state = {
    row: disputeFixture(),
    grants: ["DISPUTE_MANAGE"],
    fail: false,
    reads: [] as string[],
    writes: [] as { action: string; body: Record<string, unknown> }[],
    cursor: null as string | null,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(50),
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-17T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        user: { id: id(10), email: "disputes@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-dispute-csrf-".repeat(4) });
    if (endpoint === "/staff/profile")
      return reply(route, {
        id: id(10),
        email: "disputes@example.test",
        role,
        status: "ACTIVE",
        staffProfile: null,
        capabilities: state.grants,
      });
    if (
      endpoint === `/staff/disputes/${state.row.id}` &&
      route.request().method() === "GET"
    )
      return state.fail
        ? route.fulfill({
            status: 503,
            json: { success: false, error: { code: "UNAVAILABLE" } },
          })
        : reply(route, state.row);
    if (endpoint === "/staff/disputes/operators")
      return reply(route, {
        items: [10, 11, 12].map((n) => ({
          id: id(n),
          label: `Synthetic Operator ${n} (operator${n}@example.test)`,
        })),
        nextCursor: null,
      });
    if (
      endpoint === "/staff/disputes" ||
      endpoint === "/admin/operations/payment-disputes"
    ) {
      state.reads.push(url.search);
      if (state.fail)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      return reply(route, {
        items:
          endpoint === "/staff/disputes" &&
          url.searchParams.get("openOnly") !== "false" &&
          state.row.resolvedAt
            ? []
            : [
                endpoint === "/admin/operations/payment-disputes"
                  ? disputeSchema.parse(state.row)
                  : state.row,
              ],
        nextCursor:
          endpoint === "/staff/disputes"
            ? state.cursor && !url.searchParams.has("cursor")
              ? state.row.id
              : null
            : undefined,
      });
    }
    if (endpoint === "/admin/staff")
      return reply(route, {
        items: [10, 11, 12].map((n) => ({
          id: id(n),
          email: `operator${n}@example.test`,
          role: "STAFF",
          status: "ACTIVE",
          staffProfile: {
            id: id(n + 100),
            firstName: "Synthetic",
            lastName: `Operator ${n}`,
            branchId: null,
          },
        })),
      });
    if (endpoint.startsWith(`/staff/disputes/${state.row.id}/`)) {
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      const action = endpoint.split("/").at(-1)!,
        body = route.request().postDataJSON();
      state.writes.push({ action, body });
      if (action === "evidence-access")
        return reply(route, {
          id: state.row.id,
          url: "https://unapproved.invalid/private-evidence",
        });
      expect(body.expectedUpdatedAt).toBe(state.row.updatedAt);
      if (action === "assign") {
        state.row.primaryUserId = body.primaryUserId;
        state.row.backupUserId = body.backupUserId;
        state.row.primaryOperator = {
          id: body.primaryUserId,
          label: "Synthetic assigned primary",
        };
        state.row.backupOperator = {
          id: body.backupUserId,
          label: "Synthetic assigned backup",
        };
      }
      if (action === "acknowledge") {
        state.row.acknowledgedAt = "2026-09-17T10:00:00Z";
        state.row.acknowledgedByUserId = id(10);
      }
      if (action === "submission") {
        state.row.respondedAt = body.submittedAt;
        state.row.providerSubmissionReference = body.providerSubmissionReference;
      }
      state.row.updatedAt = new Date(
        Date.parse(state.row.updatedAt) + 1000,
      ).toISOString();
      return reply(route, state.row);
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
async function open(page: Page) {
  await page.goto(`/admin/payment-disputes/work?selected=${id(20)}`);
  await expect(page).toHaveTitle("Dispute work queue");
  await expect(
    page.getByRole("heading", { name: "Dispute work queue", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wh-identity")).toBeVisible();
  await page.locator(".wh-lifecycle summary").click();
}
async function confirm(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("super admin sees confirmed partial chargebacks and unresolved provider outcomes in both queues", async ({
  page,
}) => {
  const errors: string[] = [];
  const toolingCsp: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Console Ninja is injected by this workstation's development tooling.
    // Preserve CSP and report its blocked loopback connection separately.
    if (
      /^Connecting to 'ws:\/\/127\.0\.0\.1:\d+\/' violates the following Content Security Policy directive: "connect-src 'self'"/.test(
        text,
      ) ||
      text.startsWith("Console Ninja failed to send logs,")
    )
      toolingCsp.push(text);
    else errors.push(text);
  });
  const state = await fixture(page, "SUPER_ADMIN");
  Object.assign(state.row, {
    status: "ACCEPTED",
    chargebackAmountKobo: "1200",
    providerStatus: "resolved",
    providerResolution: "merchant-accepted",
    resolvedAt: "2026-10-12T08:00:00Z",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/payment-disputes/work");
  await expect(page).toHaveTitle("Dispute work queue");
  await expect(
    page.getByRole("heading", { name: "Dispute work queue", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Dispute history").selectOption("all");
  await page.locator(".wh-record").first().getByRole("button").click();
  await page.locator(".wh-lifecycle summary").click();
  await expect(
    page.locator(".wh-detail .totals").getByText(formatKobo("1200"), { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("merchant accepted", { exact: true })).toBeVisible();
  await page
    .locator(".wh-detail .totals")
    .getByText("Confirmed chargeback", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-dispute-contract-desktop.png"),
  });
  await page.getByRole("link", { name: "View dispute overview" }).click();
  await expect(page).toHaveURL(/\/admin\/payment-disputes$/);
  await expect(
    page.getByRole("heading", { name: "Payment disputes", exact: true }),
  ).toBeVisible();
  await page.locator(".wd-record").first().getByRole("button").click();
  await expect(page.getByText(formatKobo("1200"), { exact: true })).toBeVisible();
  Object.assign(state.row, {
    status: "UNDER_REVIEW",
    chargebackAmountKobo: null,
    providerResolution: "declined",
    providerReviewReason: "UNCONFIRMED_PROVIDER_RESOLUTION",
    resolvedAt: null,
  });
  await page.reload();
  await expect(page.getByText(/provider outcome needs review/)).toBeVisible();
  await expect(
    page.locator(".wd-chargeback").getByText("Not confirmed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(formatKobo("1200"), { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".wd-chargeback")
    .getByText("Confirmed chargeback", { exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await expect(page.locator("nextjs-portal").getByText(/runtime error/i)).toHaveCount(0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-dispute-contract-mobile.png"),
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  await test.info().attach("development-tool-csp", {
    body: JSON.stringify(toolingCsp),
    contentType: "application/json",
  });
  expect(state.writes).toEqual([]);
});

test("assigned staff acknowledge and record exact provider receipts without claiming resolution", async ({
  page,
}) => {
  const state = await fixture(page);
  state.row.hasEvidence = true;
  state.row.evidenceChecklist = {
    invoice: true,
    fulfillmentOrHandoverProof: true,
    relevantCustomerMessages: true,
    note: "Synthetic complete evidence",
  };
  await open(page);
  await expect(
    page
      .locator(".wh-identity + .wh-facts")
      .getByText("12,345,678,901,234.56", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".wh-lifecycle")).toContainText("28 Sept 2026");
  await expect(page.getByLabel("Primary operator", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Acknowledgement note")
    .fill("Synthetic acknowledgement recorded");
  await page.getByRole("button", { name: "Review acknowledgement" }).click();
  await expect(page.getByRole("dialog")).toContainText("does not submit evidence");
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Go back" }),
  ).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await confirm(page);
  await expect(page.getByLabel("Acknowledgement note")).toHaveCount(0);
  await page.getByLabel("Provider submission reference").fill("SYNTHETIC-RECEIPT-001");
  await page.getByLabel("Submission time (Lagos time)").fill("2026-09-17T13:00");
  await page
    .getByLabel("Submission note", { exact: true })
    .fill("Synthetic provider submission receipt");
  await page.getByRole("button", { name: "Review provider receipt" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "does not submit evidence to the provider",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-dispute-receipt-review-390.png"),
  });
  await confirm(page);
  expect(state.writes).toEqual([
    {
      action: "acknowledge",
      body: {
        note: "Synthetic acknowledgement recorded",
        expectedUpdatedAt: "2026-09-17T09:00:00Z",
      },
    },
    {
      action: "submission",
      body: {
        providerSubmissionReference: "SYNTHETIC-RECEIPT-001",
        submittedAt: "2026-09-17T12:00:00.000Z",
        note: "Synthetic provider submission receipt",
        expectedUpdatedAt: "2026-09-17T09:00:01.000Z",
      },
    },
  ]);
  await expect(page.locator(".wh-identity .wh-badge")).toHaveText("Awaiting response");
  await expect(page.getByText("SYNTHETIC-RECEIPT-001", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review provider receipt" })).toHaveCount(
    0,
  );
});

test("administrator assignment uses account IDs and requires different operators", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  await open(page);
  await page.getByLabel("Primary operator", { exact: true }).selectOption(id(12));
  await page.getByLabel("Backup operator", { exact: true }).selectOption(id(12));
  await page.getByRole("button", { name: "Review dispute assignment" }).click();
  await expect(page.getByText("Choose two different operators.")).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.getByLabel("Backup operator", { exact: true }).selectOption(id(11));
  await page.getByRole("button", { name: "Review dispute assignment" }).click();
  await expect(page.getByRole("dialog")).toContainText("operator12@example.test");
  await confirm(page);
  expect(state.writes[0]).toEqual({
    action: "assign",
    body: {
      primaryUserId: id(12),
      backupUserId: id(11),
      expectedUpdatedAt: "2026-09-17T09:00:00Z",
    },
  });
  await expect(
    page
      .locator(".wh-identity + .wh-facts")
      .getByRole("definition")
      .filter({ hasText: "Synthetic assigned primary" }),
  ).toBeVisible();
});

test("grants and navigation revoke together without retaining private work details", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  const nav = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(
    nav.getByRole("link", { name: "Dispute work queue", exact: true }),
  ).toBeVisible();
  state.grants = [];
  await page.getByRole("button", { name: "Check permissions" }).click();
  await expect(
    page.getByText("An active dispute-management grant is required to use this queue."),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Dispute work queue", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "PAYSTACK · ISOLATED-DISPUTE-020" }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
for (const role of ["STAFF", "ADMIN"])
  test(`${role} without an explicit grant never reads the work queue`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    state.grants = [];
    await page.goto("/admin/payment-disputes/work");
    await expect(
      page.getByText("An active dispute-management grant is required to use this queue."),
    ).toBeVisible();
    expect(state.reads).toEqual([]);
  });
for (const result of ["unknown", "wrong-record", "stale"])
  test(`${result} acknowledgement requires reconciliation before any new action`, async ({
    page,
  }) => {
    const state = await fixture(page);
    let writes = 0;
    await page.route("**/staff/disputes/*/acknowledge", async (route) => {
      writes++;
      if (result === "unknown") return route.abort("failed");
      if (result === "stale") {
        state.row.updatedAt = "2026-09-17T09:00:01.000Z";
        return route.fulfill({
          status: 409,
          json: { success: false, error: { code: "PAYMENT_CONFLICT" } },
        });
      }
      return reply(route, {
        ...state.row,
        id: id(999),
        acknowledgedAt: "2026-09-17T10:00:00Z",
        acknowledgedByUserId: id(10),
      });
    });
    await open(page);
    await page.getByLabel("Acknowledgement note").fill("Synthetic acknowledgement");
    await page.getByRole("button", { name: "Review acknowledgement" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change" })
      .click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
    ).toBeDisabled();
    state.fail = true;
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: result === "stale" ? "Go back" : "Close & review record",
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "PAYSTACK · ISOLATED-DISPUTE-020" }),
    ).toHaveCount(0);
    state.fail = false;
    await page.getByRole("button", { name: "Refresh records" }).click();
    if (result === "stale")
      await expect(
        page.getByRole("button", { name: "Review acknowledgement" }),
      ).toBeEnabled();
    else
      await expect(
        page.getByRole("button", { name: "Review acknowledgement" }),
      ).toBeDisabled();
    await page.getByLabel("Dispute history").selectOption("all");
    if (result === "stale")
      await expect(
        page.getByRole("button", { name: "Review acknowledgement" }),
      ).toBeEnabled();
    else
      await expect(
        page.getByRole("button", { name: "Review acknowledgement" }),
      ).toBeDisabled();
    expect(writes).toBe(1);
  });

test("unexpected assignment hides the record and cannot open actions", async ({
  page,
}) => {
  const state = await fixture(page);
  state.row.primaryUserId = id(99);
  state.row.primaryOperator = { id: id(99), label: "Different operator" };
  await page.goto("/admin/payment-disputes/work");
  await expect(
    page.getByText("We could not read this information. Please try again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review dispute actions" })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
});

test("private evidence requires an audited request and refuses unapproved hosts", async ({
  page,
}) => {
  const state = await fixture(page);
  state.row.hasEvidence = true;
  await open(page);
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Load private dispute evidence" }).click();
  await expect(
    page.getByText(
      "The private dispute evidence could not be verified. Refresh the record before trying again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open dispute evidence in a new tab" }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([{ action: "evidence-access", body: {} }]);
});

test("resolved history offers evidence access without further mutations", async ({
  page,
}) => {
  const state = await fixture(page);
  state.row.status = "WON";
  state.row.resolvedAt = "2026-09-18T10:00:00Z";
  state.row.hasEvidence = true;
  await open(page);
  await expect(
    page.getByText(
      "Resolved history is preserved. No further changes are available here.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review acknowledgement" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Review provider receipt" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Load private dispute evidence" }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("queue history changes reset paging and account invalidation clears pending review", async ({
  page,
}) => {
  const state = await fixture(page);
  state.cursor = id(99);
  await open(page);
  await page.locator(".wh-pagination").getByRole("button", { name: "Next" }).click();
  await expect.poll(() => state.reads.at(-1)).toContain("cursor=");
  await page.getByLabel("Dispute history").selectOption("all");
  await expect
    .poll(() => new URLSearchParams(state.reads.at(-1)).get("openOnly"))
    .toBe("false");
  expect(new URLSearchParams(state.reads.at(-1)).has("cursor")).toBe(false);
  await page.getByLabel("Acknowledgement note").fill("Synthetic acknowledgement");
  await page.getByRole("button", { name: "Review acknowledgement" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Acknowledgement note")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("work queue fits eleven widths and passes mobile accessibility before console verification", async ({
  page,
}) => {
  const errors: string[] = [],
    logs: string[] = [],
    toolingCsp: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const text = message.text();
    // Keep the workstation's Console Ninja CSP noise separate from app errors.
    if (
      /^Connecting to 'ws:\/\/127\.0\.0\.1:\d+\/' violates the following Content Security Policy directive: "connect-src 'self'"/.test(
        text,
      ) ||
      text.startsWith("Console Ninja failed to send logs,")
    )
      toolingCsp.push(text);
    else logs.push(text);
  });
  await fixture(page);
  await open(page);
  for (const width of [320, 360, 375, 390, 414, 768, 844, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `overflow at ${width}`,
    ).toBe(true);
    if (width === 390 || width === 1440) {
      await page
        .getByRole("heading", { name: "Acknowledgement and provider submission" })
        .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-dispute-work-${width}.png`),
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(
    page.locator("nextjs-portal").getByText("Runtime Error", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(logs).toEqual([]);
  await test.info().attach("development-tool-csp", {
    body: JSON.stringify(toolingCsp),
    contentType: "application/json",
  });
});
