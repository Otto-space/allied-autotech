import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
const id = (n: number) => `e4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic response",
      data,
      meta: { requestId: "finance-test" },
    },
  });
const initial = () => ({
  id: id(4),
  key: "finance",
  version: 3,
  approvalStatus: "DRAFT_ACCOUNTANT_APPROVAL",
  source: "Synthetic draft only",
  sourceQuestion: "Q7-Q8",
  sourceSignatory: null,
  approvedByUserId: null as string | null,
  effectiveAt: "2026-01-01T00:00:00Z",
  recordedAt: "2026-01-01T00:00:00Z",
  approvalEvidence: null as string | null,
  settings: { vatBasisPoints: 750 } as unknown,
});
async function fixture(
  page: Page,
  options: {
    role?: string;
    granted?: boolean;
    outcome?: "stale" | "interrupted" | "mismatched" | "revoked";
    wrongIdentity?: boolean;
  } = {},
) {
  const state = {
    reads: 0,
    writes: [] as Record<string, unknown>[],
    profileFailure: false,
    history: [initial()],
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const role = options.role ?? "STAFF";
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(1),
        user: { id: id(2), email: "approver@example.test", role },
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-24T09:00:00Z",
      });
    if (endpoint === "/staff/profile") {
      if (state.profileFailure)
        return route.fulfill({
          status: 500,
          json: { success: false, error: { code: "INTERNAL_SERVER_ERROR" } },
        });
      return reply(route, {
        id: id(options.wrongIdentity ? 99 : 2),
        email: "approver@example.test",
        role,
        status: "ACTIVE",
        capabilities: options.granted === false ? [] : ["FINANCE_POLICY_APPROVE"],
        staffProfile: {
          id: id(3),
          firstName: "Synthetic",
          lastName: "Approver",
          branchId: null,
        },
      });
    }
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "finance-csrf-".repeat(5) });
    if (endpoint === "/staff/finance-policy") {
      state.reads++;
      return reply(route, state.history);
    }
    if (endpoint === "/admin/policies") {
      const body = route.request().postDataJSON();
      state.writes.push(body);
      expect(route.request().headers()["x-csrf-token"]).toBe("finance-csrf-".repeat(5));
      if (options.outcome === "stale" || options.outcome === "revoked")
        return route.fulfill({
          status: options.outcome === "stale" ? 409 : 403,
          json: {
            success: false,
            error: { code: options.outcome === "stale" ? "CONFLICT" : "FORBIDDEN" },
          },
        });
      if (options.outcome === "interrupted") return route.abort("failed");
      const saved = {
        ...initial(),
        id: id(5),
        version: 4,
        approvalStatus: "APPROVED",
        approvedByUserId: id(2),
        source: body.source,
        approvalEvidence: body.approvalEvidence,
        effectiveAt: body.effectiveAt,
        settings: body.settings,
      };
      state.history = [saved, ...state.history];
      return reply(
        route,
        options.outcome === "mismatched"
          ? {
              ...saved,
              settings: {
                ...body.settings,
                deliveryTaxable: !body.settings.deliveryTaxable,
              },
            }
          : saved,
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
  await page.getByLabel("Invoice business name").fill("Synthetic Automotive Company");
  await page
    .getByLabel("Invoice business address")
    .fill("Synthetic address for testing only");
  await page
    .getByLabel("Payment terms", { exact: true })
    .fill("Synthetic terms approved for this test only.");
  await page.getByLabel("VAT on delivery fees").selectOption("no");
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic accountant approval TEST-FIN");
  await page
    .getByLabel("Written accounting approval or reference")
    .fill("Synthetic signed accounting approval TEST-001.");
}
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} with a grant reviews and publishes the exact financial policy`, async ({
    page,
  }) => {
    const state = await fixture(page, { role });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    await page.goto("/admin/finance-policy");
    await expect(page).toHaveTitle(/Financial policy/);
    await expect(page.getByLabel("VAT on delivery fees")).toHaveValue("");
    await expect(page.getByLabel("Invoice business name")).toHaveValue("");
    await fill(page);
    await page
      .getByLabel("Effective date and time", { exact: false })
      .fill("2027-01-05T08:30");
    if (role === "STAFF") {
      for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(os.tmpdir(), "allied-finance-policy-1440.png"),
      });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.getByRole("button", { name: "Review financial approval" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Not subject to VAT", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
    expect(state.writes).toEqual([]);
    if (role === "STAFF") {
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: path.join(os.tmpdir(), "allied-finance-review-390.png"),
      });
    }
    await dialog
      .getByRole("button", { name: "Approve financial policy", exact: true })
      .click();
    await expect(page.getByText("Latest recorded version: 4.")).toBeVisible();
    expect(state.writes).toEqual([
      {
        kind: "FINANCE",
        expectedVersion: 3,
        effectiveAt: "2027-01-05T07:30:00.000Z",
        source: "Synthetic accountant approval TEST-FIN",
        approvalEvidence: "Synthetic signed accounting approval TEST-001.",
        settings: {
          vatBasisPoints: 750,
          pricesIncludeVat: false,
          rounding: "HALF_UP_MINOR_UNIT",
          discountTreatment: "BEFORE_VAT",
          deliveryTaxable: false,
          invoiceName: "Synthetic Automotive Company",
          invoiceAddress: "Synthetic address for testing only",
          paymentTerms: "Synthetic terms approved for this test only.",
          applicability: "ALL_PRODUCTS_AND_SERVICES",
        },
      },
    ]);
    await page.getByText("Financial policy history", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Version 4 · APPROVED" }),
    ).toBeVisible();
    await expect(page.getByLabel("Written accounting approval or reference")).toHaveValue(
      "",
    );
    if (role === "STAFF") {
      for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole("heading", { name: "Version 4 · APPROVED" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(os.tmpdir(), "allied-finance-history-390.png"),
      });
    }
    expect(errors).toEqual([]);
  });
