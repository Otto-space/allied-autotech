import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixture } from "../fixtures/overview-browser";
import { overviewFixture } from "../fixtures/overview";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";

const coverBytes = readFileSync(
  resolve(__dirname, "../../public/images/workshop/owner/tyre-care-at-work.webp"),
);
const id = (n: number) => `b9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const photo = (n: number) => ({
  id: id(n),
  url: `/api/v1/customers/media/images/${id(n)}`,
  altText: "Isolated garage photo",
  sortOrder: 0,
  isPrimary: true,
  width: 1600,
  height: 1067,
});
for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
])
  test.describe(`own overview ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width <= 430,
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    test("chosen default, private photo, fallback, booked priority and account switch", async ({
      page,
    }, info) => {
      const state = await fixture(page, "CUSTOMER");
      const full = overviewFixture("CUSTOMER").care!;
      const chosen = {
        ...full.vehicle!,
        id: id(301),
        model: "Selected garage vehicle",
        photo: photo(302),
      };
      state.care = {
        ...overviewFixture("CUSTOMER", undefined, true).care!,
        vehicle: full.vehicle,
        vehicleSource: "RECENT",
        defaultVehicle: chosen,
      };
      const errors: string[] = [];
      const writes: string[] = [];
      const media: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().includes("/api/v1/") && !["GET", "HEAD"].includes(r.method()))
          writes.push(r.method() + " " + new URL(r.url()).pathname);
      });
      await page.route("**/api/v1/public/capabilities", (r) =>
        r.fulfill({
          json: {
            success: true,
            message: "Isolated availability",
            meta: { requestId: "overview-capabilities" },
            data: publicCapabilitiesFixture(),
          },
        }),
      );
      await page.route("**/api/v1/customers/media/images/**", (r) => {
        const url = new URL(r.request().url());
        media.push(url.pathname + url.search);
        return r.request().url().endsWith(id(303))
          ? r.fulfill({ status: 404 })
          : r.fulfill({
              // Existing owner-approved workshop photograph, used only as isolated private-media bytes.
              contentType: "image/webp",
              body: coverBytes,
            });
      });
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.locator(".customer-care")).toContainText("Default vehicle");
      await expect(page.locator(".customer-care")).toContainText(
        "Selected garage vehicle",
      );
      expect(
        await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      ).toEqual({ width, height });
      const image = page.locator(".care-vehicle-photo img");
      await expect
        .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      expect(media).toEqual([photo(302).url]);
      await expect(image).toHaveCSS("object-fit", "contain");
      await expect(
        page.getByRole("link", { name: "View vehicle", exact: true }),
      ).toHaveAttribute("href", `/dashboard/vehicles/${chosen.id}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath("overview-first-viewport.png") });
      await page
        .locator(".customer-care")
        .screenshot({ path: info.outputPath("overview-default.png") });
      const frame = await page.locator(".care-vehicle-photo").boundingBox();
      state.care.defaultVehicle = { ...chosen, photo: photo(303) };
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(
        page.getByRole("img", { name: "Vehicle photo unavailable" }),
      ).toBeVisible();
      expect((await page.locator(".care-vehicle-photo").boundingBox())?.height).toBe(
        frame?.height,
      );
      // A current/next booking's actual vehicle must not be replaced by the default.
      state.care = { ...full, defaultVehicle: chosen };
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(page.locator(".customer-care")).toContainText("Booked vehicle");
      await expect(page.locator(".customer-care")).not.toContainText(chosen.model);
      // Old servers omit additive fields: retain their truthful recent fallback.
      state.care = {
        ...overviewFixture("CUSTOMER", undefined, true).care!,
        vehicle: full.vehicle,
        vehicleSource: "RECENT",
      };
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(page.locator(".customer-care")).toContainText(
        "Recently added vehicle",
      );
      // Auth invalidation clears prior care before a different account is verified.
      state.userId = id(401);
      state.care = {
        ...overviewFixture("CUSTOMER", undefined, true).care!,
        defaultVehicle: {
          ...chosen,
          id: id(402),
          model: "Second account vehicle",
          photo: null,
        },
      };
      await page.evaluate(() => {
        const c = new BroadcastChannel("aat-session");
        c.postMessage("changed");
        c.close();
      });
      const verify = page.getByRole("button", { name: "Verify session again" });
      await expect(verify).toBeVisible();
      await expect(page.locator(".customer-care")).toHaveCount(0);
      await verify.click();
      await expect(page.locator(".customer-care")).toContainText(
        "Second account vehicle",
      );
      await expect(page.locator(".customer-care")).not.toContainText(chosen.model);
      await expect(page.locator(".care-vehicle-photo")).toHaveCount(0);
      const action = page.getByRole("link", { name: "View vehicle", exact: true });
      await action.focus();
      await expect(action).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/dashboard/vehicles/${id(402)}$`));
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
