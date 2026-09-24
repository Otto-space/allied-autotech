import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import type { PrivacyRequest, RetentionHold } from "../../lib/api/privacy-schemas";
const id = (n: number) => `ea000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const initial = (): PrivacyRequest => ({
  id: id(10),
  userId: id(2),
  kind: "DELETION",
  reason: "Synthetic customer explanation for privacy review.",
  status: "REQUESTED",
  createdAt: "2026-09-20T09:00:00Z",
  reviewedAt: null,
  reviewNote: null,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic response",
      data,
      meta: { requestId: "privacy-test" },
    },
  });
const failure = (route: Route, status = 503) =>
  route.fulfill({
    status,
    json: {
      success: false,
      error: {
        code:
          status === 409
            ? "CONFLICT"
            : status === 403
              ? "FORBIDDEN"
              : "INTERNAL_SERVER_ERROR",
      },
    },
  });
async function fixture(
  page: Page,
  options: {
    role?: string;
    granted?: boolean;
    wrongIdentity?: boolean;
    outcome?: "stale" | "interrupted" | "mismatched" | "revoked";
  } = {},
) {
  const state = {
    items: [initial()],
    holds: [] as RetentionHold[],
    writes: [] as { path: string; body: Record<string, unknown> }[],
    reads: [] as string[],
    failRead: false,
    profileFailure: false,
    wrongCustomer: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      endpoint = url.pathname.replace("/api/v1", "");
    const role = options.role ?? "CUSTOMER";
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(1),
        user: {
          id: id(role === "CUSTOMER" ? 2 : 3),
          email: "synthetic@example.test",
          role,
        },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-09-24T09:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "privacy-csrf-".repeat(5) });
    if (endpoint === "/staff/profile") {
      if (state.profileFailure) return failure(route);
      return reply(route, {
        id: id(options.wrongIdentity ? 99 : 3),
        email: "synthetic@example.test",
        role,
        status: "ACTIVE",
        capabilities: options.granted === false ? [] : ["PRIVACY_REVIEW"],
        staffProfile: {
          id: id(4),
          firstName: "Synthetic",
          lastName: "Reviewer",
          branchId: null,
        },
      });
    }
    if (route.request().method() === "GET") {
      state.reads.push(endpoint);
      if (state.failRead) return failure(route);
      if (endpoint.endsWith("/privacy-requests")) {
        expect(url.searchParams.get("limit")).toBe("10");
        const start = url.searchParams.get("cursor")
          ? state.items.findIndex((item) => item.id === url.searchParams.get("cursor")) +
            1
          : 0;
        const items = state.items.slice(start, start + 10).map((item) => ({
          ...item,
          ...(state.wrongCustomer ? { userId: id(99) } : {}),
        }));
        return reply(route, {
          items,
          nextCursor: state.items.length > start + 10 ? items.at(-1)?.id : null,
        });
      }
      if (endpoint === "/staff/retention-holds") {
        expect(url.searchParams.get("userId")).toBe(id(2));
        return reply(route, state.holds);
      }
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.writes.push({ path: endpoint, body });
      expect(route.request().headers()["x-csrf-token"]).toBe("privacy-csrf-".repeat(5));
      if (options.outcome === "stale" || options.outcome === "revoked")
        return failure(route, options.outcome === "stale" ? 409 : 403);
      if (options.outcome === "interrupted") return route.abort("failed");
      if (endpoint === "/customers/privacy-requests") {
        let saved = state.items.find(
          (item) => item.kind === body.kind && item.status !== "REJECTED",
        );
        if (!saved) {
          saved = { ...initial(), id: id(11), kind: body.kind, reason: body.reason };
          state.items.unshift(saved);
        }
        return reply(
          route,
          options.outcome === "mismatched" ? { ...saved, userId: id(99) } : saved,
        );
      }
      if (endpoint.endsWith("/review")) {
        if (
          body.status === "APPROVED_PENDING_POLICY" &&
          state.holds.some((hold) => !hold.releasedAt)
        )
          return failure(route, 409);
        const item = state.items[0]!;
        if (body.expectedReviewedAt !== item.reviewedAt) return failure(route, 409);
        const saved = {
          ...item,
          status: body.status,
          reviewNote: body.note,
          reviewedAt: "2026-09-24T10:00:00Z",
        };
        state.items[0] = saved;
        return reply(
          route,
          options.outcome === "mismatched" ? { ...saved, id: id(99) } : saved,
        );
      }
      if (endpoint === "/staff/retention-holds") {
        const saved = {
          id: id(20),
          userId: body.userId,
          recordType: body.recordType,
          recordId: body.recordId ?? null,
          reason: body.reason,
          createdAt: "2026-09-24T09:00:00Z",
          releasedAt: null,
        };
        state.holds.unshift(saved);
        return reply(
          route,
          options.outcome === "mismatched" ? { ...saved, userId: id(99) } : saved,
        );
      }
      if (endpoint.endsWith("/release")) {
        state.holds = state.holds.map((hold) => ({
          ...hold,
          releasedAt: "2026-09-24T10:00:00Z",
        }));
        return reply(route, { id: options.outcome === "mismatched" ? id(99) : id(20) });
      }
    }
    return failure(route, 404);
  });
  return state;
}
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  return errors;
}
async function fillIntake(page: Page) {
  await page.getByLabel("Request type", { exact: true }).selectOption("ANONYMIZATION");
  await page
    .getByLabel("Why are you making this request?")
    .fill("Synthetic anonymization request for review only.");
}
async function openReview(page: Page) {
  await page
    .getByRole("button", { name: /Review request from/ })
    .first()
    .click();
  await expect(page.getByLabel("New request status")).toBeVisible();
}
async function fillReview(page: Page) {
  await page.getByLabel("New request status").selectOption("UNDER_REVIEW");
  await page
    .getByLabel("Response visible to the customer")
    .fill("We are reviewing this synthetic request and its record protections.");
}
async function responsive(page: Page, name: string) {
  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      await page
        .getByRole("heading", { level: 1 })
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    ).toBeLessThanOrEqual(32);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(os.tmpdir(), `allied-${name}-1440.png`) });
}
test("customer reviews an exact privacy request, retains cancel focus and sees saved status", async ({
  page,
}) => {
  const state = await fixture(page);
  const errors = collectErrors(page);
  await page.goto("/dashboard/privacy");
  await expect(page).toHaveTitle(/Privacy requests/);
  await fillIntake(page);
  await responsive(page, "privacy-customer");
  await page.getByRole("button", { name: "Review privacy request" }).click();
  expect(state.writes).toEqual([]);
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(
    page.getByRole("button", { name: "Review privacy request" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Review privacy request" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-privacy-customer-review-390.png"),
  });
  await page.getByRole("button", { name: "Send privacy request", exact: true }).click();
  await expect(page.getByText(/Your privacy request is recorded/)).toBeVisible();
  await expect(page.locator(".privacy-record")).toHaveCount(2);
  await expect(page.getByLabel("Why are you making this request?")).toHaveValue("");
  expect(state.writes).toEqual([
    {
      path: "/customers/privacy-requests",
      body: {
        kind: "ANONYMIZATION",
        reason: "Synthetic anonymization request for review only.",
      },
    },
  ]);
  await expect(page.getByText(/Account reference:/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("staff records and releases protection, then reviews with the last server timestamp", async ({
  page,
}) => {
  const state = await fixture(page, { role: "STAFF" });
  const errors = collectErrors(page);
  await page.goto("/admin/privacy");
  await expect(page).toHaveTitle(/Privacy review/);
  await openReview(page);
  await page.getByLabel("Protected records").selectOption("ALL");
  await page
    .getByLabel("Reason for protection")
    .fill("Synthetic accounting protection during request review.");
  await page.getByRole("button", { name: "Review new hold" }).click();
  await page.getByRole("button", { name: "Confirm hold change" }).click();
  await expect(
    page.getByRole("heading", { name: "All records · Active hold" }),
  ).toBeVisible();
  await page
    .getByLabel("Release justification")
    .fill("Synthetic documented accounting clearance permits release.");
  await page.getByRole("button", { name: "Review hold release" }).click();
  await page.getByRole("button", { name: "Confirm hold change" }).click();
  await expect(
    page.getByRole("heading", { name: "All records · Released" }),
  ).toBeVisible();
  await fillReview(page);
  await responsive(page, "privacy-staff");
  await page.getByRole("button", { name: "Review response" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-privacy-staff-review-390.png"),
  });
  await page.getByRole("button", { name: "Save privacy review" }).click();
  await expect(page.getByText(/Privacy review saved. No deletion/)).toBeVisible();
  expect(state.writes.at(-1)?.body).toEqual({
    status: "UNDER_REVIEW",
    note: "We are reviewing this synthetic request and its record protections.",
    expectedReviewedAt: null,
  });
  await expect(
    page.locator(".privacy-record strong").getByText("Under review", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} needs the narrow privacy grant before reading records`, async ({
    page,
  }) => {
    const state = await fixture(page, { role, granted: false });
    await page.goto("/admin/privacy");
    await expect(page.getByText(/Privacy review requires an active/)).toBeVisible();
    expect(state.reads).toEqual([]);
    expect(state.writes).toEqual([]);
  });
