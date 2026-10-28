/** Full local UI/API/DB composition. No interception, provider or real inventory. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { verifyConsole } from "../fixtures/preview-console";

test.skip(
  process.env.RUN_SCOPED_BOOKING_BROWSER_TESTS !== "true",
  "Requires isolated native booking harness",
);
test("a scoped Staff confirmation crosses the actual browser, CSRF, API and restricted database", async ({
  page,
  context,
  request,
}) => {
  const sessionFile = path.join(
    os.tmpdir(),
    "allied-workforce-booking-browser.local.json",
  );
  const identity = JSON.parse(fs.readFileSync(sessionFile, "utf8")) as {
    cookie: string;
    bookingId: string;
  };
  expect(identity.bookingId).toMatch(/^[\da-f-]{36}$/);
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
  await page.goto(`/admin/workforce/bookings/${identity.bookingId}`);
  await expect(
    page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  const note =
    "Synthetic native acceptance: technician and diagnostic equipment availability reviewed";
  await page.getByLabel("People and equipment review", { exact: true }).fill(note);
  await page
    .getByRole("button", { name: "Review appointment confirmation", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Synthetic workforce diagnostic");
  expect(
    (
      await new AxeBuilder({ page })
        .include("dialog[open]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-booking-native-review-390.png"),
  });
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().endsWith(`/bookings/${identity.bookingId}/confirmation`),
  );
  await dialog.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  const actual = await response;
  expect(actual.status()).toBe(200);
  expect(actual.request().headers()["x-csrf-token"]?.length).toBeGreaterThan(31);
  const packet = await actual.json();
  expect(packet.data).toMatchObject({
    id: identity.bookingId,
    status: "CONFIRMED",
    version: 1,
    resourceReviewNote: note,
  });
  await expect(
    page.getByText("This appointment is confirmed.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review appointment confirmation", exact: true }),
  ).toHaveCount(0);
  const evidence = await request.get("http://127.0.0.1:5021/__booking-test-evidence");
  expect(evidence.status()).toBe(200);
  expect(await evidence.json()).toEqual({
    status: "CONFIRMED",
    version: 1,
    confirmed: true,
    policyRecorded: true,
    auditCount: 1,
    reminderCount: 1,
  });
  expect(writes).toHaveLength(2);
  expect(writes.filter((p) => p.endsWith("/auth/csrf"))).toHaveLength(1);
  expect(
    writes.filter((p) => p.endsWith(`/bookings/${identity.bookingId}/confirmation`)),
  ).toHaveLength(1);
  expect(external).toEqual([]);
  await verifyConsole(page, errors, warnings);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-booking-native-confirmed-390.png"),
  });
});
