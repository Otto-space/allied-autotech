import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resourceEditorFixture } from "../fixtures/workshop-resource-editor";
import { resourceId as id, resourceRow } from "../fixtures/workshop-resources";
import { verifyConsole } from "../fixtures/preview-console";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";
test.beforeEach(async ({ request }) => {
  await bookingRuntimeCapabilities(request);
});
const root = `/admin/booking-resources?branch=${id(1)}`;
async function approval(page: Page) {
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic written resource approval");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic signed resource approval for isolated verification only.");
}
async function review(page: Page) {
  await approval(page);
  await page
    .getByRole("button", { name: "Review resource approval", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve resource plan", exact: true })
    .click();
}
for (const [width, collapsed] of [
  [320, false],
  [768, false],
  [1440, false],
  [1440, true],
] as const)
  test(`owner reviews real names, split periods and one approval at ${width}px${collapsed ? " with collapsed sidebar" : ""}`, async ({
    page,
  }, info) => {
    const state = await resourceEditorFixture(page),
      errors: string[] = [],
      warnings: string[] = [],
      external: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
      if (m.type() === "warning") warnings.push(m.text());
    });
    page.on("request", (r) => {
      if (
        /^https?:/.test(r.url()) &&
        !["127.0.0.1", "localhost"].includes(new URL(r.url()).hostname)
      )
        external.push(r.url());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(root);
    if (collapsed) {
      await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Expand sidebar", exact: true }),
      ).toBeVisible();
    }
    await expect(page).toHaveURL(/\/admin\/booking-resources\?branch=/);
    await expect(page).toHaveTitle(/Workshop resources/);
    await expect(
      page.getByRole("heading", { name: "Workshop resources", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }).locator("ol>li"),
    ).toHaveCount(2);
    await expect(
      page.locator("nextjs-portal").getByText(/Build Error|Runtime Error/),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Current workshop resources" }),
    ).toContainText("Current version 2");
    await expect(page.getByLabel("Unit name")).toHaveValue("Synthetic alignment machine");
    await page.screenshot({
      path: info.outputPath(`allied-resource-overview-${width}.png`),
      fullPage: false,
    });
    const nameField = page.getByLabel("Unit name");
    await nameField.focus();
    await expect(nameField).toBeFocused();
    await nameField.press("Tab");
    await expect(page.getByLabel("Current condition")).toBeFocused();
    await page.getByLabel("Current condition").press("Shift+Tab");
    await expect(nameField).toBeFocused();
    expect(
      await nameField.evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--focus-ring)";
        document.body.appendChild(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(el).outlineColor === expected;
      }),
    ).toBe(true);
    const target = await page
      .getByRole("button", { name: "Add equipment", exact: true })
      .boundingBox();
    expect(target?.height).toBeGreaterThanOrEqual(44);
    await nameField.fill("Synthetic reviewed 2D alignment machine");
    const unit = page.locator("[data-unit]").first();
    await unit.getByLabel("Until", { exact: true }).fill("12:00");
    await unit.getByRole("button", { name: "Add working period", exact: true }).click();
    const period = unit.locator("[data-period]").last();
    await period.getByRole("combobox", { name: "Day", exact: true }).selectOption("1");
    await period.getByLabel("From", { exact: true }).fill("13:00");
    await period.getByLabel("Until", { exact: true }).fill("18:00");
    await review(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Synthetic alignment technician");
    await expect(dialog).toContainText("Monday 13:00–18:00");
    await expect(dialog).toContainText("A future plan is already scheduled");
    await expect(dialog).not.toContainText(id(31));
    await page.screenshot({
      path: info.outputPath(`allied-resource-review-${width}.png`),
    });
    await expect(
      dialog.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: "Go back", exact: true }).click();
    expect(state.writes).toHaveLength(0);
    await review(page);
    await confirm(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("Resource plan version 4 was approved.", { exact: false }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      kind: "BRANCH_RESOURCES",
      branchId: id(1),
      expectedVersion: 3,
      settings: {
        resources: [
          {
            id: id(30),
            name: "Synthetic reviewed 2D alignment machine",
            workingPeriods: [
              { weekday: 1, opensAt: "08:00", closesAt: "12:00" },
              { weekday: 1, opensAt: "13:00", closesAt: "18:00" },
            ],
          },
        ],
      },
    });
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
      path: info.outputPath(`allied-resource-editor-${width}.png`),
      fullPage: false,
    });
    expect(external).toEqual([]);
    await verifyConsole(page, errors, warnings);
  });
