import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workStaffDetailFixture, id } from "../fixtures/work-staff-detail";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
import type { WorkforceReviewKind } from "@/lib/api/workforce-directory-schemas";
const base = "/admin/workforce/reviews",
  stamp = "2026-11-13T12:00:00.000Z";
async function setup(
  page: Page,
  delegated = false,
  role = delegated ? "ADMIN" : "SUPER_ADMIN",
) {
  const f = await workStaffDetailFixture(page, role);
  const state = {
    mode: "normal",
    reads: [] as URL[],
    writes: [] as string[],
    long: false,
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic access-review QA",
      meta: { requestId: "review-qa" },
    },
  });
  await page.route("**/api/v1/public/capabilities", (r) =>
    r.fulfill(ok(publicCapabilitiesFixture())),
  );
  if (delegated) {
    await page.route("**/api/v1/auth/session", (r) =>
      r.fulfill(
        ok({
          id: id(301),
          user: { id: id(302), email: "manager@example.test", role: "ADMIN" },
          workforceManaged: false,
          mfaRequired: true,
          mfaVerifiedAt: stamp,
          expiresAt: "2027-01-01T00:00:00Z",
          idleExpiresAt: "2027-01-01T00:00:00Z",
        }),
      ),
    );
    await page.route("**/api/v1/staff/workforce/access", (r) =>
      r.fulfill(
        ok({
          managed: true,
          userId: id(302),
          staffId: id(601),
          position: "OPERATIONS",
          department: "Strategy",
          version: state.mode === "revoked" ? 2 : 1,
          assignments: [],
          permissions: [],
          canManageAssignments: state.mode !== "revoked",
          canInviteAdmins: false,
          serverTime: stamp,
        }),
      ),
    );
  }
  await page.route(/\/api\/v1\/admin\/workforce\/accounts(?:\?.*)?$/, async (r) => {
    const url = new URL(r.request().url());
    state.reads.push(url);
    if (r.request().method() !== "GET") {
      state.writes.push(r.request().method());
      return r.fulfill({ status: 405 });
    }
    if (state.mode === "error")
      return r.fulfill({
        status: 503,
        json: {
          success: false,
          message: "Synthetic review unavailable",
          error: { code: "DATABASE_UNAVAILABLE" },
        },
      });
    if (state.mode === "denied")
      return r.fulfill({
        status: 403,
        json: {
          success: false,
          message: "Synthetic review denied",
          error: { code: "FORBIDDEN" },
        },
      });
    const kind = (url.searchParams.get("review") ??
      "COVER_ENDING") as WorkforceReviewKind;
    const row = (n: number) => ({
      userId: n === 0 ? f.member.id : id(289000 + n),
      name:
        n === 0
          ? state.long
            ? "Alexandra Chidinma Okonkwo-Emmanuel ".repeat(4)
            : "Ada Okoro"
          : `Synthetic colleague ${n}`,
      email: `review.${n}@example.test`,
      role: "STAFF",
      status: "ACTIVE",
      verified: true,
      managed: kind !== "EARLIER_STAFF_SETUP",
      position: kind === "EARLIER_STAFF_SETUP" ? null : "CUSTOMER_SERVICE",
      version: kind === "EARLIER_STAFF_SETUP" ? null : 1,
      accountBranch: { id: id(101), name: "Stadium Road workshop", isActive: true },
      responsibilities: [],
      responsibilitiesMore: false,
      canInspect: true,
      reviewMatchesMore: false,
      reviewMatches: ["UNASSIGNED", "EARLIER_STAFF_SETUP"].includes(kind)
        ? []
        : [
            {
              assignmentId: id(288000 + n),
              template: "CUSTOMER_SERVICE",
              templateVersion: 1,
              scope: "BRANCH",
              temporary: true,
              branch: { id: id(101), name: "Stadium Road workshop", isActive: true },
              startsAt:
                kind === "SCHEDULED"
                  ? "2026-11-14T12:00:00.000Z"
                  : "2026-11-12T12:00:00.000Z",
              expiresAt:
                kind === "OPEN_ENDED_COVER"
                  ? null
                  : kind === "ENDED"
                    ? "2026-11-13T00:00:00.000Z"
                    : "2026-11-14T12:00:00.000Z",
              revokedAt: kind === "REMOVED" ? "2026-11-13T01:00:00.000Z" : null,
            },
          ],
    });
    const filtered = url.searchParams.has("q"),
      cursor = url.searchParams.has("cursor");
    return r.fulfill(
      ok({
        generatedAt: stamp,
        review: {
          kind,
          scope:
            state.mode === "invalid"
              ? "INVALID_SCOPE"
              : delegated
                ? "DELEGATED_STAFF_AND_DUTIES"
                : "ALL_PRIVILEGED_ACCOUNTS",
          ...(kind === "COVER_ENDING"
            ? {
                windowEndsAt: new Date(
                  Date.parse(stamp) +
                    Number(url.searchParams.get("reviewDays") ?? 7) * 86400000,
                ).toISOString(),
              }
            : {}),
        },
        ...(delegated
          ? {
              managementBranches: [
                { id: id(101), name: "Stadium Road workshop", isActive: true },
              ],
            }
          : {}),
        items:
          state.mode === "empty"
            ? []
            : filtered
              ? [row(0)]
              : cursor
                ? [row(2)]
                : [row(0), row(1)],
        ...(!filtered && !cursor && state.mode !== "empty"
          ? { nextCursor: id(289001) }
          : {}),
      }),
    );
  });
  return { f, state };
}
for (const [width, height] of [
  [320, 720],
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1440, 900],
] as const)
  test(`access review layout and controls at ${width}`, async ({ page }, info) => {
    const s = await setup(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await expect(
      page.getByRole("heading", { level: 1, name: "Access reviews", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ada Okoro", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Checked .*Lagos time/)).toBeVisible();
    await expect(page.locator(".workforce-reviews")).not.toContainText(
      "(Lagos time) (Lagos time)",
    );
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
    const control = page.getByRole("button", { name: "Apply review", exact: true });
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath("access-review.png") });
    await page.locator(".wf-review-people > li").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("recorded-duty-facts.png") });
    expect(errors).toEqual([]);
    expect(s.state.writes).toEqual([]);
  });
