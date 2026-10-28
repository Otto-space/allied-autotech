import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Real public record for SSR; all account reads and submissions are intercepted.
const serviceId = "669f57ce-6e45-46f8-a9c4-75aa56f9d169";
const branchId = "f6000000-0000-4000-8000-000000000001";
const receiptId = "f6000000-0000-4000-8000-000000000002";
const servicePath = `/services/${serviceId}`;
async function fixture(page: Page) {
  const state = {
    branchError: false,
    reject: false,
    writes: [] as Record<string, unknown>[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname;
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: true,
          message: "Isolated service enquiry",
          data,
          meta: { requestId: "service-clarity-fixture" },
        },
      });
    if (endpoint.endsWith("/public/branches") && request.method() === "GET") {
      if (state.branchError)
        return route.fulfill({
          status: 503,
          json: {
            success: false,
            error: { code: "SERVICE_UNAVAILABLE" },
          },
        });
      return ok({ items: [{ id: branchId, name: "Synthetic workshop", code: "TEST" }] });
    }
    if (endpoint.endsWith("/public/support/enquiries") && request.method() === "POST") {
      state.writes.push(request.postDataJSON());
      if (state.reject)
        return route.fulfill({
          status: 422,
          json: {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Review the subject.",
              fields: { "body.subject": ["Enter a clearer subject."] },
            },
          },
        });
      return ok(
        { id: receiptId, status: "OPEN", createdAt: "2026-10-29T00:00:00Z" },
        202,
      );
    }
    return route.fulfill({
      status: 401,
      json: {
        success: false,
        error: { code: "ISOLATED_UNMATCHED_REQUEST" },
      },
    });
  });
  return state;
}
async function fillDraft(page: Page) {
  await page.getByLabel("Your name", { exact: true }).fill("Service Fixture");
  await page.getByLabel("Email address", { exact: true }).fill("service@example.test");
  await page.getByLabel("Subject", { exact: true }).fill("Tyre fitting question");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Please discuss fitting tyres for my vehicle.");
  const branch = page.getByRole("combobox", { name: "Handling branch" });
  await branch.fill("Synthetic");
  await page.getByRole("option", { name: "Synthetic workshop", exact: true }).click();
}

for (const width of [390, 1440]) {
  test(`service enquiry has one heading, full photo and reviewed submission at ${width}`, async ({
    page,
  }, info) => {
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 936 });
    await page.goto(servicePath);
    await expect(page).toHaveTitle(/Tyre Change/);
    const heading = page.getByRole("heading", { name: "Service enquiry", exact: true });
    await expect(heading).toHaveCount(1);
    await expect(page.locator("#support-create-heading")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Service enquiry", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("An enquiry does not confirm an appointment.", { exact: false }),
    ).toBeVisible();
    const photo = page.locator(".sd-media img");
    await expect(photo).toHaveCSS("object-fit", "contain");
    await expect
      .poll(() =>
        photo.evaluate(
          (image: HTMLImageElement) =>
            image.complete && image.naturalHeight > image.naturalWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath(`service-full-photo-${width}.png`) });
    const action = page.getByRole("button", { name: "Send an enquiry", exact: true });
    await action.focus();
    await page.keyboard.press("Enter");
    await expect(heading).toBeFocused();
    await heading.hover();
    await expect(heading).toBeFocused();
    await fillDraft(page);
    await page.screenshot({ path: info.outputPath(`service-enquiry-${width}.png`) });
    const axe = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Tyre Change");
    await expect(dialog).toContainText("Synthetic workshop");
    expect(state.writes).toHaveLength(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
      "Please discuss fitting tyres for my vehicle.",
    );
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await dialog.getByRole("button", { name: "Send enquiry", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Enquiry received", exact: true }),
    ).toBeFocused();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      serviceId,
      branchId,
      type: "SERVICE",
      subject: "Tyre fitting question",
    });
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}

for (const width of [360, 768]) {
  test(`service guidance and image failure remain usable at ${width}`, async ({
    page,
  }, info) => {
    const state = await fixture(page);
    await page.route("**/*", (route) =>
      route.request().resourceType() === "image" ? route.abort() : route.fallback(),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto(servicePath);
    await expect(
      page.getByRole("img", { name: "Service image unavailable", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Service enquiry", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.goto("/services");
    const journey = page.locator(".services-journey");
    await expect(journey).toContainText("What happens after you enquire?");
    await expect(journey).toContainText(
      "An enquiry alone does not confirm an appointment or reserve stock.",
    );
    await expect(journey).not.toContainText("Choose an available appointment");
    await journey.screenshot({ path: info.outputPath(`service-journey-${width}.png`) });
    expect(state.writes).toHaveLength(0);
  });
}

test("service enquiry retains the draft through branch retry and rejected submission", async ({
  page,
}) => {
  const state = await fixture(page);
  state.branchError = true;
  await page.goto(servicePath);
  await page.getByLabel("Your name", { exact: true }).fill("Retained name");
  await expect(page.getByRole("button", { name: "Retry branch choices" })).toBeVisible();
  state.branchError = false;
  await page.getByRole("button", { name: "Retry branch choices" }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "Retained name",
  );
  await fillDraft(page);
  state.reject = true;
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
  await expect(page.getByText("Enter a clearer subject.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Please discuss fitting tyres for my vehicle.",
  );
  expect(state.writes).toHaveLength(1);
});
