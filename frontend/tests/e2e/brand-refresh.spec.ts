import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  booking,
  id,
  branch,
  policy,
  publicRecord,
  service,
  slot,
} from "../fixtures/public-account-actions";

test.skip(
  process.env.RUN_BRAND_TESTS !== "true",
  "Uses the isolated public API at port 5011",
);
const envelope = (data: unknown) => ({
  success: true,
  message: "Synthetic test response",
  data,
  meta: { requestId: "brand-test" },
});
const currentPolicy = {
  ...policy,
  version: "owner-booking-request-v2",
  depositBasisPoints: 0,
  depositRefundableForCustomerCancellation: true,
  reminderHoursBeforeAppointment: [1],
};
const requestedBooking = {
  ...booking,
  status: "REQUESTED",
  depositAmountKobo: null,
  paymentHoldExpiresAt: null,
};
const savedVehicle = {
  id: id(81),
  year: 2022,
  make: "Synthetic",
  model: "Vehicle",
  registrationNumber: "TEST-001",
  vin: null,
  color: null,
  mileageKm: null,
};
const contact = {
  firstName: "Test",
  lastName: "Customer",
  phone: "+2348000000000",
  address: null,
  city: null,
  state: null,
  country: "NG",
  user: { id: id(80), email: "booking@example.test" },
};
async function customerDetails(page: Page) {
  await intercept(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: envelope({
        id: id(82),
        user: { ...contact.user, role: "CUSTOMER" },
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: false,
        mfaVerifiedAt: null,
      }),
    }),
  );
  await page.route("**/api/v1/customers/profile", (route) =>
    route.fulfill({ json: envelope(contact) }),
  );
  await page.route("**/api/v1/customers/vehicles?*", (route) =>
    route.fulfill({ json: envelope({ vehicles: [savedVehicle] }) }),
  );
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: envelope({ csrfToken: "s".repeat(64) }) }),
  );
}
function record(url: string) {
  const pathname = new URL(url, "http://127.0.0.1:5011").pathname.replace(
    /^\/api\/v1/,
    "",
  );
  if (pathname === "/public/booking-policy") return currentPolicy;
  return publicRecord(pathname);
}
let server: Server;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(envelope(record(req.url ?? "/"))));
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
async function intercept(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "SESSION_EXPIRED" } },
      });
    return route.fulfill({ json: envelope(record(url)) });
  });
}
for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
  test(`homepage and About remain readable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await intercept(page);
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/about"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page).toHaveTitle(/Allied AutoTech/);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (width <= 1024) {
        await expect(
          page.getByRole("button", { name: "Open navigation", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Primary navigation", exact: true }),
        ).toBeHidden();
      } else {
        await expect(
          page.getByRole("button", { name: "Open navigation", exact: true }),
        ).toBeHidden();
        await expect(
          page
            .getByRole("navigation", { name: "Primary navigation", exact: true })
            .getByRole("link", { name: "Shop", exact: true }),
        ).toBeVisible();
      }
      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: path.join(
            os.tmpdir(),
            `allied-brand-${route === "/" ? "home" : "about"}-${width}-viewport.png`,
          ),
        });
        // Load below-the-fold images before capturing the full layout.
        for (const picture of await page.locator("main img").all()) {
          await picture.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              picture.evaluate(
                (element) =>
                  element instanceof HTMLImageElement &&
                  element.complete &&
                  element.naturalWidth > 0,
              ),
            )
            .toBe(true);
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({
          path: path.join(
            os.tmpdir(),
            `allied-brand-${route === "/" ? "home" : "about"}-${width}.png`,
          ),
          fullPage: true,
        });
        const audit = await new AxeBuilder({ page }).analyze();
        expect(audit.violations).toEqual([]);
      }
    }
    expect(errors).toEqual([]);
  });
}
test("hero keyboard, slide links, optional playback and marquee pause work", async ({
  page,
}) => {
  await intercept(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Explore Allied AutoTech" });
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
    "Built on Trust. Driven by Quality.",
  );
  await hero.getByRole("button", { name: "Next slide", exact: true }).click();
  await expect(hero.getByRole("link", { name: "Explore Diagnostics" })).toHaveAttribute(
    "href",
    "/services",
  );
  await page.keyboard.press("ArrowRight");
  await expect(hero.getByRole("link", { name: "Visit Shop" })).toHaveAttribute(
    "href",
    "/parts",
  );
  await hero.getByRole("button", { name: "Show slide 4: Browse Vehicles" }).click();
  await expect(hero.getByRole("link", { name: "Browse Vehicles" })).toHaveAttribute(
    "href",
    "/vehicles",
  );
  await hero.getByRole("button", { name: "Play slideshow" }).click();
  await expect(hero.getByRole("button", { name: "Pause slideshow" })).toBeVisible();
  await hero.getByRole("button", { name: "Next slide", exact: true }).focus();
  await expect(hero.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  await page.getByRole("button", { name: "Pause service marquee" }).click();
  await expect(page.locator(".marquee-track")).toHaveCSS(
    "animation-play-state",
    "paused",
  );
});
test("reduced motion disables automatic movement", async ({ page }) => {
  await intercept(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".marquee-track")).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("button", { name: "Play slideshow" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause service marquee" })).toBeHidden();
});
test("mobile navigation contains focus, closes with Escape and closes after navigation", async ({
  page,
}) => {
  await intercept(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "Open navigation", exact: true });
  await open.click();
  const menu = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(menu.getByRole("button", { name: "Close menu" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await open.click();
  await menu.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});
test("all fifteen supplied equipment images load in their grouped gallery", async ({
  page,
}) => {
  await intercept(page);
  await page.goto("/about");
  const images = page.locator("#equipment img");
  await expect(images).toHaveCount(15);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            element instanceof HTMLImageElement &&
            element.complete &&
            element.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(await image.getAttribute("alt")).toBeTruthy();
  }
});
test("saved vehicle and customer contact review sends the chosen vehicle and preserves selection across pages", async ({
  page,
}) => {
  await customerDetails(page);
  const second = {
    ...savedVehicle,
    id: id(83),
    model: "Second vehicle",
    registrationNumber: "TEST-002",
  };
  await page.route("**/api/v1/customers/vehicles?*", (route) =>
    route.fulfill({
      json: envelope(
        new URL(route.request().url()).searchParams.has("cursor")
          ? { vehicles: [second] }
          : { vehicles: [savedVehicle], nextCursor: savedVehicle.id },
      ),
    }),
  );
  let body: unknown;
  await page.route("**/api/v1/customers/bookings", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({
      json: envelope({
        booking: {
          ...requestedBooking,
          vehicle: second,
          customerNotes: "Check this saved vehicle.",
        },
      }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/services/${service.id}`);
  await page
    .getByRole("button", { name: "Load saved vehicles & contact details" })
    .click();
  await expect(page.getByText(contact.user.email, { exact: true })).toBeVisible();
  await page.getByLabel("Saved vehicle (optional)").selectOption(savedVehicle.id);
  await page.getByRole("button", { name: "More saved vehicles" }).click();
  await expect(page.getByLabel("Saved vehicle (optional)")).toHaveValue(savedVehicle.id);
  await page.getByLabel("Saved vehicle (optional)").selectOption(second.id);
  await page.getByRole("button", { name: "First vehicle page" }).click();
  await expect(page.getByLabel("Saved vehicle (optional)")).toHaveValue(second.id);
  await page.getByLabel("Workshop branch").selectOption(branch.id);
  await page.locator(".slot").first().click();
  await page
    .getByLabel("What should we know about your vehicle? (optional)")
    .fill("Check this\nsaved vehicle.");
  const account = page.getByRole("region", { name: "Your vehicle & contact details" });
  await account.evaluate((element) =>
    window.scrollTo({
      top: window.scrollY + element.getBoundingClientRect().top - 90,
      behavior: "instant",
    }),
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-booking-account-390.png"),
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  expect(body).toEqual({
    slotId: slot.id,
    policyVersion: currentPolicy.version,
    customerNotes: "Check this saved vehicle.",
    vehicleId: second.id,
  });
  await expect(page.getByText(/Vehicle: 2022 Synthetic Second vehicle/)).toBeVisible();
  await expect(page.getByText("Your notes: Check this saved vehicle.")).toBeVisible();
});

