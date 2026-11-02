import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { notificationsFixture } from "../fixtures/customer-notifications";
import { fixture as overviewBrowser } from "../fixtures/overview-browser";
import { workforceOverviewFixture } from "../fixtures/workforce-overview";
import { overviewFixture } from "../fixtures/overview";

async function browserSupport(page: Page, supported = true) {
  await page.addInitScript((supported) => {
    Object.defineProperty(window, "isSecureContext", { value: supported });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: async () => {
          document.documentElement.dataset.pushPrompts = "1";
          return "denied";
        },
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => undefined,
        getRegistrations: async () => [],
        register: async () => {
          throw Error("Unexpected registration from invitation");
        },
      },
    });
  }, supported);
}

async function alertsFixture(page: Page, role = "CUSTOMER", supported = true) {
  const notifications = await notificationsFixture(page, role);
  const state = { available: true, failed: false, pushWrites: [] as string[] };
  await browserSupport(page, supported);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname.endsWith("/overview"))
      data = overviewFixture(role, {
        from: url.searchParams.get("from")!,
        to: url.searchParams.get("to")!,
      });
    else if (url.pathname.endsWith("/notifications/push")) {
      if (route.request().method() !== "GET")
        state.pushWrites.push(route.request().method());
      if (state.failed)
        return route.fulfill({
          status: 503,
          json: {
            success: false,
            message: "Unavailable",
            error: { code: "SERVICE_UNAVAILABLE" },
          },
        });
      data = {
        available: state.available,
        publicKey: state.available ? "B" + "A".repeat(86) : null,
        enabled: false,
        endpointHashes: [],
      };
    } else return route.fallback();
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated alerts fixture",
        meta: { requestId: "alerts-test" },
        data,
      },
    });
  });
  return { state, notifications };
}

test("invitation prompts only after explicit Enable and explains a declined permission", async ({
  page,
}) => {
  const { state, notifications } = await alertsFixture(page);
  await page.goto("/dashboard");
  const enable = page.getByRole("button", { name: "Enable notifications", exact: true });
  await expect(enable).toBeVisible();
  expect(await page.locator("html").getAttribute("data-push-prompts")).toBeNull();
  await enable.click();
  await expect(page.locator("html")).toHaveAttribute("data-push-prompts", "1");
  await expect(
    page.getByRole("region", { name: "Browser notification update" }),
  ).toContainText("browser’s site settings");
  expect(state.pushWrites).toEqual([]);
  expect(notifications.writes).toEqual([]);
});

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  for (const width of [320, 1440])
    test(`${role} optional invitation opens existing settings without prompting at ${width}px`, async ({
      page,
    }, info) => {
      const { state, notifications } = await alertsFixture(page, role);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const home = role === "CUSTOMER" ? "/dashboard" : "/admin";
      await page.goto(home);
      const invitation = page.getByRole("region", {
        name: "Would you like browser alerts?",
      });
      await expect(invitation).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.title()).not.toBe("");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      const link = invitation.getByRole("link", { name: "Review notification settings" });
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(
        (await invitation.getByRole("button", { name: "Not now" }).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
      expect(
        (
          await new AxeBuilder({ page })
            .include('section[aria-labelledby="push-invitation-title"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await invitation.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`invitation-${role}-${width}.png`) });
      await link.focus();
      await link.press("Enter");
      await expect(page).toHaveURL(
        new RegExp(
          `${home === "/dashboard" ? "/dashboard" : "/admin"}/notifications#browser-push-heading$`,
        ),
      );
      await expect(
        page.getByRole("heading", { name: "Browser notifications", exact: true }),
      ).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Enable on this device", exact: true }),
      ).toBeEnabled();
      expect(await page.locator("html").getAttribute("data-push-prompts")).toBeNull();
      expect(state.pushWrites).toEqual([]);
      expect(notifications.writes).toEqual([]);
      expect(errors).toEqual([]);
    });

test("Not now persists in this tab and storage failure still allows dismissal", async ({
  page,
}) => {
  await alertsFixture(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Would you like browser alerts?" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Would you like browser alerts?" }),
  ).toHaveCount(0);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("Storage blocked");
    };
  });
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(
    page.getByRole("heading", { name: "Would you like browser alerts?" }),
  ).toHaveCount(0);
  expect(await page.locator("html").getAttribute("data-push-prompts")).toBeNull();
});

