import { test, expect, type Route, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const record = () => ({
  id: id(1),
  customerId: id(2),
  bookingSlotId: id(3),
  version: 7,
  status: "CONFIRMED",
  scheduledAt: "2026-09-25T09:00:00Z",
  service: {
    id: id(4),
    name: "Isolated workshop service",
    slug: "isolated-service",
    description: null,
    shortDescription: null,
    pricingType: "FIXED",
    priceKobo: "10000",
    currency: "NGN",
    durationMinutes: 60,
    version: 1,
  },
  branch: { id: id(5), name: "Isolated branch", code: "TEST" },
  assignedStaff: { id: id(6), firstName: "Test", lastName: "Technician" },
  vehicle: null,
  customerNotes: "Test appointment note",
  staffNotes: null,
  depositAmountKobo: "3000",
  depositPaidAt: "2026-09-13T09:00:00Z",
  paymentHoldExpiresAt: null,
  customerRescheduleCount: 0,
  disruptionRequestedAt: null,
  disruptionReason: null,
  disruptionResolution: null,
  depositPayment: { id: id(7), status: "SUCCEEDED", amountKobo: "3000" },
  quotes: [],
  workOrder: null,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated test",
      data,
      meta: { requestId: "staff-booking-test" },
    },
  });

type Options = {
  expiresAt?: string;
  revision?: number;
  role?: string;
  assigned?: boolean;
  profileMissing?: boolean;
  profileError?: boolean;
  bookingError?: number;
  status?: string;
  quotes?: string[];
};
async function fixture(page: Page, options: Options = {}) {
  const writes: unknown[] = [];
  const role = options.role ?? "STAFF";
  const quote = (status: string, index: number) => ({
    id: id(20 + index),
    quoteNumber: `Q-2026-${1042 + index}`,
    version: 2,
    revision: options.revision ?? 3,
    status,
    subtotalKobo: "4500000",
    taxKobo: "337500",
    totalKobo: "4837500",
    expiresAt: options.expiresAt ?? "2027-01-10T16:00:00Z",
    notes: "Confirm the diagnostic findings before proceeding.",
    items: [
      {
        id: id(40 + index),
        type: "LABOUR",
        productId: null,
        description: "Engine diagnostics and assessment",
        quantity: 1,
        unitPriceKobo: "4500000",
        subtotalKobo: "4500000",
      },
    ],
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session") {
      if (role === "ANONYMOUS")
        return route.fulfill({
          status: 401,
          json: { success: false, error: { code: "UNAUTHENTICATED" } },
        });
      return reply(route, {
        id: id(8),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: "2026-10-07T09:00:00Z",
        user: { id: id(9), email: "quotation@example.test", role },
      });
    }
    if (endpoint === "/staff/profile") {
      if (options.profileError)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      return reply(route, {
        id: id(9),
        email: "quotation@example.test",
        role,
        status: "ACTIVE",
        capabilities: [],
        staffProfile: options.profileMissing
          ? null
          : { id: id(6), firstName: "Test", lastName: "Technician", branchId: id(5) },
      });
    }
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "quotation-quality-csrf-".repeat(3) });
    if (endpoint === `/staff/bookings/${id(1)}`) {
      if (options.bookingError)
        return route.fulfill({
          status: options.bookingError,
          json: { success: false, error: { code: "FORBIDDEN" } },
        });
      return reply(route, {
        ...record(),
        status: options.status ?? "CONFIRMED",
        assignedStaff:
          options.assigned === false
            ? { id: id(90), firstName: "Another", lastName: "Technician" }
            : record().assignedStaff,
        depositAmountKobo: null,
        depositPaidAt: null,
        depositPayment: null,
        quotes: (options.quotes ?? ["DRAFT"]).map(quote),
      });
    }
    if (request.method() !== "GET") {
      writes.push(request.postDataJSON());
      return route.fulfill({
        status: 409,
        json: {
          success: false,
          error: {
            code: "STALE_VERSION",
            message: "This record changed. Refresh the booking.",
          },
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  await page.goto(`/admin/bookings/${id(1)}`);
  return { writes };
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`quotation editor, saved record and review fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { writes } = await fixture(page);
    const section = page.getByRole("region", { name: "Quotations", exact: true });
    await expect(
      section.getByRole("heading", { name: "Q-2026-1042", exact: true }),
    ).toBeVisible();
    await section.getByRole("button", { name: "Edit draft", exact: true }).click();
    await expect(
      section.getByRole("heading", { name: "Edit draft Q-2026-1042" }),
    ).toBeFocused();
    const positions = await page.evaluate(() =>
      ["quote-editor-0-quantity", "quote-editor-0-price"].map(
        (id) => document.getElementById(id)!.getBoundingClientRect().y,
      ),
    );
    expect(positions[0]).toBe(positions[1]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    if ([320, 390, 768, 1024, 1440, 1536].includes(width)) {
      const editorAccessibility = await new AxeBuilder({ page })
        .include(".staff-quotations")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(editorAccessibility.violations).toEqual([]);
    }
    await section.getByRole("button", { name: "Review quotation draft" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
    const box = await dialog.boundingBox();
    const firstFact = await dialog.locator(".spec-row").first().boundingBox();
    expect(firstFact!.width).toBeGreaterThan(box!.width * 0.7);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.height).toBeLessThanOrEqual(900);
    expect(writes).toEqual([]);
    if ([320, 390, 768, 1024, 1440, 1536].includes(width)) {
      const a11y = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(a11y.violations).toEqual([]);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await section.getByRole("button", { name: "Close editor" }).click();
    await expect(
      section.getByRole("heading", { name: "Quotations", exact: true }),
    ).toBeFocused();
  });
}
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} can prepare a quotation with a valid staff profile`, async ({ page }) => {
    await fixture(page, { role });
    await page.getByRole("button", { name: "Create quotation" }).click();
    await expect(page.getByRole("heading", { name: "New quotation" })).toBeVisible();
  });
}
for (const role of ["CUSTOMER", "ANONYMOUS"]) {
  test(`${role} cannot reach quotation mutations`, async ({ page }) => {
    const { writes } = await fixture(page, { role });
    await expect(page).toHaveURL(role === "CUSTOMER" ? /\/dashboard$/ : /\/login\?/);
    await expect(page.getByRole("button", { name: "Create quotation" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review issue", exact: true }),
    ).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}
test("staff assigned elsewhere can read saved quotes without mutation controls", async ({
  page,
}) => {
  await fixture(page, { assigned: false });
  await expect(
    page.getByRole("heading", { name: "Q-2026-1042", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Quotation changes are available to the assigned workshop staff and authorised administrators.",
    ),
  ).toBeVisible();
  for (const name of ["Create quotation", "Edit draft", "Review issue", "Review void"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
});
test("administrator without a staff profile can issue but cannot author drafts", async ({
  page,
}) => {
  await fixture(page, { role: "ADMIN", profileMissing: true });
  await expect(
    page.getByRole("button", { name: "Review issue", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create quotation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit draft" })).toHaveCount(0);
});
test("failed permission read leaves quotations readable and mutations hidden", async ({
  page,
}) => {
  await fixture(page, { profileError: true });
  await expect(
    page.getByRole("heading", { name: "Q-2026-1042", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review issue", exact: true }),
  ).toHaveCount(0);
});
test("denied booking cannot expose quotation records", async ({ page }) => {
  await fixture(page, { bookingError: 403 });
  await expect(
    page.getByRole("heading", { name: "Manage workshop booking" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quotations", exact: true }),
  ).toHaveCount(0);
});
test("empty and closed booking states have useful guidance and no new-draft action", async ({
  page,
}) => {
  await fixture(page, { status: "COMPLETED", quotes: [] });
  await expect(page.getByText("No quotations recorded.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create quotation" })).toHaveCount(0);
});
test("quotation history shows human-readable status and server totals", async ({
  page,
}) => {
  await fixture(page, {
    quotes: ["DRAFT", "ISSUED", "ACCEPTED", "REJECTED", "EXPIRED", "VOID"],
  });
  for (const [i, status] of [
    "Draft",
    "Issued",
    "Accepted",
    "Rejected",
    "Expired",
    "Void",
  ].entries()) {
    const article = page.getByRole("article", { name: `Q-2026-${1042 + i}` });
    await expect(article.getByText(status, { exact: true })).toBeVisible();
    await expect(article.locator(".quotation-totals dd")).toContainText([
      "45,000.00",
      "3,375.00",
      "48,375.00",
    ]);
    if (i > 1) await expect(article.getByRole("button")).toHaveCount(0);
  }
});
test("invalid amounts, quantities and Lagos expiry never open confirmation", async ({
  page,
}) => {
  const { writes } = await fixture(page, { quotes: [] });
  await page.getByRole("button", { name: "Create quotation" }).click();
  await page.getByLabel("Description", { exact: true }).fill("Diagnostic labour");
  await page.getByLabel("Unit price (NGN)").fill("1.001");
  await page.getByRole("button", { name: "Review quotation draft" }).click();
  await expect(
    page.getByText("Enter a valid NGN amount with up to two decimal places."),
  ).toBeVisible();
  await page.getByLabel("Unit price (NGN)").fill("1.01");
  await page.getByLabel("Quantity", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Review quotation draft" }).click();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Draft expiry (Lagos time)").fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "Review quotation draft" }).click();
  await expect(page.getByText("Choose a future expiry in Lagos time.")).toBeVisible();
  await expect(page.getByLabel("Draft expiry (Lagos time)")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([]);
});
test("removing the final line preserves focus and prevents empty draft", async ({
  page,
}) => {
  await fixture(page, { quotes: [] });
  await page.getByRole("button", { name: "Create quotation" }).click();
  await page.getByRole("button", { name: "Remove line 1" }).click();
  await expect(page.getByRole("button", { name: "Add line item" })).toBeFocused();
  await page.getByRole("button", { name: "Review quotation draft" }).click();
  await expect(page.getByText("Add at least one line item.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("quotation Help accurately describes the anonymous enquiry flow", async ({
  page,
}) => {
  await page.goto("/help/request-a-quotation");
  await expect(
    page.getByText(/You do not need to sign in to send this enquiry/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Find a service" })).toHaveAttribute(
    "href",
    "/services",
  );
});
test("Enter searches catalogue choices without submitting a quotation", async ({
  page,
}) => {
  await fixture(page, { quotes: [] });
  const searches: string[] = [];
  await page.route("**/api/v1/public/catalog/products?**", (route) => {
    searches.push(new URL(route.request().url()).searchParams.get("search") ?? "");
    return reply(route, { items: [], nextCursor: undefined });
  });
  await page.getByRole("button", { name: "Create quotation" }).click();
  await page.getByLabel("Line type").selectOption("PART");
  await page.getByLabel("Find a part by name or SKU").fill("oil filter");
  await page.getByLabel("Find a part by name or SKU").press("Enter");
  await expect.poll(() => searches).toContain("oil filter");
  await expect(page.getByText("No parts match this search.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Choose a catalogue part.")).toHaveCount(0);
});
test("assignment changes discard an open quotation draft after refresh", async ({
  page,
}) => {
  const options: Options = { assigned: true };
  await fixture(page, options);
  await page.getByRole("button", { name: "Create quotation" }).click();
  await page.getByLabel("Description", { exact: true }).fill("A private unsaved draft");
  options.assigned = false;
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(page.locator(".quotation-access-note")).toBeVisible();
  await expect(page.locator(".quotation-editor")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review issue", exact: true }),
  ).toHaveCount(0);
});
for (const action of ["void", "expire"] as const) {
  test(`${action} reviews the quotation and refreshes its persisted state`, async ({
    page,
  }) => {
    const options: Options = {
      quotes: [action === "void" ? "DRAFT" : "ISSUED"],
      expiresAt: "2020-01-01T00:00:00Z",
    };
    await fixture(page, options);
    let count = 0;
    await page.route(
      `**/api/v1/staff/bookings/${id(1)}/quotes/${id(20)}/${action}`,
      (route) => {
        expect(route.request().method()).toBe("POST");
        expect(route.request().postDataJSON()).toEqual({ expectedRevision: 3 });
        expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
        count++;
        options.quotes = [action === "void" ? "VOID" : "EXPIRED"];
        options.revision = 4;
        return reply(route, {});
      },
    );
    await page
      .getByRole("button", {
        name: action === "void" ? "Review void" : "Review expiry",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("dialog").getByText(/does not record a payment or refund/),
    ).toBeVisible();
    expect(count).toBe(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change" })
      .click();
    const article = page.getByRole("article", { name: "Q-2026-1042" });
    await expect(
      article.getByText(action === "void" ? "Void" : "Expired", { exact: true }),
    ).toBeVisible();
    await expect(article.getByText("Version 2 · Revision 4")).toBeVisible();
    await expect(article.getByRole("button")).toHaveCount(0);
    expect(count).toBe(1);
  });
}
for (const viewport of [
  { width: 390, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`long quotation review stays usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await fixture(page);
    await page.getByRole("button", { name: "Edit draft", exact: true }).click();
    await page
      .getByLabel("Quotation notes (optional)")
      .fill(
        "Confirm the diagnostic findings with the customer before further work. ".repeat(
          45,
        ),
      );
    await page.getByRole("button", { name: "Review quotation draft" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    const confirm = dialog.getByRole("button", { name: "Confirm change" });
    await expect(confirm).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole("button", { name: "Go back" })).toBeInViewport({
      ratio: 1,
    });
    const content = dialog.getByRole("region", { name: "Review details" });
    expect(await content.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await content.focus();
    await page.keyboard.press("End");
    await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Quotation notes (optional)")).toHaveValue(
      /Confirm the diagnostic findings/,
    );
  });
}
