/** Explicit native browser/API/DB composition. Ordinary suites skip it. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { verifyConsole } from "../fixtures/preview-console";

test.skip(
  process.env.RUN_SCOPED_CARE_CASE_BROWSER_TESTS !== "true",
  "Requires the isolated Care case harness",
);
test("Care assignments and replies cross the actual browser, CSRF, API and restricted CI database", async ({
  page,
  context,
  request,
}) => {
  const identity = JSON.parse(
    fs.readFileSync(
      path.join(os.tmpdir(), "allied-workforce-care-browser.local.json"),
      "utf8",
    ),
  ) as {
    cookie: string;
    enquiryId: string;
    complaintId: string;
    targetName: string;
  };
  expect(identity.enquiryId).toMatch(/^[\da-f-]{36}$/);
  expect(identity.complaintId).toMatch(/^[\da-f-]{36}$/);
  const separator = identity.cookie.indexOf("=");
  await context.addCookies([
    {
      name: identity.cookie.slice(0, separator),
      value: identity.cookie.slice(separator + 1),
      url: "http://127.0.0.1:3167",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [],
    writes: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (!/^(GET|HEAD|OPTIONS)$/.test(r.method())) writes.push(url.pathname);
    if (/^https?:/.test(r.url()) && url.hostname !== "127.0.0.1") external.push(r.url());
  });
  for (const kind of ["complaints", "enquiries"] as const) {
    const id = kind === "complaints" ? identity.complaintId : identity.enquiryId,
      prefix = kind === "complaints" ? "wfc" : "wfe",
      body = `Synthetic native ${kind} customer-visible reply: please share the missing vehicle details.`,
      reason = `Synthetic native ${kind} internal assignment basis, not a customer reply.`;
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(`/admin/workforce/${kind}?selected=${id}`);
    await expect(page.locator(`#${prefix}-body`)).toBeEditable();
    await page.locator(`#${prefix}-body`).fill(body);
    await page.getByRole("button", { name: "Change assignee", exact: true }).click();
    await page
      .locator(`#${prefix}-staff`)
      .getByRole("radio", { name: new RegExp(identity.targetName) })
      .check();
    await page.locator(`#${prefix}-reason`).fill(reason);
    await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Internal assignment reason");
    await expect(dialog).toContainText(reason);
    await expect(dialog).not.toContainText(body);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-care-native-assign-${kind}-${width}.png`),
      });
    }
    const assigned = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/${kind}/${id}/assignment`) && r.request().method() === "PATCH",
    );
    await dialog
      .getByRole("button", { name: "Confirm change", exact: true })
      .press("Enter");
    const assignmentResponse = await assigned;
    expect(assignmentResponse.status()).toBe(200);
    expect(assignmentResponse.headers()["cache-control"]).toContain("no-store");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(`#${prefix}-body`)).toHaveValue(body);
    await expect(page.locator(`#${prefix}-reason`)).toHaveValue("");
    await page.getByRole("button", { name: "Review reply", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Customer-visible reply");
    await expect(page.getByRole("dialog")).not.toContainText(reason);
    const replied = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/${kind}/${id}/replies`) && r.request().method() === "POST",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .press("Enter");
    expect((await replied).status()).toBe(200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(`#${prefix}-body`)).toHaveValue("");
    await expect(page.locator("main")).toContainText(body);
    await page.setViewportSize({ width: 390, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-care-native-recorded-${kind}-390.png`),
    });
  }
  const response = await request.get("http://127.0.0.1:5021/__care-test-evidence");
  expect(response.status()).toBe(200);
  const evidence = await response.json();
  expect(evidence).toEqual({
    enquiryVersion: 2,
    complaintVersion: 2,
    bothAssignedToReviewedTarget: true,
    branchPreserved: true,
    publicReplyCount: 2,
    internalMessageCount: 0,
    auditCount: 4,
    inventoryUnchanged: true,
    bookingsUnchanged: true,
  });
  expect(
    writes.filter((p) => /\/staff\/workforce\/.*\/(?:assignment|replies)$/.test(p)),
  ).toHaveLength(4);
  expect(external).toEqual([]);
  await verifyConsole(page, errors, warnings);
  fs.writeFileSync(
    path.join(
      os.tmpdir(),
      "allied-allie-state-20261027-db",
      "w14-care-native-evidence.json",
    ),
    JSON.stringify(evidence, null, 2),
  );
});
