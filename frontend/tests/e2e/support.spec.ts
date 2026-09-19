import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

const id = (n: number) => `d5000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const branch = { id: id(2), code: "TEST", name: "Test handling branch", isActive: true };
const staff = { id: id(3), firstName: "Test", lastName: "Handler", branchId: id(2) };
const profile = {
  id: id(4),
  email: "staff@example.test",
  role: "STAFF",
  status: "ACTIVE",
  staffProfile: staff,
};
const message = (n = 10, visibility = "CUSTOMER") => ({
  id: id(n),
  authorType: "STAFF",
  visibility,
  body: `Isolated reply ${n}`,
  createdAt: time,
});
const row = (kind = "enquiries") => ({
  id: id(kind === "enquiries" ? 1 : 5),
  branchId: id(2),
  assignedStaffId: null as string | null,
  subject: kind === "enquiries" ? "Test enquiry" : "Test complaint",
  version: 0,
  createdAt: time,
  updatedAt: time,
  resolvedAt: null as string | null,
  closedAt: null as string | null,
  branch,
  assignedStaff: null as typeof staff | null,
  type: "GENERAL",
  status: "OPEN",
  message: "Original test enquiry",
  description: "Original test complaint",
  resolution: null as string | null,
  priority: "MEDIUM",
  productId: null as string | null,
  serviceId: null as string | null,
  bookingId: null as string | null,
  quoteId: null as string | null,
  vehicleListingId: null as string | null,
  orderId: null as string | null,
  vehicleTransactionId: null as string | null,
  name: "Test Customer",
  email: "private@example.test",
  phone: null,
  customerId: id(8) as string | null,
  messages: [message(99, "INTERNAL")],
});
const ok = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "support-test" },
    },
  });
const fail = (route: Route, status = 503, code = "DATABASE_UNAVAILABLE") =>
  route.fulfill({
    status,
    json: { success: false, message: "Private server exception", error: { code } },
  });
async function fixture(page: Page, role = "CUSTOMER") {
  const state = {
    records: { enquiries: row(), complaints: row("complaints") },
    messages: [message()],
    hasMore: false,
    listMore: false,
    empty: false,
    failList: false,
    failDetail: false,
    failMessages: false,
    failSource: false,
    unknown: false,
    hold: false,
    releases: [] as (() => void)[],
    contradictory: false,
    stale: false,
    reads: [] as string[],
    writes: [] as { endpoint: string; body: Record<string, unknown>; csrf?: string }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return ok(route, {
        id: id(20),
        user: { id: id(21), role, email: "support@example.test" },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : time,
      });
    if (endpoint === "/auth/csrf")
      return ok(route, { csrfToken: "isolated-support-csrf-".repeat(3) });
    const match = endpoint.match(
      /^\/(customers|staff|public)\/support\/(enquiries|complaints)(?:\/([^/]+))?(?:\/(messages|assignment|status|priority))?$/,
    );
    if (request.method() === "GET") {
      state.reads.push(endpoint + url.search);
      if (endpoint === "/public/branches" || endpoint === "/admin/branches")
        return ok(route, { items: [branch] });
      if (endpoint === "/admin/staff") return ok(route, { items: [profile] });
      if (endpoint === "/staff/profile") return ok(route, profile);
      if (match) {
        const record = state.records[match[2] as keyof typeof state.records];
        if (match[4] === "messages") {
          if (state.failMessages) return fail(route, 403, "FORBIDDEN");
          const items = url.searchParams.has("cursor") ? [message(11)] : state.messages;
          return ok(route, {
            items,
            cursor: items.at(-1)?.id ?? null,
            hasMore: state.hasMore && !url.searchParams.has("cursor"),
            pollAfterMs: 5000,
          });
        }
        if (match[3])
          return state.failDetail ? fail(route, 403, "FORBIDDEN") : ok(route, record);
        if (state.failList) return fail(route);
        return ok(route, {
          items: state.empty || url.searchParams.has("cursor") ? [] : [record],
          ...(state.listMore && !url.searchParams.has("cursor")
            ? { nextCursor: record.id }
            : {}),
        });
      }
      if (state.failSource) return fail(route);
      const sources: Record<string, unknown[]> = {
        "/public/catalog/products": [{ id: id(30), name: "Test part" }],
        "/public/services": [{ id: id(31), name: "Test service" }],
        "/public/vehicles": [{ id: id(32), title: "Test vehicle" }],
        "/customers/bookings": [
          {
            id: id(33),
            service: { id: id(31), name: "Test booked service" },
            scheduledAt: time,
            branch,
            quotes: [{ id: id(34), quoteNumber: "TEST-QUOTE", status: "DRAFT" }],
          },
        ],
        "/customers/orders": [{ id: id(35), orderNumber: "TEST-ORDER" }],
        "/customers/vehicle-transactions": [
          {
            id: id(36),
            transactionNumber: "TEST-SALE",
            vehicleListing: { title: "Test purchased vehicle" },
          },
        ],
      };
      if (sources[endpoint]) return ok(route, { items: sources[endpoint] });
      return ok(route, { items: [] });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    state.writes.push({ endpoint, body, csrf: request.headers()["x-csrf-token"] });
    if (state.hold) await new Promise<void>((resolve) => state.releases.push(resolve));
    if (state.unknown) return fail(route);
    if (state.stale) return fail(route, 409, "CONFLICT");
    if (match) {
      const record = state.records[match[2] as keyof typeof state.records];
      if (!match[3]) {
        if (match[1] === "public")
          return ok(route, {
            id: record.id,
            status: "OPEN",
            createdAt: time,
            priority: "MEDIUM",
          });
        Object.assign(record, body);
        if (state.contradictory) record.type = "PRODUCT";
        return ok(route, record);
      }
      if (match[4] === "messages") {
        const saved = {
          ...message(12),
          body: String(body.message),
          visibility: String(body.visibility ?? "CUSTOMER"),
          authorType: match[1] === "staff" ? "STAFF" : "CUSTOMER",
        };
        if (state.contradictory) saved.visibility = "INTERNAL";
        state.messages.push(saved);
        return ok(route, saved);
      }
      Object.assign(record, body, { version: record.version + 1 });
      if (match[4] === "assignment")
        record.assignedStaff = body.assignedStaffId ? staff : null;
      if (state.contradictory) record.version--;
      return ok(route, record);
    }
    return fail(route, 404, "NOT_FOUND");
  });
  return state;
}
const thread = (kind = "enquiries", staffMode = false) =>
  `${staffMode ? "/admin" : "/dashboard"}/support/${kind}/${id(kind === "enquiries" ? 1 : 5)}`;
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
}
async function fillCreation(page: Page, kind = "enquiries") {
  await page.getByLabel("Subject", { exact: true }).fill("Created test record");
  await page
    .getByLabel(kind === "enquiries" ? "Your message" : "Complaint details", {
      exact: true,
    })
    .fill("Synthetic support request");
}
for (const [type, source, field] of [
  ["GENERAL", 0, ""],
  ["PRODUCT", 30, "productId"],
  ["SERVICE", 31, "serviceId"],
  ["VEHICLE", 32, "vehicleListingId"],
  ["BOOKING", 33, "bookingId"],
  ["QUOTATION", 34, "quoteId"],
] as const) {
  test(`customer creates ${type} enquiry with the correct source and branch`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.goto("/dashboard/support");
    await page.locator("#support-type").selectOption(type);
    if (source) await page.locator("#support-source").selectOption(id(source));
    const explicitBranch = ["GENERAL", "PRODUCT", "SERVICE"].includes(type);
    if (explicitBranch) await page.getByLabel("Handling branch").selectOption(id(2));
    await fillCreation(page);
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      explicitBranch ? branch.name : "related record's branch",
    );
    await confirm(page);
    await expect(page).toHaveURL(thread());
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Created test record",
    );
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body).toEqual({
      type,
      subject: "Created test record",
      message: "Synthetic support request",
      ...(source ? { [field]: id(source) } : {}),
      ...(explicitBranch ? { branchId: id(2) } : {}),
    });
    expect(state.writes[0].csrf).toBeTruthy();
  });
}
for (const [type, source, field] of [
  ["NONE", 0, ""],
  ["BOOKING", 33, "bookingId"],
  ["ORDER", 35, "orderId"],
  ["VEHICLE_TRANSACTION", 36, "vehicleTransactionId"],
] as const) {
  test(`customer creates ${type} complaint without unrelated enquiry fields`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.goto("/dashboard/support");
    await page.getByLabel("Record category").selectOption("complaints");
    await page.getByLabel("Related transaction").selectOption(type);
    if (source) await page.locator("#support-source").selectOption(id(source));
    else await page.getByLabel("Handling branch").selectOption(id(2));
    await fillCreation(page, "complaints");
    await page.getByRole("button", { name: "Review complaint", exact: true }).click();
    await confirm(page);
    await expect(page).toHaveURL(thread("complaints"));
    expect(state.writes[0].body).toEqual({
      subject: "Created test record",
      description: "Synthetic support request",
      ...(source ? { [field]: id(source) } : { branchId: id(2) }),
    });
  });
}
for (const kind of ["enquiries", "complaints"]) {
  test(`public ${kind} validate contact and branch, then submit without account CSRF`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.goto("/contact");
    await page.getByLabel("Contact reason").selectOption(kind);
    await fillCreation(page, kind);
    const review = page.getByRole("button", {
      name: kind === "enquiries" ? "Review enquiry" : "Review complaint",
      exact: true,
    });
    await review.click();
    await expect(page.getByText("Enter your name.", { exact: true })).toBeVisible();
    await page.getByLabel("Your name").fill("Test Guest");
    await page.getByLabel("Email address", { exact: true }).fill("Guest@Example.Test");
    await review.click();
    await expect(
      page.getByText("Choose the branch handling your request."),
    ).toBeVisible();
    await page.getByLabel("Handling branch").selectOption(id(2));
    await review.click();
    await confirm(page);
    await expect(
      page.getByRole("heading", {
        name: kind === "enquiries" ? "Enquiry received" : "Complaint received",
        exact: true,
      }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].endpoint).toBe(`/public/support/${kind}`);
    expect(state.writes[0].body).toMatchObject({
      name: "Test Guest",
      email: "guest@example.test",
      branchId: id(2),
    });
    expect(state.writes[0].csrf).toBeUndefined();
  });
}
test("history uses paginated messages, excludes embedded private fields, and fails closed on internal replies", async ({
  page,
}) => {
  const state = await fixture(page);
  state.hasMore = true;
  await page.goto(thread());
  await expect(page.getByText("Isolated reply 10", { exact: true })).toBeVisible();
  await expect(page.getByText("Isolated reply 99")).toHaveCount(0);
  await expect(page.getByText("private@example.test")).toHaveCount(0);
  const pages = page.getByRole("navigation", { name: "Conversation messages pages" });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Isolated reply 11", { exact: true })).toBeVisible();
  await expect(page.getByText("Isolated reply 10", { exact: true })).toHaveCount(0);
  expect(
    state.reads.some((url) => url.endsWith(`/messages?limit=50&cursor=${id(10)}`)),
  ).toBeTruthy();
  state.messages = [message(13, "INTERNAL")];
  await pages.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Isolated reply 13")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review reply" })).toBeDisabled();
});

test("public product enquiry review shows contact details and fits a narrow screen", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/contact");
  await page.getByLabel("Your name").fill("Test Guest");
  await page.getByLabel("Email address", { exact: true }).fill("guest@example.test");
  await page.locator("#support-type").selectOption("PRODUCT");
  await page.locator("#support-source").selectOption(id(30));
  await page.getByLabel("Handling branch").selectOption(id(2));
  await fillCreation(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await page.evaluate(() =>
    window.scrollTo({ top: window.scrollY, behavior: "instant" }),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("guest@example.test");
  await expect(dialog).toContainText("Test part");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-support-public-320.png"),
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review enquiry", exact: true }),
  ).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test("customer can reply to resolved records, with a fresh closed-record guard", async ({
  page,
}) => {
  const state = await fixture(page);
  state.records.enquiries.status = "RESOLVED";
  await page.goto(thread());
  await page.getByLabel("Reply text").fill("Customer follow-up");
  await page.getByRole("button", { name: "Review reply" }).click();
  await confirm(page);
  await expect(page.getByText("Customer follow-up", { exact: true })).toBeVisible();
  expect(state.writes[0].body).toEqual({ message: "Customer follow-up" });
  expect(state.writes[0].csrf).toBeTruthy();
  await page.getByLabel("Reply text").fill("Late reply");
  await page.getByRole("button", { name: "Review reply" }).click();
  state.records.enquiries.status = "CLOSED";
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("unknown reply locks resubmission and preserves the draft", async ({ page }) => {
  const state = await fixture(page);
  state.unknown = true;
  await page.goto(thread("complaints"));
  await page.getByLabel("Reply text").fill("Uncertain complaint follow-up");
  await page.getByRole("button", { name: "Review reply" }).click();
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/This reply has an unknown outcome/)).toBeVisible();
  await expect(page.getByLabel("Reply text")).toHaveValue(
    "Uncertain complaint follow-up",
  );
  await expect(page.getByRole("button", { name: "Review reply" })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("uncertain creation stays locked across category switches", async ({ page }) => {
  const state = await fixture(page);
  state.contradictory = true;
  await page.goto("/dashboard/support");
  await page.getByLabel("Handling branch").selectOption(id(2));
  await fillCreation(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Record category").selectOption("complaints");
  await page.getByLabel("Record category").selectOption("enquiries");
  await expect(
    page.getByRole("button", { name: "Review enquiry", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("list pagination and filters reset correctly; errors do not masquerade as empty records", async ({
  page,
}) => {
  const state = await fixture(page);
  state.listMore = true;
  await page.goto("/dashboard/support");
  const pages = page.getByRole("navigation", { name: "Support records pages" });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("No support records match this page and filters."),
  ).toBeVisible();
  await page.getByLabel("Record status").selectOption("RESOLVED");
  await expect(pages).toContainText("Page 1");
  await expect.poll(() => state.reads.at(-1)).toContain("status=RESOLVED");
  state.failList = true;
  await page.getByRole("button", { name: "Refresh support records" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("link", { name: "Test enquiry", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("No support records yet.")).toHaveCount(0);
});
test("source failure blocks creation and distinguishes unavailable from empty choices", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failSource = true;
  await page.goto("/dashboard/support");
  await page.locator("#support-type").selectOption("BOOKING");
  await fillCreation(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await expect(page.getByText("Choose the related record.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
for (const visibility of ["INTERNAL", "CUSTOMER"]) {
  test(`staff deliberately sends ${visibility} message with matching visibility`, async ({
    page,
  }) => {
    const state = await fixture(page, "ADMIN");
    state.records.complaints.customerId = null;
    state.messages.push(message(14, "INTERNAL"));
    await page.goto(thread("complaints", true));
    await expect(page.getByText(/submitted without an account/)).toBeVisible();
    await expect(page.getByText("Isolated reply 14", { exact: true })).toBeVisible();
    await page.getByLabel("Message visibility").selectOption(visibility);
    await page.getByLabel("Reply text").fill("Staff test message");
    await page.getByRole("button", { name: "Review reply" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      visibility === "INTERNAL" ? "Staff only" : "Customer-visible",
    );
    await confirm(page);
    await expect(page.getByText("Staff test message", { exact: true })).toBeVisible();
    expect(state.writes[0].body).toEqual({ message: "Staff test message", visibility });
    await expect(page.getByLabel("Message visibility")).toHaveValue("CUSTOMER");
  });
}
for (const kind of ["enquiries", "complaints"]) {
  test(`staff resolves and closes ${kind} with version checks and customer-visible text`, async ({
    page,
  }) => {
    const state = await fixture(page, "ADMIN");
    await page.goto(thread(kind, true));
    await page.getByLabel("New status").selectOption("RESOLVED");
    await page.getByRole("button", { name: "Review support change" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByLabel("Customer-visible response or resolution")
      .fill("Test resolution text");
    await page.getByRole("button", { name: "Review support change" }).click();
    await expect(page.getByRole("dialog")).toContainText("Test resolution text");
    await confirm(page);
    await expect(page.getByText("Support change saved.", { exact: true })).toBeVisible();
    expect(state.writes[0].body).toEqual({
      expectedVersion: 0,
      status: "RESOLVED",
      [kind === "enquiries" ? "response" : "resolution"]: "Test resolution text",
    });
    await page.getByLabel("New status").selectOption("CLOSED");
    await page.getByRole("button", { name: "Review support change" }).click();
    await confirm(page);
    await expect(
      page.getByText("This record is closed and cannot receive further messages."),
    ).toBeVisible();
    expect(state.writes[1].body).toEqual({ expectedVersion: 1, status: "CLOSED" });
    await expect(page.getByLabel("Reply text")).toHaveCount(0);
  });
}
test("staff assignment, removal and complaint priority use exact server versions", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  await page.goto(thread("complaints", true));
  await page.getByLabel("Action", { exact: true }).selectOption("assignment");
  await page.getByLabel("Staff member", { exact: true }).selectOption(id(3));
  await page.getByRole("button", { name: "Review support change" }).click();
  await expect(page.getByRole("dialog")).toContainText("Test Handler");
  await confirm(page);
  await expect(page.getByText("Support change saved.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Action", { exact: true })).toHaveValue("status");
  await page.getByLabel("Action", { exact: true }).selectOption("assignment");
  await page.getByLabel("Remove the current assignment").check();
  await page.getByRole("button", { name: "Review support change" }).click();
  await confirm(page);
  await expect(page.getByLabel("Action", { exact: true })).toHaveValue("status");
  await page.getByLabel("Action", { exact: true }).selectOption("priority");
  await page.getByLabel("New priority").selectOption("URGENT");
  await page.getByRole("button", { name: "Review support change" }).click();
  await confirm(page);
  await expect(page.getByLabel("Action", { exact: true })).toHaveValue("status");
  expect(state.writes.map((write) => write.body)).toEqual([
    { expectedVersion: 0, assignedStaffId: id(3) },
    { expectedVersion: 1, assignedStaffId: null },
    { expectedVersion: 2, priority: "URGENT" },
  ]);
});
for (const unknown of [false, true]) {
  test(`${unknown ? "unknown" : "stale"} staff change does not replay`, async ({
    page,
  }) => {
    const state = await fixture(page, "ADMIN");
    state.unknown = unknown;
    state.stale = !unknown;
    await page.goto(thread("enquiries", true));
    await page.getByLabel("New status").selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "Review support change" }).click();
    await confirm(page);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    if (unknown)
      await expect(
        page.getByRole("button", { name: "Review support change" }),
      ).toBeDisabled();
    expect(state.writes).toHaveLength(1);
  });
}
test("admin queue sends branch, assignment, type and priority filters", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  await page.goto("/admin/support");
  await page.getByLabel("Branch filter", { exact: true }).selectOption(id(2));
  await page.getByLabel("Assigned staff filter", { exact: true }).selectOption(id(3));
  await page.getByLabel("Enquiry type", { exact: true }).selectOption("PRODUCT");
  await expect
    .poll(() =>
      state.reads.filter((url) => url.startsWith("/staff/support/enquiries?")).at(-1),
    )
    .toContain(`type=PRODUCT&branchId=${id(2)}&assignedStaffId=${id(3)}`);
  await page.getByLabel("Record category").selectOption("complaints");
  await page.getByLabel("Complaint priority").selectOption("HIGH");
  await expect
    .poll(() =>
      state.reads.filter((url) => url.startsWith("/staff/support/complaints?")).at(-1),
    )
    .toContain("priority=HIGH");
});
test("ordinary staff assignment choices do not call the admin directory", async ({
  page,
}) => {
  const state = await fixture(page, "STAFF");
  await page.goto(thread("enquiries", true));
  await page.getByLabel("Action", { exact: true }).selectOption("assignment");
  await page.getByLabel("Staff member", { exact: true }).selectOption(id(3));
  await expect(page.getByText(/choose your own branch profile/)).toBeVisible();
  expect(state.reads.some((url) => url.startsWith("/admin/staff"))).toBeFalsy();
});
test("failed message and detail reads remove previously displayed private data", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(thread());
  await expect(page.getByText("Isolated reply 10", { exact: true })).toBeVisible();
  state.failMessages = true;
  await page.getByRole("button", { name: "Refresh messages" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("Isolated reply 10", { exact: true })).toHaveCount(0);
  state.failDetail = true;
  await page.getByRole("button", { name: "Refresh record", exact: true }).click();
  await expect(page.getByText("Original test enquiry", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Reply text")).toHaveCount(0);
});
test("changing accounts clears private conversations and unsent drafts", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(thread());
  await page.getByLabel("Reply text").fill("Private unsent draft");
  await page.getByRole("button", { name: "Review reply" }).click();
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Isolated reply 10", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Reply text")).toHaveCount(0);
  await expect(page.getByText("Private unsent draft")).toHaveCount(0);
});

test("long support subjects and contact details wrap on narrow screens", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  state.records.complaints.subject = "S".repeat(160);
  state.records.complaints.email = `${"e".repeat(64)}@${"d".repeat(63)}.example.test`;
  state.records.complaints.description = "D".repeat(4000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(thread("complaints", true));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    state.records.complaints.subject,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test("navigating between enquiry and complaint threads clears prior history and draft", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(thread());
  await page.getByLabel("Reply text").fill("Draft from previous thread");
  await page.getByRole("link", { name: "Back to customer care", exact: true }).click();
  state.messages = [message(15)];
  await page.getByLabel("Record category").selectOption("complaints");
  await page.getByRole("link", { name: "Test complaint", exact: true }).click();
  await expect(page.getByText("Isolated reply 15", { exact: true })).toBeVisible();
  await expect(page.getByText("Isolated reply 10", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Reply text")).toHaveValue("");
});

for (const [width, staffMode] of [
  [320, false],
  [390, true],
  [1280, true],
] as const) {
  test(`support is accessible at ${width}px with keyboard review and no overflow`, async ({
    page,
  }) => {
    await fixture(page, staffMode ? "ADMIN" : "CUSTOMER");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => {
      if (["error", "warning"].includes(entry.type())) errors.push(entry.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(thread("complaints", staffMode));
    await expect(page).toHaveURL(thread("complaints", staffMode));
    await expect(page).toHaveTitle(/Support conversation/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Test complaint");
    await expect(
      page.getByRole("button", { name: "Quick help", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-support-page-${width}.png`),
    });
    const reply = page.getByLabel("Reply text");
    await reply.fill("Accessible test reply");
    await expect(page.getByRole("button", { name: "Review reply" })).toBeEnabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Review reply" }).click();
    await page.evaluate(() =>
      window.scrollTo({ top: window.scrollY, behavior: "instant" }),
    );
    const dialog = page.getByRole("dialog");
    const bounds = await dialog.boundingBox();
    expect(bounds?.y).toBeGreaterThanOrEqual(0);
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(900);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-support-${width}.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Review reply" })).toBeFocused();
    await expect(reply).toHaveValue("Accessible test reply");
    expect(errors).toEqual([]);
  });
}

