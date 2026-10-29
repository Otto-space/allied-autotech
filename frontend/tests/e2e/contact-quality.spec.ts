import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

const branchId = "f6000000-0000-4000-8000-000000000001";
const sourceId = "f6000000-0000-4000-8000-000000000002";
async function fixture(page: Page) {
  const state = {
    role: "anonymous" as
      "anonymous" | "CUSTOMER" | "STAFF" | "ADMIN" | "SUPER_ADMIN" | "error",
    status: 202,
    code: "",
    fields: undefined as Record<string, string[]> | undefined,
    branchError: false,
    empty: false,
    delay: 0,
    postDelay: 0,
    holdPost: false,
    releasePost: undefined as (() => void) | undefined,
    disconnect: false,
    writes: [] as Record<string, unknown>[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: true,
          data,
          message: "Isolated test",
          meta: { requestId: "contact-test" },
        },
      });
    if (endpoint.endsWith("/auth/session")) {
      if (state.role !== "anonymous" && state.role !== "error")
        return ok({
          user: { id: branchId, role: state.role },
          mfaRequired: false,
          mfaVerifiedAt: null,
          expiresAt: "2099-01-01T00:00:00Z",
          idleExpiresAt: "2099-01-01T00:00:00Z",
        });
      return route.fulfill({
        status: state.role === "error" ? 503 : 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    }
    if (endpoint.endsWith("/public/branches")) {
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (state.branchError)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      return ok({
        items: state.empty
          ? []
          : [
              { id: branchId, name: "Port Harcourt test branch", code: "TEST" },
              {
                id: "f6000000-0000-4000-8000-000000000099",
                name: "Second synthetic workshop",
                code: "TEST2",
              },
            ],
      });
    }
    if (endpoint.endsWith("/public/catalog/products"))
      return ok({
        items: [
          {
            id: sourceId,
            name: "A very long synthetic product name for checking searchable selection and narrow viewport boundaries",
          },
        ],
      });
    if (endpoint.endsWith("/public/services"))
      return ok({ items: [{ id: sourceId, name: "Test service" }] });
    if (endpoint.endsWith("/public/vehicles"))
      return ok({ items: [{ id: sourceId, title: "Test vehicle" }] });
    if (route.request().method() === "POST") {
      state.writes.push(route.request().postDataJSON());
      if (state.holdPost)
        await new Promise<void>((resolve) => {
          state.releasePost = resolve;
        });
      if (state.postDelay)
        await new Promise((resolve) => setTimeout(resolve, state.postDelay));
      if (state.disconnect) return route.abort("connectionfailed");
      if (state.status !== 202)
        return route.fulfill({
          status: state.status,
          json: { success: false, error: { code: state.code, fields: state.fields } },
        });
      return ok({ id: sourceId, status: "OPEN", createdAt: "2026-09-30T00:00:00Z" }, 202);
    }
    return ok({ items: [] });
  });
  return state;
}
async function draft(page: Page, kind = "enquiry") {
  await page.getByLabel("Your name", { exact: true }).fill("Contact Test");
  await page.getByLabel("Email address", { exact: true }).fill("Contact@Example.Test");
  await page.getByLabel("Subject", { exact: true }).fill("Workshop question");
  await page
    .getByLabel(kind === "enquiry" ? "Your message" : "Complaint details", {
      exact: true,
    })
    .fill("An isolated test of customer care.");
  const branch = page.getByRole("combobox", { name: "Handling branch" });
  await branch.click();
  await branch.fill("Port Harcourt");
  await page.getByRole("option", { name: "Port Harcourt test branch" }).click();
}

