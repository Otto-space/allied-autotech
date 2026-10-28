import { expect, test, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workStaffDetailFixture, id } from "../fixtures/work-staff-detail";
import { definitionForAssignment } from "../../../backend/src/modules/organization/workforce-catalogue";
import {
  effectiveWorkforceGrants,
  workforceGrantChanges,
  type GrantVisibility,
} from "../../../backend/src/modules/organization/workforce-effective-access";
const stamp = "2026-10-19T08:00:00.000Z";
const proof = "Synthetic browser proof only";
const reason = "Reviewed workshop responsibility coverage";
const ok = (data: unknown) => ({
  json: {
    success: true,
    data,
    message: "Synthetic workforce QA",
    meta: { requestId: "workforce-detail-test" },
  },
});
async function setup(page: Page, enrolled = false, admin = false, role = "SUPER_ADMIN") {
  const f = await workStaffDetailFixture(page, role);
  if (admin) f.member.role = "ADMIN";
  const w = f.workforce;
  const access = {
    userId: f.member.id,
    position: "WORKSHOP_LEAD",
    version: 0,
    enabledAt: stamp,
    delegatedTemplates: [] as string[],
    delegatedBranchIds: [] as string[],
    delegationPolicyVersion: 1,
  };
  if (enrolled) {
    w.access = access;
    Object.assign(w.management, { canAssign: true, canRevoke: true, canDelegate: admin });
  }
  const state = {
    f,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    mode: "normal",
    reads: 0,
    previews: [] as Record<string, unknown>[],
  };
  const assignments = () =>
    w.assignments.map((a) => ({
      ...a,
      templateVersion: a.templateVersion ?? 1,
      startsAt: new Date(a.startsAt),
      expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
      revokedAt: a.revokedAt ? new Date(a.revokedAt) : null,
    }));
  function visibility(): GrantVisibility {
    const delegated = w.management.branchIds !== null;
    const scopes = new Map<string, "BRANCH" | "ASSIGNED">();
    for (const template of w.management.templates)
      for (const capability of w.templates[template]!.actions)
        if (scopes.get(capability) !== "BRANCH")
          scopes.set(capability, w.templates[template]!.scope as "BRANCH" | "ASSIGNED");
    return {
      eligible: true,
      branches: w.branches,
      capabilities: delegated
        ? (new Set(scopes.keys()) as GrantVisibility["capabilities"])
        : null,
      maximumScopes: scopes as GrantVisibility["maximumScopes"],
      visibleAssignmentIds: new Set(w.assignments.map((a) => a.id)),
    };
  }
  function projection() {
    w.assignmentDefinitions = Object.fromEntries(
      assignments().map((a) => [a.id, definitionForAssignment(a) ?? null]),
    );
    w.effectiveAccess = {
      baseline: w.access ? "MANAGED" : "LEGACY",
      visibility: w.management.branchIds === null ? "FULL" : "DELEGATED",
      evaluatedAt: new Date().toISOString(),
      grants: effectiveWorkforceGrants(assignments(), visibility(), new Date()),
      responsibilityGrantsOnly: true,
    };
    w.management.delegationCapabilities =
      w.management.branchIds === null
        ? null
        : [...visibility().maximumScopes!.entries()].map(([capability, scope]) => ({
            capability,
            scope,
          }));
  }
  await page.route(/\/api\/v1\/admin\/workforce\/accounts(?:\?.*)?$/, (r) =>
    r.fulfill(
      ok({
        items: [
          {
            userId: f.member.id,
            name: "Ada Okoro",
            email: f.member.email,
            role: f.member.role,
            status: "ACTIVE",
            verified: true,
            managed: enrolled,
            position: enrolled ? "WORKSHOP_LEAD" : null,
            version: enrolled ? 0 : null,
            accountBranch: null,
            responsibilities: [],
            responsibilitiesMore: false,
            canInspect: true,
          },
        ],
        generatedAt: stamp,
      }),
    ),
  );
  await page.route("**/api/v1/admin/workforce/accounts/**", async (r) => {
    if (r.request().method() === "GET") {
      state.reads++;
      projection();
      return r.fulfill(ok(w));
    }
    const body = r.request().postDataJSON(),
      path = new URL(r.request().url()).pathname;
    if (path.endsWith("/access-preview")) {
      state.previews.push(body);
      if (state.mode === "preview-unavailable")
        return r.fulfill({
          status: 503,
          json: {
            success: false,
            error: { code: "SERVICE_UNAVAILABLE" },
            message: "Access preview is unavailable",
          },
        });
      const before = assignments(),
        now = new Date(),
        at =
          body.operation === "assign"
            ? new Date(Math.max(now.getTime(), Date.parse(body.startsAt)))
            : now;
      const after =
        body.operation === "assign"
          ? [
              ...before,
              {
                id: "proposal",
                template: body.template,
                templateVersion: 1,
                scope: w.templates[body.template]!.scope,
                branchId: body.branchId,
                startsAt: new Date(body.startsAt),
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
                revokedAt: null,
              },
            ]
          : before.filter((a) => a.id !== body.assignmentId);
      return r.fulfill(
        ok({
          ...workforceGrantChanges(
            effectiveWorkforceGrants(before, visibility(), at),
            effectiveWorkforceGrants(after, visibility(), at, "proposal"),
          ),
          userId: w.userId,
          expectedVersion: w.access!.version,
          operation: body.operation,
          evaluatedAt: at.toISOString(),
          scheduled: at > now,
          visibility: w.management.branchIds === null ? "FULL" : "DELEGATED",
          responsibilityGrantsOnly: true,
          fingerprint: "a".repeat(64),
        }),
      );
    }
    state.writes.push({ path, body });
    if (state.mode === "lost") return r.abort("failed");
    if (state.mode === "malformed")
      return r.fulfill(ok({ ...access, userId: id(999), updatedByUserId: id(302) }));
    if (path.endsWith("/delegation")) {
      w.access = {
        ...w.access!,
        version: w.access!.version + 1,
        delegatedTemplates: [
          ...body.templates,
          ...(body.allowAdminInvitations ? ["ADMIN_INVITE"] : []),
        ],
        delegatedBranchIds: body.branchIds,
      };
      return r.fulfill(ok({ ...w.access, updatedByUserId: id(302) }));
    }
    if (path.endsWith("/revoke")) {
      const a = w.assignments.find((a) => path.includes(a.id))!;
      Object.assign(a, {
        revokedAt: stamp,
        revokedByUserId: id(302),
        revocationReason: body.reason,
      });
      w.activeAssignmentIds = w.assignments.filter((a) => !a.revokedAt).map((a) => a.id);
      w.access!.version++;
      return r.fulfill(ok(a));
    }
    if (path.endsWith("/assignments")) {
      const a = {
        id: id(700),
        userId: w.userId,
        template: body.template,
        templateVersion: 1,
        branchId: body.branchId,
        scope: "BRANCH" as const,
        temporary: body.temporary,
        startsAt: body.startsAt,
        expiresAt: body.expiresAt,
        reason: body.reason,
        assignedByUserId: id(302),
        createdAt: stamp,
        revokedAt: null,
        revokedByUserId: null,
        revocationReason: null,
      };
      w.assignments.push(a);
      w.activeAssignmentIds = [a.id];
      w.access!.version++;
      return r.fulfill(ok(a));
    }
    w.access = { ...access, position: body.position };
    w.management.canAssign = true;
    w.management.canRevoke = true;
    return r.fulfill(ok({ ...w.access, updatedByUserId: id(302) }));
  });
  return state;
}
const section = (page: Page) => page.locator(".workforce-panel");
for (const width of [390, 1440])
  test(`access review explains overlapping care grants at ${width}px`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleMessages: { level: string; text: string }[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()))
        consoleMessages.push({ level: message.type(), text: message.text() });
    });
    const s = await setup(page, true);
    s.f.workforce.assignments = [780, 781].map((n) => ({
      id: id(n),
      userId: s.f.member.id,
      template: "CUSTOMER_SERVICE",
      templateVersion: 1,
      branchId: id(101),
      scope: "BRANCH",
      temporary: false,
      startsAt: stamp,
      expiresAt: null,
      reason: "Isolated reviewed care coverage",
      assignedByUserId: id(302),
      createdAt: stamp,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
    }));
    s.f.workforce.activeAssignmentIds = s.f.workforce.assignments.map((a) => a.id);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/admin/staff/${s.f.member.id}`);
    const current = page.getByRole("region", {
      name: "Effective responsibility access",
      exact: true,
    });
    await expect(current.getByText("Capabilities and grant sources (4)")).toBeVisible();
    const first = section(page).locator(".wf-assignments > li").first();
    await first.getByText("Revoke this responsibility", { exact: true }).click();
    const form = first.locator("form");
    await fillProof(form);
    await form.getByRole("button", { name: "Review revocation" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Access removed (0)" }),
    ).toBeVisible();
    const retained = dialog.getByText("Access retained (4)", { exact: true });
    await retained.focus();
    await retained.press("Enter");
    await expect(
      dialog.getByText("Handle Customer Care enquiries", { exact: true }),
    ).toBeVisible();
    await expect(dialog).toContainText("Supplied by: Customer Service Officer.");
    await expect(page).toHaveURL(new RegExp(`/admin/staff/${s.f.member.id}$`));
    expect(await page.title()).not.toBe("");
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
    expect(pageErrors).toEqual([]);
    expect(consoleMessages.filter((message) => message.level === "error")).toEqual([]);
    await test.info().attach("review-console", {
      body: JSON.stringify(consoleMessages, null, 2),
      contentType: "application/json",
    });
    expect(s.writes).toHaveLength(0);
    expect(JSON.stringify(s.previews)).not.toContain(proof);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-workforce-effective-review-${width}.png`),
      fullPage: false,
    });
    const careGrant = dialog.getByText("Handle Customer Care enquiries", { exact: true });
    await careGrant.scrollIntoViewIfNeeded();
    await expect(careGrant).toBeInViewport();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-workforce-effective-retained-${width}.png`),
      fullPage: false,
    });
    await confirm(page);
    await expect(dialog).toHaveCount(0);
    expect(s.writes).toHaveLength(1);
    expect(s.writes[0]!.body.expectedAccessPreview).toBe("a".repeat(64));
  });
test("unavailable access preview never opens confirmation or creates an uncertain save", async ({
  page,
}) => {
  const s = await setup(page, true);
  s.mode = "preview-unavailable";
  await page.goto(`/admin/staff/${s.f.member.id}`);
  await section(page).getByText("Assign responsibility", { exact: true }).click();
  const form = section(page)
    .locator("details")
    .filter({ has: page.locator("#workforce-template") })
    .locator("form");
  await form.getByLabel("Responsibility", { exact: true }).selectOption("WORKSHOP_LEAD");
  await form.getByLabel("Branch", { exact: true }).selectOption(id(101));
  await form.getByLabel("Starts at (your device time)").fill("2026-10-26T09:00");
  await fillProof(form);
  await form.getByRole("button", { name: "Review responsibility assignment" }).click();
  await expect(section(page).getByRole("alert")).toContainText(
    "The request could not be completed. Please try again shortly.",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(s.previews).toHaveLength(1);
  expect(s.writes).toHaveLength(0);
  await expect(
    page.getByRole("heading", { name: "Check the previous access change" }),
  ).toHaveCount(0);
});
async function fillProof(scope: Locator) {
  await scope.getByLabel("Reason", { exact: true }).fill(reason);
  await scope.getByLabel("Your current password", { exact: true }).fill(proof);
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
}
test("enrollment reviews named account, clears and hides password, then applies once", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(`/admin/staff/${s.f.member.id}`);
  await section(page)
    .getByText("Review legacy access and enroll", { exact: true })
    .click();
  const form = section(page).locator("form").first();
  await form.getByLabel("Job position", { exact: true }).selectOption("WORKSHOP_LEAD");
  await fillProof(form);
  await form.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(form.getByLabel("Your current password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await form.getByRole("button", { name: "Review enrollment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Ada Okoro", { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText(proof);
  await expect(form.getByLabel("Your current password", { exact: true })).toHaveValue("");
  await expect(form.getByLabel("Your current password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await confirm(page);
  await expect(dialog).toHaveCount(0);
  await expect(
    section(page).getByText("Update job position", { exact: true }),
  ).toBeVisible();
  expect(s.writes).toHaveLength(1);
  expect(s.writes[0]!.body).toEqual({
    receiptVersion: 2,
    currentPassword: proof,
    reason,
    position: "WORKSHOP_LEAD",
    expectedVersion: null,
  });
  expect(
    await page.evaluate(
      (p) => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(p),
      proof,
    ),
  ).toBe(false);
});
for (const mode of ["lost", "malformed"])
  test(`${mode} workforce result stays locked across reload without replay`, async ({
    page,
  }) => {
    const s = await setup(page);
    s.mode = mode;
    await page.goto(`/admin/staff/${s.f.member.id}`);
    await section(page)
      .getByText("Review legacy access and enroll", { exact: true })
      .click();
    const form = section(page).locator("form").first();
    await form.getByLabel("Job position", { exact: true }).selectOption("WORKSHOP_LEAD");
    await fillProof(form);
    await form.getByRole("button", { name: "Review enrollment" }).click();
    await confirm(page);
    await expect(page.getByText(/The outcome could not be confirmed/)).toBeVisible();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Review account change" }),
    ).toBeDisabled();
    await section(page)
      .getByText("Review legacy access and enroll", { exact: true })
      .click();
    await expect(
      section(page).getByRole("button", { name: "Review enrollment" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Check current access", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Finish reconciliation" }),
    ).toBeDisabled();
    expect(s.writes).toHaveLength(1);
  });
test("assignment rejects reverse dates and records exact cover before a separate revocation", async ({
  page,
}) => {
  const s = await setup(page, true);
  await page.goto(`/admin/staff/${s.f.member.id}`);
  await section(page).getByText("Assign responsibility", { exact: true }).click();
  const form = section(page)
    .locator("details")
    .filter({ has: page.locator("#workforce-template") })
    .locator("form");
  await form.getByLabel("Responsibility", { exact: true }).selectOption("WORKSHOP_LEAD");
  await form.getByLabel("Branch", { exact: true }).selectOption(id(101));
  await form.getByLabel("Starts at (your device time)").fill("2026-10-19T09:00");
  await form
    .getByLabel("Expires at (optional, your device time)")
    .fill("2026-10-18T09:00");
  await fillProof(form);
  await form.getByRole("button", { name: "Review responsibility assignment" }).click();
  await expect(
    section(page).getByText("Expiry must be after the start time."),
  ).toBeVisible();
  expect(s.writes).toHaveLength(0);
  await form.getByLabel("Expires at (optional, your device time)").fill("");
  await form.getByLabel("Temporary cover", { exact: true }).check();
  await form.getByRole("button", { name: "Review responsibility assignment" }).click();
  await expect(page.getByRole("dialog")).toContainText("Stadium Road workshop");
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    section(page).getByText("Active · Temporary cover", { exact: true }),
  ).toBeVisible();
  await section(page).getByText("Revoke this responsibility", { exact: true }).click();
  // Successful refresh presents an explicit fresh version before another action.
  const reload = section(page).getByRole("button", {
    name: "Reload responsibility actions",
  });
  if (await reload.isVisible()) {
    await reload.click();
    await section(page).getByText("Revoke this responsibility", { exact: true }).click();
  }
  const revoke = section(page).locator(".wf-assignments form");
  await fillProof(revoke);
  await revoke.getByRole("button", { name: "Review revocation" }).click();
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    section(page).getByText("Revoked · Temporary cover", { exact: true }),
  ).toBeVisible();
  expect(s.writes.map((w) => w.body.expectedVersion)).toEqual([0, 1]);
});
test("delegation preserves off-page branches and reviews later-page additions", async ({
  page,
}) => {
  const s = await setup(page, true, true),
    w = s.f.workforce;
  w.access!.delegatedBranchIds = [id(102)];
  await page.route("**/api/v1/admin/branches?**", (r) =>
    r.fulfill(
      ok(
        new URL(r.request().url()).searchParams.has("cursor")
          ? { items: [{ id: id(103), name: "Rumuola workshop", isActive: true }] }
          : {
              items: [{ id: id(101), name: "Stadium Road workshop", isActive: true }],
              nextCursor: id(101),
            },
      ),
    ),
  );
  await page.goto(`/admin/staff/${s.f.member.id}`);
  await section(page)
    .getByText("Owner-approved admin delegation envelope", { exact: true })
    .click();
  const form = section(page)
    .locator("details")
    .filter({ has: page.locator("#workforce-delegated-branch") })
    .locator("form");
  await expect(form.locator(".wf-selected-branches")).toContainText("GRA workshop");
  await form.getByRole("button", { name: "Next", exact: true }).click();
  await form.getByLabel("Add a permitted branch").selectOption(id(103));
  await form
    .getByRole("checkbox", { name: "Workshop / Quality Service Lead", exact: true })
    .check();
  await fillProof(form);
  await form.getByRole("button", { name: "Review delegation envelope" }).click();
  await expect(page.getByRole("dialog")).toContainText("GRA workshop, Rumuola workshop");
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(s.writes[0]!.body.branchIds).toEqual([id(102), id(103)]);
});
for (const width of [430, 1440])
  test(`expanded workforce forms are accessible at ${width}px`, async ({ page }) => {
    const s = await setup(page, true, true);
    await page.setViewportSize({ width, height: 1050 });
    await page.goto(`/admin/staff/${s.f.member.id}`);
    await expect(
      section(page).getByText("Update job position", { exact: true }),
    ).toBeVisible();
    for (const label of [
      "Update job position",
      "Assign responsibility",
      "Owner-approved admin delegation envelope",
    ])
      await section(page).getByText(label, { exact: true }).click();
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
      path: `C:/Users/PC/.codex/work-staff-workforce-${width}.png`,
      fullPage: true,
    });
  });
test("owner responsibility directory reuses verified account and hides protected actions", async ({
  page,
}) => {
  const s = await setup(page);
  Object.assign(s.f.workforce.management, {
    canEnroll: false,
    canAssign: false,
    canRevoke: false,
    canDelegate: false,
  });
  await page.goto("/admin/workforce");
  await page.getByRole("link", { name: "View/manage Ada Okoro", exact: true }).click();
  await expect(
    section(page).getByText(/Responsibility changes are unavailable/),
  ).toBeVisible();
  await expect(section(page).locator("form")).toHaveCount(0);
  expect(s.f.reads).toBe(0);
  expect(s.writes).toHaveLength(0);
});
test("delegated responsibility workspace assigns through scoped APIs without legacy account access", async ({
  page,
}) => {
  const s = await setup(page, true, false, "ADMIN");
  Object.assign(s.f.workforce.management, {
    canEnroll: false,
    canDelegate: false,
    templates: ["WORKSHOP_LEAD"],
    branchIds: [id(101)],
  });
  const legacyReads: string[] = [];
  await page.route("**/api/v1/admin/staff/**", (r) => {
    legacyReads.push(r.request().url());
    return r.fulfill({
      status: 403,
      json: { success: false, error: { code: "FORBIDDEN" } },
    });
  });
  await page.route("**/api/v1/admin/branches**", (r) => {
    legacyReads.push(r.request().url());
    return r.fulfill({
      status: 403,
      json: { success: false, error: { code: "FORBIDDEN" } },
    });
  });
  await page.route("**/api/v1/auth/session", (r) =>
    r.fulfill(
      ok({
        id: id(301),
        user: { id: id(302), email: "workshop@example.test", role: "ADMIN" },
        workforceManaged: true,
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
        department: "Operations",
        version: 1,
        assignments: [],
        permissions: [],
        canManageAssignments: true,
        canInviteAdmins: false,
        serverTime: stamp,
      }),
    ),
  );
  await page.goto("/admin/workforce/access");
  await page.getByRole("link", { name: "View/manage Ada Okoro", exact: true }).click();
  await section(page).getByText("Assign responsibility", { exact: true }).click();
  const form = section(page).locator("form");
  await expect(
    form.getByLabel("Responsibility", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await expect(form.getByLabel("Branch", { exact: true }).locator("option")).toHaveCount(
    2,
  );
  await form.getByLabel("Responsibility", { exact: true }).selectOption("WORKSHOP_LEAD");
  await form.getByLabel("Branch", { exact: true }).selectOption(id(101));
  await form.getByLabel("Starts at (your device time)").fill("2026-10-19T09:00");
  await fillProof(form);
  await form.getByRole("button", { name: "Review responsibility assignment" }).click();
  await confirm(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(section(page).getByText("Active", { exact: true })).toBeVisible();
  expect(s.writes).toHaveLength(1);
  expect(legacyReads).toEqual([]);
});
test("changed actor identity stops responsibility submission before a write", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(`/admin/staff/${s.f.member.id}`);
  await section(page)
    .getByText("Review legacy access and enroll", { exact: true })
    .click();
  const form = section(page).locator("form");
  await form.getByLabel("Job position", { exact: true }).selectOption("WORKSHOP_LEAD");
  await fillProof(form);
  await form.getByRole("button", { name: "Review enrollment" }).click();
  s.f.directory.base.profileMode = "mismatch";
  await confirm(page);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  expect(s.writes).toHaveLength(0);
});
