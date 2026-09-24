import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { StaffMember } from "@/lib/api/staff-admin-schemas";
const id = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const branch = (n = 20) => ({
  id: id(n),
  name: `Isolated branch ${n}`,
  code: `TEST-${n}`,
  isActive: true,
});
const memberFixture = (): StaffMember => ({
  id: id(1),
  email: "member@example.test",
  role: "STAFF",
  status: "ACTIVE",
  emailVerifiedAt: time,
  createdAt: time,
  updatedAt: time,
  staffProfile: {
    id: id(2),
    firstName: "Test",
    lastName: "Member",
    phone: null,
    jobTitle: "Technician",
    branchId: id(20),
    createdAt: time,
    updatedAt: time,
    branch: branch(),
  },
});
const reply = (route: Route, data?: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      ...(data === undefined ? {} : { data }),
      meta: { requestId: "staff-test" },
    },
  });
async function fixture(
  page: Page,
  handler: (route: Route, endpoint: string) => Promise<boolean | void>,
  role = "ADMIN",
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: { id: id(11), email: "operator@example.test", role },
        mfaRequired: true,
        mfaVerifiedAt: time,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-staff-csrf-".repeat(4) });
    if (endpoint === "/admin/capabilities") return reply(route, []);
    if (endpoint === "/admin/branches") {
      const next = new URL(route.request().url()).searchParams.has("cursor");
      return reply(route, {
        items: [branch(next ? 21 : 20)],
        ...(next ? {} : { nextCursor: id(20) }),
      });
    }
    await route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });

test("Super Admin can grant and revoke a narrow duty on their own protected account", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeErrors.push(message.text());
  });
  const member = { ...memberFixture(), id: id(11), role: "SUPER_ADMIN" };
  const grants: {
    id: string;
    userId: string;
    capability: string;
    grantedByUserId: string;
    grantedAt: string;
    revokedAt: string | null;
  }[] = [];
  const writes: unknown[] = [];
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === `/admin/staff/${id(11)}`) {
        await reply(route, member);
        return true;
      }
      if (endpoint === "/admin/capabilities") {
        const url = new URL(route.request().url());
        if (route.request().method() === "GET") {
          expect(url.searchParams.get("userId")).toBe(member.id);
          await reply(
            route,
            url.searchParams.get("activeOnly") === "true"
              ? grants.filter((grant) => !grant.revokedAt)
              : grants,
          );
        } else {
          writes.push(route.request().postDataJSON());
          grants.push({
            id: id(70),
            userId: member.id,
            capability: "BOOKING_CONFIRM",
            grantedByUserId: id(11),
            grantedAt: time,
            revokedAt: null,
          });
          await reply(route, grants[0]);
        }
        return true;
      }
      if (endpoint === `/admin/capabilities/${id(70)}/revoke`) {
        writes.push(route.request().postDataJSON());
        grants[0].revokedAt = time;
        await reply(route, { id: id(70), revoked: true });
        return true;
      }
    },
    "SUPER_ADMIN",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/staff/${member.id}`);
  await expect(page).toHaveTitle(/Staff account/);
  const permissions = page.getByRole("region", { name: "Operational permissions" });
  await expect(permissions.getByText("No active operational permissions.")).toBeVisible();
  await permissions.getByLabel("Permission to grant").selectOption("BOOKING_CONFIRM");
  await permissions.getByRole("button", { name: "Review permission grant" }).click();
  await expect(page.getByRole("dialog").getByText(member.email)).toBeVisible();
  expect(writes).toEqual([]);
  await confirm(page).click();
  const revoke = permissions.getByRole("button", {
    name: "Revoke confirm workshop bookings",
  });
  await expect(revoke).toBeEnabled();
  await permissions.screenshot({
    path: path.join(os.tmpdir(), "allied-permissions-active-390.png"),
  });
  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await revoke.click();
  await permissions
    .getByLabel("Reason for removal")
    .fill("Workshop confirmation duty reassigned.");
  await permissions.getByRole("button", { name: "Review permission removal" }).click();
  await expect(
    page.getByRole("dialog").getByText("Workshop confirmation duty reassigned."),
  ).toBeVisible();
  await confirm(page).click();
  await expect(permissions.getByText("No active operational permissions.")).toBeVisible();
  expect(writes).toEqual([
    { userId: member.id, capability: "BOOKING_CONFIRM" },
    { reason: "Workshop confirmation duty reassigned." },
  ]);
  await expect(
    permissions
      .getByLabel("Permission to grant")
      .locator('option[value="BOOKING_CONFIRM"]'),
  ).toHaveCount(1);
  await permissions.getByText("Recent permission history", { exact: true }).click();
  await expect(permissions.locator("details")).toContainText("revoked");
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-permissions-390-viewport.png"),
  });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-permissions-390.png"),
    fullPage: true,
  });
  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-permissions-1440-viewport.png"),
  });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-permissions-1440.png"),
    fullPage: true,
  });
  expect(runtimeErrors).toEqual([]);
});

test("administrator cannot read or grant operational permissions", async ({ page }) => {
  let permissionReads = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/admin/staff/${id(1)}`) {
      await reply(route, memberFixture());
      return true;
    }
    if (endpoint.startsWith("/admin/capabilities")) {
      permissionReads++;
      await reply(route, []);
      return true;
    }
  });
  await page.goto(`/admin/staff/${id(1)}`);
  await expect(page.getByRole("heading", { name: "Test Member" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Operational permissions" })).toHaveCount(
    0,
  );
  expect(permissionReads).toBe(0);
});