test("Visit preference errors identify the field that needs correction", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact");
  await draft(page);
  await page.getByLabel("Enquiry type", { exact: true }).selectOption("SERVICE");
  const picker = page.getByRole("combobox", { name: "Related record" });
  await picker.click();
  await picker.fill("Test service");
  await page.getByRole("option", { name: "Test service", exact: true }).click();
  await page.getByLabel("Include my preferred date and time").check();
  await page.getByLabel("Preferred date (Nigeria time)").fill("2099-01-10");
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await expect(page.locator("#support-visit-time")).toBeFocused();
  await expect(page.locator("#support-visit-time")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#support-visit-date")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  await expect(page.locator("#support-visit-error")).toContainText(
    "Choose your preferred date and time.",
  );
  await page.getByLabel("Preferred time (Nigeria time)").fill("09:30");
  await expect(page.locator("#support-visit-error")).toBeEmpty();

  await page.getByLabel("Your message", { exact: true }).fill("x".repeat(4000));
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await expect(page.locator("#support-opening")).toBeFocused();
  await expect(page.locator("#support-opening")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#support-visit-error")).toContainText(
    "Shorten your message",
  );
  await page.getByLabel("Your message", { exact: true }).fill("A short message.");
  await expect(page.locator("#support-visit-error")).toBeEmpty();
  expect(state.writes).toHaveLength(0);
});

