import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_NATIVE_BROWSER_TESTS !== "true")(
  "native rendered concern booking",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>, server: Server;
    const origin = "http://127.0.0.1:3021";
    const evidence = join(tmpdir(), "aat-native-booking-group-20261101");
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      await prisma.userCapability.create({
        data: {
          userId: f.care.user.id,
          capability: "BOOKING_CONFIRM",
          grantedByUserId: f.owner.id,
        },
      });
      mkdirSync(evidence, { recursive: true });
      server = await new Promise<Server>((resolve, reject) => {
        const running = createApp({
          checkReadiness: async () => undefined,
          rateLimit: 10000,
          trustProxyHops: 1,
        }).listen(5021, "127.0.0.1", () => resolve(running));
        running.once("error", reject);
      });
    }, 30000);
    afterAll(async () => {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      await prisma.$disconnect();
    });
    for (const width of [390, 1440])
      it(`submits a concern, reviews a staff proposal and accepts without confirmation at ${width}px`, async () => {
        const group = await prisma.serviceCategory.create({
          data: { name: "Tyre & Wheel Maintenance", slug: randomUUID() },
        });
        const customer = await f.account(null, "CUSTOMER");
        const vehicle = await prisma.customerVehicle.create({
          data: {
            customerId: customer.user.profile!.id,
            make: "Toyota",
            model: "Corolla",
            year: 2020,
          },
        });
        // Native browser checks reuse frontend dependencies only when explicitly enabled.
        const { chromium, expect: browserExpect } = createRequire(import.meta.url)(
          fileURLToPath(
            new URL("../../../frontend/node_modules/@playwright/test", import.meta.url),
          ),
        );
        const browser = await chromium.launch({ channel: "msedge", headless: true });
        try {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          const cookie = customer.headers.Cookie;
          const separator = cookie.indexOf("=");
          await context.addCookies([
            {
              name: cookie.slice(0, separator),
              value: cookie.slice(separator + 1),
              url: origin,
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (e: Error) => errors.push(e.message));
          const identityResponse = page.waitForResponse(
            (response: { url(): string }) => response.url().endsWith("/auth/session"),
            { timeout: 60000 },
          );
          await page.goto(origin + `/services/request?serviceGroup=${group.id}`, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await browserExpect(
            page.getByRole("heading", { name: "Tell us what your vehicle needs" }),
          ).toBeVisible({ timeout: 60000 });
          expect((await identityResponse).status()).toBe(200);
          const concern = "The vehicle vibrates when braking from road speed.";
          await page.getByLabel("What have you noticed?").fill(concern);
          await page
            .getByRole("combobox", { name: "Workshop", exact: true })
            .selectOption(f.home.id);
          const date = new Date(Date.now() + 10 * 86400000);
          date.setUTCHours(10, 0, 0, 0);
          await page
            .getByLabel("Preferred date and time (Lagos)")
            .fill(date.toISOString().slice(0, 16));
          await page
            .getByRole("button", { name: "Load saved vehicles & contact details" })
            .click();
          await page
            .getByRole("combobox", { name: "Saved vehicle (optional)", exact: true })
            .click();
          await page
            .getByRole("option", { name: "2020 Toyota Corolla", exact: true })
            .click();
          await browserExpect(
            page.getByText("Selected vehicle:", { exact: false }),
          ).toContainText("2020 Toyota Corolla");
          await browserExpect(page.getByLabel("What have you noticed?")).toHaveValue(
            concern,
          );
          await page.getByRole("button", { name: "Review request", exact: true }).click();
          await page.screenshot({
            path: join(evidence, "review-attempt-" + width + ".png"),
          });
          writeFileSync(
            join(evidence, "review-attempt-" + width + ".txt"),
            await page.locator("main").innerText(),
          );
          await browserExpect(
            page.getByRole("heading", { name: "Review your request" }),
          ).toBeFocused();
          expect(
            await prisma.booking.count({
              where: { customerId: customer.user.profile!.id },
            }),
          ).toBe(0);
          await page.screenshot({ path: join(evidence, `review-${width}.png`) });
          await page
            .getByRole("button", { name: "Request a workshop visit", exact: true })
            .click();
          await browserExpect(
            page.getByRole("heading", { name: "Your request is saved" }),
          ).toBeVisible({ timeout: 30000 });
          const rows = await prisma.booking.findMany({
            where: { customerId: customer.user.profile!.id },
          });
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({
            customerConcern: concern,
            vehicleId: vehicle.id,
            status: "REQUESTED",
            serviceId: null,
            depositAmountKobo: null,
          });
          await page
            .getByRole("link", { name: "View your booking", exact: true })
            .click();
          await browserExpect(
            page.getByRole("heading", { name: "Booking details", exact: true }),
          ).toBeVisible({ timeout: 60000 });
          await browserExpect(page.locator("main")).toContainText(concern, {
            timeout: 30000,
          });
          await prisma.serviceCategory.update({
            where: { id: group.id },
            data: { name: "Renamed workshop group", isActive: false },
          });
          await page.reload();
          await browserExpect(page.locator("main")).toContainText(group.name);
          await browserExpect(page.locator("main")).toContainText(concern, {
            timeout: 30000,
          });
          expect(
            await prisma.booking.count({
              where: { customerId: customer.user.profile!.id },
            }),
          ).toBe(1);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          expect(errors).toEqual([]);
          await page.screenshot({ path: join(evidence, `saved-${width}.png`) });

          const booking = rows[0]!;
          expect(booking).toMatchObject({
            requestedServiceCategoryId: group.id,
            requestedServiceCategoryName: group.name,
          });
          const staffContext = await browser.newContext({
            viewport: { width, height: 900 },
          });
          const staffCookie = f.care.headers.Cookie;
          const staffSeparator = staffCookie.indexOf("=");
          await staffContext.addCookies([
            {
              name: staffCookie.slice(0, staffSeparator),
              value: staffCookie.slice(staffSeparator + 1),
              url: origin,
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
          const staffPage = await staffContext.newPage();
          staffPage.on("pageerror", (e: Error) => errors.push(e.message));
          await staffPage.goto(origin + `/admin/workforce/bookings/${booking.id}`);
          await browserExpect(staffPage.locator("main")).toContainText(
            `Requested service group: ${group.name}`,
          );
          const proposedLocal = new Date(date.getTime() + 86400000)
            .toISOString()
            .slice(0, 16);
          const proposedAt = new Date(`${proposedLocal}:00+01:00`);
          const reason = "Allow time for the workshop to review the braking concern.";
          await staffPage
            .getByLabel("Proposed time (Lagos)", { exact: true })
            .fill(proposedLocal);
          await staffPage
            .getByLabel("Reason shown to customer", { exact: true })
            .fill(reason);
          await staffPage
            .getByRole("button", { name: "Review proposed time", exact: true })
            .click();
          await browserExpect(staffPage.getByRole("dialog")).toContainText(
            "Their current appointment stays unchanged.",
          );
          const read = () =>
            prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
          expect(await read()).toMatchObject({
            version: 0,
            scheduledAt: booking.scheduledAt,
            alternativeStartsAt: null,
          });
          await staffPage.screenshot({
            path: join(evidence, `staff-review-${width}.png`),
          });
          const proposalResponse = staffPage.waitForResponse(
            (response: { url(): string; request(): { method(): string } }) =>
              response.request().method() === "POST" &&
              response.url().endsWith(`/bookings/${booking.id}/alternative`),
          );
          await staffPage
            .getByRole("button", { name: "Send proposed time", exact: true })
            .click();
          const proposedResponse = await proposalResponse;
          expect(proposedResponse.status()).toBe(200);
          expect(
            proposedResponse.request().headers()["x-csrf-token"]?.length,
          ).toBeGreaterThan(31);
          expect(await read()).toMatchObject({
            version: 1,
            status: "REQUESTED",
            scheduledAt: booking.scheduledAt,
            alternativeStartsAt: proposedAt,
            alternativeReason: reason,
            customerConcern: concern,
            vehicleId: vehicle.id,
          });
          await page.reload();
          await browserExpect(
            page.getByRole("heading", { name: "The workshop proposed another time" }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Review proposed time", exact: true })
            .click();
          await browserExpect(page.getByRole("dialog")).toContainText(
            "not a confirmed appointment",
          );
          expect(await read()).toMatchObject({
            version: 1,
            scheduledAt: booking.scheduledAt,
          });
          for (const height of width === 390 ? [900, 500] : [900]) {
            await page.setViewportSize({ width, height });
            for (const button of await page
              .getByRole("dialog")
              .getByRole("button")
              .all()) {
              const bounds = await button.boundingBox();
              expect(bounds).not.toBeNull();
              expect(bounds!.height).toBeGreaterThanOrEqual(44);
              expect(bounds!.height).toBeLessThan(80);
              expect(bounds!.y).toBeGreaterThanOrEqual(0);
              expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
            }
            await page.screenshot({
              path: join(evidence, `customer-review-${width}-${height}.png`),
            });
          }
          await page.setViewportSize({ width, height: 900 });
          const acceptanceResponse = page.waitForResponse(
            (response: { url(): string; request(): { method(): string } }) =>
              response.request().method() === "POST" &&
              response.url().endsWith(`/bookings/${booking.id}/alternative-response`),
          );
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Confirm change", exact: true })
            .click();
          const acceptedResponse = await acceptanceResponse;
          expect(acceptedResponse.status()).toBe(200);
          expect(
            acceptedResponse.request().headers()["x-csrf-token"]?.length,
          ).toBeGreaterThan(31);
          await browserExpect(
            page.getByRole("heading", { name: "The workshop proposed another time" }),
          ).toHaveCount(0);
          expect(await read()).toMatchObject({
            version: 2,
            status: "REQUESTED",
            scheduledAt: proposedAt,
            alternativeStartsAt: null,
            confirmedAt: null,
            assignedStaffId: null,
            customerConcern: concern,
            vehicleId: vehicle.id,
            depositAmountKobo: null,
            customerRescheduleCount: 0,
          });
          await page.reload();
          await browserExpect(
            page.locator(".booking-appointment .booking-detail-status"),
          ).toHaveText(/Requested/);
          await staffPage.reload();
          await browserExpect(
            staffPage.getByRole("region", { name: "Proposed appointment", exact: true }),
          ).toHaveCount(0);
          await browserExpect(staffPage.locator("main")).toContainText(concern);
          for (const currentPage of [page, staffPage]) {
            expect(
              await currentPage.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          }
          expect(
            await prisma.booking.count({
              where: { customerId: customer.user.profile!.id },
            }),
          ).toBe(1);
          expect(errors).toEqual([]);
          await page.screenshot({
            path: join(evidence, `accepted-pending-${width}.png`),
          });
          await staffPage.screenshot({
            path: join(evidence, `staff-pending-${width}.png`),
          });
          await staffContext.close();
        } finally {
          await browser.close();
        }
      }, 180000);
  },
);