for (const outcome of ["interrupted", "mismatched"] as const)
  test(`a ${outcome} permission grant cannot be repeated after closing its review`, async ({
    page,
  }) => {
    let writes = 0;
    await fixture(
      page,
      async (route, endpoint) => {
        if (endpoint === `/admin/staff/${id(1)}`) {
          await reply(route, memberFixture());
          return true;
        }
        if (endpoint === "/admin/capabilities" && route.request().method() === "POST") {
          writes++;
          if (outcome === "interrupted") await route.abort("failed");
          else
            await reply(route, {
              id: id(70),
              userId: id(99),
              capability: "BOOKING_CONFIRM",
              grantedByUserId: id(11),
              grantedAt: time,
              revokedAt: null,
            });
          return true;
        }
      },
      "SUPER_ADMIN",
    );
    await page.goto(`/admin/staff/${id(1)}`);
    await page.getByLabel("Permission to grant").selectOption("BOOKING_CONFIRM");
    await page.getByRole("button", { name: "Review permission grant" }).click();
    await confirm(page).click();
    await expect(confirm(page)).toBeDisabled();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await expect(
      page.getByRole("button", { name: "Review permission grant" }),
    ).toBeDisabled();
    expect(writes).toBe(1);
  });

test("a mismatched revocation response cannot report success or be repeated", async ({
  page,
}) => {
  let writes = 0;
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === `/admin/staff/${id(1)}`) {
        await reply(route, memberFixture());
        return true;
      }
      if (endpoint === "/admin/capabilities") {
        await reply(route, [
          {
            id: id(70),
            userId: id(1),
            capability: "BOOKING_CONFIRM",
            grantedByUserId: id(11),
            grantedAt: time,
            revokedAt: null,
          },
        ]);
        return true;
      }
      if (endpoint === `/admin/capabilities/${id(70)}/revoke`) {
        writes++;
        await reply(route, { id: id(99), revoked: true });
        return true;
      }
    },
    "SUPER_ADMIN",
  );
  await page.goto(`/admin/staff/${id(1)}`);
  await page.getByRole("button", { name: "Revoke confirm workshop bookings" }).click();
  await page.getByLabel("Reason for removal").fill("Booking duty has been reassigned.");
  await page.getByRole("button", { name: "Review permission removal" }).click();
  await confirm(page).click();
  await expect(
    page.getByRole("dialog").getByText(/outcome could not be confirmed/),
  ).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await expect(
    page.getByText("Permission change recorded.", { exact: true }),
  ).toHaveCount(0);
  expect(writes).toBe(1);
});
for (const route of ["/admin/staff", `/admin/staff/${id(1)}`, "/admin/staff/invite"])
  test(`staff cannot enter ${route} or read administrator records`, async ({ page }) => {
    const reads: string[] = [];
    await fixture(
      page,
      async (request, endpoint) => {
        if (endpoint.startsWith("/admin/")) {
          reads.push(endpoint);
          await reply(request, { items: [] });
          return true;
        }
      },
      "STAFF",
    );
    await page.goto(route);
    await expect(page.getByText(/Administrator access is required/)).toBeVisible();
    expect(reads).toEqual([]);
  });