for (const [type, record, width] of [
  ["SERVICE", "Test service", 390],
  ["VEHICLE", "Test vehicle", 1440],
] as const) {
  test(`Request-only ${type} includes preferences in reviewed support submission`, async ({
    page,
  }) => {
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/contact");
    await expect(page).toHaveTitle(/Contact & customer care/);
    await draft(page);
    await page.getByLabel("Enquiry type", { exact: true }).selectOption(type);
    const picker = page.getByRole("combobox", { name: "Related record" });
    await picker.click();
    await picker.fill(record);
    await page.getByRole("option", { name: record, exact: true }).click();
    await page.getByLabel("Include my preferred date and time").check();
    await page.getByLabel("Preferred date (Nigeria time)").fill("2099-01-10");
    await page.getByLabel("Preferred time (Nigeria time)").fill("09:30");
    await expect(
      page.getByRole("link", { name: "privacy notice (opens in a new tab)" }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.locator("#support-visit-date").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-visit-request-${width}.png`),
    });
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "2099-01-10 09:30 (Africa/Lagos, UTC+01:00)",
    );
    await expect(page.getByRole("dialog")).toContainText("Staff confirmation required");
    expect(state.writes).toHaveLength(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Send enquiry", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Enquiry received" })).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].message).toContain("Staff confirmation required");
    expect(state.writes[0].message).toContain("An isolated test of customer care.");
    expect(state.writes[0][type === "SERVICE" ? "serviceId" : "vehicleListingId"]).toBe(
      sourceId,
    );
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`Contact quality and anchor navigation at ${width}px`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/hydration|hydrating|uncaught/i.test(message.text()))
        errors.push(message.text());
    });
    await page.goto("/contact");
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle(/Contact & customer care/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Let’s talk about your vehicle.",
    );
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator('[aria-current="page"]'),
    ).toHaveText("Contact");
    await page.screenshot({
      path: path.join(os.tmpdir(), `contact-quality-${width}-viewport.png`),
    });
    await page.getByRole("link", { name: "Send an enquiry", exact: true }).click();
    await expect(page.locator("#enquiry")).toBeFocused();
    await expect
      .poll(() =>
        page
          .locator("#enquiry")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBeGreaterThanOrEqual(68);
    await expect(page.getByLabel("Your name", { exact: true })).toHaveCSS(
      "border-top-width",
      "1px",
    );
    await expect(page.getByLabel("Your name", { exact: true })).toHaveCSS(
      "border-top-color",
      "rgb(130, 147, 159)",
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), `contact-quality-${width}-form.png`),
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: path.join(os.tmpdir(), `contact-quality-${width}-full.png`),
      fullPage: true,
    });
    if ([320, 375, 390, 768, 1440, 1536].includes(width))
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(page.locator(".contact-map iframe")).toHaveCount(0);
    await expect(page.locator(".contact-map-fallback")).toContainText("133 Stadium Road");
    await page.locator(".contact-location").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(os.tmpdir(), `contact-quality-${width}-location.png`),
    });
    for (const photo of await page.locator("main img").all())
      await expect
        .poll(() =>
          photo.evaluate(
            (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
          ),
        )
        .toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const kind of ["enquiry", "complaint"] as const) {
  test(`Contact ${kind} validates, reviews exact payload, prevents duplicates and focuses confirmation`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.holdPost = true;
    await page.setViewportSize({ width: kind === "complaint" ? 390 : 1280, height: 900 });
    await page.goto("/contact");
    if (kind === "complaint")
      await page.getByRole("radio", { name: "Complaint", exact: true }).check();
    await page.getByRole("button", { name: `Review ${kind}`, exact: true }).click();
    await expect(page.getByLabel("Your name", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await draft(page, kind);
    await page.getByRole("button", { name: `Review ${kind}`, exact: true }).click();
    const confirm = page
      .getByRole("dialog")
      .getByRole("button", { name: `Send ${kind}`, exact: true });
    await confirm.click();
    const submitting = page
      .getByRole("dialog")
      .getByRole("button", { name: "Submitting…", exact: true });
    await expect(submitting).toBeDisabled();
    await expect(submitting).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => typeof state.releasePost).toBe("function");
    state.releasePost?.();
    await expect(
      page.getByRole("heading", {
        name: kind === "enquiry" ? "Enquiry received" : "Complaint received",
        exact: true,
      }),
    ).toBeFocused();
    expect(state.writes).toEqual([
      {
        subject: "Workshop question",
        ...(kind === "enquiry"
          ? { type: "GENERAL", message: "An isolated test of customer care." }
          : { description: "An isolated test of customer care." }),
        branchId,
        name: "Contact Test",
        email: "contact@example.test",
      },
    ]);
    await expect(page.getByRole("link", { name: "Continue on WhatsApp" })).toBeVisible();
    await expect(page.getByLabel("Your reference", { exact: true })).toHaveValue(
      sourceId,
    );
    await expect(page.getByLabel("Your reference", { exact: true })).toHaveAttribute(
      "readonly",
      "",
    );
    await expect(page.locator(".contact-success")).toHaveCSS("padding-left", "24px");
    await expect(
      page.getByText("Please review the message on this page.", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `contact-quality-${kind}-success.png`),
    });
  });
}

test("Contact searchable choices support keyboard, Escape, long names and viewport containment", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/contact");
  await page.getByLabel("Enquiry type").selectOption("PRODUCT");
  const source = page.getByRole("combobox", { name: "Related product (optional)" });
  await source.focus();
  await page.keyboard.press("ArrowDown");
  await source.fill("long synthetic");
  const bounds = await page.getByRole("listbox").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  await page.keyboard.press("Enter");
  await expect(source).toHaveValue(/very long synthetic/);
  await source.click();
  await page.keyboard.press("Escape");
  await expect(source).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(source).toHaveValue(/very long synthetic/);
  await source.click();
  await source.fill("no matching item");
  await expect(page.getByText("No matching choices on this page.")).toBeVisible();
});

for (const type of ["PRODUCT", "SERVICE", "VEHICLE"] as const) {
  test(`Contact ${type} enquiry submits only its selected resource and correct branch scope`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.goto("/contact");
    await draft(page);
    await page.getByLabel("Enquiry type").selectOption(type);
    await page
      .getByRole("combobox", {
        name: type === "PRODUCT" ? "Related product (optional)" : "Related record",
      })
      .click();
    await page.getByRole("listbox").getByRole("option").first().click();
    if (type === "VEHICLE") {
      await expect(page.getByRole("combobox", { name: "Handling branch" })).toHaveCount(
        0,
      );
      await expect(
        page.getByText("The related record determines the handling branch."),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Send enquiry", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Enquiry received", exact: true }),
    ).toBeVisible();
    expect(state.writes).toEqual([
      {
        name: "Contact Test",
        email: "contact@example.test",
        subject: "Workshop question",
        message: "An isolated test of customer care.",
        type,
        [type === "PRODUCT"
          ? "productId"
          : type === "SERVICE"
            ? "serviceId"
            : "vehicleListingId"]: sourceId,
        ...(type === "VEHICLE" ? { vehicleEnquiryIntent: "LISTING" } : { branchId }),
      },
    ]);
  });
}

test("Contact branch selection survives real cursor navigation without implying global search", async ({
  page,
}) => {
  await fixture(page);
  const reads: string[] = [];
  await page.route("**/api/v1/public/branches?*", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    reads.push(cursor ?? "first");
    return route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            {
              id: cursor ? sourceId : branchId,
              name: cursor ? "Second page branch" : "First page branch",
            },
          ],
          ...(cursor ? {} : { nextCursor: branchId }),
        },
        message: "Isolated pagination",
        meta: { requestId: "contact-pagination" },
      },
    });
  });
  await page.goto("/contact");
  const branch = page.getByRole("combobox", { name: "Handling branch" });
  await branch.click();
  await page.getByRole("option", { name: "First page branch" }).click();
  const pagination = page.getByRole("navigation", { name: "branch choices pages" });
  await pagination.getByRole("button", { name: "Next" }).click();
  await expect(pagination).toContainText("Page 2");
  await expect(branch).toHaveValue("First page branch");
  await branch.click();
  await expect(page.getByRole("option", { name: "Second page branch" })).toBeVisible();
  await page.keyboard.press("Escape");
  await pagination.getByRole("button", { name: "Previous" }).click();
  await branch.click();
  await expect(page.getByRole("option", { name: "First page branch" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(reads).toEqual(["first", branchId, "first"]);
});

test("Contact touch choices scroll without accidental selection and remain usable with a short viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 500 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await fixture(page);
    await page.route("**/api/v1/public/branches?*", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Isolated touch choices",
          meta: { requestId: "contact-touch" },
          data: {
            items: Array.from({ length: 20 }, (_, index) => ({
              id: `f6000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              name: `Test branch ${String(index + 1).padStart(2, "0")}`,
            })),
          },
        },
      }),
    );
    await page.goto("/contact");
    const branch = page.getByRole("combobox", { name: "Handling branch" });
    await branch.tap();
    const popover = page.locator(".contact-choice-popover");
    const bounds = await popover.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500);
    const cdp = await context.newCDPSession(page);
    const x = bounds!.x + bounds!.width / 2;
    const start = bounds!.y + bounds!.height - 25;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: start }],
    });
    for (let step = 1; step <= 6; step++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: start - step * 18 }],
      });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(popover).toBeVisible();
    await expect.poll(() => popover.evaluate((el) => el.scrollTop)).toBeGreaterThan(20);
    await expect(branch).toHaveValue("");
    await page.getByRole("option", { name: "Test branch 15", exact: true }).tap();
    await expect(branch).toHaveValue("Test branch 15");
    await expect(popover).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("Contact branch loading, unavailable and empty states offer safe recovery", async ({
  page,
}) => {
  const state = await fixture(page);
  state.delay = 900;
  state.branchError = true;
  await page.goto("/contact");
  await expect(page.getByRole("combobox", { name: "Handling branch" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry branch choices" })).toBeVisible();
  state.branchError = false;
  state.empty = true;
  state.delay = 0;
  await page.getByRole("button", { name: "Retry branch choices" }).click();
  await expect(page.getByText("No branches available on this page.")).toBeVisible();
});

test("Contact picker opens when pointer focus scrolls it clear of floating support controls", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/contact");
  const branch = page.getByRole("combobox", { name: "Handling branch" });
  await expect(branch).toBeEnabled();
  await branch.evaluate((el) =>
    window.scrollTo({
      top: scrollY + el.getBoundingClientRect().bottom - innerHeight + 45,
      behavior: "instant",
    }),
  );
  await branch.click();
  await expect(branch).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "Port Harcourt test branch" })
    .click();
  await expect(branch).toHaveValue("Port Harcourt test branch");
});

