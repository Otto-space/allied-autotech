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
    const evidence = join(tmpdir(), "aat-native-concern-browser-20261030");
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
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
      it(`saves and reloads a real concern request at ${width}px`, async () => {
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
          await page.goto(origin + "/services/request", {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await browserExpect(
            page.getByRole("heading", { name: "Tell us what your vehicle needs" }),
          ).toBeVisible({ timeout: 60000 });
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
          await page.reload();
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
        } finally {
          await browser.close();
        }
      }, 120000);
  },
);