test("empty plan uses actual references and requires explicit resource assessment", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  state.history = [];
  await page.goto(root);
  await expect(
    page.getByText("No approved resource plan is currently in effect."),
  ).toBeVisible();
  await expect(page.getByLabel("Unit name")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Add an existing service", exact: true })
    .selectOption(id(42));
  await page
    .getByRole("combobox", { name: "Add an existing technician", exact: true })
    .selectOption(id(41));
  const tech = page.locator("[data-technician]");
  await expect(tech).toContainText("Synthetic mechanic with a longer display name");
  await tech
    .getByRole("checkbox", { name: "Synthetic independent inspection", exact: true })
    .check();
  await tech.getByRole("button", { name: "Add working period", exact: true }).click();
  await tech.getByRole("combobox", { name: "Day", exact: true }).selectOption("1");
  await tech.getByLabel("From", { exact: true }).fill("08:00");
  await tech.getByLabel("Until", { exact: true }).fill("18:00");
  await approval(page);
  await page
    .getByRole("button", { name: "Review resource approval", exact: true })
    .click();
  await expect(page.locator(".resource-validation")).toContainText(
    "Assess every service",
  );
  await expect(page.locator(".resource-validation")).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("checkbox", { name: "Assessed: no equipment or shared space required" })
    .check();
  await page
    .getByRole("button", { name: "Review resource approval", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "no equipment or shared space required",
  );
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes[0]).toMatchObject({
    settings: {
      resources: [],
      technicians: [{ staffId: id(41), serviceIds: [id(42)] }],
      services: [{ serviceId: id(42), requirements: [] }],
    },
  });
});
test("new physical units do not assume condition or working hours", async ({ page }) => {
  await resourceEditorFixture(page);
  await page.goto(root);
  await page.getByRole("button", { name: "Add equipment", exact: true }).click();
  const unit = page.locator("[data-unit]").last();
  await expect(unit.getByLabel("Unit name")).toHaveValue("");
  await expect(
    unit.getByRole("combobox", { name: "Current condition", exact: true }),
  ).toHaveValue("");
  await expect(unit.locator("[data-period]")).toHaveCount(0);
  await unit.getByRole("button", { name: "Add working period", exact: true }).click();
  await expect(unit.getByRole("combobox", { name: "Day", exact: true })).toHaveValue(
    "-1",
  );
  await expect(unit.getByLabel("From", { exact: true })).toHaveValue("");
  await page
    .getByRole("button", { name: "Review resource approval", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("search and pagination use real selectable records without submitting approval", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  state.pageSize = 1;
  await page.goto(root);
  await page.getByRole("button", { name: "Next services", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Add an existing service", exact: true })
    .selectOption(id(42));
  await expect(page.locator("[data-service]").last()).toContainText(
    "Synthetic independent inspection",
  );
  await page.getByLabel("Search existing technicians", { exact: true }).fill("mechanic");
  await page.getByLabel("Search existing technicians", { exact: true }).press("Enter");
  await expect(
    page
      .getByRole("combobox", { name: "Add an existing technician", exact: true })
      .getByRole("option", { name: /Synthetic mechanic/ }),
  ).toBeAttached();
  await page
    .getByRole("combobox", { name: "Add an existing technician", exact: true })
    .selectOption(id(41));
  await expect(page.locator("[data-technician]").last()).toContainText(
    "Synthetic mechanic",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("stale preflight preserves draft and sends no approval", async ({ page }) => {
  const state = await resourceEditorFixture(page);
  await page.goto(root);
  await page.getByLabel("Unit name").fill("Synthetic retained draft");
  await review(page);
  state.history.unshift(resourceRow(4));
  await confirm(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByLabel("Unit name")).toHaveValue("Synthetic retained draft");
  await expect(
    page.getByText("A newer resource version was recorded.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review resource approval", exact: true }),
  ).toBeDisabled();
});
test("definitive rejection keeps the draft and clears only its recovery marker", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  state.mode = "reject";
  await page.goto(root);
  await page.getByLabel("Unit name").fill("Synthetic rejected draft");
  await review(page);
  await confirm(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  await expect(page.getByLabel("Unit name")).toHaveValue("Synthetic rejected draft");
  expect(state.writes).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((k) => k.startsWith("aat:resource-policy:")),
    ),
  ).toEqual([]);
  expect(state.history).toHaveLength(2);
});
for (const mode of ["drop", "wrong-receipt"] as const)
  test(`${mode} response blocks duplicate save and survives refresh for explicit recovery`, async ({
    page,
  }) => {
    const state = await resourceEditorFixture(page);
    state.mode = mode;
    await page.goto(root);
    await review(page);
    await confirm(page);
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Approve resource plan", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    await expect(page.getByRole("region", { name: "Approval recovery" })).toBeVisible();
    expect(state.writes).toHaveLength(1);
    const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
    expect(stored).not.toContain("Synthetic signed resource approval");
    expect(stored).not.toContain("workingPeriods");
    expect(stored).not.toContain("Synthetic alignment technician");
    page.on("dialog", (d) => d.accept());
    await page.reload();
    const recovery = page.getByRole("region", { name: "Approval recovery" });
    await expect(recovery).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review resource approval", exact: true }),
    ).toBeDisabled();
    await recovery
      .getByRole("button", { name: "Check latest approval record", exact: true })
      .click();
    await expect(recovery).toContainText("Latest recorded version: 4");
    await recovery.locator(".resource-version>summary").first().click();
    await expect(recovery).toContainText(
      "Synthetic signed resource approval for isolated verification only.",
    );
    await recovery.getByRole("checkbox").check();
    await recovery
      .getByRole("button", { name: "Acknowledge reviewed outcome", exact: true })
      .click();
    await expect(recovery).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).filter((k) => k.startsWith("aat:resource-policy:")),
      ),
    ).toEqual([]);
  });
test("unavailable selected staff never becomes eligible through this form", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  state.options.find((r) => r.id === id(31))!.eligible = false;
  await page.goto(root);
  await expect(page.locator("[data-technician]")).toContainText(
    "Current job permissions do not allow this selection",
  );
  await approval(page);
  await page
    .getByRole("button", { name: "Review resource approval", exact: true })
    .click();
  await expect(page.locator(".resource-validation")).toContainText(
    "Verify the selected service and technician names",
  );
  expect(state.writes).toHaveLength(0);
});
test("account change during approval preflight hides private form without a write", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  await page.goto(root);
  await review(page);
  state.identity.profileOwner = id(999);
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Unit name")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("load failures are recoverable, and access loss removes resource details", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  state.fail = true;
  await page.goto(root);
  await expect(
    page.getByRole("region", { name: "Current workshop resources" }),
  ).toHaveCount(0);
  await expect(page.locator(".workshop-resources").getByRole("alert")).toBeVisible();
  state.fail = false;
  await page
    .getByRole("button", { name: "Refresh resource record", exact: true })
    .click();
  await expect(page.getByLabel("Unit name")).toHaveValue("Synthetic alignment machine");
  state.denied = true;
  await page
    .getByRole("button", { name: "Refresh resource record", exact: true })
    .click();
  await expect(page.getByLabel("Unit name")).toHaveCount(0);
});
test("ordinary administrators cannot load the owner resource record", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  state.identity.role = "ADMIN";
  await page.goto(root);
  await expect(page.getByLabel("Unit name")).toHaveCount(0);
  await expect(
    page.getByText(
      "Resource policy requires an active, verified Super Admin account with MFA.",
    ),
  ).toBeVisible();
  expect(state.readCount).toBe(0);
});

