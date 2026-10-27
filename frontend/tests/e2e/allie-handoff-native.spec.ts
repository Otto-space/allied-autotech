/** Explicit real browser/CSRF/API/restricted-CI-DB composition; no external delivery. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { verifyConsole } from "../fixtures/preview-console";

test.skip(
  process.env.RUN_HANDOFF_BROWSER_TESTS !== "true",
  "Requires the isolated handoff API harness",
);
test("reviewed new/existing handoffs persist to canonical customer history and scoped operator queue", async ({
  page,
  context,
  request,
}) => {
  const identity = JSON.parse(
    fs.readFileSync(path.join(os.tmpdir(), "allied-handoff-browser.local.json"), "utf8"),
  ) as {
    customerCookie: string;
    operatorCookie: string;
    complaintId: string;
    branchName: string;
  };
  async function useCookie(cookie: string) {
    await context.clearCookies();
    const at = cookie.indexOf("=");
    await context.addCookies([
      {
        name: cookie.slice(0, at),
        value: cookie.slice(at + 1),
        url: "http://127.0.0.1:3167",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  await useCookie(identity.customerCookie);
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== "127.0.0.1")
      external.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/help");
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  let panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Customer Care · leave a message" }).click();
  await panel
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("SYNTHETIC native reviewed handoff");
  await panel
    .getByRole("textbox", { name: /Your issue summary/ })
    .fill(
      "Synthetic native reviewed new handoff: please check the missing compatibility evidence.",
    );
  await panel.getByRole("radio", { name: identity.branchName, exact: true }).check();
  await panel.getByRole("button", { name: "Review message", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Review your message" })).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      (
        await new AxeBuilder({ page })
          .include(".allie-dialog")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-handoff-native-review-${width}.png`),
    });
  }
  const post = page.waitForResponse(
    (r) =>
      r.url().endsWith("/customers/support/handoff") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "Send message to Customer Care" })
    .press("Enter");
  const response = await post;
  expect(response.status()).toBe(201);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const reference = (await response.json()).data.reference;
  await expect(
    panel.getByRole("heading", { name: "Your message is saved" }),
  ).toBeVisible();
  await panel.getByRole("link", { name: "Open your Customer Care conversation" }).click();
  await expect(page).toHaveURL(`/dashboard/support/enquiries/${reference.id}`);
  await expect(page.locator("main")).toContainText(
    "Synthetic native reviewed new handoff",
  );
  await expect(page.locator("main")).not.toContainText("SYNTHETIC INTERNAL NOTE");
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Customer Care · leave a message" }).click();
  await panel
    .getByRole("combobox", { name: "Support destination" })
    .selectOption("COMPLAINT");
  await panel
    .getByRole("radio", { name: "SYNTHETIC native handoff complaint", exact: true })
    .check();
  await panel
    .getByRole("textbox", { name: /Your issue summary/ })
    .fill(
      "Synthetic native reviewed complaint handoff: the original issue needs a person.",
    );
  await panel.getByRole("button", { name: "Review message", exact: true }).click();
  await panel.getByRole("button", { name: "Send message to Customer Care" }).click();
  await panel.getByRole("link", { name: "Open your Customer Care conversation" }).click();
  await expect(page).toHaveURL(`/dashboard/support/complaints/${identity.complaintId}`);
  await expect(page.locator("main")).toContainText(
    "Synthetic native reviewed complaint handoff",
  );
  await expect(page.locator("main")).not.toContainText(
    "SYNTHETIC INTERNAL NOTE NEVER CUSTOMER VISIBLE",
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-handoff-native-customer-history-1440.png"),
  });
  await useCookie(identity.operatorCookie);
  await page.goto(`/admin/workforce/enquiries?selected=${reference.id}`);
  await expect(page.locator("main")).toContainText(
    "Synthetic native reviewed new handoff",
  );
  await page.goto(`/admin/workforce/complaints?selected=${identity.complaintId}`);
  await expect(page.locator("main")).toContainText(
    "Synthetic native reviewed complaint handoff",
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-handoff-native-operator-390.png"),
  });
  const evidence = await request.get("http://127.0.0.1:5021/__handoff-test-evidence");
  expect(evidence.status()).toBe(200);
  expect(await evidence.json()).toMatchObject({
    newEnquiryCount: 1,
    newSummaryPersisted: true,
    publicReplyCount: 1,
    existingSummaryPersisted: true,
    internalMessageCount: 1,
    inventoryUnchanged: true,
    bookingsUnchanged: true,
    auditCount: 2,
  });
  expect(external).toEqual([]);
  await verifyConsole(page, errors, warnings);
});