test("Contact maps backend field validation to the retained field and moves focus", async ({
  page,
}) => {
  const state = await fixture(page);
  state.status = 400;
  state.code = "VALIDATION_FAILED";
  state.fields = { "body.email": ["Rejected value"] };
  await page.goto("/contact");
  await draft(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
  const email = page.getByLabel("Email address", { exact: true });
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveValue("Contact@Example.Test");
  await expect(
    page.getByText("Check this field and enter a valid value.", { exact: true }),
  ).toBeVisible();
});

for (const failure of ["rate-limit", "server", "network"] as const) {
  test(`Contact ${failure} preserves values and never fakes success`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.status = failure === "rate-limit" ? 429 : 503;
    state.code = failure === "rate-limit" ? "RATE_LIMITED" : "DATABASE_UNAVAILABLE";
    state.disconnect = failure === "network";
    await page.goto("/contact");
    await draft(page);
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Send enquiry", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      failure === "rate-limit" ? "Too many requests" : "outcome could not be confirmed",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
      "Contact Test",
    );
    await expect(
      page.getByRole("heading", { name: "Enquiry received", exact: true }),
    ).toHaveCount(0);
    if (failure !== "rate-limit")
      await expect(
        page.getByRole("button", { name: "Review enquiry", exact: true }),
      ).toBeDisabled();
    expect(state.writes).toHaveLength(1);
  });
}

