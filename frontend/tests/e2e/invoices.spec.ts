import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { writeFile } from "node:fs/promises";
const id = (value: number) =>
  `50000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Isolated fixture",
      meta: { requestId: "invoice-test" },
    },
  });
const invoice = () => ({
  id: id(1),
  invoiceNumber: "ISOLATED-INVOICE-001",
  currency: "NGN",
  status: "DRAFT",
  version: 0,
  subtotalKobo: "10005",
  taxKobo: "500",
  depositCreditKobo: "302",
  totalKobo: "10203",
  issuedAt: null as string | null,
  dueAt: null as string | null,
  paidAt: null,
  createdAt: "2026-09-17T09:00:00Z",
  order: null,
  booking: { id: id(2) },
  vehicleTransaction: null,
  payments: [] as {
    id: string;
    paymentNumber: string;
    status: string;
    amountKobo: string;
    succeededAt: string | null;
  }[],
});
async function fixture(
  page: Page,
  handler: (route: Route, endpoint: string) => Promise<boolean | void>,
  role = "ADMIN",
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(3),
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-17T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        user: { id: id(4), email: "invoices@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-token-".repeat(4) });
    if (endpoint === "/public/branches") return reply(route, { items: [] });
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
for (const width of [390, 1440])
  test(`existing invoice payment conflict has a recovery link at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [],
      consoleMessages: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type()))
        consoleMessages.push(message.text());
    });
    const record = { ...invoice(), status: "ISSUED", issuedAt: "2026-09-17T09:00:00Z" };
    let writes = 0;
    await fixture(
      page,
      async (route, endpoint) => {
        if (endpoint === `/customers/invoices/${record.id}`) {
          await reply(route, record);
          return true;
        }
        if (endpoint === "/customers/payments" && route.request().method() === "POST") {
          writes++;
          expect(route.request().postDataJSON()).toEqual({
            targetType: "INVOICE",
            targetId: record.id,
            purpose: "SERVICE_INVOICE",
          });
          await route.fulfill({
            status: 409,
            json: {
              success: false,
              error: {
                code: "PAYMENT_TARGET_PENDING",
                message: "private diagnostic must not render",
              },
            },
          });
          return true;
        }
        if (endpoint === "/customers/payments") {
          await reply(route, { items: [] });
          return true;
        }
      },
      "CUSTOMER",
    );
    await page.goto(`/dashboard/invoices/${record.id}`);
    await expect(page.getByRole("heading", { name: "Invoice details" })).toBeVisible();
    await expect(page).toHaveTitle(/Allied AutoTech/);
    await page.getByRole("button", { name: "Prepare invoice payment" }).click();
    await expect(
      page.getByText(
        "A payment already exists for this purchase or invoice. Open Payments and check the existing request before paying again.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText("private diagnostic must not render")).toHaveCount(0);
    const recovery = page.getByRole("link", {
      name: "View existing payments",
      exact: true,
    });
    await expect(recovery).toBeVisible();
    await expect(recovery).toHaveAttribute("href", "/dashboard/payments");
    await expect(
      page.getByRole("button", { name: "Prepare invoice payment" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.locator("nextjs-error-overlay")).toHaveCount(0);
    await recovery.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-invoice-payment-conflict-${width}.png`),
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await recovery.click();
    await expect(page).toHaveURL(/\/dashboard\/payments$/);
    expect(writes).toBe(1);
    expect(errors).toEqual([]);
    await writeFile(
      path.join(os.tmpdir(), `allied-invoice-payment-conflict-${width}-console.json`),
      JSON.stringify(consoleMessages, null, 2),
    );
  });
test("invoice creation uses the selected source, server credit and versioned issue/void", async ({
  page,
}) => {
  const record = invoice();
  let created = false;
  const writes: { endpoint: string; body: unknown }[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/orders") {
      await reply(route, { items: [] });
      return true;
    }
    if (endpoint === "/staff/bookings") {
      await reply(route, {
        items: [
          {
            id: id(2),
            status: "COMPLETED",
            service: { name: "Isolated accepted service" },
            branch: { name: "Test branch" },
            quotes: [{ status: "ACCEPTED" }],
          },
          {
            id: id(5),
            status: "CONFIRMED",
            service: { name: "Unaccepted service" },
            branch: null,
            quotes: [{ status: "DRAFT" }],
          },
        ],
      });
      return true;
    }
    if (endpoint === "/staff/invoices" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      writes.push({ endpoint, body });
      created = true;
      record.dueAt = body.dueAt;
      await reply(route, record);
      return true;
    }
    if (endpoint === "/staff/invoices") {
      await reply(route, { items: created ? [record] : [] });
      return true;
    }
    if (endpoint === `/staff/invoices/${record.id}`) {
      await reply(route, record);
      return true;
    }
    if (endpoint.endsWith("/issue") || endpoint.endsWith("/void")) {
      writes.push({ endpoint, body: route.request().postDataJSON() });
      record.version++;
      record.status = endpoint.endsWith("/issue") ? "ISSUED" : "VOID";
      if (record.status === "ISSUED") record.issuedAt = new Date().toISOString();
      await reply(route, record);
      return true;
    }
  });
  await page.goto("/admin/invoices");
  await page.getByRole("button", { name: "Create an invoice", exact: true }).click();
  await page.getByRole("button", { name: "Review draft invoice" }).click();
  await expect(page.getByLabel("Source record")).toBeFocused();
  await page.getByLabel("Invoice source type").selectOption("BOOKING");
  await expect(page.getByRole("option", { name: /Unaccepted service/ })).toHaveCount(0);
  await page.getByLabel("Source record").selectOption(id(2));
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Due date (optional, Lagos time)").fill(`${tomorrow}T12:30`);
  await page.getByRole("button", { name: "Review draft invoice" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "does not record or collect a payment",
  );
  expect(writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/invoices/${record.id}$`));
  await expect(page.getByRole("heading", { name: record.invoiceNumber })).toBeVisible();
  expect(writes[0].body).toEqual({
    sourceType: "BOOKING",
    sourceId: id(2),
    dueAt: `${tomorrow}T12:30:00+01:00`,
  });
  await expect(
    page.locator("dt", { hasText: /^Deposit credit applied$/ }).locator("+ dd"),
  ).toContainText("3.02");
  await expect(
    page.locator("dt", { hasText: /^Invoice total$/ }).locator("+ dd"),
  ).toContainText("102.03");
  await page.getByRole("button", { name: "Review invoice issue" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("ISSUED");
  expect(writes[1].body).toEqual({ expectedVersion: 0 });
  await page.getByRole("button", { name: "Review invoice void" }).click();
  await expect(page.getByRole("dialog")).toContainText("does not refund a payment");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("VOID");
  expect(writes[2].body).toEqual({ expectedVersion: 1 });
  await expect(page.getByRole("button", { name: "Review invoice issue" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review invoice void" })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 740 });
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
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-invoice-mobile.png"),
    fullPage: true,
  });
});

test("lost invoice creation is not resubmitted and source paging preserves the selected order", async ({
  page,
}) => {
  let writes = 0;
  let created = false;
  const record = invoice();
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/orders") {
      const second = new URL(route.request().url()).searchParams.has("cursor");
      await reply(route, {
        items: second
          ? []
          : [
              {
                id: id(6),
                orderNumber: "ISOLATED-ORDER",
                status: "PENDING",
                totalKobo: "10203",
                branch: { name: "Test branch" },
                invoice: null,
              },
            ],
        ...(second ? {} : { nextCursor: id(6) }),
      });
      return true;
    }
    if (endpoint === "/staff/invoices") {
      if (route.request().method() === "POST") {
        writes++;
        created = true;
        await route.abort("failed");
      } else await reply(route, { items: created ? [record] : [] });
      return true;
    }
  });
  await page.goto("/admin/invoices");
  await page.getByRole("button", { name: "Create an invoice", exact: true }).click();
  await page.getByLabel("Source record").selectOption(id(6));
  await page
    .getByRole("navigation", { name: "Invoice sources pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect(page.getByLabel("Source record")).toHaveValue(id(6));
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Review draft invoice" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(page.getByRole("link", { name: record.invoiceNumber })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review draft invoice" })).toBeDisabled();
  await page.getByRole("button", { name: "Close invoice form" }).click();
  await page.getByRole("button", { name: "Create an invoice", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review draft invoice" })).toBeDisabled();
  expect(writes).toBe(1);
});

test("invoice failures are not empty lists and a successful payment prevents void controls", async ({
  page,
}) => {
  const record = invoice();
  record.status = "ISSUED";
  record.payments.push({
    id: id(8),
    paymentNumber: "ISOLATED-PAYMENT",
    status: "SUCCEEDED",
    amountKobo: record.totalKobo,
    succeededAt: "2026-09-17T09:00:00Z",
  });
  let recovered = false;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/invoices") {
      if (!recovered)
        await route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      else
        await reply(route, {
          items: new URL(route.request().url()).searchParams.has("status")
            ? []
            : [record],
        });
      return true;
    }
    if (endpoint === `/staff/invoices/${record.id}`) {
      await reply(route, record);
      return true;
    }
  });
  await page.goto("/admin/invoices");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    page.getByRole("heading", { name: "No invoices on this page" }),
  ).toHaveCount(0);
  recovered = true;
  await page.getByRole("button", { name: "Refresh invoices" }).click();
  await page.getByLabel("Invoice status").selectOption("VOID");
  await expect(
    page.getByRole("heading", { name: "No invoices match these filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear invoice filter" }).click();
  await page.getByRole("link", { name: record.invoiceNumber }).click();
  await expect(page.getByRole("heading", { name: "ISOLATED-PAYMENT" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review invoice void" })).toHaveCount(0);
});

test("administrator invoice filters validate customer references and reset cursor paging", async ({
  page,
}) => {
  const queries: URLSearchParams[] = [];
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/public/branches") {
        await reply(route, { items: [{ id: id(20), name: "Invoice filter branch" }] });
        return true;
      }
      if (endpoint === "/staff/invoices") {
        queries.push(new URL(route.request().url()).searchParams);
        await reply(route, { items: [invoice()], nextCursor: id(1) });
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/invoices");
  await page
    .getByRole("navigation", { name: "Invoices pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect.poll(() => queries.at(-1)?.get("cursor")).toBe(id(1));
  await page.getByRole("button", { name: "Filter by branch or customer" }).click();
  await page.getByLabel("Active branch (optional)").selectOption(id(20));
  await page.getByLabel("Customer profile reference (optional)").fill("not-a-profile-id");
  await page.getByRole("button", { name: "Apply invoice filters" }).click();
  await expect(page.getByLabel("Customer profile reference (optional)")).toBeFocused();
  await expect(
    page.getByText("Enter an existing profile reference in UUID format."),
  ).toBeVisible();
  await page.getByLabel("Customer profile reference (optional)").fill(id(21));
  await page.getByRole("button", { name: "Apply invoice filters" }).click();
  await expect.poll(() => queries.at(-1)?.get("customerId")).toBe(id(21));
  expect(queries.at(-1)?.get("branchId")).toBe(id(20));
  expect(queries.at(-1)?.has("cursor")).toBe(false);
  expect(page.url()).not.toContain(id(21));
  await page.getByRole("button", { name: "Clear invoice filters", exact: true }).click();
  await expect(page.getByLabel("Customer profile reference (optional)")).toHaveValue("");
  await expect(page.getByLabel("Active branch (optional)")).toHaveValue("");
  await expect.poll(() => queries.at(-1)?.has("customerId")).toBe(false);
});

test("vehicle invoice selection excludes ineligible sources and sends only the chosen source", async ({
  page,
}) => {
  const record = {
    ...invoice(),
    booking: null,
    vehicleTransaction: { id: id(22), transactionNumber: "ISOLATED-VEHICLE-SALE" },
  };
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/orders") {
      await reply(route, { items: [] });
      return true;
    }
    if (endpoint === "/staff/vehicle-transactions") {
      const source = {
        id: id(22),
        transactionNumber: "ISOLATED-VEHICLE-SALE",
        status: "PAID",
        agreedPriceKobo: "10203",
        customerId: id(23),
        vehicleListing: { title: "Isolated vehicle" },
      };
      await reply(route, {
        items: [
          source,
          { ...source, id: id(24), transactionNumber: "ENQUIRY-ONLY", status: "ENQUIRY" },
          {
            ...source,
            id: id(25),
            transactionNumber: "UNLINKED-CUSTOMER",
            customerId: null,
          },
        ],
      });
      return true;
    }
    if (endpoint === "/staff/invoices") {
      if (route.request().method() === "POST") {
        writes.push(route.request().postDataJSON());
        await reply(route, record);
      } else await reply(route, { items: [] });
      return true;
    }
    if (endpoint === `/staff/invoices/${record.id}`) {
      await reply(route, record);
      return true;
    }
  });
  await page.goto("/admin/invoices");
  await page.getByRole("button", { name: "Filter by branch or customer" }).click();
  await expect(page.getByLabel("Active branch (optional)")).toBeVisible();
  await page.getByRole("button", { name: "Create an invoice", exact: true }).click();
  await page.getByLabel("Invoice source type").selectOption("VEHICLE_TRANSACTION");
  await page.getByLabel("Source record").selectOption(id(22));
  await expect(
    page.getByRole("option", { name: /ENQUIRY-ONLY|UNLINKED-CUSTOMER/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Review draft invoice" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/invoices/${record.id}$`));
  expect(writes).toEqual([{ sourceType: "VEHICLE_TRANSACTION", sourceId: id(22) }]);
  await expect(
    page.getByText("Vehicle transaction: ISOLATED-VEHICLE-SALE"),
  ).toBeVisible();
});