test("criteria, ending windows, exact filters, pagination, reload and person return retain context", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(base);
  await page.getByLabel("Ending within").selectOption("1");
  await page.getByRole("button", { name: "Apply review", exact: true }).click();
  await expect(page).toHaveURL(/reviewDays=1/);
  await expect(page.getByText("2 people on this page", { exact: true })).toBeVisible();
  expect(s.state.reads.at(-1)!.searchParams.get("reviewDays")).toBe("1");
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page.getByText("1 person on this page", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 person on this page", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText("2 people on this page", { exact: true })).toBeVisible();
  await page.getByLabel("Review", { exact: true }).selectOption("OPEN_ENDED_COVER");
  await page.getByLabel("Person name or email").fill("Ada");
  await page.getByRole("button", { name: "Apply review", exact: true }).click();
  await expect(page).toHaveURL(/review=OPEN_ENDED_COVER/);
  await expect(page).not.toHaveURL(/reviewDays=/);
  await expect(page.getByText("No end date recorded", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View person: Ada Okoro", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Back to access reviews", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to access reviews", exact: true }).click();
  await expect(page.getByLabel("Review", { exact: true })).toHaveValue(
    "OPEN_ENDED_COVER",
  );
  await expect(page.getByLabel("Person name or email")).toHaveValue("Ada");
  expect(s.state.writes).toEqual([]);
});
test("all recorded review states stay distinct from a claim of no other access", async ({
  page,
}) => {
  const s = await setup(page);
  for (const kind of [
    "SCHEDULED",
    "ENDED",
    "REMOVED",
    "UNASSIGNED",
    "EARLIER_STAFF_SETUP",
  ]) {
    await page.goto(`${base}?review=${kind}`);
    await expect(
      page.getByRole("heading", { name: "Ada Okoro", exact: true }),
    ).toBeVisible();
    if (kind === "UNASSIGNED")
      await expect(
        page.getByText(/Administrators and the protected owner baseline are excluded/),
      ).toBeVisible();
    if (kind === "EARLIER_STAFF_SETUP")
      await expect(page.getByText(/not a requirement to enroll them/)).toBeVisible();
    if (kind === "REMOVED")
      await expect(page.getByText("Removed", { exact: true })).toHaveCount(2);
  }
  expect(s.state.writes).toEqual([]);
});
test("failed and malformed reviews clear earlier people, and retry recovers", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Ada Okoro", exact: true }),
  ).toBeVisible();
  for (const mode of ["error", "invalid", "denied"]) {
    s.state.mode = mode;
    await page.getByRole("button", { name: "Refresh review", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ada Okoro", exact: true }),
    ).toHaveCount(0);
    s.state.mode = "normal";
    await page.getByRole("button", { name: "Refresh review", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ada Okoro", exact: true }),
    ).toBeVisible();
  }
  s.state.mode = "empty";
  await page.getByRole("button", { name: "Refresh review", exact: true }).click();
  await expect(
    page.getByText("No people match this review within your current management scope.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(s.state.writes).toEqual([]);
});
test("invalid review filters fetch no review records and can be reset", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(`${base}?review=UNSUPPORTED`);
  await expect(page.getByText(/A review filter is invalid/)).toBeVisible();
  expect(s.state.reads).toEqual([]);
  await page.getByRole("link", { name: "Reset review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ada Okoro", exact: true }),
  ).toBeVisible();
});
test("delegated managers receive their scoped review and lose the route when delegation ends", async ({
  page,
}) => {
  const s = await setup(page, true);
  await page.goto(base);
  await expect(page.getByText(/Staff accounts in your delegated branches/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review invitation status", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Ada Okoro", exact: true }),
  ).toBeVisible();
  const before = s.state.reads.length;
  s.state.mode = "revoked";
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Duty management unavailable", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  expect(s.state.reads).toHaveLength(before);
  expect(s.state.writes).toEqual([]);
});
for (const role of ["STAFF", "ADMIN"])
  test(`an undelegated ${role} cannot discover review people`, async ({ page }) => {
    const s = await setup(page, false, role);
    await page.goto(base);
    await expect(
      page.getByRole("heading", {
        name:
          role === "ADMIN"
            ? "Duty management unavailable"
            : "Responsibility management unavailable",
        exact: true,
      }),
    ).toBeVisible();
    expect(s.state.reads).toEqual([]);
  });
for (const width of [320, 1440])
  test(`long names and enlarged text keep the person action reachable at ${width}`, async ({
    page,
  }, info) => {
    const s = await setup(page);
    s.state.long = true;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await expect(page.locator(".wf-review-people > li")).toHaveCount(2);
    await page.locator(".workforce-reviews").evaluate((root) => {
      for (const el of root.querySelectorAll<HTMLElement>(
        "p,label,input,select,button,a,dt,dd",
      )) {
        el.style.fontSize = "28px";
        el.style.lineHeight = "1.7";
        el.style.letterSpacing = "0.12em";
        el.style.wordSpacing = "0.16em";
      }
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const action = page.getByRole("link", { name: /View person: Alexandra/ });
    await action.focus();
    await expect(action).toBeFocused();
    const box = await action.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath("large-text-person.png") });
    for (const link of await page.locator(".wf-review-person .button").all()) {
      await link.focus();
      await expect(link).toBeFocused();
      expect(
        await link.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          );
          return hit !== null && element.contains(hit);
        }),
      ).toBe(true);
    }
    expect(s.state.writes).toEqual([]);
  });
