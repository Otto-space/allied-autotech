import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
type Kind = "COMPLAINTS" | "DISPUTES" | "RETENTION";
const id = (n: number) => `eb000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const routes = {
  COMPLAINTS: "complaint-policy",
  DISPUTES: "dispute-policy",
  RETENTION: "retention-policy",
};
const titles = {
  COMPLAINTS: "Complaint policy",
  DISPUTES: "Dispute policy",
  RETENTION: "Retention policy",
};
const settings: Record<Kind, Record<string, unknown>> = {
  COMPLAINTS: {
    escalationUserId: id(3),
    ordinaryBusinessDayDefinition: "ACCUMULATED_WORKING_HOURS",
    holidays: ["2030-10-01"],
    holidayCalendarApproved: true,
    urgentClassifications: ["Synthetic safety concern"],
  },
  DISPUTES: {
    primaryUserId: id(3),
    backupUserId: id(4),
    days: [1, 2, 3, 4, 5],
    openMinute: 480,
    closeMinute: 1080,
    holidays: ["2030-10-01"],
  },
  RETENTION: {
    destructiveExecutionEnabled: false,
    records: [
      {
        recordType: "INVOICE",
        retentionMonths: 84,
        startEvent: "Synthetic invoice issue date",
        disposition: "RETAIN",
        legalBasis: "Synthetic approved retention basis for testing only.",
      },
    ],
  },
};
const initial = (kind: Kind) => ({
  id: id(8),
  key: kind.toLowerCase(),
  version: 4,
  approvalStatus: "APPROVED",
  source: "Synthetic approved source",
  sourceQuestion: "TEST",
  sourceSignatory: null,
  approvedByUserId: id(2),
  effectiveAt: "2026-01-01T00:00:00Z",
  recordedAt: "2026-01-01T00:00:00Z",
  approvalEvidence: "Synthetic written policy approval",
  settings: settings[kind],
});
const person = (n: number, role: string) => ({
  id: id(n),
  email: `synthetic-${n}@example.test`,
  role,
  status: "ACTIVE",
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  staffProfile: {
    id: id(n + 100),
    firstName: "Synthetic",
    lastName: `Contact ${n}`,
    branchId: null,
  },
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Synthetic response",
      meta: { requestId: "operational-policy-test" },
    },
  });
const fail = (route: Route, status: number) =>
  route.fulfill({
    status,
    json: {
      success: false,
      error: { code: status === 409 ? "CONFLICT" : "DATABASE_UNAVAILABLE" },
    },
  });
async function fixture(
  page: Page,
  kind: Kind,
  options: { role?: string; outcome?: "stale" | "interrupted" | "mismatched" } = {},
) {
  const state = {
    history: [initial(kind)],
    reads: 0,
    writes: [] as Record<string, unknown>[],
    directoryReads: [] as string[],
    failRead: false,
    failDirectory: false,
    mismatchContact: false,
    mismatchGrant: false,
    revoked: false,
    paged: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(1),
        user: {
          id: id(2),
          email: "synthetic@example.test",
          role: options.role ?? "SUPER_ADMIN",
        },
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-24T09:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "operational-policy-csrf-".repeat(3) });
    if (endpoint === "/admin/policies" && route.request().method() === "GET") {
      state.reads++;
      expect(url.searchParams.get("key")).toBe(kind.toLowerCase());
      expect(url.searchParams.get("limit")).toBe("100");
      return state.failRead ? fail(route, 503) : reply(route, state.history);
    }
    if (endpoint === "/admin/policies" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.writes.push(body);
      expect(route.request().headers()["x-csrf-token"]).toBe(
        "operational-policy-csrf-".repeat(3),
      );
      if (options.outcome === "stale") return fail(route, 409);
      if (options.outcome === "interrupted") return route.abort("failed");
      const saved = {
        ...initial(kind),
        id: id(9),
        version: 5,
        source: body.source,
        approvalEvidence: body.approvalEvidence,
        effectiveAt: body.effectiveAt,
        settings: body.settings,
      };
      state.history = [saved, ...state.history];
      return reply(
        route,
        options.outcome === "mismatched" ? { ...saved, key: "wrong-policy" } : saved,
      );
    }
    if (endpoint === "/admin/staff") {
      state.directoryReads.push(url.searchParams.get("cursor") ?? "");
      if (state.failDirectory) return fail(route, 503);
      if (state.paged && url.searchParams.get("cursor"))
        return reply(route, { items: [person(5, "SUPER_ADMIN")] });
      return reply(route, {
        items: [
          person(3, "ADMIN"),
          person(4, "STAFF"),
          { ...person(6, "ADMIN"), emailVerifiedAt: null },
          { ...person(7, "ADMIN"), status: "SUSPENDED" },
        ],
        ...(state.paged ? { nextCursor: id(4) } : {}),
      });
    }
    if (endpoint.startsWith("/admin/staff/")) {
      const n = Number(endpoint.split("-").at(-1));
      return reply(
        route,
        person(
          state.mismatchContact ? 99 : n,
          n === 4 ? "STAFF" : n === 5 ? "SUPER_ADMIN" : "ADMIN",
        ),
      );
    }
    if (endpoint === "/admin/capabilities") {
      expect(url.searchParams.get("activeOnly")).toBe("true");
      return reply(
        route,
        state.revoked
          ? []
          : [
              {
                id: id(10),
                userId: state.mismatchGrant ? id(99) : url.searchParams.get("userId"),
                capability: "DISPUTE_MANAGE",
                grantedByUserId: id(2),
                grantedAt: "2026-01-01T00:00:00Z",
                revokedAt: null,
              },
            ],
      );
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
async function metadata(page: Page) {
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic approval TEST-OWNER");
  await page
    .getByLabel("Written approval or reference")
    .fill("Synthetic written operational policy TEST-001.");
}
async function ready(page: Page, kind: Kind) {
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toBeEnabled();
  if (kind === "COMPLAINTS")
    await expect(page.locator('input[name="escalationUserId"]')).toHaveValue(id(3));
  if (kind === "DISPUTES") {
    await expect(page.locator('input[name="primaryUserId"]')).toHaveValue(id(3));
    await expect(page.locator('input[name="backupUserId"]')).toHaveValue(id(4));
  }
  if (kind !== "RETENTION") await page.getByLabel("I confirm that this schedule").check();
  await metadata(page);
}
for (const kind of ["COMPLAINTS", "DISPUTES", "RETENTION"] as const) {
  test(`${kind} owner reviews and publishes complete versioned settings`, async ({
    page,
  }) => {
    const state = await fixture(page, kind),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) errors.push(m.text());
    });
    await page.goto(`/admin/${routes[kind]}`);
    await expect(page).toHaveTitle(new RegExp(titles[kind]));
    await ready(page, kind);
    const inputAppearance = await page
      .getByLabel("Approval source", { exact: true })
      .evaluate((element) => ({
        border: getComputedStyle(element).borderTopWidth,
        height: element.getBoundingClientRect().height,
      }));
    expect(Number.parseFloat(inputAppearance.border)).toBeGreaterThan(0);
    expect(inputAppearance.height).toBeGreaterThanOrEqual(40);
    await page.getByLabel("Effective date and time").fill("2030-01-05T08:30");
    for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-${routes[kind]}-1440.png`),
    });
    await page.getByRole("button", { name: "Review policy", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    expect(state.writes).toEqual([]);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Review policy", exact: true }),
    ).toBeFocused();
    await expect(page.getByLabel("Written approval or reference")).toHaveValue(
      "Synthetic written operational policy TEST-001.",
    );
    await page.getByRole("button", { name: "Review policy", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-${routes[kind]}-review-390.png`),
    });
    await page.getByRole("button", { name: "Approve policy", exact: true }).click();
    await expect(page.getByText("Latest recorded version: 5.")).toBeVisible();
    expect(state.writes).toEqual([
      {
        kind,
        settings: settings[kind],
        expectedVersion: 4,
        effectiveAt: "2030-01-05T07:30:00.000Z",
        source: "Synthetic approval TEST-OWNER",
        approvalEvidence: "Synthetic written operational policy TEST-001.",
      },
    ]);
    await expect(page.getByLabel("Written approval or reference")).toHaveValue("");
    await page.getByText("Policy history", { exact: true }).click();
    await expect(page.getByRole("heading", { name: /Version 5/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
  for (const role of ["ADMIN", "STAFF"])
    test(`${role} cannot read or approve ${kind}`, async ({ page }) => {
      const state = await fixture(page, kind, { role });
      await page.goto(`/admin/${routes[kind]}`);
      await expect(
        page.getByText("Super Admin access is required to configure this policy."),
      ).toBeVisible();
      expect(state.reads).toBe(0);
      expect(state.directoryReads).toEqual([]);
      expect(state.writes).toEqual([]);
      await expect(
        page.getByRole("link", { name: titles[kind], exact: true }),
      ).toHaveCount(0);
    });
  test(`${kind} empty history does not invent approved settings`, async ({ page }) => {
    const state = await fixture(page, kind);
    state.history = [];
    await page.goto(`/admin/${routes[kind]}`);
    await expect(page.getByText("No policy version has been recorded.")).toBeVisible();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
    if (kind === "RETENTION")
      await expect(page.getByLabel("Retention period (months)")).toHaveValue("");
    if (kind === "COMPLAINTS")
      await expect(page.getByLabel("Approved urgent classifications")).toHaveValue("");
    if (kind === "DISPUTES")
      await expect(page.getByLabel("Opening time (Lagos time)")).toHaveValue("");
    expect(state.writes).toEqual([]);
  });
}
for (const outcome of ["stale", "interrupted", "mismatched"] as const)
  test(`publication ${outcome} is not replayed and uncertainty survives history failures`, async ({
    page,
  }) => {
    const kind: Kind = "RETENTION",
      state = await fixture(page, kind, { outcome });
    await page.goto("/admin/retention-policy");
    await ready(page, kind);
    await page.getByRole("button", { name: "Review policy", exact: true }).click();
    await page.getByRole("button", { name: "Approve policy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Approve policy", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: outcome === "stale" ? "Go back" : "Close & review record",
        exact: true,
      })
      .click();
    if (outcome !== "stale") {
      state.failRead = true;
      await page
        .getByRole("button", { name: "Refresh policy history", exact: true })
        .click();
      await expect(page.getByText(/The approval outcome is uncertain/)).toBeVisible();
      state.failRead = false;
      await page
        .getByRole("button", { name: "Refresh policy history", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Review policy", exact: true }),
      ).toBeDisabled();
    }
    expect(state.writes).toHaveLength(1);
    await expect(
      page.getByText("Retention policy approved.", { exact: true }),
    ).toHaveCount(0);
  });
test("contact pagination preserves selection and publishes account IDs, not profile IDs", async ({
  page,
}) => {
  const state = await fixture(page, "COMPLAINTS");
  state.paged = true;
  await page.goto("/admin/complaint-policy");
  await ready(page, "COMPLAINTS");
  await page
    .getByRole("navigation", { name: "Policy contacts pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByLabel("Escalation contact", { exact: true })).toHaveValue(id(3));
  await page.getByLabel("Escalation contact", { exact: true }).selectOption(id(5));
  await expect(page.locator('input[name="escalationUserId"]')).toHaveValue(id(5));
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText(new RegExp("synthetic-5@example.test")),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve policy", exact: true }).click();
  await expect(page.getByText("Latest recorded version: 5.")).toBeVisible();
  expect(state.writes[0]?.settings).toMatchObject({ escalationUserId: id(5) });
  expect(state.directoryReads).toContain(id(4));
});
for (const failure of ["mismatchContact", "mismatchGrant", "revoked"] as const)
  test(`${failure} contact cannot authorize a dispute policy`, async ({ page }) => {
    const state = await fixture(page, "DISPUTES");
    state[failure] = true;
    await page.goto("/admin/dispute-policy");
    await metadata(page);
    await page.getByLabel("I confirm that this schedule").check();
    await expect(page.locator('input[name="primaryUserId"]')).toHaveValue("");
    await page.getByRole("button", { name: "Review policy", exact: true }).click();
    await expect(page.getByLabel("Primary contact", { exact: true })).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(state.writes).toEqual([]);
  });
test("complaint validation rejects impossible dates and short classifications", async ({
  page,
}) => {
  const state = await fixture(page, "COMPLAINTS");
  await page.goto("/admin/complaint-policy");
  await ready(page, "COMPLAINTS");
  await page.getByLabel("Excluded holiday dates").fill("2030-02-30");
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Excluded holiday dates")).toBeFocused();
  await page.getByLabel("Excluded holiday dates").fill("");
  await page.getByLabel("Approved urgent classifications").fill("X");
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Approved urgent classifications")).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("dispute validation rejects identical contacts, no weekdays and reversed hours", async ({
  page,
}) => {
  const state = await fixture(page, "DISPUTES");
  await page.goto("/admin/dispute-policy");
  await ready(page, "DISPUTES");
  await page.getByLabel("Backup contact", { exact: true }).selectOption(id(3));
  await expect(page.locator('input[name="backupUserId"]')).toHaveValue(id(3));
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Backup contact", { exact: true })).toBeFocused();
  await page.getByLabel("Backup contact", { exact: true }).selectOption(id(4));
  await expect(page.locator('input[name="backupUserId"]')).toHaveValue(id(4));
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    await page.getByLabel(day, { exact: true }).uncheck();
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Sunday", { exact: true })).toBeFocused();
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Closing time (Lagos time)").fill("07:00");
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Closing time (Lagos time)")).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("retention rows retain independent drafts, validate trimmed text and remove without publishing", async ({
  page,
}) => {
  const state = await fixture(page, "RETENTION");
  await page.goto("/admin/retention-policy");
  await ready(page, "RETENTION");
  await page.getByLabel("Approved legal basis").fill(" ".repeat(20));
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Approved legal basis")).toBeFocused();
  await page
    .getByLabel("Approved legal basis")
    .fill("Synthetic legal basis preserved through draft edits.");
  await page.getByRole("button", { name: "Add retention rule", exact: true }).click();
  await expect(page.getByLabel("Record category")).toHaveCount(2);
  await page.getByLabel("Record category").nth(1).selectOption("SUPPORT");
  await page.getByRole("button", { name: "Remove rule 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add retention rule", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Approved legal basis")).toHaveValue(
    "Synthetic legal basis preserved through draft edits.",
  );
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Deletion and anonymization remain disabled.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("account change clears an open policy approval and its draft", async ({ page }) => {
  const state = await fixture(page, "RETENTION");
  await page.goto("/admin/retention-policy");
  await ready(page, "RETENTION");
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Written approval or reference")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("history from a different policy cannot enable publication", async ({ page }) => {
  const state = await fixture(page, "RETENTION");
  state.history[0]!.key = "wrong";
  await page.goto("/admin/retention-policy");
  await expect(
    page.getByText("We could not read this information. Please try again."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review policy", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

for (const kind of ["COMPLAINTS", "DISPUTES", "RETENTION"] as const)
  test(`customer cannot enter ${kind} policy administration`, async ({ page }) => {
    const state = await fixture(page, kind, { role: "CUSTOMER" });
    await page.goto(`/admin/${routes[kind]}`);
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(state.reads).toBe(0);
    expect(state.directoryReads).toEqual([]);
    expect(state.writes).toEqual([]);
  });
test("retention publishes multiple reviewed rules and wraps long history at 320px", async ({
  page,
}) => {
  const state = await fixture(page, "RETENTION");
  state.history[0]!.source = "S".repeat(500);
  state.history[0]!.approvalEvidence = "E".repeat(1000);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/admin/retention-policy");
  await ready(page, "RETENTION");
  await page.getByRole("button", { name: "Add retention rule", exact: true }).click();
  await page.getByLabel("Record category").nth(1).selectOption("SUPPORT");
  await page.getByLabel("Retention period (months)").nth(1).fill("12");
  await page
    .getByLabel("Period starts from")
    .nth(1)
    .fill("Synthetic support closure date");
  await page
    .getByLabel("Disposition after the period")
    .nth(1)
    .selectOption("REVIEW_ANONYMIZATION");
  await page.getByLabel("Approved legal basis").nth(1).fill("L".repeat(1000));
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Rule 2 \u00b7 Records", { exact: true }),
  ).toBeVisible();
  expect(
    await page.getByRole("dialog").evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Approve policy", exact: true }).click();
  await expect(page.getByText("Latest recorded version: 5.")).toBeVisible();
  expect(state.writes[0]?.settings).toEqual({
    destructiveExecutionEnabled: false,
    records: [
      ...(settings.RETENTION.records as unknown[]),
      {
        recordType: "SUPPORT",
        retentionMonths: 12,
        startEvent: "Synthetic support closure date",
        disposition: "REVIEW_ANONYMIZATION",
        legalBasis: "L".repeat(1000),
      },
    ],
  });
  await page.getByText("Policy history", { exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-retention-history-320.png"),
  });
});
test("rechecking a revoked dispute grant prevents using an earlier eligible selection", async ({
  page,
}) => {
  const state = await fixture(page, "DISPUTES");
  await page.goto("/admin/dispute-policy");
  await ready(page, "DISPUTES");
  state.revoked = true;
  await page.getByRole("button", { name: "Recheck backup contact", exact: true }).click();
  await expect(page.locator('input[name="backupUserId"]')).toHaveValue("");
  await page.getByRole("button", { name: "Review policy", exact: true }).click();
  await expect(page.getByLabel("Backup contact", { exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});