test("Nigeria-time exceptions and future approval preserve the currently active plan", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  await page.goto(root);
  const unit = page.locator("[data-unit]");
  await unit
    .getByRole("combobox", { name: "Current condition", exact: true })
    .selectOption("UNAVAILABLE");
  await unit.getByText("Unavailable periods (0)", { exact: true }).click();
  await unit.getByRole("button", { name: "Add unavailable period", exact: true }).click();
  await unit.getByLabel("Unavailable from", { exact: true }).fill("2048-05-03T10:00");
  await unit.getByLabel("Available again", { exact: true }).fill("2048-05-03T11:00");
  await unit
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic maintenance exception");
  await approval(page);
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2048-05-01T08:00");
  await page
    .getByRole("button", { name: "Review resource approval", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("2048-05-03 10:00");
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes[0]).toMatchObject({
    effectiveAt: "2048-05-01T07:00:00.000Z",
    settings: {
      resources: [
        {
          status: "UNAVAILABLE",
          unavailablePeriods: [
            {
              startsAt: "2048-05-03T09:00:00.000Z",
              endsAt: "2048-05-03T10:00:00.000Z",
              reason: "Synthetic maintenance exception",
            },
          ],
        },
      ],
    },
  });
  await expect(
    page.getByRole("region", { name: "Current workshop resources" }),
  ).toContainText("Current version 2");
});
test("branch changes ask before discarding a private unsaved draft", async ({ page }) => {
  await resourceEditorFixture(page);
  await page.goto(root);
  await page.getByLabel("Unit name").fill("Synthetic branch-specific unsaved draft");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("combobox", { name: "Workshop branch", exact: true })
    .selectOption(id(9));
  await expect(page).toHaveURL(new RegExp(id(1)));
  await expect(page.getByLabel("Unit name")).toHaveValue(
    "Synthetic branch-specific unsaved draft",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("combobox", { name: "Workshop branch", exact: true })
    .selectOption(id(9));
  await expect(page).toHaveURL(new RegExp(id(9)));
  await expect(page.getByLabel("Unit name")).toHaveValue("Synthetic alignment machine");
});

test("an incorrect device clock does not turn immediate approval into a future policy", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  await page.clock.setFixedTime(new Date("2047-01-01T12:00:00Z"));
  await page.goto(root);
  await review(page);
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  const when = Date.parse(String(state.writes[0]!.effectiveAt));
  expect(Math.abs(when - Date.now())).toBeLessThan(60000);
  await expect(
    page.getByRole("region", { name: "Current workshop resources" }),
  ).toContainText("Current version 4");
});