test("directory distinguishes failed reads, preserves filters and resets cursor navigation", async ({
  page,
}) => {
  let fail = true;
  const queries: Record<string, string>[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint !== "/admin/staff") return;
    const query = Object.fromEntries(new URL(route.request().url()).searchParams);
    queries.push(query);
    if (fail)
      await route.fulfill({
        status: 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      });
    else
      await reply(route, {
        items: query.status
          ? []
          : [{ ...memberFixture(), id: query.cursor ? id(3) : id(1) }],
        ...(query.cursor || query.status ? {} : { nextCursor: id(1) }),
      });
    return true;
  });
  await page.goto("/admin/staff");
  await expect(
    page.getByText("The service is temporarily unavailable. Please try again shortly."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No matching staff accounts" }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Refresh staff directory" }).click();
  await expect(page.getByRole("heading", { name: "Test Member" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Staff directory pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View account for Test Member" }),
  ).toHaveAttribute("href", `/admin/staff/${id(3)}`);
  expect(queries.at(-1)?.cursor).toBe(id(1));
  await page.getByLabel("Account status", { exact: true }).selectOption("SUSPENDED");
  await page.getByLabel("Account role", { exact: true }).selectOption("ADMIN");
  await page.getByLabel("Branch", { exact: true }).selectOption(id(20));
  await expect(
    page.getByRole("heading", { name: "No matching staff accounts" }),
  ).toBeVisible();
  await expect
    .poll(() => queries.at(-1))
    .toEqual({ limit: "25", status: "SUSPENDED", role: "ADMIN", branchId: id(20) });
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: "Clear staff filters" }).click();
  await expect(page.getByRole("heading", { name: "Test Member" })).toBeVisible();
});
test("administrator cannot manage self, peers or super-administrators", async ({
  page,
}) => {
  let target = memberFixture();
  await fixture(page, async (route, endpoint) => {
    if (endpoint.startsWith("/admin/staff/")) {
      expect(route.request().method()).toBe("GET");
      await reply(route, target);
      return true;
    }
  });
  for (const value of [
    { ...memberFixture(), id: id(11) },
    { ...memberFixture(), role: "ADMIN" as const },
    { ...memberFixture(), role: "SUPER_ADMIN" as const },
  ]) {
    target = value;
    await page.goto(`/admin/staff/${target.id}`);
    await expect(
      page.getByText(/Role, status and branch changes are unavailable/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Review account change" })).toHaveCount(
      0,
    );
  }
});
test("status change rechecks the record, blocks a stale review and submits only the actual status contract", async ({
  page,
}) => {
  let member = memberFixture();
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/admin/staff/${id(1)}`) {
      await reply(route, member);
      return true;
    }
    if (endpoint === `/admin/staff/${id(1)}/status`) {
      writes.push(route.request().postDataJSON());
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      member = { ...member, status: "DEACTIVATED", updatedAt: "2026-09-17T12:00:00Z" };
      await reply(route, { id: member.id, status: member.status });
      return true;
    }
  });
  await page.goto(`/admin/staff/${id(1)}`);
  await page.getByLabel("New account status").selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Review account change" }).click();
  await expect(page.getByRole("dialog")).toContainText("revokes their existing sessions");
  expect(writes).toEqual([]);
  member = { ...member, status: "SUSPENDED", updatedAt: "2026-09-17T11:00:00Z" };
  await confirm(page).click();
  await expect(
    page.getByText("This record has changed. Refresh it and review the latest details."),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByRole("button", { name: "Reload account action" }).click();
  await page.getByLabel("New account status").selectOption("DEACTIVATED");
  await page.getByRole("button", { name: "Review account change" }).click();
  await confirm(page).click();
  await expect(
    page.getByText("Change recorded. The account’s existing sessions were revoked."),
  ).toBeVisible();
  expect(writes).toEqual([{ status: "DEACTIVATED" }]);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-staff-account-mobile.png"),
    fullPage: true,
  });
});
test("failed preflight reads do not submit or permanently lock an account change", async ({
  page,
}) => {
  let fail = false;
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/admin/staff/${id(1)}`) {
      if (fail) await route.abort("failed");
      else await reply(route, memberFixture());
      return true;
    }
    if (endpoint.endsWith("/status")) {
      writes++;
      await reply(route, { id: id(1), status: "SUSPENDED" });
      return true;
    }
  });
  await page.goto(`/admin/staff/${id(1)}`);
  await page.getByLabel("New account status").selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Review account change" }).click();
  fail = true;
  await confirm(page).click();
  await expect(
    page.getByText(
      "The current record could not be checked. No change was submitted. Refresh it before trying again.",
    ),
  ).toBeVisible();
  expect(writes).toBe(0);
  fail = false;
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review account change" })).toBeEnabled();
  await page.getByRole("button", { name: "Review account change" }).click();
  await confirm(page).click();
  await expect(
    page.getByText("Change recorded. The account’s existing sessions were revoked."),
  ).toBeVisible();
  expect(writes).toBe(1);
});
test("a contradictory success response cannot confirm or replay a status change", async ({
  page,
}) => {
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/admin/staff/${id(1)}`) {
      await reply(route, memberFixture());
      return true;
    }
    if (endpoint.endsWith("/status")) {
      writes++;
      await reply(route, { id: id(1), status: "ACTIVE" });
      return true;
    }
  });
  await page.goto(`/admin/staff/${id(1)}`);
  await page.getByLabel("New account status").selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Review account change" }).click();
  await confirm(page).click();
  await expect(page.getByText(/The outcome could not be confirmed/)).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await expect(
    page.getByText("Change recorded. The account’s existing sessions were revoked."),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(
    page.getByRole("button", { name: "Review account change" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
});
test("branch changes retain paged choices and unknown outcomes cannot be resent", async ({
  page,
}) => {
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === `/admin/staff/${id(1)}`) {
      await reply(route, memberFixture());
      return true;
    }
    if (endpoint.endsWith("/branch")) {
      writes.push(route.request().postDataJSON());
      await route.abort("failed");
      return true;
    }
  });
  await page.goto(`/admin/staff/${id(1)}`);
  await page.getByLabel("Account change", { exact: true }).selectOption("branch");
  await page
    .getByRole("navigation", { name: "Branch choices pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByLabel("New active branch").selectOption(id(21));
  await page
    .getByRole("navigation", { name: "Branch choices pages" })
    .getByRole("button", { name: "Previous", exact: true })
    .click();
  await expect(page.getByLabel("New active branch")).toHaveValue(id(21));
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Review account change" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Existing booking assignments are not automatically reassigned",
  );
  await confirm(page).click();
  await expect(page.getByText(/The outcome could not be confirmed/)).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(
    page.getByRole("button", { name: "Review account change" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Refresh staff account" }).click();
  await expect(
    page.getByRole("button", { name: "Review account change" }),
  ).toBeDisabled();
  expect(writes).toEqual([{ branchId: id(21) }]);
});

const invitationToken = "isolated-private-token-".repeat(3);
const invitation = () => ({
  id: id(40),
  email: "member@example.test",
  role: "ADMIN",
  recipientId: id(1),
  invitedById: id(11),
  status: "PENDING",
  createdAt: time,
  expiresAt: "2027-01-01T00:00:00Z",
  usedAt: null,
  revokedAt: null,
});
const candidate = (role: "STAFF" | "CUSTOMER") => ({
  id: id(1),
  email: "member@example.test",
  role,
  profile: role === "CUSTOMER" ? { firstName: "Test", lastName: "Customer" } : null,
  staffProfile:
    role === "STAFF" ? { firstName: "Test", lastName: "Member", branchId: id(20) } : null,
});

test("even the owner has no generic ADMIN promotion control", async ({ page }) => {
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === `/admin/staff/${id(1)}`) {
        await reply(route, memberFixture());
        return true;
      }
    },
    "SUPER_ADMIN",
  );
  await page.goto(`/admin/staff/${id(1)}`);
  await expect(page.getByRole("heading", { name: "Test Member" })).toBeVisible();
  await expect(
    page.getByLabel("Account change", { exact: true }).locator('option[value="role"]'),
  ).toHaveCount(0);
});

test("owner demotion requires an active branch and confirms the returned staff assignment", async ({
  page,
}) => {
  let member = { ...memberFixture(), role: "ADMIN" as StaffMember["role"] };
  const writes: unknown[] = [];
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === `/admin/staff/${id(1)}`) {
        await reply(route, member);
        return true;
      }
      if (endpoint === `/admin/staff/${id(1)}/role`) {
        writes.push(route.request().postDataJSON());
        expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
        member = { ...memberFixture(), updatedAt: "2026-09-18T10:00:00Z" };
        await reply(route, member);
        return true;
      }
    },
    "SUPER_ADMIN",
  );
  await page.goto(`/admin/staff/${id(1)}`);
  await page.getByLabel("Account change", { exact: true }).selectOption("role");
  await expect(
    page.getByLabel("New account role").locator('option[value="ADMIN"]'),
  ).toHaveCount(0);
  await page.getByLabel("New active branch").selectOption(id(20));
  await page.getByRole("button", { name: "Review account change" }).click();
  expect(writes).toEqual([]);
  await confirm(page).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes).toEqual([{ role: "STAFF", branchId: id(20) }]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const role of ["STAFF", "CUSTOMER"] as const)
  test(`verified ${role} search supports the reviewed access workflow`, async ({
    page,
  }) => {
    const writes: { endpoint: string; body: unknown }[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await fixture(page, async (route, endpoint) => {
      if (endpoint === "/admin/staff/candidates") {
        expect(new URL(route.request().url()).searchParams.get("email")).toBe(
          "member@example.test",
        );
        await reply(route, { items: [candidate(role)] });
        return true;
      }
      if (endpoint === "/admin/staff/invitations" && route.request().method() === "GET") {
        await reply(route, { items: [] });
        return true;
      }
      if (["/admin/staff/invitations", "/admin/staff/promotions"].includes(endpoint)) {
        writes.push({ endpoint, body: route.request().postDataJSON() });
        expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
        await reply(
          route,
          role === "STAFF"
            ? { invitation: invitation(), delivery: "QUEUED" }
            : memberFixture(),
        );
        return true;
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/staff/invite");
    await expect(page).toHaveTitle("Invite a team member");
    await expect(
      page.getByRole("heading", { name: "Team & access", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Account email", { exact: true }).fill("member@example.test");
    await page.getByRole("button", { name: "Search account" }).click();
    await page
      .getByLabel("Your current password", { exact: true })
      .fill("current proof password");
    if (role === "CUSTOMER")
      await page.getByLabel("Active staff branch").selectOption(id(20));
    await page
      .getByRole("button", {
        name:
          role === "STAFF" ? "Review administrator invitation" : "Review staff promotion",
      })
      .click();
    expect(writes).toEqual([]);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-team-${role.toLowerCase()}-review.png`),
      fullPage: false,
    });
    await confirm(page).click();
    await expect(
      page.getByText(
        role === "STAFF"
          ? "Administrator invitation queued. Email delivery and acceptance are not yet confirmed."
          : "Staff promotion recorded. Existing sessions were revoked.",
      ),
    ).toBeVisible();
    expect(writes).toEqual([
      {
        endpoint:
          role === "STAFF" ? "/admin/staff/invitations" : "/admin/staff/promotions",
        body:
          role === "STAFF"
            ? {
                email: "member@example.test",
                role: "ADMIN",
                currentPassword: "current proof password",
              }
            : {
                customerUserId: id(1),
                branchId: id(20),
                currentPassword: "current proof password",
              },
      },
    ]);
    expect(pageErrors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (role === "STAFF") {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const nav = page.getByRole("navigation", { name: "Administration", exact: true });
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(
        nav.getByRole("link", { name: "Promotions & invitations" }),
      ).toHaveAttribute("aria-current", "page");
      await page.screenshot({
        path: path.join(os.tmpdir(), "allied-team-desktop.png"),
        fullPage: false,
      });
    }
  });

