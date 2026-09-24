import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
const id = (n: number) => `e9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-09-24T09:00:00Z";
const acknowledged = "2026-09-24T09:30:00Z";
const response = "We have received your synthetic complaint and will review the details.";
const initial = () => ({
  id: id(1),
  branchId: id(2),
  assignedStaffId: null,
  subject: "Synthetic complaint",
  version: 0,
  createdAt: stamp,
  updatedAt: stamp,
  resolvedAt: null,
  closedAt: null,
  branch: { id: id(2), code: "TEST", name: "Synthetic handling branch" },
  assignedStaff: null,
  status: "OPEN",
  description: "Synthetic complaint for browser verification.",
  resolution: null,
  priority: "URGENT",
  bookingId: null,
  orderId: null,
  vehicleTransactionId: null,
  name: "Synthetic Customer",
  email: "private-contact@example.test",
  phone: null,
  customerId: id(3),
  acknowledgedAt: null as string | null,
  acknowledgementDueAt: "2026-09-24T10:00:00Z",
  escalatedAt: "2026-09-24T10:01:00Z",
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Synthetic response",
      meta: { requestId: "complaint-ack-test" },
    },
  });
async function fixture(page: Page, role = "STAFF") {
  const state = {
    record: initial(),
    mode: "success",
    failRead: false,
    legacy: false,
    writes: [] as { body: unknown; csrf?: string }[],
    messages: [] as {
      id: string;
      authorType: string;
      visibility: string;
      body: string;
      createdAt: string;
    }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(4),
        user: { id: id(5), email: "synthetic@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : stamp,
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "complaint-ack-csrf-".repeat(4) });
    if (endpoint.endsWith("/messages"))
      return reply(route, {
        items: state.messages,
        cursor: state.messages.at(-1)?.id ?? null,
        hasMore: false,
        pollAfterMs: 5000,
      });
    if (
      endpoint === `/staff/support/complaints/${id(1)}` ||
      endpoint === `/customers/support/complaints/${id(1)}`
    ) {
      if (state.failRead)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      return reply(
        route,
        state.legacy
          ? {
              ...state.record,
              acknowledgedAt: undefined,
              acknowledgementDueAt: undefined,
              escalatedAt: undefined,
            }
          : state.record,
      );
    }
    if (endpoint.endsWith("/acknowledge")) {
      state.writes.push({
        body: route.request().postDataJSON(),
        csrf: route.request().headers()["x-csrf-token"],
      });
      if (state.mode === "interrupted") return route.abort("failed");
      if (state.mode === "denied")
        return route.fulfill({
          status: 403,
          json: { success: false, error: { code: "FORBIDDEN" } },
        });
      if (state.mode === "mismatched")
        return reply(route, {
          ...state.record,
          id: id(99),
          acknowledgedAt: acknowledged,
        });
      state.record.acknowledgedAt = acknowledged;
      state.messages = [
        {
          id: id(10),
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: route.request().postDataJSON().message,
          createdAt: acknowledged,
        },
      ];
      return reply(route, state.record);
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
async function review(page: Page) {
  await page.getByLabel("Acknowledgement response").fill(`  ${response}  `);
  await page.getByRole("button", { name: "Review acknowledgement", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Go back" }),
  ).toBeFocused();
}
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} records a reviewed acknowledgement without resolving and preserves the reply draft`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    await page.goto(`/admin/support/complaints/${id(1)}`);
    await expect(page).toHaveTitle(/Support conversation/);
    await expect(
      page.getByText("Awaiting acknowledgement", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Reply text").fill("Keep my separate draft reply.");
    if (role === "STAFF") {
      for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page
        .getByRole("heading", { name: "Acknowledge this complaint", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(os.tmpdir(), "allied-complaint-ack-1440.png"),
      });
    }
    await review(page);
    expect(state.writes).toEqual([]);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(response, { exact: true })).toBeVisible();
    if (role === "STAFF") {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: path.join(os.tmpdir(), "allied-complaint-review-390.png"),
      });
    }
    await dialog
      .getByRole("button", { name: "Record acknowledgement", exact: true })
      .click();
    await expect(
      page.getByText(
        "Complaint acknowledgement is recorded. Review the conversation for the saved response.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.locator(".support-message").getByText(response, { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Reply text")).toHaveValue(
      "Keep my separate draft reply.",
    );
    await expect(
      page.getByRole("button", { name: "Review acknowledgement", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".support-details dd").first()).toHaveText("open");
    expect(state.writes).toEqual([
      { body: { message: response }, csrf: "complaint-ack-csrf-".repeat(4) },
    ]);
    expect(errors).toEqual([]);
  });