for (const role of ["SUPER_ADMIN", "ADMIN"])
  test(`managed ${role} retains the correct resource authoring boundary`, async ({
    page,
  }) => {
    const state = await resourceEditorFixture(page);
    state.identity.role = role;
    const reply = (route: import("@playwright/test").Route, data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic managed resource response",
          meta: { requestId: "managed-resource-fixture" },
        },
      });
    await page.route("**/api/v1/auth/session", (route) =>
      reply(route, {
        id: id(2),
        user: { id: state.identity.owner, email: "resource-owner@example.test", role },
        mfaRequired: true,
        mfaVerifiedAt: new Date().toISOString(),
        workforceManaged: true,
      }),
    );
    await page.route("**/api/v1/staff/workforce/access", (route) =>
      reply(route, {
        managed: true,
        userId: state.identity.owner,
        staffId: id(5),
        position: "CEO_MD",
        department: "Strategy",
        version: 0,
        assignments: [],
        permissions: [],
        canManageAssignments: true,
        canInviteAdmins: true,
        serverTime: new Date().toISOString(),
      }),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(root);
    if (role === "SUPER_ADMIN") {
      await expect(
        page
          .getByRole("navigation", { name: "Administration", exact: true })
          .getByRole("link", { name: "Workshop resources", exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Unit name")).toHaveValue(
        "Synthetic alignment machine",
      );
    } else {
      await expect(page.getByLabel("Unit name")).toHaveCount(0);
      await expect(
        page
          .getByRole("navigation", { name: "Administration", exact: true })
          .getByRole("link", { name: "Workshop resources", exact: true }),
      ).toHaveCount(0);
      expect(state.readCount).toBe(0);
    }
    expect(state.writes).toHaveLength(0);
  });

test("an unrelated edit preserves recorded exception seconds and milliseconds", async ({
  page,
}) => {
  const state = await resourceEditorFixture(page);
  const exception = {
    startsAt: "2030-05-01T09:00:30.250Z",
    endsAt: "2030-05-01T10:00:45.125Z",
    reason: "Synthetic precise maintenance",
  };
  state.history[1]!.settings.resources[0]!.unavailablePeriods = [exception];
  await page.goto(root);
  await page.getByLabel("Unit name").fill("Synthetic renamed precise machine");
  await review(page);
  await expect(page.getByRole("dialog")).toContainText("2030-05-01 10:00:30.250");
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const settings = state.writes[0]!
    .settings as (typeof state.history)[number]["settings"];
  expect(settings.resources[0]!.unavailablePeriods).toEqual([exception]);
});