test("anonymous saved-detail review preserves the booking draft and reads no customer records", async ({
  page,
}) => {
  await intercept(page);
  let privateReads = 0;
  await page.route("**/api/v1/customers/**", (route) => {
    privateReads++;
    return route.fulfill({
      status: 401,
      json: { success: false, error: { code: "SESSION_EXPIRED" } },
    });
  });
  await page.goto(`/services/${service.id}`);
  const notes = page.getByLabel("What should we know about your vehicle? (optional)");
  await notes.fill("Keep my appointment notes.");
  await page
    .getByRole("button", { name: "Load saved vehicles & contact details" })
    .click();
  await expect(
    page.getByRole("link", { name: "Sign in to your account", exact: true }),
  ).toBeVisible();
  await expect(notes).toHaveValue("Keep my appointment notes.");
  expect(privateReads).toBe(0);
});

for (const delayed of [false, true])
  test(`saved booking details clear on account change${delayed ? " before a late read completes" : " after loading"}`, async ({
    page,
  }) => {
    await customerDetails(page);
    let release: (() => void) | undefined;
    let reads = 0;
    let finished = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    if (delayed)
      await page.route("**/api/v1/customers/vehicles?*", async (route) => {
        reads++;
        await gate;
        await route
          .fulfill({ json: envelope({ vehicles: [savedVehicle] }) })
          .catch(() => undefined);
        finished = true;
      });
    await page.goto(`/services/${service.id}`);
    await page
      .getByRole("button", { name: "Load saved vehicles & contact details" })
      .click();
    if (delayed) await expect.poll(() => reads).toBe(1);
    else {
      await page.getByLabel("Saved vehicle (optional)").selectOption(savedVehicle.id);
      await expect(page.getByText(contact.user.email, { exact: true })).toBeVisible();
    }
    await page.evaluate(() => {
      const channel = new BroadcastChannel("aat-session");
      channel.postMessage("changed");
      channel.close();
    });
    await expect(page.getByLabel("Saved vehicle (optional)")).toHaveCount(0);
    release?.();
    if (delayed) await expect.poll(() => finished).toBe(true);
    await expect(
      page.getByRole("button", { name: "Load saved vehicles & contact details" }),
    ).toBeVisible();
    await expect(page.getByText(contact.user.email, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Selected vehicle:/)).toHaveCount(0);
  });

