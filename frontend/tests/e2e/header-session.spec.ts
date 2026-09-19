import { test, expect, type Page, type Route } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { overviewFixture } from "../fixtures/overview";

const session = (role: string) => ({
  id: "a0000000-0000-4000-8000-000000000001",
  user: {
    id: "a0000000-0000-4000-8000-000000000002",
    email: "header@example.test",
    role,
  },
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-09-18T08:00:00Z",
  expiresAt: "2027-01-01T00:00:00Z",
  idleExpiresAt: "2027-01-01T00:00:00Z",
});
const reply = (route: Route, role: string | null) =>
  role
    ? route.fulfill({
        json: {
          success: true,
          message: "Isolated session",
          data: session(role),
          meta: { requestId: "header-test" },
        },
      })
    : route.fulfill({
        status: 401,
        json: { success: false, error: { code: "SESSION_EXPIRED" } },
      });
async function changed(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
}

for (const role of [null, "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  for (const width of [390, 1440])
    test(`${role ?? "anonymous"} public header routes its account link at ${width}px`, async ({
      page,
    }) => {
      let probes = 0;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/v1/auth/session", async (route) => {
        probes++;
        await reply(route, role);
      });
      await page.route("**/api/v1/*/overview?**", (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Isolated overview",
            data: overviewFixture(role ?? "CUSTOMER"),
            meta: { requestId: "header-test" },
          },
        }),
      );
      await page.route("**/api/v1/customers/bookings?**", (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Isolated records",
            data: { items: [] },
            meta: { requestId: "header-test" },
          },
        }),
      );
      await page.route("**/api/v1/admin/operations/status", (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Isolated status",
            data: { queues: [], openPaymentAnomalies: 0, lastReconciliation: null },
            meta: { requestId: "header-test" },
          },
        }),
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/help");
      await expect.poll(() => probes).toBe(1);
      if (width === 390)
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      const nav = page.getByRole("navigation", {
        name: width === 390 ? "Mobile navigation" : "Primary navigation",
        exact: true,
      });
      const link = nav.getByRole("link", {
        name: role ? "Dashboard" : "Sign in",
        exact: true,
      });
      const destination = !role
        ? "/login"
        : role === "CUSTOMER"
          ? "/dashboard"
          : "/admin";
      await expect(link).toHaveAttribute("href", destination);
      if (role)
        await expect(
          nav.getByRole("link", { name: "Create account", exact: true }),
        ).toHaveCount(0);
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-header-${role ?? "anonymous"}-${width}.png`),
        fullPage: false,
      });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
      expect(errors).toEqual([]);
    });

test("public header refreshes role and sign-out across tabs without a probing loop", async ({
  page,
}) => {
  let role: string | null = "CUSTOMER";
  let probes = 0;
  await page.route("**/api/v1/auth/session", async (route) => {
    probes++;
    await reply(route, role);
  });
  await page.goto("/help");
  const nav = page.getByRole("navigation", { name: "Primary navigation", exact: true });
  await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  role = "ADMIN";
  await changed(page);
  await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute(
    "href",
    "/admin",
  );
  role = null;
  await changed(page);
  await expect(nav.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect.poll(() => probes).toBe(3);
  await page.getByLabel("Search help topics").fill("booking");
  expect(probes).toBe(3);
});

test("an anonymous session check does not clear an in-progress public draft", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/auth/session", async (route) => {
    await held;
    await reply(route, null);
  });
  await page.goto("/help");
  await page.getByRole("button", { name: "Quick help", exact: true }).click();
  await page.getByLabel("Your question").fill("Where is the workshop?");
  const checked = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/auth/session") && response.status() === 401,
  );
  release();
  await checked;
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  await expect(page.getByLabel("Your question")).toHaveValue("Where is the workshop?");
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation", exact: true })
      .getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("a privileged dashboard link still requires the existing MFA gate", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Pending MFA",
        data: { ...session("ADMIN"), mfaVerifiedAt: null },
        meta: { requestId: "header-test" },
      },
    }),
  );
  await page.goto("/help");
  await page
    .getByRole("navigation", { name: "Primary navigation", exact: true })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/mfa$/);
});

test("late session responses cannot restore a previous role after account switching", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let probes = 0;
  await page.route("**/api/v1/auth/session", async (route) => {
    probes++;
    if (probes === 1) {
      await held;
      await reply(route, "ADMIN");
    } else await reply(route, "CUSTOMER");
  });
  await page.goto("/help");
  await expect.poll(() => probes).toBe(1);
  await changed(page);
  const link = page
    .getByRole("navigation", { name: "Primary navigation", exact: true })
    .getByRole("link", { name: "Dashboard", exact: true });
  await expect(link).toHaveAttribute("href", "/dashboard");
  release();
  await page.getByLabel("Search help topics").fill("service");
  await expect(link).toHaveAttribute("href", "/dashboard");
});
