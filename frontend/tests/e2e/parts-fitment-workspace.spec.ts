import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const id = (value: number) =>
  `f7200000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const make = { id: id(1), name: "Toyota" };
const model = {
  id: id(2),
  makeId: make.id,
  name: "Corolla",
  yearFrom: 2013,
  yearTo: 2019,
  make,
};
const branch = { id: id(3), name: "Synthetic workshop" };
const product = {
  id: id(4),
  name: "Synthetic Corolla brake pads",
  sku: "SYNTHETIC-PADS",
  productType: "BRAKE_PADS",
  isActive: true,
};
const author = {
  id: id(10),
  email: "author@example.test",
  staffProfile: { firstName: "Synthetic", lastName: "Author" },
};
const reviewer = {
  id: id(11),
  email: "reviewer@example.test",
  staffProfile: { firstName: "Synthetic", lastName: "Reviewer" },
};
const time = "2026-10-23T12:00:00.000Z";

async function fixture(page: Page) {
  const state = {
    reviewer: false,
    authorAlsoReviewer: false,
    denied: false,
    failRead: false,
    failWrite: false,
    rule: null as Record<string, unknown> | null,
    writes: [] as { path: string; body: Record<string, unknown>; csrf?: string }[],
    history: [] as Record<string, unknown>[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace("/api/v1", "");
    const current = state.reviewer ? reviewer : author;
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          message: "Isolated fitment UI test",
          data,
          meta: { requestId: "fitment-workspace-test" },
        },
      });
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: { code: status === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" },
        },
      });
    if (path === "/auth/session")
      return ok({
        id: id(state.reviewer ? 21 : 20),
        user: { id: current.id, email: current.email, role: "STAFF" },
        workforceManaged: true,
        mfaRequired: true,
        mfaVerifiedAt: time,
      });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "fitment-workspace-csrf-".repeat(3) });
    if (path.endsWith("/notifications/summary"))
      return ok({ unreadCount: 0, groups: [] });
    if (path === "/staff/workforce/access")
      return ok({
        managed: true,
        userId: current.id,
        staffId: id(state.reviewer ? 31 : 30),
        position: "Synthetic role",
        department: "Synthetic",
        version: 1,
        canManageAssignments: false,
        permissions: [],
        serverTime: time,
        assignments: [
          {
            id: id(state.reviewer ? 41 : 40),
            userId: current.id,
            template: state.reviewer ? "WORKSHOP_LEAD" : "SALES_SUPERVISOR",
            branchId: branch.id,
            scope: "BRANCH",
            temporary: false,
            startsAt: "2026-01-01T00:00:00.000Z",
            expiresAt: null,
            reason: "Synthetic assignment",
            assignedByUserId: id(99),
            createdAt: time,
            revokedAt: null,
            revokedByUserId: null,
            revocationReason: null,
          },
        ],
      });
    if (path === "/staff/fitment/access")
      return state.denied
        ? fail(403)
        : ok({
            canAuthor: !state.reviewer,
            canReview: state.reviewer || state.authorAlsoReviewer,
            globalAuthor: false,
            globalReviewer: false,
            authorBranches: state.reviewer ? [] : [branch.id],
            reviewBranches: state.reviewer || state.authorAlsoReviewer ? [branch.id] : [],
            branches: [branch],
          });
    if (path === "/public/fitment/makes") return ok({ items: [make] });
    if (path === "/public/fitment/models") return ok({ items: [model] });
    if (path === `/public/fitment/models/${model.id}`) return ok(model);
    if (path === "/staff/fitment/products") return ok({ items: [product] });
    if (path === `/staff/fitment/products/${product.id}`) return ok(product);
    if (path === "/staff/fitment/rules")
      return state.failRead
        ? fail(503)
        : ok({
            items:
              state.rule &&
              (!url.searchParams.get("reviewStatus") ||
                url.searchParams.get("reviewStatus") === state.rule.reviewStatus)
                ? [state.rule]
                : [],
          });
    if (
      path === `/staff/fitment/products/${product.id}/rules/${id(5)}` &&
      request.method() === "GET"
    )
      return state.failRead ? fail(503) : ok(state.rule);
    if (path.endsWith("/history")) return ok({ items: state.history });
    if (
      path.startsWith(`/staff/fitment/products/${product.id}/rules`) &&
      request.method() !== "GET"
    ) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, csrf: request.headers()["x-csrf-token"] });
      if (state.failWrite) return route.abort("failed");
      if (path.endsWith("/transitions")) {
        const status = {
          SUBMIT: "PENDING",
          APPROVE: "APPROVED",
          REJECT: "REJECTED",
          RETIRE: "RETIRED",
        }[body.action as string];
        state.rule = {
          ...state.rule,
          reviewStatus: status,
          version: Number(state.rule!.version) + 1,
          reviewNote: body.note,
          ...(body.action === "SUBMIT"
            ? { submittedAt: time }
            : { reviewedByUserId: current.id, reviewedBy: current, reviewedAt: time }),
        };
      } else if (request.method() === "PUT") {
        state.rule = {
          ...state.rule,
          ...body,
          version: Number(state.rule!.version) + 1,
          reviewStatus: "DRAFT",
          updatedByUserId: current.id,
          updatedBy: current,
          reviewedByUserId: null,
          reviewedBy: null,
          reviewedAt: null,
          submittedAt: null,
          reviewNote: null,
        };
      } else
        state.rule = {
          id: id(5),
          productId: product.id,
          make: make.name,
          model: model.name,
          product,
          vehicleModel: model,
          createdByUserId: current.id,
          updatedByUserId: current.id,
          reviewedByUserId: null,
          createdBy: current,
          updatedBy: current,
          reviewedBy: null,
          createdAt: time,
          updatedAt: time,
          submittedAt: null,
          reviewedAt: null,
          reviewNote: null,
          version: 0,
          reviewStatus: "DRAFT",
          ...body,
        };
      state.history.unshift({
        id: id(100 + state.history.length),
        compatibilityId: id(5),
        actorUserId: current.id,
        actor: current,
        action: body.action || (request.method() === "PUT" ? "EDIT" : "CREATE"),
        version: state.rule!.version,
        createdAt: time,
        snapshot: { ...state.rule },
      });
      return ok(state.rule);
    }
    return ok({ items: [] });
  });
  return state;
}
async function draft(page: Page) {
  await page.goto("/admin/fitment");
  await page.getByRole("button", { name: `${product.name} · ${product.sku}` }).click();
  await page.getByRole("link", { name: "Add fitment rule", exact: true }).click();
  await page.getByLabel("Branch scope", { exact: true }).selectOption(branch.id);
  await page.getByRole("combobox", { name: "Vehicle make", exact: true }).click();
  await page.getByRole("option", { name: "Toyota", exact: true }).click();
  await page.getByRole("combobox", { name: "Vehicle model", exact: true }).click();
  await page.getByRole("option", { name: "Corolla", exact: true }).click();
  await page.getByLabel("First model year", { exact: true }).fill("2013");
  await page.getByLabel("Last model year", { exact: true }).fill("2019");
  await page
    .getByLabel("Axle / position restriction (optional)", { exact: true })
    .fill("front");
  await page
    .getByLabel("Brake system / hardware restriction (optional)", { exact: true })
    .fill("Akebono");
  await page
    .getByLabel("Evidence source reference", { exact: true })
    .fill("Synthetic manufacturer reference TEST-PADS-2018");
  await page
    .getByLabel("Evidence and variant coverage", { exact: true })
    .fill(
      "Synthetic test evidence supports the full stated model range and brake hardware.",
    );
  await page
    .getByRole("checkbox", { name: /The evidence supports every configuration/ })
    .check();
}

for (const width of [1440, 390])
  test(`staff author, independent reviewer and history remain usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await draft(page);
    await page.getByRole("button", { name: "Review fitment draft", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Synthetic manufacturer reference",
    );
    expect(state.writes).toHaveLength(0);
    await page
      .getByRole("button", { name: "Confirm fitment draft", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fitment evidence · Version 0" }),
    ).toBeVisible();
    expect(state.writes[0]).toMatchObject({
      body: {
        vehicleModelId: model.id,
        branchId: branch.id,
        yearFrom: 2013,
        yearTo: 2019,
        requiredQualifiers: ["position", "brakeSystem"],
        safetyCritical: true,
      },
      csrf: "fitment-workspace-csrf-".repeat(3),
    });
    await page
      .getByLabel("Decision reason", { exact: true })
      .fill("Synthetic author requests independent technical verification.");
    await page
      .getByRole("button", { name: "Submit for technical review", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm fitment decision", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fitment evidence · Version 1" }),
    ).toBeVisible();
    state.authorAlsoReviewer = true;
    await page.reload();
    await expect(
      page.getByText("A different authorized technical reviewer must review your rule."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve fitment", exact: true }),
    ).toHaveCount(0);
    state.reviewer = true;
    await page.reload();
    await page
      .getByLabel("Decision reason", { exact: true })
      .fill("Synthetic independent evidence and variant review accepted.");
    await page.getByRole("button", { name: "Approve fitment", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm fitment decision", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fitment evidence · Version 2" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit rule", exact: true }),
    ).toHaveCount(0);
    await page
      .getByText("Version history and previous evidence", { exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Version 2 · approve", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Version 0 · create", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .include(".fitment-workspace")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.locator(".fitment-rule-card > .fitment-facts")).toHaveCSS(
      "display",
      "grid",
    );
    await page.screenshot({
      path: testInfo.outputPath(`staff-fitment-${width}.png`),
      fullPage: true,
    });
    if (width === 1440) {
      state.reviewer = false;
      await page.reload();
      await page.getByRole("button", { name: "Edit rule", exact: true }).click();
      await page
        .getByLabel("Engine code restriction (optional)", { exact: true })
        .fill("2ZR-FE");
      await page
        .getByRole("button", { name: "Review fitment draft", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm fitment draft", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Fitment evidence · Version 3" }),
      ).toBeVisible();
      expect(state.rule!.reviewStatus).toBe("DRAFT");
      expect(state.rule!.reviewedByUserId).toBeNull();
      await page
        .getByLabel("Decision reason", { exact: true })
        .fill("Synthetic revised engine restriction needs a fresh review.");
      await page
        .getByRole("button", { name: "Submit for technical review", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm fitment decision", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Fitment evidence · Version 4" }),
      ).toBeVisible();
      state.reviewer = true;
      await page.reload();
      await page
        .getByLabel("Decision reason", { exact: true })
        .fill("Synthetic source does not substantiate the revised engine scope.");
      await page.getByRole("button", { name: "Reject fitment", exact: true }).click();
      await page
        .getByRole("button", { name: "Confirm fitment decision", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Fitment evidence · Version 5" }),
      ).toBeVisible();
      await page
        .getByLabel("Decision reason", { exact: true })
        .fill("Synthetic rule withdrawn while technical evidence is corrected.");
      await page.getByRole("button", { name: "Retire rule", exact: true }).click();
      await page
        .getByRole("button", { name: "Confirm fitment decision", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Fitment evidence · Version 6" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Retire rule", exact: true }),
      ).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

test("uncertain saves stop repeat creation, and failed reads expose no review actions", async ({
  page,
}) => {
  const state = await fixture(page);
  await draft(page);
  state.failWrite = true;
  await page.getByRole("button", { name: "Review fitment draft", exact: true }).click();
  await page.getByRole("button", { name: "Confirm fitment draft", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "The outcome could not be confirmed",
  );
  await expect(
    page.getByRole("button", { name: "Confirm fitment draft", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review fitment draft", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  state.denied = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Add a fitment rule", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