for (const role of ["STAFF", "ADMIN"])
  test(`${role} without a grant makes no financial history request`, async ({ page }) => {
    const state = await fixture(page, { role, granted: false });
    await page.goto("/admin/finance-policy");
    await expect(
      page.getByText(/Financial policy access requires an active approval permission/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review financial approval" }),
    ).toHaveCount(0);
    expect(state.reads).toBe(0);
  });
test("owner can read history but cannot publish without a grant", async ({ page }) => {
  const state = await fixture(page, { role: "SUPER_ADMIN", granted: false });
  await page.goto("/admin/finance-policy");
  await expect(page.getByText(/including for Super Admin/)).toBeVisible();
  await page.getByText("Financial policy history", { exact: true }).click();
  await expect(page.getByRole("heading", { name: /Version 3/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review financial approval" }),
  ).toHaveCount(0);
  expect(state.reads).toBeGreaterThan(0);
  expect(state.writes).toEqual([]);
});
test("another account's profile cannot authorize financial reads", async ({ page }) => {
  const state = await fixture(page, { wrongIdentity: true });
  await page.goto("/admin/finance-policy");
  await expect(
    page.getByText(/Financial policy access requires an active approval permission/),
  ).toBeVisible();
  expect(state.reads).toBe(0);
});
for (const outcome of ["stale", "interrupted", "mismatched", "revoked"] as const)
  test(`financial approval handles ${outcome} responses without replay`, async ({
    page,
  }) => {
    const state = await fixture(page, { outcome });
    await page.goto("/admin/finance-policy");
    await fill(page);
    await page.getByRole("button", { name: "Review financial approval" }).click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", {
      name: "Approve financial policy",
      exact: true,
    });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(
      page.getByText("Financial policy approved.", { exact: true }),
    ).toHaveCount(0);
    const unknown = outcome === "interrupted" || outcome === "mismatched";
    await dialog
      .getByRole("button", { name: unknown ? "Close & review record" : "Go back" })
      .click();
    if (unknown)
      await expect(
        page.getByRole("button", { name: "Review financial approval" }),
      ).toBeDisabled();
    if (outcome === "interrupted") {
      state.profileFailure = true;
      await page
        .getByRole("button", { name: "Refresh financial policy", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
      state.profileFailure = false;
      await page.getByRole("button", { name: "Refresh permission" }).click();
      await expect(
        page.getByRole("button", { name: "Review financial approval" }),
      ).toBeDisabled();
      await expect(page.getByText(/The approval outcome is uncertain/)).toBeVisible();
    }
    expect(state.writes).toHaveLength(1);
    expect(new Date(String(state.writes[0].effectiveAt)).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
  });
test("financial policy drafts clear on an account change", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/finance-policy");
  await fill(page);
  await page.getByRole("button", { name: "Review financial approval" }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  await expect(page.getByLabel("Invoice business name")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("financial review requires delivery treatment, written approval and a future scheduled time", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/admin/finance-policy");
  await fill(page);
  await page.getByLabel("VAT on delivery fees").selectOption("");
  await page.getByRole("button", { name: "Review financial approval" }).click();
  await expect(page.getByLabel("VAT on delivery fees")).toBeFocused();
  await page.getByLabel("VAT on delivery fees").selectOption("yes");
  await page.getByLabel("Written accounting approval or reference").fill(" ".repeat(20));
  await page.getByRole("button", { name: "Review financial approval" }).click();
  await expect(page.getByLabel("Written accounting approval or reference")).toBeFocused();
  await page
    .getByLabel("Written accounting approval or reference")
    .fill("Synthetic written accounting approval for testing.");
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2020-01-01T08:30");
  await page.getByRole("button", { name: "Review financial approval" }).click();
  await expect(
    page.getByLabel("Effective date and time", { exact: false }),
  ).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
