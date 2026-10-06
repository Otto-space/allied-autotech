import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
const id = "fa000000-0000-4000-8000-000000000003";

test("Super Admin service draft survives reload and rejection, then clears after confirmed save", async ({
  page,
}) => {
  let reject = true;
  const writes: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id,
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-30T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        user: { id, email: "forms@example.test", role: "SUPER_ADMIN" },
      };
    if (endpoint === "/auth/csrf")
      data = { csrfToken: "form-draft-test-token-".repeat(4) };
    if (endpoint === "/admin/services" && route.request().method() === "POST") {
      if (reject)
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            error: { code: "CONFLICT" },
            meta: { requestId: "draft-test" },
          },
        });
      const body = route.request().postDataJSON();
      writes.push(body);
      data = { id, ...body };
    }
    await route.fulfill({
      json: {
        success: true,
        message: "Draft test",
        data,
        meta: { requestId: "draft-test" },
      },
    });
  });
  await page.goto("/admin/services");
  await page.getByLabel("Name", { exact: true }).fill("Draft diagnostics");
  await page.getByLabel("URL name", { exact: true }).fill("draft-diagnostics");
  await page
    .getByLabel("Full description (optional)", { exact: true })
    .fill("Diagnostic notes kept after reloading.");
  await page.getByLabel("Pricing", { exact: true }).selectOption("QUOTE_REQUIRED");
  await page.getByLabel("Duration in minutes", { exact: true }).fill("60");
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Draft diagnostics");
  await expect(
    page.getByLabel("Full description (optional)", { exact: true }),
  ).toHaveValue("Diagnostic notes kept after reloading.");
  await expect(page.getByLabel("Pricing", { exact: true })).toHaveValue("QUOTE_REQUIRED");
  await expect(page.getByLabel("Active", { exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Draft diagnostics");
  reject = false;
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(writes).toEqual([
    expect.objectContaining({
      name: "Draft diagnostics",
      slug: "draft-diagnostics",
      pricingType: "QUOTE_REQUIRED",
      isActive: false,
      durationMinutes: 60,
    }),
  ]);
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("Full description (optional)", { exact: true }),
  ).toHaveValue("");
});

test("guest complaint draft restores its form type and a branch selected from another page", async ({
  page,
}) => {
  const branch = "fa000000-0000-4000-8000-000000000004";
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    const data = url.pathname.endsWith("/public/branches")
      ? url.searchParams.has("cursor")
        ? { items: [{ id: branch, name: "Second page branch" }] }
        : { items: [{ id, name: "First page branch" }], nextCursor: branch }
      : { items: [] };
    await route.fulfill({
      json: {
        success: true,
        message: "Guest draft test",
        data,
        meta: { requestId: "guest-draft" },
      },
    });
  });
  await page.goto("/contact");
  await page.getByRole("radio", { name: "Complaint", exact: true }).check();
  await page.getByLabel("Your name", { exact: true }).fill("Guest Draft");
  await page.getByLabel("Email address", { exact: true }).fill("draft@example.test");
  await page.getByLabel("Subject", { exact: true }).fill("My unfinished complaint");
  await page
    .getByLabel("Complaint details", { exact: true })
    .fill("Keep these details after a browser reload.");
  await page
    .getByRole("navigation", { name: "branch choices pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Handling branch" }).fill("Second");
  await page.getByRole("option", { name: "Second page branch", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Complaint", exact: true })).toBeChecked();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Guest Draft");
  await expect(page.getByLabel("Complaint details", { exact: true })).toHaveValue(
    "Keep these details after a browser reload.",
  );
  await expect(page.getByRole("combobox", { name: "Handling branch" })).toHaveValue(
    "Second page branch",
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByLabel("Subject", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-guest-draft-reloaded.png"),
  });
});