test("invitation status filtering and revocation use the selected record and password proof", async ({
  page,
}) => {
  let revoked = false;
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/staff/invitations") {
      await reply(route, {
        items: [
          {
            ...invitation(),
            status: revoked ? "REVOKED" : "PENDING",
            revokedAt: revoked ? time : null,
          },
        ],
      });
      return true;
    }
    if (endpoint === `/admin/staff/invitations/${id(40)}/revoke`) {
      writes.push(route.request().postDataJSON());
      revoked = true;
      await reply(route, { ...invitation(), status: "REVOKED", revokedAt: time });
      return true;
    }
  });
  await page.goto("/admin/staff/invite");
  await page.getByLabel("Invitation status filter").selectOption("PENDING");
  await page
    .getByLabel("Your current password to revoke member@example.test")
    .fill("proof password");
  await page.getByRole("button", { name: "Review revocation" }).click();
  expect(writes).toEqual([]);
  await confirm(page).click();
  await expect(page.getByText("Invitation revoked.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review revocation" })).toHaveCount(0);
  expect(writes).toEqual([{ currentPassword: "proof password" }]);
});

test("acceptance scrubs its fragment and requires an explicit authenticated CSRF-protected confirmation", async ({
  page,
}) => {
  const writes: unknown[] = [];
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/auth/staff/invitations/accept") {
        writes.push(route.request().postDataJSON());
        expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
        await reply(route, { role: "ADMIN", signInRequired: true });
        return true;
      }
    },
    "STAFF",
  );
  await page.goto(`/staff/accept-invitation#token=${invitationToken}`);
  await expect(page).toHaveURL(/\/staff\/accept-invitation$/);
  await expect(page.getByLabel("Invitation token")).toHaveValue(invitationToken);
  expect(writes).toEqual([]);
  await page.getByLabel("Your current password").fill("existing account password");
  await page.getByRole("button", { name: "Review acceptance" }).click();
  expect(writes).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Accept administrator access" })
    .click();
  await expect(
    page.getByText(
      "Administrator access accepted. Your previous sessions were revoked. Sign in again to continue.",
    ),
  ).toBeVisible();
  expect(writes).toEqual([
    { token: invitationToken, currentPassword: "existing account password" },
  ]);
  await expect(page.getByLabel("Invitation token")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in again" })).toBeVisible();
});

