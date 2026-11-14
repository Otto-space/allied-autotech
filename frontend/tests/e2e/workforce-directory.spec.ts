import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workStaffDetailFixture, id } from "../fixtures/work-staff-detail";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
const base = "/admin/workforce/access",
  stamp = "2026-10-26T18:00:00.000Z";
async function setup(page: Page, delegated = false, managedSession = true) {
  const f = await workStaffDetailFixture(page, delegated ? "ADMIN" : "SUPER_ADMIN");
  f.workforce.effectiveAccess = {
    baseline: "LEGACY",
    visibility: delegated ? "DELEGATED" : "FULL",
    evaluatedAt: stamp,
    grants: [],
    responsibilityGrantsOnly: true,
    ...(delegated ? {} : { independentCapabilities: [] }),
  };
  if (delegated) {
    f.workforce.management.canEnroll = false;
    f.workforce.management.branchIds = [id(101)];
    f.workforce.branches = f.workforce.branches.filter((branch) => branch.id === id(101));
  }
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
  await page.route("**/api/v1/public/capabilities", (route) =>
    route.fulfill(ok(publicCapabilitiesFixture("browse_enquiries"))),
  );
  const row = (n: number) => ({
    userId: n === 0 ? f.member.id : id(240000 + n),
    name:
      n === 0
        ? "Ada Okoro"
        : n === 1
          ? "Chidinma Alexandra Okonkwo-Emmanuel"
          : `Fixture colleague ${n}`,
    email:
      n === 1
        ? "chidinma.alexandra.okonkwo-emmanuel@example.test"
        : `fixture.${n}@example.test`,
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
          workforceManaged: managedSession,
          mfaRequired: true,
          mfaVerifiedAt: stamp,
          expiresAt: "2027-01-01T00:00:00.000Z",
          idleExpiresAt: "2027-01-01T00:00:00.000Z",
        }),
      ),
    );
    await page.route("**/api/v1/staff/workforce/access", (r) =>
      state.mode === "scope-error"
        ? r.fulfill({
            status: 503,
            json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
          })
        : r.fulfill(
            ok({
              ...access,
              userId: state.mode === "wrong-actor" ? id(999999) : access.userId,
              canManageAssignments: state.mode !== "revoked",
              version: state.mode === "revoked" ? 2 : 1,
            }),
          ),
    );
  }
  return { ...state, state, f };
}
for (const width of [320, 1440])
  test(`real Admin baseline can open delegated People at ${width}px`, async ({
    page,
  }) => {
    const s = await setup(page, true, false);
    await page.setViewportSize({ width, height: 720 });
    await page.goto(base);
    await expect(
      page.getByRole("heading", { name: "People", exact: true }),
    ).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("People");
    await page.getByRole("link", { name: "View person: Ada Okoro", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ada Okoro", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".wf-person-header")).toContainText("Staff");
    await expect(breadcrumb).toHaveCount(1);
    await expect(
      breadcrumb.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveCount(1);
    await expect(
      breadcrumb.getByRole("link", { name: "People", exact: true }),
    ).toHaveAttribute("href", base);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Person");
    expect(s.state.errors).toEqual([]);
    expect(s.state.writes).toEqual([]);
  });
test("real Admin baseline remains available when duty delegation ends", async ({
  page,
}) => {
  const s = await setup(page, true, false);
  await page.goto(base);
  await expect(page.getByRole("heading", { name: "People", exact: true })).toBeVisible();
  s.state.mode = "revoked";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Duty management unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View person: Ada Okoro", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Return to People", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Staff directory", exact: true }),
  ).toBeVisible();
  expect(s.state.errors).toEqual([]);
  expect(s.state.writes).toEqual([]);
});
test("real Admin without current duty delegation never fetches the scoped directory", async ({
  page,
}) => {
  const s = await setup(page, true, false);
  s.state.mode = "revoked";
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Duty management unavailable", exact: true }),
  ).toBeVisible();
  expect(s.state.reads).toEqual([]);
  await expect(
    page.getByRole("link", { name: "View person: Ada Okoro", exact: true }),
  ).toHaveCount(0);
  expect(s.state.writes).toEqual([]);
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
  const refresh = page.getByRole("button", {
    name: "Refresh duty management access",
    exact: true,
  });
  await refresh.focus();
  for (const control of [
    refresh,
    page.getByRole("link", { name: "Return to People", exact: true }),
  ]) {
    await expect(control).toBeFocused();
    const hitArea = await control.evaluate((element) => {
      const b = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const radius = Math.max(
        ...[
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomLeftRadius,
          style.borderBottomRightRadius,
        ].map((value) => Number.parseFloat(value) || 0),
      );
      // Probe painted corners, then each edge. The bounding rectangle's
      // square corners are outside a rounded button's actual hit area.
      const inset = Math.min(b.width / 2, b.height / 2, radius / 2 + 2);
      const points = [
        [b.left + inset, b.top + inset],
        [b.right - inset, b.top + inset],
        [b.left + inset, b.bottom - inset],
        [b.right - inset, b.bottom - inset],
        [b.left + b.width / 2, b.top + 2],
        [b.left + b.width / 2, b.bottom - 2],
        [b.left + 2, b.top + b.height / 2],
        [b.right - 2, b.top + b.height / 2],
      ];
      return {
        height: b.height,
        radius,
        points: points.map(([x, y]) => ({
          x,
          y,
          unobscured: element.contains(document.elementFromPoint(x!, y!)),
        })),
      };
    });
    expect(hitArea.height, JSON.stringify(hitArea)).toBeGreaterThanOrEqual(44);
    expect(
      hitArea.points.every((point) => point.unobscured),
      JSON.stringify(hitArea),
    ).toBe(true);
    await page.keyboard.press("Tab");
  }
});
test("real Admin rejects another account's duty snapshot before fetching people", async ({
  page,
}) => {
  const s = await setup(page, true, false);
  s.state.mode = "wrong-actor";
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Duty management unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Your current Admin identity could not be confirmed" }),
  ).toBeVisible();
  expect(s.state.reads).toEqual([]);
  expect(s.state.writes).toEqual([]);
});
test("real Admin can retry an unavailable duty check without treating it as no access", async ({
  page,
}) => {
  const s = await setup(page, true, false);
  s.state.mode = "scope-error";
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Duty management unavailable", exact: true }),
  ).toBeVisible();
  expect(s.state.reads).toEqual([]);
  s.state.mode = "normal";
  await page
    .getByRole("button", { name: "Refresh duty management access", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "People", exact: true })).toBeVisible();
  expect(s.state.writes).toEqual([]);
});
for (const [width, height] of [
  [1440, 720],
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`workforce directory ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width <= 430,
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    test(`directory at ${width}px keeps filters, table and actions accessible`, async ({
      page,
    }, info) => {
      const s = await setup(page);
      await page.goto(base);
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      await expect(
        page.getByRole("heading", {
          name: "People",
          exact: true,
        }),
      ).toBeVisible();
      const region = page.getByRole("region", {
        name: "Workforce accounts",
        exact: true,
      });
      await expect(region).toBeVisible();
      await expect(
        page.getByRole("link", { name: "View person: Ada Okoro", exact: true }),
      ).toBeAttached();
      await region.locator("tbody tr").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("workforce-records.png") });
      const cells = await region.locator("tbody th, tbody td").evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { left: box.left, right: box.right, text: node.textContent };
        }),
      );
      expect(
        cells.every((cell) => cell.left >= 0 && cell.right <= width),
        JSON.stringify(cells),
      ).toBe(true);
      expect(
        await region.evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      if (width >= 1024) {
        await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Expand sidebar", exact: true }),
        ).toBeVisible();
        expect(
          await region.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Collapse sidebar", exact: true }),
        ).toBeVisible();
      }
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
      const open = page.getByRole("link", {
        name: "View person: Ada Okoro",
        exact: true,
      });
      await open.focus();
      await expect(open).toBeInViewport();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", {
          name: "Responsibilities & temporary cover",
          exact: true,
        }),
      ).toBeVisible();
      await page.getByText("Review legacy access and enroll", { exact: true }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Ada Okoro", exact: true }),
      ).toBeVisible();
      const identity = page.locator(".wf-person-header");
      await expect(identity.getByText("Staff", { exact: true })).toBeVisible();
      await expect(
        identity.getByText("Stadium Road workshop", { exact: true }),
      ).toBeVisible();
      await expect(identity.getByText("Active", { exact: true })).toBeVisible();
      await expect(page.getByText(/This is a partial access summary/)).toBeVisible();
      await expect(page.getByLabel("Job position", { exact: true })).toBeVisible();
      const review = page.getByRole("button", { name: "Review enrollment", exact: true });
      await review.focus();
      await expect(review).toBeInViewport();
      const selected = page.getByRole("complementary", {
        name: "Selected person",
        exact: true,
      });
      await expect(selected.getByText("Ada Okoro", { exact: true })).toBeVisible();
      const occlusion = await review.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const top = document.querySelector(".wf-person-context")!.getBoundingClientRect();
        const front = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return {
          belowIdentity: box.top >= top.bottom,
          unobscured: front === element || element.contains(front),
        };
      });
      expect(occlusion).toEqual({ belowIdentity: true, unobscured: true });
      await page.screenshot({ path: info.outputPath("person-edit-context.png") });
      await selected.getByRole("link", { name: "Overview", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#workforce-person-overview")).toBeFocused();
      await expect(
        page.getByRole("heading", { name: "Ada Okoro", level: 1, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("workforce-detail.png") });
      if (width === 320 || width === 1440)
        expect(
          (await new AxeBuilder({ page }).include(".workforce-panel").analyze())
            .violations,
        ).toEqual([]);
      await page.getByRole("link", { name: "Back to People", exact: true }).click();
      await expect(region).toBeVisible();
      expect(s.errors).toEqual([]);
      expect(s.writes).toEqual([]);
    });
  });
}
for (const { width, collapsed, measuredBand, earlierInset } of [
  { width: 320, collapsed: false, measuredBand: false, earlierInset: 0 },
  { width: 768, collapsed: false, measuredBand: false, earlierInset: 0 },
  { width: 1440, collapsed: false, measuredBand: false, earlierInset: 0 },
  { width: 1440, collapsed: true, measuredBand: false, earlierInset: 0 },
  { width: 320, collapsed: false, measuredBand: true, earlierInset: 0 },
  { width: 320, collapsed: false, measuredBand: true, earlierInset: 160 },
]) {
  test(`long selected identity at ${width}px${measuredBand ? " with the measured identity band" : ""}${earlierInset ? " and an earlier header inset" : ""} wraps at enlarged text without covering actions${collapsed ? " with collapsed sidebar" : ""}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 720 });
    const s = await setup(page);
    const name = "Chidinma Alexandra Okonkwo-Emmanuel with a long recorded family name";
    s.f.workforce.accountLabel = name;
    await page.goto(`${base}/${s.f.member.id}`);
    if (collapsed) {
      await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Expand sidebar", exact: true }),
      ).toBeVisible();
    }
    await page.getByText("Review legacy access and enroll", { exact: true }).click();
    const selected = page.getByRole("complementary", { name: "Selected person" });
    await selected.locator("strong").evaluate((element) => {
      element.style.fontSize = "28px";
      element.style.lineHeight = "1.5";
      element.style.letterSpacing = "0.12em";
      element.style.wordSpacing = "0.16em";
    });
    if (measuredBand)
      await selected.evaluate((element, extraInset) => {
        // Keep the valid larger band independent of platform font metrics.
        element.style.minHeight = "356px";
        const header = document.querySelector(".dashboard-top")!;
        document.documentElement.style.setProperty(
          "--viewport-header-offset",
          `${Math.max(0, header.getBoundingClientRect().bottom) + 16 + extraInset}px`,
        );
      }, earlierInset);
    const review = page.getByRole("button", { name: "Review enrollment", exact: true });
    for (const control of [
      page.getByLabel("Your current password", { exact: true }),
      review,
    ]) {
      if (control === review) {
        await page.keyboard.press("Tab");
        await expect(
          page.getByRole("button", { name: "Show password", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Tab");
      } else {
        await control.focus();
      }
      await expect(control).toBeFocused();
      // The person-context resize/focus handler uses this native alignment.
      // Exercise it explicitly so event timing cannot mask doubled header space.
      await control.evaluate((element) =>
        element.scrollIntoView({ block: "start", behavior: "instant" }),
      );
      await expect(selected.getByText(name, { exact: true })).toBeInViewport();
      expect(
        await selected.evaluate((element) => element.getBoundingClientRect().height),
      ).toBeLessThan(720 / 2);
      await expect(control).toBeInViewport();
      await expect
        .poll(() =>
          control.evaluate((element) => {
            const targets = [element];
            if (element instanceof HTMLInputElement) {
              const label = element.labels?.[0];
              if (!label)
                return {
                  belowIdentity: false,
                  occludingElements: ["Visible field label missing"],
                };
              targets.push(label);
            }
            const boxes = targets.map((target) => target.getBoundingClientRect());
            const bar = document
              .querySelector(".wf-person-context")!
              .getBoundingClientRect();
            // Sample painted edge midpoints; bounding-box corners can fall
            // outside the button's rounded border even with nothing over it.
            const occludingElements = boxes.flatMap((box, index) =>
              [
                [box.left + box.width / 2, box.top + 2],
                [box.left + box.width / 2, box.bottom - 2],
                [box.left + 2, box.top + box.height / 2],
                [box.right - 2, box.top + box.height / 2],
              ].flatMap(([x, y]) => {
                const front = document.elementFromPoint(x, y);
                const target = targets[index]!;
                return front === target || target.contains(front)
                  ? []
                  : [front ? `${front.tagName}.${front.className}` : "outside viewport"];
              }),
            );
            return {
              belowIdentity: boxes.every((box) => box.top >= bar.bottom),
              occludingElements,
            };
          }),
        )
        .toEqual({ belowIdentity: true, occludingElements: [] });
      await page.screenshot({
        path: info.outputPath(
          control === review ? "person-long-identity.png" : "person-long-password.png",
        ),
      });
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath("person-long-identity.png") });
    expect(s.writes).toEqual([]);
    expect(s.errors).toEqual([]);
  });
}

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
  await page.getByLabel("Job position", { exact: true }).selectOption("WORKSHOP_LEAD");
  await page.getByRole("button", { name: "Search people", exact: true }).click();
  await expect(page).toHaveURL(/q=Ada&position=WORKSHOP_LEAD$/);
  await page.getByRole("link", { name: "View person: Ada Okoro", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Responsibilities & temporary cover",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to People", exact: true }).click();
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
  await expect(
    page.locator(".workforce-directory").getByText("Ada Okoro", { exact: true }),
  ).toBeVisible();
  s.state.mode = "error";
  await page.getByRole("button", { name: "Refresh people", exact: true }).click();
  await expect(page.locator(".workforce-directory").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Workforce accounts" })).toHaveCount(0);
  s.state.mode = "empty";
  await page.getByRole("button", { name: "Refresh people", exact: true }).click();
  await expect(page.getByText(/No people are available within/)).toBeVisible();
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
  await expect(page.getByLabel("Account level", { exact: true })).toHaveCount(0);
  s.state.mode = "revoked";
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
  await expect(
    page.locator(".workforce-directory").getByText("Ada Okoro", { exact: true }),
  ).toHaveCount(0);
  await page.goto(`${base}/${s.f.member.id}`);
  await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
  await expect(
    page.getByRole("heading", {
      name: "Responsibilities & temporary cover",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(s.errors).toEqual([]);
  expect(s.writes).toEqual([]);
});