test("Contact reduced-motion anchor and direct channels use verified destinations", async ({
  page,
}) => {
  await fixture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contact");
  await page.getByRole("link", { name: "Call or WhatsApp", exact: true }).click();
  await expect(page.locator("#contact-channels")).toBeFocused();
  await expect(
    page.locator('.contact-channels a[href="tel:+2348136075567"]'),
  ).toBeVisible();
  await expect(
    page.locator('.contact-channels a[href="https://wa.me/2348136075567"]'),
  ).toBeVisible();
  await expect(
    page.locator('.contact-channels a[href="mailto:support@alliedautotech.com"]'),
  ).toBeVisible();
  const url = new URL(
    (await page
      .getByRole("link", { name: "Get directions", exact: true })
      .getAttribute("href")) as string,
  );
  expect(url.searchParams.get("destination")).toBe(
    "Allied AutoTech, 133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria",
  );
  const question = page.locator(".contact-faq summary").first();
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(question.locator("..")).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(question.locator("..")).not.toHaveAttribute("open", "");
  await expect(page.locator(".contact-faq a[href='/help']")).toHaveCount(2);
  await expect(page.locator(".contact-faq a[href='/services']")).toHaveCount(1);
});

test("Contact account shortcut follows roles and recovers without blocking the public form", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/contact");
  await expect(
    page.getByRole("link", { name: "Sign in to customer care", exact: true }),
  ).toHaveAttribute("href", "/login?next=%2Fdashboard%2Fsupport");
  for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
    state.role = role;
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("aat:session-changed")),
    );
    const customer = role === "CUSTOMER";
    await expect(page.locator(".contact-account-link a")).toHaveAttribute(
      "href",
      customer ? "/dashboard/support" : "/admin/support",
    );
    await expect(page.locator(".contact-account-link")).toContainText(
      customer ? "View customer care" : "Open support workspace",
    );
    await expect(
      page.getByRole("button", { name: "Review enquiry", exact: true }),
    ).toBeEnabled();
  }
  state.role = "error";
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("button", { name: "Retry account check" })).toBeVisible();
  await expect(page.locator(".contact-account-link a")).toHaveCount(0);
  state.role = "anonymous";
  await page.getByRole("button", { name: "Retry account check" }).click();
  await expect(
    page.getByRole("link", { name: "Sign in to customer care", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("Contact receipt supports copy fallback, safe text review and clearing on account change", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Unavailable");
        },
      },
    }),
  );
  await page.goto("/contact");
  await draft(page);
  const message = '<img src=x onerror="alert(1)"> Please review this as ordinary text.';
  await page.getByLabel("Your message", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(message);
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
  const reference = page.getByLabel("Your reference", { exact: true });
  await expect(reference).toHaveValue(sourceId);
  await page.getByRole("button", { name: "Copy reference", exact: true }).click();
  await expect(reference).toBeFocused();
  expect(
    await reference.evaluate(
      (element: HTMLInputElement) => element.selectionEnd! - element.selectionStart!,
    ),
  ).toBe(sourceId.length);
  await expect(
    page.getByText("Select and copy the value above using your device’s copy command."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "contact-oct-320-copy-fallback.png"),
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(reference).toHaveCount(0);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("");
  expect(state.writes).toHaveLength(1);
});

test("Contact receipt copies only its returned reference", async ({ page }) => {
  await fixture(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset.copiedReference = value;
        },
      },
    }),
  );
  await page.goto("/contact");
  await draft(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy reference", exact: true }).click();
  await expect(page.getByText("Copied to clipboard.", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-copied-reference", sourceId);
});