for (const result of ["rejected", "unknown"] as const)
  test(`acceptance handles ${result} outcomes and clears the current password`, async ({
    page,
  }) => {
    let calls = 0;
    await fixture(
      page,
      async (route, endpoint) => {
        if (endpoint === "/auth/staff/invitations/accept") {
          calls++;
          if (result === "unknown") await route.abort("failed");
          else
            await route.fulfill({
              status: 400,
              json: { success: false, error: { code: "TOKEN_INVALID" } },
            });
          return true;
        }
      },
      "STAFF",
    );
    await page.goto(`/staff/accept-invitation#token=${invitationToken}`);
    await page.getByRole("button", { name: "Review acceptance" }).click();
    await expect(
      page.getByText("Enter your current password.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Your current password").fill("existing password");
    await page.getByRole("button", { name: "Review acceptance" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Accept administrator access" })
      .click();
    await expect.poll(() => calls).toBe(1);
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Accept administrator access" }),
    ).toBeDisabled();
    await expect(page.getByLabel("Your current password")).toHaveValue("");
    await expect(page.getByText(/Administrator access accepted/)).toHaveCount(0);
  });

test("cross-tab account changes discard invitation credentials and late acceptance responses", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/auth/staff/invitations/accept") {
        calls++;
        await held;
        await reply(route, { role: "ADMIN", signInRequired: true });
        return true;
      }
    },
    "STAFF",
  );
  await page.goto(`/staff/accept-invitation#token=${invitationToken}`);
  await page.getByLabel("Your current password").fill("existing password");
  await page.getByRole("button", { name: "Review acceptance" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Accept administrator access" })
    .click();
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(
    page.getByText(
      "Your session changed. Sign in to the intended staff account and reopen the invitation link.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Invitation token")).toHaveCount(0);
  await expect(page.getByLabel("Your current password")).toHaveCount(0);
  await expect(page.getByText(/Signed in as operator/)).toHaveCount(0);
  release?.();
  await expect(page.getByText(/Administrator access accepted/)).toHaveCount(0);
});
