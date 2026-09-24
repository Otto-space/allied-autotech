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

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`sign-in uses the ${role} response role and retains its success notification`, async ({
    page,
  }) => {
    await page.route("**/api/v1/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      let data: unknown = { items: [] };
      if (pathname.endsWith("/auth/login"))
        data = { user: session(role).user, mfaRequired: false };
      else if (pathname.endsWith("/auth/csrf"))
        data = { csrfToken: "synthetic-csrf-token-".repeat(3) };
      else if (pathname.endsWith("/auth/session")) data = session(role);
      else if (pathname.endsWith("/overview")) data = overviewFixture(role);
      else if (pathname.endsWith("/operations/status"))
        data = { queues: [], openPaymentAnomalies: 0, lastReconciliation: null };
      return route.fulfill({
        json: {
          success: true,
          message: "Isolated sign-in response",
          data,
          meta: { requestId: "login-role-test" },
        },
      });
    });
    await page.goto("/login");
    await page.getByLabel("Email address").fill("role@example.test");
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await expect(page).toHaveURL(
      new RegExp(role === "CUSTOMER" ? "/dashboard$" : "/admin$"),
    );
    await expect(
      page.getByRole("region", { name: "Notifications", exact: true }),
    ).toContainText("Signed in successfully.");
  });
}

test("sign-in defers dashboard access when its response requires MFA", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith("/auth/login")
      ? { user: session("ADMIN").user, mfaRequired: true }
      : pathname.endsWith("/auth/csrf")
        ? { csrfToken: "synthetic-csrf-token-".repeat(3) }
        : pathname.endsWith("/auth/session")
          ? { ...session("ADMIN"), mfaVerifiedAt: null }
          : { items: [] };
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated MFA requirement",
        data,
        meta: { requestId: "login-mfa-test" },
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
});

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
      const nav =
        width === 390
          ? page.getByRole("dialog", { name: "Mobile navigation" })
          : page.getByRole("banner");
      const link = nav.getByRole("link", {
        name: role ? /Dashboard/ : /Sign In/,
      });
      const destination = !role
        ? "/login"
        : role === "CUSTOMER"
          ? "/dashboard"
          : "/admin";
      await expect(link).toHaveAttribute("href", destination);
      if (role)
        await expect(
          nav.getByRole("link", { name: "Create an account", exact: true }),
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
  const nav = page.getByRole("banner");
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
  await expect(nav.getByRole("link", { name: "Sign In", exact: true })).toBeVisible();
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
    page.getByRole("banner").getByRole("link", { name: "Sign In", exact: true }),
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
    .getByRole("banner")
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
    .getByRole("banner")
    .getByRole("link", { name: "Dashboard", exact: true });
  await expect(link).toHaveAttribute("href", "/dashboard");
  release();
  await page.getByLabel("Search help topics").fill("service");
  await expect(link).toHaveAttribute("href", "/dashboard");
});