test("saved contact review never displays a different account's profile", async ({
  page,
}) => {
  await customerDetails(page);
  await page.route("**/api/v1/customers/profile", (route) =>
    route.fulfill({
      json: envelope({
        ...contact,
        user: { id: id(99), email: "wrong-account@example.test" },
      }),
    }),
  );
  await page.goto(`/services/${service.id}`);
  await page
    .getByRole("button", { name: "Load saved vehicles & contact details" })
    .click();
  await expect(
    page.getByText("We could not read these account details. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("wrong-account@example.test", { exact: true })).toHaveCount(
    0,
  );
});

test("saved vehicle read failure retains readable contact details and offers retry", async ({
  page,
}) => {
  await customerDetails(page);
  let fail = true;
  await page.route("**/api/v1/customers/vehicles?*", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        })
      : route.fulfill({ json: envelope({ vehicles: [] }) }),
  );
  await page.goto(`/services/${service.id}`);
  await page
    .getByRole("button", { name: "Load saved vehicles & contact details" })
    .click();
  await expect(page.getByText(contact.user.email, { exact: true })).toBeVisible();
  await expect(page.getByText(/No saved vehicles on this page/)).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry saved vehicles" }).click();
  await expect(page.getByText(/No saved vehicles on this page/)).toBeVisible();
});

test("an uncertain booking locks its selected vehicle and repeats only the original request", async ({
  page,
}) => {
  await customerDetails(page);
  const requests: { body: unknown; key: string | undefined }[] = [];
  await page.route("**/api/v1/customers/bookings", (route) => {
    requests.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()["idempotency-key"],
    });
    return requests.length === 1
      ? route.abort("failed")
      : route.fulfill({
          json: envelope({ booking: { ...requestedBooking, vehicle: savedVehicle } }),
        });
  });
  await page.goto(`/services/${service.id}`);
  await page
    .getByRole("button", { name: "Load saved vehicles & contact details" })
    .click();
  await page.getByLabel("Saved vehicle (optional)").selectOption(savedVehicle.id);
  await page.getByLabel("Workshop branch").selectOption(branch.id);
  await page.locator(".slot").first().click();
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(page.getByLabel("Saved vehicle (optional)")).toBeDisabled();
  await page.getByRole("button", { name: "Check the same booking request" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[0].key).toBeTruthy();
});

test("current booking policy submits a request without obsolete deposit consent", async ({
  page,
}) => {
  await intercept(page);
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: envelope({ csrfToken: "s".repeat(64) }) }),
  );
  let body: unknown;
  await page.route("**/api/v1/customers/bookings", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: envelope({ booking: requestedBooking }) });
  });
  await page.goto(`/services/${service.id}`);
  await page.getByLabel("Workshop branch").selectOption(branch.id);
  await page.locator(".slot").first().click();
  await expect(page.getByText("I have read and accept these deposit terms.")).toHaveCount(
    0,
  );
  await page
    .getByLabel("What should we know about your vehicle? (optional)")
    .fill("Synthetic diagnostic request");
  await page.getByRole("button", { name: "Request booking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  expect(body).toEqual({
    slotId: slot.id,
    policyVersion: currentPolicy.version,
    customerNotes: "Synthetic diagnostic request",
  });
  await expect(
    page.getByRole("main").getByRole("link", { name: "View booking", exact: true }),
  ).toHaveAttribute("href", `/dashboard/bookings/${booking.id}`);
  await expect(page.getByText(/Deposit due:/)).toHaveCount(0);
});
