import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workStaffDetailFixture, id } from "../fixtures/work-staff-detail";
const base = "/admin/workforce/access",
  stamp = "2026-10-26T18:00:00.000Z";
async function setup(page: Page, delegated = false) {
  const f = await workStaffDetailFixture(page, delegated ? "ADMIN" : "SUPER_ADMIN");
  const state = {
    mode: "normal",
    reads: [] as URL[],
    writes: [] as string[],
    errors: [] as string[],
  };
  page.on("pageerror", (e) => state.errors.push(e.message));
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Isolated workforce directory fixture",
      meta: { requestId: "r4-directory" },
    },
  });
  const row = (n: number) => ({
    userId: n === 0 ? f.member.id : id(240000 + n),
    name: n === 0 ? "Ada Okoro" : `Fixture colleague ${n}`,
    email: `fixture.${n}@example.test`,
    role: "STAFF",
    status: "ACTIVE",
    verified: true,
    managed: true,
    position: "WORKSHOP_LEAD",
    version: 1,
    accountBranch: { id: id(101), name: "Stadium Road workshop", isActive: true },
    responsibilities: [
      {
        assignmentId: id(260000 + n),
        template: "WORKSHOP_LEAD",
        branch: { id: id(101), name: "Stadium Road workshop" },
        scope: "BRANCH",
        temporary: false,
        expiresAt: null,
      },
    ],
    responsibilitiesMore: false,
    canInspect: true,
  });
  await page.route(/\/api\/v1\/admin\/workforce\/accounts(?:\?.*)?$/, async (r) => {
    const u = new URL(r.request().url());
    state.reads.push(u);
    if (r.request().method() !== "GET") {
      state.writes.push(r.request().method());
      return r.fulfill({ status: 405 });
    }
    if (state.mode === "error")
      return r.fulfill({
        status: 503,
        json: {
          success: false,
          error: { code: "DATABASE_UNAVAILABLE" },
          message: "Directory unavailable",
        },
      });
    const filtered = u.searchParams.has("q"),
      cursor = u.searchParams.has("cursor");
    return r.fulfill(
      ok({
        items:
          state.mode === "empty"
            ? []
            : filtered
              ? [row(0)]
              : cursor
                ? [row(2)]
                : [row(0), row(1)],
        ...(!filtered && !cursor ? { nextCursor: id(240001) } : {}),
        generatedAt: stamp,
      }),
    );
  });
  if (delegated) {
    const access = {
      managed: true,
      userId: id(302),
      staffId: id(601),
      position: "OPERATIONS",
      department: "Strategy",
      version: 1,
      assignments: [],
      permissions: [],
      canManageAssignments: true,
      canInviteAdmins: false,
      serverTime: stamp,
    };
    await page.route("**/api/v1/auth/session", (r) =>
      r.fulfill(
        ok({
          id: id(301),
          user: { id: id(302), email: "workshop@example.test", role: "ADMIN" },
          workforceManaged: true,
          mfaRequired: true,
          mfaVerifiedAt: stamp,
          expiresAt: "2027-01-01T00:00:00.000Z",
          idleExpiresAt: "2027-01-01T00:00:00.000Z",
        }),
      ),
    );
    await page.route("**/api/v1/staff/workforce/access", (r) =>
      r.fulfill(
        ok({
          ...access,
          canManageAssignments: state.mode !== "revoked",
          version: state.mode === "revoked" ? 2 : 1,
        }),
      ),
    );
  }
  return { ...state, state, f };
}
for (const width of [320, 390, 768, 1024, 1440])
  test(`directory at ${width}px keeps filters, table and actions accessible`, async ({
    page,
  }) => {
    const s = await setup(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await expect(
      page.getByRole("heading", {
        name: "Manage workforce & responsibilities",
        exact: true,
      }),
    ).toBeVisible();
    const region = page.getByRole("region", { name: "Workforce accounts", exact: true });
    await expect(region).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View/manage Ada Okoro", exact: true }),
    ).toBeAttached();
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter(
          (e) =>
            e.getBoundingClientRect().right > window.innerWidth + 1 &&
            getComputedStyle(e).position !== "fixed",
        )
        .slice(0, 12)
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          width: e.getBoundingClientRect().width,
          right: e.getBoundingClientRect().right,
        })),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      JSON.stringify(overflow),
    ).toBe(true);
    await region.focus();
    await expect(region).toBeFocused();
    await page.keyboard.press("End");
    expect(
      await region.evaluate((e) => {
        const style = getComputedStyle(e);
        return style.outlineStyle !== "none";
      }),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".workforce-directory").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-workforce-r4-directory-${width}.png`),
      fullPage: true,
    });
    expect(s.errors).toEqual([]);
    expect(s.writes).toEqual([]);
  });
test("directory filtering, pagination, clear and deep-link context use real controls", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(base);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Fixture colleague 2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "First page", exact: true }).click();
  await expect(page).toHaveURL(base);
  await page.getByLabel("Find a person", { exact: true }).fill("Ada");
  await page
    .getByLabel("Business position", { exact: true })
    .selectOption("WORKSHOP_LEAD");
  await page.getByRole("button", { name: "Search workforce", exact: true }).click();
  await expect(page).toHaveURL(/q=Ada&position=WORKSHOP_LEAD$/);
  await page.getByRole("link", { name: "View/manage Ada Okoro", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Responsibilities & temporary cover",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Back to workforce directory", exact: true })
    .click();
  await expect(page.getByLabel("Find a person", { exact: true })).toHaveValue("Ada");
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(page).toHaveURL(base);
  expect(s.writes).toEqual([]);
});
test("empty, failure and invalid filters provide recovery and clear retained rows", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(base);
  await expect(page.getByText("Ada Okoro", { exact: true })).toBeVisible();
  s.state.mode = "error";
  await page.getByRole("button", { name: "Refresh workforce", exact: true }).click();
  await expect(page.locator(".workforce-directory").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Workforce accounts" })).toHaveCount(0);
  s.state.mode = "empty";
  await page.getByRole("button", { name: "Refresh workforce", exact: true }).click();
  await expect(page.getByText(/No workforce accounts match/)).toBeVisible();
  await page.goto(`${base}?role=CUSTOMER`);
  await expect(page.getByText(/A directory filter is invalid/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Workforce accounts" })).toHaveCount(0);
  expect(s.state.reads.some((u) => u.searchParams.get("role") === "CUSTOMER")).toBe(
    false,
  );
});
test("delegated administrator loses open directory and copied detail route when authority changes", async ({
  page,
}) => {
  const s = await setup(page, true);
  await page.goto(base);
  await expect(page.getByRole("region", { name: "Workforce accounts" })).toBeVisible();
  await expect(page.getByLabel("Account role", { exact: true })).toHaveCount(0);
  s.state.mode = "revoked";
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ada Okoro", { exact: true })).toHaveCount(0);
  await page.goto(`${base}/${s.f.member.id}`);
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Responsibilities & temporary cover",
      exact: true,
    }),
  ).toHaveCount(0);
});