async function guestDraft(page: Page, kind: string) {
  await page.getByLabel("Contact reason").selectOption(kind);
  await page.getByLabel("Your name").fill("Previous Guest");
  await page.getByLabel("Email address", { exact: true }).fill("previous@example.test");
  await page.getByLabel("Phone number (optional)").fill("08012345678");
  await page.getByLabel("Handling branch").selectOption(id(2));
  await fillCreation(page, kind);
}
async function changePublicSession(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(
    page.getByText(/Your session changed. Please enter your contact details again/),
  ).toBeVisible();
}
async function expectClearedGuest(page: Page, kind: string) {
  for (const label of [
    "Your name",
    "Email address",
    "Phone number (optional)",
    "Subject",
    kind === "enquiries" ? "Your message" : "Complaint details",
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Handling branch")).toHaveValue("");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("previous@example.test", { exact: true })).toHaveCount(0);
}
for (const kind of ["enquiries", "complaints"]) {
  for (const stage of ["draft", "review", "pending", "unknown", "complete"]) {
    test(`public ${kind} clear ${stage} data on session change and retain uncertain locks`, async ({
      page,
    }) => {
      const state = await fixture(page);
      state.hold = stage === "pending";
      state.unknown = stage === "unknown";
      await page.goto("/contact");
      await guestDraft(page, kind);
      const review = page.getByRole("button", {
        name: kind === "enquiries" ? "Review enquiry" : "Review complaint",
        exact: true,
      });
      if (stage !== "draft") await review.click();
      if (["pending", "unknown", "complete"].includes(stage)) {
        await confirm(page);
        await expect.poll(() => state.writes.length).toBe(1);
        if (stage === "unknown")
          await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
        if (stage === "complete")
          await expect(
            page.getByRole("heading", {
              name: kind === "enquiries" ? "Enquiry received" : "Complaint received",
              exact: true,
            }),
          ).toBeVisible();
      }
      await changePublicSession(page);
      state.releases.forEach((release) => release());
      await expectClearedGuest(page, kind);
      const locked = ["pending", "unknown"].includes(stage);
      if (locked) {
        await expect(review).toBeDisabled();
        await expect(
          page.getByText("This submission has an unknown outcome.", { exact: false }),
        ).toBeVisible();
        await page
          .getByLabel("Contact reason")
          .selectOption(kind === "enquiries" ? "complaints" : "enquiries");
        await page.getByLabel("Contact reason").selectOption(kind);
        await expect(review).toBeDisabled();
        await changePublicSession(page);
        await expect(review).toBeDisabled();
      } else {
        await expect(review).toBeEnabled();
        await guestDraft(page, kind);
        await review.click();
        await expect(page.getByRole("dialog")).toContainText("Previous Guest");
        await page.keyboard.press("Escape");
      }
      expect(state.writes).toHaveLength(
        ["pending", "unknown", "complete"].includes(stage) ? 1 : 0,
      );
    });
  }
}
test("session invalidation during form validation cannot reopen a stale contact proposal", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/contact");
  await guestDraft(page, "enquiries");
  await page.getByLabel("Your name").evaluate((input) => {
    (input.closest("form") as HTMLFormElement).requestSubmit();
    window.dispatchEvent(new Event("aat:session-changed"));
  });
  await expect(
    page.getByText(/Your session changed. Please enter your contact details again/),
  ).toBeVisible();
  await expectClearedGuest(page, "enquiries");
  expect(state.writes).toHaveLength(0);
});
