import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { id } from "../fixtures/public-account-actions";

const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
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