test("blocked permission and offline state never produce an invitation or prompt", async ({
  page,
}) => {
  await alertsFixture(page);
  await page.goto("/dashboard");
  const invitation = page.getByRole("region", { name: "Would you like browser alerts?" });
  await expect(invitation).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    window.dispatchEvent(new Event("offline"));
  });
  await expect(invitation).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));
  });
  await expect(invitation).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(Notification, "permission", { value: "denied" });
    window.dispatchEvent(new Event("focus"));
  });
  await expect(invitation).toHaveCount(0);
  expect(await page.locator("html").getAttribute("data-push-prompts")).toBeNull();
});

for (const unavailable of ["unconfigured", "failed", "unsupported"])
  test(`${unavailable} push preserves the dashboard without an invitation`, async ({
    page,
  }) => {
    const { state } = await alertsFixture(
      page,
      "CUSTOMER",
      unavailable !== "unsupported",
    );
    state.available = unavailable !== "unconfigured";
    state.failed = unavailable === "failed";
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Your vehicle care, connected." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Would you like browser alerts?" }),
    ).toHaveCount(0);
    expect(await page.locator("html").getAttribute("data-push-prompts")).toBeNull();
    expect(state.pushWrites).toEqual([]);
  });

for (const width of [320, 1440])
  test(`dashboard countdown follows confirmed current data and expiry at ${width}px`, async ({
    page,
  }, info) => {
    await page.clock.install({ time: new Date("2026-11-01T22:30:00Z") });
    const state = await overviewBrowser(page, "CUSTOMER");
    state.care!.nextBooking!.status = "CONFIRMED";
    state.care!.nextBooking!.scheduledAt = "2026-11-01T22:31:30Z";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    const next = page.locator(".customer-care-next");
    await expect(next.getByRole("timer")).toHaveText("Starts in 2 minutes");
    await expect(next).toContainText("Lagos time");
    await expect(next.getByRole("timer")).toHaveAttribute("aria-live", "off");
    await page.screenshot({ path: info.outputPath(`dashboard-countdown-${width}.png`) });
    await page.clock.fastForward(90_000);
    await expect(next.getByRole("timer")).toHaveCount(0);
    await expect(next).toContainText("confirmed");
    state.care!.nextBooking!.scheduledAt = "2026-11-02T10:30:00Z";
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(next.getByRole("timer")).toBeVisible();
    state.mode = "hold";
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(next.getByRole("timer")).toHaveCount(0);
    await expect.poll(() => !!state.held).toBe(true);
    state.care!.nextBooking!.status = "REQUESTED";
    state.held!();
    state.mode = "normal";
    await expect(next).toContainText("Awaiting workshop confirmation.");
    await expect(next.getByRole("timer")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });

for (const width of [320, 1440])
  test(`managed Staff invitation waits for verified work access at ${width}px`, async ({
    page,
  }) => {
    const state = await workforceOverviewFixture(page);
    await browserSupport(page);
    state.holdOverview = true;
    await page.route("**/api/v1/staff/notifications/push", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Isolated push availability",
          meta: { requestId: "managed-alerts" },
          data: {
            available: true,
            publicKey: "B" + "A".repeat(86),
            enabled: false,
            endpointHashes: [],
          },
        },
      }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin");
    await expect.poll(() => !!state.releaseOverview).toBe(true);
    await expect(
      page.getByRole("region", { name: "Would you like browser alerts?" }),
    ).toHaveCount(0);
    state.releaseOverview!();
    const invitation = page.getByRole("region", {
      name: "Would you like browser alerts?",
    });
    await expect(invitation).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Operational overview", exact: true }),
    ).toBeVisible();
    await invitation.getByRole("link", { name: "Review notification settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Browser notifications", exact: true }),
    ).toBeFocused();
    expect(await page.locator("html").getAttribute("data-push-prompts")).toBeNull();
    expect(state.notifications.writes).toEqual([]);
  });