test("customer reads the recorded acknowledgement and server dates without staff controls or private contact data", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  state.record.acknowledgedAt = acknowledged;
  await page.goto(`/dashboard/support/complaints/${id(1)}`);
  await expect(
    page.getByText("Recorded 24 Sept 2026, 10:30 (Lagos time)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Acknowledgement target", { exact: true })).toBeVisible();
  await expect(page.getByText("Escalated", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review acknowledgement" })).toHaveCount(
    0,
  );
  await expect(page.getByText("private-contact@example.test")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("older responses without acknowledgement fields do not imply an unacknowledged complaint", async ({
  page,
}) => {
  const state = await fixture(page);
  state.legacy = true;
  await page.goto(`/admin/support/complaints/${id(1)}`);
  await expect(
    page.getByText("Not available on this record", { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Review acknowledgement" })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
});
test("an acknowledgement completed by another operator prevents another write at preflight", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`/admin/support/complaints/${id(1)}`);
  await review(page);
  state.record.acknowledgedAt = acknowledged;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record acknowledgement", exact: true })
    .click();
  await expect(page.getByText(/Complaint acknowledgement is recorded/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Review acknowledgement" })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
});
for (const mode of ["interrupted", "mismatched", "denied"])
  test(`${mode} acknowledgement remains unconfirmed without automatic replay`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.mode = mode;
    await page.goto(`/admin/support/complaints/${id(1)}`);
    await review(page);
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", {
      name: "Record acknowledgement",
      exact: true,
    });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(page.getByText(/Complaint acknowledgement is recorded/)).toHaveCount(0);
    await dialog
      .getByRole("button", {
        name: mode === "denied" ? "Go back" : "Close & review record",
      })
      .click();
    if (mode !== "denied") {
      await expect(
        page.getByRole("button", { name: "Review acknowledgement", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Review reply", exact: true }),
      ).toBeDisabled();
      state.failRead = true;
      await page.getByRole("button", { name: "Refresh record", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Review acknowledgement", exact: true }),
      ).toHaveCount(0);
      state.failRead = false;
      await page.getByRole("button", { name: "Refresh record", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Review acknowledgement", exact: true }),
      ).toBeDisabled();
    }
    expect(state.writes).toHaveLength(1);
  });
test("failed acknowledgement preflight performs no write and preserves the draft", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`/admin/support/complaints/${id(1)}`);
  await review(page);
  state.failRead = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record acknowledgement", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Record acknowledgement", exact: true }),
  ).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel("Acknowledgement response")).toHaveValue(
    `  ${response}  `,
  );
  await expect(page.getByText(/A support change has an unknown outcome/)).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("a missing acknowledgement on a closed complaint does not reopen it", async ({
  page,
}) => {
  const state = await fixture(page);
  state.record.status = "CLOSED";
  await page.goto(`/admin/support/complaints/${id(1)}`);
  await expect(
    page.getByText("This record is closed. The reply form is unavailable."),
  ).toBeVisible();
  await review(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record acknowledgement", exact: true })
    .click();
  await expect(
    page.locator(".support-message").getByText(response, { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".support-details dd").first()).toHaveText("closed");
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test("acknowledgement validation focuses the response and account changes clear the review", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`/admin/support/complaints/${id(1)}`);
  await page.getByLabel("Acknowledgement response").fill("   short   ");
  await page.getByRole("button", { name: "Review acknowledgement", exact: true }).click();
  await expect(page.getByLabel("Acknowledgement response")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await review(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Acknowledgement response")).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  expect(state.writes).toEqual([]);
});