test("mismatched staff profile prevents privacy reads", async ({ page }) => {
  const state = await fixture(page, { role: "ADMIN", wrongIdentity: true });
  await page.goto("/admin/privacy");
  await expect(page.getByText(/Privacy review requires an active/)).toBeVisible();
  expect(state.reads).toEqual([]);
});
for (const outcome of ["interrupted", "mismatched", "stale", "revoked"] as const)
  test(`privacy review handles ${outcome} without replay`, async ({ page }) => {
    const state = await fixture(page, { role: "ADMIN", outcome });
    await page.goto("/admin/privacy");
    await openReview(page);
    await fillReview(page);
    await page.getByRole("button", { name: "Review response" }).click();
    await page.getByRole("button", { name: "Save privacy review" }).click();
    await expect(
      page.getByRole("button", { name: "Save privacy review" }),
    ).toBeDisabled();
    const unknown = outcome === "interrupted" || outcome === "mismatched";
    await page
      .getByRole("dialog")
      .getByRole("button", { name: unknown ? "Close & review record" : "Go back" })
      .click();
    await expect(page.getByText(/Privacy review saved. No deletion/)).toHaveCount(0);
    if (unknown) {
      state.failRead = true;
      await page.getByRole("button", { name: "Refresh privacy requests" }).click();
      await expect(page.locator(".privacy-record")).toHaveCount(0);
      state.failRead = false;
      await page.getByRole("button", { name: "Refresh privacy requests" }).click();
      await expect(page.getByRole("button", { name: "Review response" })).toBeDisabled();
      state.profileFailure = true;
      await page.getByRole("button", { name: "Refresh privacy permission" }).click();
      await expect(page.locator(".privacy-record")).toHaveCount(0);
      state.profileFailure = false;
      await page.getByRole("button", { name: "Refresh privacy permission" }).click();
      await openReview(page);
      await expect(page.getByRole("button", { name: "Review response" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Review new hold" })).toBeDisabled();
    }
    expect(state.writes).toHaveLength(1);
  });
test("customer paging stays isolated and a mismatched account response hides all private rows", async ({
  page,
}) => {
  const state = await fixture(page);
  state.items = Array.from({ length: 11 }, (_, index) => ({
    ...initial(),
    id: id(10 + index),
    reason: `Synthetic private explanation ${index}`,
  }));
  await page.goto("/dashboard/privacy");
  await expect(page.locator(".privacy-record")).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".privacy-record")).toHaveCount(1);
  await expect(
    page.getByText("Synthetic private explanation 10", { exact: true }),
  ).toBeVisible();
  state.wrongCustomer = true;
  await page.getByRole("button", { name: "Refresh privacy requests" }).click();
  await expect(page.locator(".privacy-record")).toHaveCount(0);
  await expect(
    page.getByText("We could not read this information. Please try again."),
  ).toBeVisible();
  await expect(page.getByText("No privacy requests are recorded.")).toHaveCount(0);
});
test("an existing privacy request keeps its original explanation without claiming replacement", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/privacy");
  await page.getByLabel("Request type", { exact: true }).selectOption("DELETION");
  await page
    .getByLabel("Why are you making this request?")
    .fill("Synthetic second explanation for the same request type.");
  await page.getByRole("button", { name: "Review privacy request" }).click();
  await expect(
    page.getByRole("dialog").getByText(/original explanation kept/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send privacy request", exact: true }).click();
  await expect(page.locator(".privacy-record")).toHaveCount(1);
  await expect(
    page.locator(".privacy-record").getByText(initial().reason, { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("account change discards privacy drafts and confirmation", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/dashboard/privacy");
  await fillIntake(page);
  await page.getByRole("button", { name: "Review privacy request" }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".privacy-record")).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("unknown intake locks further requests while retaining the explanation", async ({
  page,
}) => {
  const state = await fixture(page, { outcome: "interrupted" });
  await page.goto("/dashboard/privacy");
  await fillIntake(page);
  await page.getByRole("button", { name: "Review privacy request" }).click();
  await page.getByRole("button", { name: "Send privacy request", exact: true }).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(
    page.getByRole("button", { name: "Review privacy request" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Why are you making this request?")).toHaveValue(
    "Synthetic anonymization request for review only.",
  );
  await page.getByRole("button", { name: "Refresh privacy requests" }).click();
  await expect(
    page.getByRole("button", { name: "Review privacy request" }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});

test("active hold blocks approval without a success claim", async ({ page }) => {
  const state = await fixture(page, { role: "ADMIN" });
  state.holds = [
    {
      id: id(20),
      userId: id(2),
      recordType: "ALL",
      recordId: null,
      reason: "Synthetic active protection",
      createdAt: "2026-09-20T09:00:00Z",
      releasedAt: null,
    },
  ];
  await page.goto("/admin/privacy");
  await openReview(page);
  await page.getByLabel("New request status").selectOption("APPROVED_PENDING_POLICY");
  await page
    .getByLabel("Response visible to the customer")
    .fill("Synthetic proposed approval must remain blocked.");
  await page.getByRole("button", { name: "Review response" }).click();
  await page.getByRole("button", { name: "Save privacy review" }).click();
  await expect(page.getByRole("button", { name: "Save privacy review" })).toBeDisabled();
  await expect(page.getByText(/Privacy review saved. No deletion/)).toHaveCount(0);
  expect(state.items[0]?.status).toBe("REQUESTED");
  expect(state.writes).toHaveLength(1);
});
for (const action of ["create", "release"] as const)
  test(`unknown hold ${action} locks all account decisions`, async ({ page }) => {
    const state = await fixture(page, { role: "ADMIN", outcome: "interrupted" });
    if (action === "release")
      state.holds = [
        {
          id: id(20),
          userId: id(2),
          recordType: "ALL",
          recordId: null,
          reason: "Synthetic active protection",
          createdAt: "2026-09-20T09:00:00Z",
          releasedAt: null,
        },
      ];
    await page.goto("/admin/privacy");
    await openReview(page);
    if (action === "create") {
      await page.getByLabel("Protected records").selectOption("PAYMENT");
      await page
        .getByLabel("Reason for protection")
        .fill("Synthetic new accounting protection");
      await page.getByRole("button", { name: "Review new hold" }).click();
    } else {
      await page
        .getByLabel("Release justification")
        .fill("Synthetic approved release justification");
      await page.getByRole("button", { name: "Review hold release" }).click();
    }
    await page.getByRole("button", { name: "Confirm hold change" }).click();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await expect(page.getByRole("button", { name: "Review response" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Review new hold" })).toBeDisabled();
    await page.getByRole("button", { name: "Refresh retention holds" }).click();
    await expect(page.getByRole("button", { name: "Review new hold" })).toBeDisabled();
    expect(state.writes).toHaveLength(1);
  });

test("long privacy explanations and hold references fit narrow screens", async ({
  page,
}) => {
  const state = await fixture(page, { role: "ADMIN" });
  state.items[0]!.reason = "Synthetic " + "X".repeat(1900);
  state.holds = [
    {
      id: id(20),
      userId: id(2),
      recordType: "PAYMENT",
      recordId: id(99),
      reason: "Synthetic " + "H".repeat(1900),
      createdAt: "2026-09-20T09:00:00Z",
      releasedAt: null,
    },
  ];
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/admin/privacy");
  await openReview(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByLabel("New request status").selectOption("ON_HOLD");
  await page
    .getByLabel("Response visible to the customer")
    .fill("Synthetic " + "R".repeat(1900));
  await page.getByRole("button", { name: "Review response" }).click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(page.getByRole("button", { name: "Review response" })).toBeFocused();
  expect(state.writes).toEqual([]);
});

test("trimmed privacy explanation validation focuses the customer field", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/privacy");
  await page.getByLabel("Request type", { exact: true }).selectOption("DELETION");
  await page.getByLabel("Why are you making this request?").fill(" ".repeat(10));
  await page.getByRole("button", { name: "Review privacy request" }).click();
  await expect(page.getByLabel("Why are you making this request?")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("invalid hold reference and trimmed reason focus the relevant fields", async ({
  page,
}) => {
  const state = await fixture(page, { role: "STAFF" });
  await page.goto("/admin/privacy");
  await openReview(page);
  await page.getByLabel("Protected records").selectOption("PAYMENT");
  await page.getByLabel("Individual record reference").fill("invalid-reference");
  await page
    .getByLabel("Reason for protection")
    .fill("Synthetic valid protection reason");
  await page.getByRole("button", { name: "Review new hold" }).click();
  await expect(page.getByLabel("Individual record reference")).toBeFocused();
  await page.getByLabel("Individual record reference").fill("");
  await page.getByLabel("Reason for protection").fill(" ".repeat(10));
  await page.getByRole("button", { name: "Review new hold" }).click();
  await expect(page.getByLabel("Reason for protection")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
