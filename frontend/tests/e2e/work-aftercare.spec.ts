import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookingId, workAftercareFixture } from "../fixtures/work-aftercare";
const path = `/admin/orders/${bookingId(1100)}/aftercare`,
  note = "The goods were checked against the original recorded order.";
async function select(page: Page) {
  await page.getByRole("button", { name: "Review return request", exact: true }).click();
  await expect(page.getByLabel("Next review action")).toBeEnabled();
}
async function inspect(page: Page) {
  await select(page);
  await page.getByLabel("Next review action").selectOption("INSPECTED");
  await page.getByLabel("Goods in good condition?").selectOption("false");
  await page.getByLabel("Internal inspection note", { exact: true }).fill(note);
  await page.getByRole("button", { name: "Review recorded action", exact: true }).click();
}
async function evidence(page: Page) {
  await page
    .getByLabel("Delivery or collection time (Lagos time)")
    .fill("2026-10-16T10:00");
  await page
    .getByLabel("Supporting evidence reference")
    .fill("QA signed collection note");
  await page
    .getByRole("button", { name: "Review fulfillment evidence", exact: true })
    .click();
}
test("named navigation, actual history facts and selected review survive responsive layouts", async ({
  page,
}) => {
  await workAftercareFixture(page);
  await page.goto(path);
  await expect(page.getByText("2 requests shown")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toContainText("ORD-20261017-001");
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Back to order", exact: true }),
  ).toHaveAttribute("href", `/admin/orders/${bookingId(1100)}`);
  await select(page);
  for (const width of [390, 1467]) {
    await page.setViewportSize({ width, height: 1050 });
    await expect(page.getByLabel("Next review action")).toHaveCount(1);
  }
  await page.reload();
  await expect(page.getByText("2 requests shown")).toBeVisible();
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} has operational stages and only live financial decisions`, async ({
    page,
  }) => {
    const { aftercare } = await workAftercareFixture(page, role);
    aftercare.canDecide = false;
    await page.goto(path);
    await select(page);
    expect(
      await page.getByLabel("Next review action").locator("option").allTextContents(),
    ).toEqual(["Choose action", "Record condition inspection"]);
    aftercare.canDecide = true;
    await page
      .getByRole("button", { name: "Refresh order requests", exact: true })
      .click();
    await expect(
      page.getByLabel("Next review action").locator('option[value="REJECTED"]'),
    ).toHaveCount(1);
    expect(aftercare.writes).toHaveLength(0);
  });
test("customer direct navigation never fetches staff history or permission", async ({
  page,
}) => {
  const { aftercare, detail } = await workAftercareFixture(page, "CUSTOMER");
  await page.goto(path);
  await expect(page.getByLabel("Next review action")).toHaveCount(0);
  expect(aftercare.reads).toEqual([]);
  expect(detail.reads).toEqual([]);
});
test("inspection reviews and cancels without writing, then saves exact condition and note with CSRF", async ({
  page,
}) => {
  const { aftercare } = await workAftercareFixture(page);
  await page.goto(path);
  await inspect(page);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review recorded action", exact: true }),
  ).toBeFocused();
  expect(aftercare.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Review recorded action", exact: true }).click();
  await page.getByRole("button", { name: "Save order review", exact: true }).click();
  await expect(
    page.getByText("Condition inspected", { exact: true }).first(),
  ).toBeVisible();
  expect(aftercare.writes[0].body).toEqual({
    stage: "INSPECTED",
    note,
    expectedStatus: "RECEIVED",
    goodCondition: false,
  });
  expect(aftercare.writes[0].csrf).toBeTruthy();
});
test("permission revoked after review blocks POST and removes the decision option", async ({
  page,
}) => {
  const { aftercare } = await workAftercareFixture(page);
  await page.goto(path);
  await select(page);
  await page.getByLabel("Next review action").selectOption("REJECTED");
  await page.getByLabel("Decision note visible to the customer").fill(note);
  await page.getByRole("button", { name: "Review recorded action", exact: true }).click();
  aftercare.canDecide = false;
  await page.getByRole("button", { name: "Save order review", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save order review", exact: true }),
  ).toBeDisabled();
  expect(aftercare.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByLabel("Next review action").locator('option[value="REJECTED"]'),
  ).toHaveCount(0);
});
test("one-time evidence validates time/reference and saves the exact Lagos timestamp", async ({
  page,
}) => {
  const { aftercare } = await workAftercareFixture(page);
  await page.goto(path);
  await evidence(page);
  await page
    .getByRole("button", { name: "Record fulfillment evidence", exact: true })
    .click();
  await expect(page.getByText(/cannot be overwritten here/)).toBeVisible();
  expect(aftercare.writes[0].body).toEqual({
    at: "2026-10-16T09:00:00.000Z",
    reference: "QA signed collection note",
  });
  await expect(
    page.getByRole("button", { name: "Review fulfillment evidence", exact: true }),
  ).toHaveCount(0);
});
for (const operation of ["review", "evidence"])
  for (const outcome of ["uncertain", "uncommitted", "contradictory"])
    test(`${operation} ${outcome} survives reload and reconciles without replay`, async ({
      page,
    }) => {
      const { aftercare } = await workAftercareFixture(page);
      aftercare.outcome = outcome;
      await page.goto(path);
      if (operation === "review") await inspect(page);
      else await evidence(page);
      await page
        .getByRole("button", {
          name:
            operation === "review" ? "Save order review" : "Record fulfillment evidence",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Close & review record", exact: true })
        .click();
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Load saved order and requests", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Load saved order and requests", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Load saved order and requests", exact: true }),
      ).toHaveCount(0);
      expect(aftercare.writes).toHaveLength(1);
    });
test("direct recovery checks the affected request even outside the history window", async ({
  page,
}) => {
  const { aftercare } = await workAftercareFixture(page);
  aftercare.outcome = "uncertain";
  await page.goto(path);
  await inspect(page);
  await page.getByRole("button", { name: "Save order review", exact: true }).click();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  aftercare.recovered = aftercare.history[0];
  aftercare.history = aftercare.history.slice(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Load saved order and requests", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Load saved order and requests", exact: true }),
  ).toHaveCount(0);
  expect(aftercare.reads).toContain(`/staff/order-requests/${bookingId(1400)}`);
  expect(aftercare.writes).toHaveLength(1);
});
test("unavailable recovery storage blocks a mutation before POST", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("work-aftercare-pending:"))
        throw new Error("Synthetic unavailable storage");
      return original.call(this, key, value);
    };
  });
  const { aftercare } = await workAftercareFixture(page);
  await page.goto(path);
  await inspect(page);
  await page.getByRole("button", { name: "Save order review", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save order review", exact: true }),
  ).toBeDisabled();
  expect(aftercare.writes).toHaveLength(0);
  await expect(page.getByText(/could not save a recovery marker/).first()).toBeVisible();
});
for (const mode of ["error", "denied", "malformed", "mismatch"])
  test(`${mode} history fails closed and can recover`, async ({ page }) => {
    const { aftercare } = await workAftercareFixture(page);
    aftercare.mode = mode;
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Retry order review", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review return request", exact: true }),
    ).toHaveCount(0);
    aftercare.mode = "normal";
    await page.getByRole("button", { name: "Retry order review", exact: true }).click();
    await expect(page.getByText("2 requests shown")).toBeVisible();
  });
test("mismatched identity or branch removes private records; transient reads retain them disabled", async ({
  page,
}) => {
  const { aftercare } = await workAftercareFixture(page, "STAFF");
  await page.goto(path);
  await select(page);
  aftercare.mode = "error";
  await page.getByRole("button", { name: "Refresh order requests", exact: true }).click();
  await expect(page.getByText(/Previously loaded information/)).toBeVisible();
  await expect(page.getByLabel("Next review action")).toBeDisabled();
  aftercare.mode = "normal";
  aftercare.accessMode = "branch";
  await page.getByRole("button", { name: "Refresh order requests", exact: true }).click();
  await expect(
    page.getByText("One brake pad set needs inspection.", { exact: true }),
  ).toHaveCount(0);
});
test("empty history has a useful state and evidence remains separately available", async ({
  page,
}) => {
  const { aftercare } = await workAftercareFixture(page);
  aftercare.mode = "empty";
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "No requests recorded" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review fulfillment evidence", exact: true }),
  ).toBeEnabled();
});
test("long history, selected review and reduced motion fit all core breakpoints", async ({
  page,
}) => {
  const { aftercare } = await workAftercareFixture(page);
  aftercare.history[0].reason =
    "A complete explanation of the historical request. ".repeat(35);
  aftercare.history[0].inspectionNote = "Internal QA detail ".repeat(50);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await select(page);
  for (const width of [320, 375, 430, 768, 1024, 1280, 1467, 1920]) {
    await page.setViewportSize({ width, height: 1050 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
});
