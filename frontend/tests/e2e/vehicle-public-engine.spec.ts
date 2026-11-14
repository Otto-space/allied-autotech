import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { id } from "../fixtures/public-account-actions";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";

const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;

test.describe("vehicle engine section navigation follows availability", () => {
  for (const width of [390, 1440]) {
    for (const mode of [
      "full",
      "browse_enquiries",
      "catalogue",
      "unavailable",
    ] as const) {
      test(`${mode} keeps section links truthful at ${width}px`, async ({ page }) => {
        const state = {
          capabilityReads: 0,
          writes: [] as string[],
          errors: [] as string[],
        };
        page.on("pageerror", (error) => state.errors.push(error.message));
        await page.route("**/api/v1/**", async (route) => {
          if (route.request().method() !== "GET") {
            state.writes.push(route.request().method());
            return route.abort();
          }
          const path = new URL(route.request().url()).pathname;
          if (path === "/api/v1/auth/session")
            return route.fulfill({
              status: 401,
              json: { success: false, error: { code: "UNAUTHORIZED" } },
            });
          if (path === "/api/v1/public/capabilities") {
            state.capabilityReads++;
            return route.fulfill(
              mode === "unavailable"
                ? { status: 503, json: { success: false } }
                : {
                    json: {
                      success: true,
                      data: publicCapabilitiesFixture(mode),
                      message: "Isolated vehicle availability fixture",
                      meta: { requestId: "vehicle-section-navigation" },
                    },
                  },
            );
          }
          return route.continue();
        });
        await page.setViewportSize({ width, height: 900 });
        const listing = process.env.PUBLIC_VEHICLE_TEST_LISTING_ID ?? id(90203);
        await page.goto(`/vehicles/${listing}`);
        const navigation = page.getByRole("navigation", { name: "Vehicle sections" });
        await expect(navigation).toBeVisible();
        // Exercise policy states in the browser without changing server policy.
        await expect
          .poll(async () => {
            if (state.capabilityReads === 0)
              await page.evaluate(() => window.dispatchEvent(new Event("focus")));
            return state.capabilityReads;
          })
          .toBeGreaterThan(0);
        if (mode === "catalogue")
          await expect(
            page.locator(".vd-summary").getByRole("link", {
              name: "Enquire by email",
              exact: true,
            }),
          ).toBeVisible();
        if (mode === "unavailable")
          await expect(
            page.getByRole("button", { name: "Check availability again", exact: true }),
          ).toBeVisible();
        const inspection = navigation.getByRole("link", {
          name: "Inspection",
          exact: true,
        });
        await expect(inspection).toHaveCount(mode === "full" ? 1 : 0);
        await expect(page.locator("#inspection")).toHaveCount(mode === "full" ? 1 : 0);
        for (const link of await navigation.getByRole("link").all()) {
          const target = await link.getAttribute("href");
          expect(target).toMatch(/^#[a-z-]+$/);
          await expect(page.locator(target!)).toHaveCount(1);
        }
        if (mode === "full") {
          await inspection.click();
          await expect(page).toHaveURL(/#inspection$/);
          await expect(page.locator("#inspection")).toBeInViewport();
        }
        expect(state.writes).toEqual([]);
        expect(state.errors).toEqual([]);
      });
    }
  }
});

test.describe("vehicle engine gallery touch controls", () => {
  test.use({ hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [850, 720],
    [930, 430],
  ]) {
    test(`photo navigation clears support and stays in place at ${width}x${height}`, async ({
      page,
      request,
    }, info) => {
      test.skip(origin !== "http://127.0.0.1:5024", "Requires the isolated loopback API");
      const control = await request.post(`${origin}/__capabilities`, {
        data: { mode: "browse_enquiries" },
      });
      expect(control.ok()).toBe(true);
      const errors: string[] = [];
      const writes: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/v1/**", async (route) => {
        if (route.request().method() !== "GET") {
          writes.push(route.request().method());
          await route.abort();
          return;
        }
        const url = new URL(route.request().url());
        if (url.pathname === "/api/v1/auth/session")
          return route.fulfill({
            status: 401,
            json: { success: false, error: { code: "UNAUTHORIZED" } },
          });
        const response = await route.fetch({
          url: origin + url.pathname + url.search,
          maxRedirects: 0,
        });
        await route.fulfill({ response });
      });
      await page.setViewportSize({ width, height });
      await page.goto(`/vehicles/${id(90203)}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Synthetic Vehicle ICE",
      );
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      const gallery = page.locator(".vd-gallery");
      const controls = gallery.locator(":scope > .vd-gallery-controls");
      const status = controls.getByRole("status");
      await expect(status).toHaveText("Photo 1 of 2");

      async function tapAtDock(button: Locator) {
        const dock = await page.locator(".support-controls > button").boundingBox();
        expect(dock).not.toBeNull();
        await button.evaluate(
          (element, center) => {
            const box = element.getBoundingClientRect();
            scrollTo({
              top: scrollY + box.top + box.height / 2 - center,
              behavior: "instant",
            });
          },
          dock!.y + dock!.height / 2,
        );
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(
          await button.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(box.right - 8, box.top + box.height / 2),
            );
          }),
        ).toBe(true);
        const before = await page.evaluate(() => scrollY);
        await page.touchscreen.tap(box!.x + box!.width - 8, box!.y + box!.height / 2);
        await page.evaluate(async () => {
          for (let frame = 0; frame < 3; frame++)
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        });
        expect(await page.evaluate(() => scrollY)).toBe(before);
      }

      await tapAtDock(controls.getByRole("button", { name: "Next photo", exact: true }));
      await expect(status).toHaveText("Photo 2 of 2");
      await tapAtDock(
        controls.getByRole("button", { name: "Previous photo", exact: true }),
      );
      await expect(status).toHaveText("Photo 1 of 2");
      const second = gallery.getByRole("button", { name: /^Show photo 2:/ });
      await second.scrollIntoViewIfNeeded();
      await tapAtDock(second);
      await expect(second).toHaveAttribute("aria-pressed", "true");
      await expect(status).toHaveText("Photo 2 of 2");
      const expand = controls.getByRole("button", { name: "View photos", exact: true });
      await tapAtDock(expand);
      const dialog = page.getByRole("dialog", { name: "Vehicle photos", exact: true });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("ArrowRight");
      await expect(dialog.getByRole("status")).toHaveText("Photo 1 of 2");
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(expand).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
      expect(errors).toEqual([]);
      expect(writes).toEqual([]);
      await page.screenshot({ path: info.outputPath(`vehicle-gallery-${width}.png`) });
    });
  }
});

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const power of ["BEV", "ICE"] as const) {
    test(`public ${power} engine and supplied features at ${width}px`, async ({
      page,
      request,
    }, info) => {
      const control = await request.post(`${origin}/__capabilities`, {
        data: { mode: "browse_enquiries" },
      });
      expect(control.ok()).toBe(true);
      await page.setViewportSize({ width, height: 720 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/v1/**", async (route) => {
        expect(route.request().method()).toBe("GET");
        const url = new URL(route.request().url());
        if (url.pathname === "/api/v1/auth/session")
          return route.fulfill({
            status: 401,
            json: { success: false, error: { code: "UNAUTHORIZED" } },
          });
        const response = await route.fetch({
          url: origin + url.pathname + url.search,
          maxRedirects: 0,
        });
        await route.fulfill({ response });
      });
      await page.goto(`/vehicles/${id(power === "BEV" ? 90200 : 90203)}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        `Synthetic Vehicle ${power}`,
      );
      const engine = page.getByRole("region", { name: "Engine & drive", exact: true });
      await expect(engine).toContainText(
        power === "BEV" ? "Fully electric (EV)" : "Internal combustion (ICE)",
      );
      await expect(engine).toContainText(power === "BEV" ? "Electric" : "Petrol");
      await expect(engine).toContainText("RWD");
      if (power === "ICE") {
        await expect(engine).toContainText("1,998 cc");
        await expect(engine.locator("dd").filter({ hasText: "2.0L I-4 DI" })).toHaveText(
          "2.0L I-4 DI, DOHC, VVT, TURBO, PREMIUM, 252HP\n".padEnd(500, "x"),
        );
        const features = page.getByRole("region", {
          name: "Additional features",
          exact: true,
        });
        await expect(features.getByRole("listitem")).toHaveCount(2);
        await expect(features.getByRole("listitem").first()).toHaveText(
          "Audio, navigation",
        );
        const columns = await features
          .locator("ul")
          .evaluate(
            (node) => getComputedStyle(node).gridTemplateColumns.split(" ").length,
          );
        expect(columns).toBe(width <= 600 ? 1 : 2);
      } else {
        await expect(engine.getByText("Engine capacity", { exact: true })).toHaveCount(0);
        await expect(engine.getByText("Cylinders", { exact: true })).toHaveCount(0);
        await expect(
          page.getByRole("region", { name: "Additional features", exact: true }),
        ).toHaveCount(0);
      }
      await expect(
        page.getByText("Owner reports broken air conditioning. Diagnosis pending.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(errors).toEqual([]);
      if (width === 320 || width === 1440)
        await info.attach(`synthetic-${power}-${width}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      if (width === 320) {
        const spacingApplied = await page.evaluate(() => {
          const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
          if (!nonce) throw Error("Document nonce is required for text-spacing checks.");
          const style = document.createElement("style");
          style.nonce = nonce;
          style.textContent =
            "main * { letter-spacing: .12em !important; word-spacing: .16em !important; line-height: 1.5 !important; } main p { margin-bottom: 2em !important; }";
          document.head.append(style);
          const heading = document.querySelector("main h1");
          return (
            !!heading && Number.parseFloat(getComputedStyle(heading).letterSpacing) > 0
          );
        });
        expect(spacingApplied).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
    });
  }
}
