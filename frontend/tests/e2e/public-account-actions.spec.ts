import { test, expect, type Page, type Route } from "@playwright/test";
import { createServer, type Server } from "node:http";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import {
  booking,
  branch,
  id,
  listing,
  product,
  publicRecord,
  quoteService,
  service,
  slot,
} from "../fixtures/public-account-actions";

test.skip(
  process.env.RUN_PUBLIC_ACTION_TESTS !== "true",
  "Requires isolated public detail API on port 5011",
);
let server: Server;
const envelope = (data: unknown) => ({
  success: true,
  message: "Isolated response",
  data,
  meta: { requestId: "public-action-test" },
});
test.beforeAll(async () => {
  server = createServer((req, res) => {
    // Only public reads are supported by this server. Browser mutations are intercepted.
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1:5011").pathname.replace(
      /^\/api\/v1/,
      "",
    );
    res.writeHead(req.method === "GET" && pathname.startsWith("/public/") ? 200 : 405, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(envelope(publicRecord(pathname))));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(5011, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
});
const reply = (route: Route, data: unknown) => route.fulfill({ json: envelope(data) });
async function fixture(page: Page) {
  const calls: { path: string; body: unknown; key?: string; csrf?: string }[] = [];
  let mode: "normal" | "hold" | "unauthorized" | "unknown" = "normal";
  let release: (() => void) | undefined;
  let delivered: Promise<void> = Promise.resolve();
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (pathname === "/auth/session")
      return reply(route, {
        id: id(90),
        user: { id: id(91), email: "public-actions@example.test", role: "CUSTOMER" },
        mfaRequired: false,
        mfaVerifiedAt: null,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (pathname === "/auth/csrf") return reply(route, { csrfToken: "s".repeat(64) });
    if (pathname.startsWith("/public/")) return reply(route, publicRecord(pathname));
    if (
      pathname.startsWith("/customers/") &&
      ["POST", "PUT"].includes(request.method())
    ) {
      calls.push({
        path: pathname,
        body: request.postDataJSON(),
        key: request.headers()["idempotency-key"],
        csrf: request.headers()["x-csrf-token"],
      });
      const response = pathname === "/customers/bookings" ? { booking } : {};
      if (mode === "hold") {
        const paused = new Promise<void>((resolve) => {
          release = resolve;
        });
        delivered = paused.then(() => reply(route, response));
        return delivered;
      }
      if (mode === "unauthorized")
        return route.fulfill({
          status: 401,
          json: { success: false, error: { code: "SESSION_EXPIRED" } },
        });
      if (mode === "unknown") return route.abort("failed");
      return reply(route, response);
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return {
    calls,
    setMode: (value: typeof mode) => {
      mode = value;
    },
    release: async () => {
      release?.();
      await delivered;
    },
  };
}
async function changeAccount(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage({ type: "changed", source: "isolated-other-tab" });
    channel.close();
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Your session changed" }),
  ).toBeVisible();
}
const actions = [
  {
    name: "booking",
    url: `/services/${service.id}`,
    title: service.name,
    button: "Request booking",
    result: "Booking request received",
    path: "/customers/bookings",
  },
  {
    name: "cart",
    url: `/parts/${product.id}`,
    title: product.name,
    button: "Save quantity to cart",
    result: "Your cart quantity has been saved.",
    path: `/customers/cart/items/${product.id}`,
  },
  {
    name: "favourite",
    url: `/parts/${product.id}`,
    title: product.name,
    button: "Save to favourites",
    result: "Product saved to your favourites.",
    path: `/customers/favourites/${product.id}`,
  },
  {
    name: "vehicle enquiry",
    url: `/vehicles/${listing.id}`,
    title: listing.title,
    button: "Enquire about this vehicle",
    result: "Your vehicle enquiry has been created.",
    path: "/customers/vehicle-transactions",
  },
  {
    name: "saved vehicle",
    url: `/vehicles/${listing.id}`,
    title: listing.title,
    button: "Save vehicle",
    result: "Vehicle saved to your account.",
    path: `/customers/saved-vehicles/${listing.id}`,
  },
  {
    name: "inspection",
    url: `/vehicles/${listing.id}`,
    title: listing.title,
    button: "Request inspection",
    result: "Inspection requested.",
    path: "/customers/vehicle-inspections",
  },
] as const;
type Action = (typeof actions)[number];
async function prepare(page: Page, action: Action) {
  if (action.name === "booking") {
    await page.getByLabel("Workshop branch").selectOption(branch.id);
    await page.locator("button.slot").click();
    await page.getByLabel("I have read and accept these deposit terms.").check();
  } else if (action.url.startsWith("/parts/")) {
    await page.getByLabel("Quantity", { exact: true }).fill("7");
  } else {
    await page
      .getByLabel("Preferred date and time (Lagos time)")
      .fill("2027-10-01T11:00");
    await page
      .getByLabel("Notes (optional)")
      .fill("Private inspection note from previous account");
  }
}
async function assertReset(page: Page, action: Action) {
  await expect(
    page.getByRole("region", { name: "Notifications", exact: true }).locator(".toast"),
  ).toHaveCount(0);
  await expect(page.getByText(action.result, { exact: false })).toHaveCount(0);
  if (action.name === "booking") {
    await expect(
      page.getByRole("main").getByRole("link", { name: "View booking", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Workshop branch")).toHaveValue("");
    await expect(
      page.getByLabel("I have read and accept these deposit terms."),
    ).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: action.button, exact: true }),
    ).toBeDisabled();
  } else if (action.url.startsWith("/parts/")) {
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
  } else {
    await expect(page.getByLabel("Preferred date and time (Lagos time)")).toHaveValue("");
    await expect(page.getByLabel("Notes (optional)")).toHaveValue("");
  }
}
for (const action of actions) {
  test(`completed ${action.name} is cleared across accounts without replay`, async ({
    page,
  }) => {
    const api = await fixture(page);
    await page.goto(action.url);
    await expect(page).toHaveTitle(new RegExp(action.title));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(action.title);
    await prepare(page, action);
    await page.getByRole("button", { name: action.button, exact: true }).click();
    await expect(
      page.getByRole("main").getByText(action.result, { exact: false }),
    ).toBeVisible();
    await changeAccount(page);
    await assertReset(page, action);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].path).toBe(action.path);
    expect(api.calls[0].csrf).toBe("s".repeat(64));
    await prepare(page, action);
    await page.getByRole("button", { name: action.button, exact: true }).click();
    await expect(
      page.getByRole("main").getByText(action.result, { exact: false }),
    ).toBeVisible();
    expect(api.calls).toHaveLength(2);
    if (action.name === "booking") {
      expect(api.calls[0].key).toBeTruthy();
      expect(api.calls[1].key).not.toBe(api.calls[0].key);
      expect(api.calls[1].body).toEqual({
        slotId: slot.id,
        policyVersion: "test-policy",
        acceptNonRefundableDeposit: true,
      });
    }
  });
  test(`late ${action.name} response cannot restore a previous account result`, async ({
    page,
  }) => {
    const api = await fixture(page);
    api.setMode("hold");
    await page.goto(action.url);
    await prepare(page, action);
    await page.getByRole("button", { name: action.button, exact: true }).click();
    await expect.poll(() => api.calls.length).toBe(1);
    await changeAccount(page);
    await api.release();
    await assertReset(page, action);
    expect(api.calls).toHaveLength(1);
    // Prove the new account can act and the old finalizer cannot leave it stuck.
    api.setMode("normal");
    await prepare(page, action);
    await page.getByRole("button", { name: action.button, exact: true }).click();
    await expect(
      page.getByRole("main").getByText(action.result, { exact: false }),
    ).toBeVisible();
    expect(api.calls).toHaveLength(2);
  });
}
for (const index of [0, 1, 3]) {
  const action = actions[index];
  test(`${action.name} expiry clears the form and provides account recovery`, async ({
    page,
  }) => {
    const api = await fixture(page);
    api.setMode("unauthorized");
    await page.goto(action.url);
    await prepare(page, action);
    await page.getByRole("button", { name: action.button, exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Sign in or review your account" }),
    ).toHaveAttribute("href", "/dashboard");
    await assertReset(page, action);
    expect(api.calls).toHaveLength(1);
  });
}
test("unknown booking reuses its key only within the same session", async ({ page }) => {
  const api = await fixture(page);
  api.setMode("unknown");
  const action = actions[0];
  await page.goto(action.url);
  await prepare(page, action);
  await page.getByRole("button", { name: action.button, exact: true }).click();
  const retry = page.getByRole("button", { name: "Check the same booking request" });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(retry).toBeEnabled();
  expect(api.calls).toHaveLength(2);
  expect(api.calls[1].key).toBe(api.calls[0].key);
  expect(api.calls[1].body).toEqual(api.calls[0].body);
  await changeAccount(page);
  await assertReset(page, action);
  await expect(retry).toHaveCount(0);
  api.setMode("normal");
  await prepare(page, action);
  await page.getByRole("button", { name: action.button, exact: true }).click();
  await expect(page.getByRole("main").getByText(action.result)).toBeVisible();
  expect(api.calls[2].key).not.toBe(api.calls[0].key);
});
test("booking account recovery remains visible when the public service refresh fails", async ({
  page,
}) => {
  const api = await fixture(page);
  const action = actions[0];
  await page.goto(action.url);
  await prepare(page, action);
  await page.getByRole("button", { name: action.button, exact: true }).click();
  await expect(page.getByRole("main").getByText(action.result)).toBeVisible();
  await page.route(`**/api/v1/public/services/${service.id}`, (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
    }),
  );
  await changeAccount(page);
  await expect(page.getByRole("button", { name: "Retry service" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in or review your account" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "View booking", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(action.result)).toHaveCount(0);
  expect(api.calls).toHaveLength(1);
});

for (const [width, height] of [
  [320, 900],
  [390, 844],
  [600, 900],
  [768, 900],
  [1024, 900],
  [1280, 900],
  [844, 390],
]) {
  test(`account-change recovery is accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const index of [0, 1, 3]) {
      const action = actions[index];
      await page.goto(action.url);
      await expect(page).toHaveTitle(new RegExp(action.title));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(action.title);
      await prepare(page, action);
      await changeAccount(page);
      await assertReset(page, action);
      const recovery = page.getByRole("link", { name: "Sign in or review your account" });
      await recovery.focus();
      await expect(recovery).toBeFocused();
      await expect(recovery).toHaveCSS("text-decoration-line", "underline");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await recovery.scrollIntoViewIfNeeded();
      const controls =
        index === 0
          ? [page.getByLabel("Workshop branch")]
          : index === 1
            ? [page.getByLabel("Quantity", { exact: true })]
            : [
                page.getByLabel("Preferred date and time (Lagos time)"),
                page.getByLabel("Notes (optional)"),
                page.getByRole("button", { name: "Request inspection", exact: true }),
              ];
      for (const control of controls) {
        await control.evaluate((element) =>
          element.scrollIntoView({ block: "end", behavior: "instant" }),
        );
        await control.focus();
        if (width <= 850) {
          const field = await control.boundingBox();
          const bar = await page
            .getByRole("navigation", { name: "Customer support" })
            .boundingBox();
          expect(field).not.toBeNull();
          expect(bar).not.toBeNull();
          expect(field!.y + field!.height).toBeLessThanOrEqual(bar!.y);
        }
        expect(
          await control.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const hit = document.elementFromPoint(box.right - 8, box.bottom - 8);
            return hit === element || element.contains(hit);
          }),
        ).toBe(true);
      }
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-support-bar-${index}-${width}.png`),
      });
    }
    expect(errors).toEqual([]);
  });
}

