/** Explicit loopback-only UI/API/DB composition; ordinary suites skip it. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { verifyConsole } from "../fixtures/preview-console";
test.skip(
  process.env.RUN_SCOPED_AFTERCARE_BROWSER_TESTS !== "true",
  "Requires the isolated native aftercare harness",
);
test("financial aftercare crosses the actual browser, CSRF, API and restricted database without stock or refund execution", async ({
  page,
  context,
  request,
}) => {
  const identity = JSON.parse(
    fs.readFileSync(
      path.join(os.tmpdir(), "allied-workforce-aftercare-browser.local.json"),
      "utf8",
    ),
  ) as { cookie: string; requestId: string };
  expect(identity.requestId).toMatch(/^[\da-f-]{36}$/);
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
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/admin/workforce/aftercare");
  await page.getByRole("link", { name: /^Review request for / }).click();
  await expect(page).toHaveURL(new RegExp(`/aftercare/${identity.requestId}$`));
  await expect(
    page.getByText("Synthetic native browser request for one damaged item", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Decision", { exact: true }).selectOption("APPROVED");
  await page.getByLabel("Reviewed fee (₦)", { exact: true }).fill("0");
  const note =
    "Synthetic native acceptance: reviewed zero fee and customer-visible decision basis";
  await page.getByLabel("Customer-visible decision note", { exact: true }).fill(note);
  await page
    .getByRole("button", { name: "Review financial decision", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Customer-visible decision note");
  await expect(dialog).not.toContainText(
    "Internal synthetic evidence stays out of customer note",
  );
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
      path: path.join(os.tmpdir(), `allied-aftercare-native-review-${width}.png`),
    });
  }
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().endsWith(`/aftercare/${identity.requestId}/decision`),
  );
  await dialog
    .getByRole("button", { name: "Record financial decision", exact: true })
    .click();
  const actual = await response;
  expect(actual.status()).toBe(200);
  expect(actual.request().headers()["x-csrf-token"]?.length).toBeGreaterThan(31);
  expect(actual.request().postDataJSON().expectedRevision).toMatch(/^[a-f0-9]{64}$/);
  expect((await actual.json()).data).toMatchObject({
    id: identity.requestId,
    status: "APPROVED",
    reviewNote: note,
    approvedFeeKobo: "0",
  });
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("This request has a recorded financial decision.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review financial decision", exact: true }),
  ).toHaveCount(0);
  const evidence = await request.get("http://127.0.0.1:5021/__aftercare-test-evidence");
  expect(evidence.status()).toBe(200);
  expect(await evidence.json()).toEqual({
    status: "APPROVED",
    reviewed: true,
    fee: "0",
    auditCount: 1,
    inventoryUnchanged: true,
    refundCount: 0,
  });
  expect(writes).toHaveLength(2);
  expect(writes.filter((p) => p.endsWith("/auth/csrf"))).toHaveLength(1);
  expect(
    writes.filter((p) => p.endsWith(`/aftercare/${identity.requestId}/decision`)),
  ).toHaveLength(1);
  expect(external).toEqual([]);
  await verifyConsole(page, errors, warnings);
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-aftercare-native-recorded-390.png"),
  });
});
