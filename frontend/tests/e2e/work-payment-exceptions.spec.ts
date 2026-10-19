import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workExceptionFixture,
  exceptionRow,
  id,
} from "../fixtures/work-payment-exceptions";
const root = "/admin/payment-exceptions",
  selected = `${root}?selected=${id(210000)}`,
  note = "Compared the immutable source records with the provider observation.";
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function visit(p: Page, n = 0) {
  await p.goto(`${root}?selected=${id(210000 + n)}`);
  await expect(p.locator(".we-detail .we-summary")).toBeVisible();
}
async function review(p: Page) {
  await p.getByLabel("Investigation note", { exact: true }).fill(note);
  await button(p, "Review investigation").click();
  await expect(p.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} sees current exception with safe source references`, async ({ page }) => {
    const f = await workExceptionFixture(page, role);
    await visit(page);
    await expect(page.locator(".we-records>li")).toHaveCount(4);
    await page.locator(".we-references summary").click();
    await expect(page.locator(".we-detail")).toContainText(
      f.records[0].paymentAttemptId!,
    );
    await expect(
      page.getByRole("link", { name: "Payment records", exact: true }).last(),
    ).toHaveAttribute("href", `/admin/payments?selected=${f.records[0].paymentId}`);
    expect(f.writes).toHaveLength(0);
  });
for (const role of ["STAFF", "CUSTOMER"])
  test(`${role} makes no exception reads`, async ({ page }) => {
    const f = await workExceptionFixture(page, role);
    await page.goto(selected);
    await expect(page.locator("main")).toBeVisible();
    expect(f.reads).toHaveLength(0);
    expect(f.detailReads).toHaveLength(0);
    expect(f.writes).toHaveLength(0);
  });
for (const mode of ["error", "denied", "inactive", "mismatch"])
  test(`profile ${mode} blocks protected reads`, async ({ page }) => {
    const f = await workExceptionFixture(page);
    f.base.profileMode = mode;
    await page.goto(selected);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(f.reads).toHaveLength(0);
    expect(f.detailReads).toHaveLength(0);
  });
test("selection and source disclosure do not refetch the queue; close and reopen retains draft", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  await page.goto(root);
  await expect(page.locator(".we-records>li")).toHaveCount(4);
  const reads = f.reads.length;
  await page.locator(".we-records>li").first().getByRole("button").click();
  await expect(page.locator(".we-detail .we-summary")).toBeVisible();
  await page.getByLabel("Investigation note", { exact: true }).fill(note);
  await page.locator(".we-references summary").click();
  await button(page, "Close investigation").click();
  await page.locator(".we-records>li").first().getByRole("button").click();
  await expect(page.getByLabel("Investigation note", { exact: true })).toHaveValue(note);
  expect(f.reads).toHaveLength(reads);
  expect(f.writes).toHaveLength(0);
});
test("cursor navigation and filters survive reload", async ({ page }) => {
  const f = await workExceptionFixture(page);
  f.records = Array.from({ length: 28 }, (_, n) => exceptionRow(n));
  await page.goto(root);
  await expect(page.locator(".we-records>li")).toHaveCount(25);
  await button(page, "Next").click();
  await expect(page.locator(".we-records>li")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".we-records>li")).toHaveCount(3);
  await button(page, "Previous").click();
  await expect(page.locator(".we-records>li")).toHaveCount(25);
  await page.getByLabel("Exception status", { exact: true }).selectOption("OPEN");
  await expect(page).toHaveURL(/status=OPEN/);
  await expect(page.locator(".we-records>li")).toHaveCount(7);
  expect(new URL(page.url()).searchParams.has("cursor")).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Exception status", { exact: true })).toHaveValue("OPEN");
});
test("invalid URL never fetches exceptions and can be reset", async ({ page }) => {
  const f = await workExceptionFixture(page);
  await page.goto(`${root}?status=BAD`);
  await expect(page.locator("main").getByRole("alert")).toContainText("unsupported");
  expect(f.reads).toHaveLength(0);
  await button(page, "Reset exception view").click();
  await expect(page.locator(".we-records>li")).toHaveCount(4);
});
test("required note focuses invalid field; review cancel preserves values and returns focus", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  await visit(page);
  await button(page, "Review investigation").click();
  await expect(page.getByLabel("Investigation note", { exact: true })).toBeFocused();
  await review(page);
  await expect(page.getByRole("dialog")).toContainText(note);
  await button(page, "Go back").click();
  await expect(page.getByLabel("Investigation note", { exact: true })).toHaveValue(note);
  await expect(button(page, "Review investigation")).toBeFocused();
  expect(f.writes).toHaveLength(0);
});
test("one start-investigation request validates receipt and keeps payments unchanged", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  await visit(page);
  await review(page);
  await button(page, "Confirm investigation update").dblclick();
  await expect(
    page.getByRole("heading", { name: "Exception update recorded" }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0].body).toEqual({
    expectedStatus: "OPEN",
    status: "INVESTIGATING",
    resolutionNote: note,
  });
  await expect(page.locator(".we-saved")).toContainText(
    "Payment, refund and dispute states are unchanged",
  );
});
for (const status of ["RESOLVED", "IGNORED"])
  test(`investigating may close as ${status} with exact note`, async ({ page }) => {
    const f = await workExceptionFixture(page);
    await visit(page, 1);
    await page.getByLabel("New exception status").selectOption(status);
    await review(page);
    await button(page, "Confirm investigation update").click();
    await expect(page.locator(".we-closure")).toBeVisible();
    await expect(button(page, "Review investigation")).toHaveCount(0);
    expect(f.writes[0].body).toEqual({
      expectedStatus: "INVESTIGATING",
      status,
      resolutionNote: note,
    });
  });
test("stale preflight sends no mutation and preserves current facts", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  await visit(page);
  await review(page);
  f.records[0] = {
    ...f.records[0],
    summary: "Source observation changed before confirmation.",
  };
  await button(page, "Confirm investigation update").click();
  await expect(page.getByRole("dialog")).toContainText(
    "No exception change request was sent",
  );
  expect(f.writes).toHaveLength(0);
  await button(page, "Go back").click();
  await expect(page.locator(".we-detail .we-summary")).toContainText(
    "Source observation changed",
  );
});
for (const mode of ["lost", "wrong", "wrongNote"])
  test(`${mode} receipt locks after reload until current read and deliberate reconciliation`, async ({
    page,
  }) => {
    const f = await workExceptionFixture(page);
    f.writeMode = mode;
    await visit(page);
    await review(page);
    await button(page, "Confirm investigation update").click();
    await expect(button(page, "Confirm investigation update")).toBeDisabled();
    await button(page, "Close & review record").click();
    await expect(
      page.getByRole("heading", { name: "Check the earlier exception change" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Check the earlier exception change" }),
    ).toBeVisible();
    await page
      .locator(".we-pending")
      .getByRole("button", { name: "Read current exception" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Current exception checked" }),
    ).toBeVisible();
    await expect(button(page, "Clear local recovery lock")).toBeDisabled();
    await page.getByRole("checkbox", { name: /independently reconciled/ }).check();
    await button(page, "Clear local recovery lock").click();
    await expect(page.locator(".we-pending")).toHaveCount(0);
    expect(f.writes).toHaveLength(1);
  });
test("definite conflict rejects once and preserves the note", async ({ page }) => {
  const f = await workExceptionFixture(page);
  f.writeMode = "conflict";
  await visit(page);
  await review(page);
  await button(page, "Confirm investigation update").click();
  await expect(button(page, "Confirm investigation update")).toBeDisabled();
  await button(page, "Go back").click();
  await expect(page.getByLabel("Investigation note", { exact: true })).toHaveValue(note);
  await expect(page.locator(".we-pending")).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
});
test("denial during confirmation clears protected records and proposal", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  f.writeMode = "denied";
  await visit(page);
  await review(page);
  await button(page, "Confirm investigation update").click();
  await expect(
    page.getByRole("heading", { name: "Exception access is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".we-summary")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
});
for (const mode of ["empty", "error"])
  test(`queue ${mode} is explicit`, async ({ page }) => {
    const f = await workExceptionFixture(page);
    f.mode = mode;
    await page.goto(root);
    await expect(
      mode === "empty"
        ? page.getByRole("heading", { name: "No matching exceptions" })
        : button(page, "Retry exception queue"),
    ).toBeVisible();
    expect(f.writes).toHaveLength(0);
  });
for (const mode of ["error", "wrong"])
  test(`current ${mode} never exposes an action`, async ({ page }) => {
    const f = await workExceptionFixture(page);
    f.detailMode = mode;
    await page.goto(selected);
    await expect(button(page, "Retry current exception")).toBeVisible();
    await expect(button(page, "Review investigation")).toHaveCount(0);
    expect(f.writes).toHaveLength(0);
  });
test("a new review or failed lookup cannot reuse earlier recovery facts", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  await visit(page);
  await page
    .locator(".we-source-links")
    .getByRole("button", { name: "Read current exception" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Current exception checked" }),
  ).toBeVisible();
  f.writeMode = "lost";
  await review(page);
  await button(page, "Confirm investigation update").click();
  await button(page, "Close & review record").click();
  await expect(
    page.getByRole("heading", { name: "Current exception checked" }),
  ).toHaveCount(0);
  await expect(button(page, "Clear local recovery lock")).toHaveCount(0);
  await page
    .locator(".we-pending")
    .getByRole("button", { name: "Read current exception" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Current exception checked" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /independently reconciled/ }).check();
  f.detailMode = "error";
  await page
    .locator(".we-pending")
    .getByRole("button", { name: "Read current exception" })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "could not be checked",
  );
  await expect(button(page, "Clear local recovery lock")).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
});
test("fresh profile revocation blocks confirmation before any write", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  await visit(page);
  await review(page);
  f.base.profileMode = "inactive";
  await button(page, "Confirm investigation update").click();
  await expect(
    page.getByRole("heading", { name: "Exception access is unavailable" }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
test("recovery storage failure prevents mutation submission", async ({ page }) => {
  const f = await workExceptionFixture(page);
  await visit(page);
  await review(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("aat:exception-change:")) throw Error("blocked recovery storage");
      return original.call(this, k, v);
    };
  });
  await button(page, "Confirm investigation update").click();
  await expect(page.getByRole("dialog")).toContainText(
    "No exception change request was sent",
  );
  expect(f.writes).toHaveLength(0);
});
test("switching selection reads the visible exception rather than its earlier reference", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  await visit(page);
  await page.locator(".we-records>li").nth(1).getByRole("button").click();
  await expect(page.locator(".we-detail-heading h2")).toHaveText("Duplicate success");
  await page
    .locator(".we-source-links")
    .getByRole("button", { name: "Read current exception" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Current exception checked" }),
  ).toBeVisible();
  expect(f.detailReads.at(-1)!.pathname).toContain(id(210001));
  expect(f.writes).toHaveLength(0);
});
test("server failure retains a lock and a failed current read cannot clear it", async ({
  page,
}) => {
  const f = await workExceptionFixture(page);
  f.writeMode = "unavailable";
  await visit(page);
  await review(page);
  await button(page, "Confirm investigation update").click();
  await button(page, "Close & review record").click();
  f.detailMode = "error";
  await page
    .locator(".we-pending")
    .getByRole("button", { name: "Read current exception" })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "could not be checked",
  );
  await expect(button(page, "Clear local recovery lock")).toHaveCount(0);
  await expect(page.locator(".we-pending")).toBeVisible();
  expect(f.writes).toHaveLength(1);
});
for (const width of [375, 430, 768, 1280, 1440])
  test(`${width}px responsive and accessible investigation workspace`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1050 });
    await workExceptionFixture(page);
    await visit(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    if (width < 768) {
      const pane = await page.locator(".we-detail").boundingBox(),
        queue = await page.locator(".we-queue").boundingBox();
      expect(pane!.y).toBeLessThan(queue!.y);
    }
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(
      axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toEqual([]);
  });