for (const outcome of ["unknown", "pending"]) {
  test(`quotation enquiry preserves its ${outcome} lock through the service remount`, async ({
    page,
  }) => {
    await fixture(page);
    let writes = 0;
    let release: (() => void) | undefined;
    await page.route("**/api/v1/public/support/enquiries", async (route) => {
      writes += 1;
      if (outcome === "pending")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      });
    });
    await page.goto(`/services/${quoteService.id}`);
    await page.getByLabel("Your name").fill("Prior guest");
    await page.getByLabel("Email address", { exact: true }).fill("prior@example.test");
    await page.getByLabel("Handling branch").selectOption(branch.id);
    await page
      .getByLabel("Your message", { exact: true })
      .fill("Private quotation message");
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect.poll(() => writes).toBe(1);
    if (outcome === "unknown")
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await page.evaluate(() => {
      const channel = new BroadcastChannel("aat-session");
      channel.postMessage("changed");
      channel.close();
    });
    await expect(
      page.getByRole("button", { name: "Review enquiry", exact: true }),
    ).toBeDisabled();
    release?.();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Your name")).toHaveValue("");
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Your message", { exact: true })).toHaveValue("");
    await expect(
      page.getByText("This submission has an unknown outcome.", { exact: false }),
    ).toBeVisible();
    expect(writes).toBe(1);
  });
}

test("automated help clears its query and closes on an account change", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(`/parts/${product.id}`);
  await page.getByRole("button", { name: "Quick help" }).click();
  await page.getByLabel("Your question").fill("Private question from the previous user");
  await page.getByRole("button", { name: "Find an answer" }).click();
  await changeAccount(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Quick help" }).click();
  await expect(page.getByLabel("Your question")).toHaveValue("");
  await expect(page.getByText(/I don.t have an approved answer/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Quick help" })).toBeFocused();
});
