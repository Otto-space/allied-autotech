import { chromium, expect, type Browser } from "@playwright/test";
import { describe, test, beforeAll, afterAll, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { product, service } from "../fixtures/public-account-actions";
import { PublicHome } from "../../app/components/public-home";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/api/public-seed-server", () => ({
  loadPublicSeed: async (endpoint: string, parse: (value: unknown) => unknown) => ({
    data: parse({
      items: endpoint.includes("products")
        ? [{ ...product, availability: [], priceKobo: "1250000" }]
        : endpoint.includes("services")
          ? [service]
          : [],
    }),
  }),
}));

// Real server-rendered Home components and source styles with fictional seed data.
// No app server, live account, API connection, hydration or business write.
describe.skipIf(process.env.RUN_VISUAL_AUDIT_COMPONENTS !== "true")(
  "isolated sparse homepage layout",
  () => {
    let browser: Browser;
    let html: string;
    const evidence = path.join(os.tmpdir(), "allied-visual-audit-20261027");
    const read = (name: string) => fs.readFileSync(path.resolve(name), "utf8");
    // Include the existing build's generated Tailwind utilities/preflight, then
    // override with current source CSS. Raw @import "tailwindcss" is not browser CSS.
    const compiledBase = fs.existsSync(".next/static/css")
      ? fs
          .readdirSync(".next/static/css")
          .map((file) => read(`.next/static/css/${file}`))
          .find(
            (css) =>
              css.includes("@layer utilities") && css.includes(".site-header__brand"),
          )
      : undefined;
    const styles =
      (compiledBase ?? "") +
      [
        "app/colour-tokens.css",
        "app/globals.css",
        "app/public-site.css",
        "app/brand-system.css",
        "app/home.css",
        "app/components/home-feedback.css",
        "app/components/campaign-artwork.css",
      ]
        .map(read)
        .join("\n")
        .replace(/@import[^;]+;/g, "");
    const font = fs
      .readFileSync("public/fonts/quicksand-variable.ttf")
      .toString("base64");
    const displayFont = fs
      .readFileSync("app/fonts/Nippo-Variable.woff2")
      .toString("base64");

    beforeAll(async () => {
      if (!compiledBase)
        throw new Error("Build CSS is required for isolated Home layout acceptance.");
      browser = await chromium.launch({ channel: "msedge", headless: true });
      html = renderToStaticMarkup(await PublicHome());
    });
    afterAll(async () => {
      await browser?.close();
    }, 30000);

    for (const width of [360, 390, 768, 1440]) {
      test(`one product, one service and no reviews at ${width}px`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        try {
          await page.route("**/*", async (route) => {
            const url = new URL(route.request().url());
            const requested =
              url.pathname === "/_next/image"
                ? url.searchParams.get("url")
                : url.pathname;
            if (
              url.origin === "http://fixture.invalid" &&
              requested &&
              /^\/(brand\/r2|images)\/[a-zA-Z0-9/_.-]+$/.test(requested) &&
              !requested.includes("..")
            ) {
              const file = path.resolve("public", requested.slice(1));
              if (fs.existsSync(file)) {
                await route.fulfill({ path: file });
                return;
              }
            }
            await route.abort();
          });
          await page.setContent(`<!doctype html><html lang="en"><head><base href="http://fixture.invalid/"><title>Isolated sparse Home</title>
            <style>@font-face {font-family:Quicksand;src:url(data:font/ttf;base64,${font});font-weight:300 700;}
            @font-face {font-family:Nippo;src:url(data:font/woff2;base64,${displayFont});font-weight:200 700;}
            :root{--font-quicksand:Quicksand;--font-nippo:Nippo;} ${styles}</style></head><body>${html}</body></html>`);
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator(".home-services__image")).toHaveCount(0);
          await expect(page.locator(".service-discovery__item")).toHaveCount(1);
          await expect(page.locator(".home-product-card")).toHaveCount(0);
          await expect(page.locator(".home-product-note")).toBeVisible();
          await expect(page.locator(".home-feedback")).toHaveCount(0);
          const vehicleBand = page.locator(".home-vehicles");
          await expect(vehicleBand).toHaveAttribute("data-state", "empty");
          await expect(vehicleBand).toHaveCSS("background-image", "none");
          const link = vehicleBand.getByRole("link", { name: "Discuss a vehicle" });
          await expect(link).toHaveAttribute("href", "/contact?vehicle=1#enquiry");
          await link.focus();
          await expect(link).toBeFocused();
          expect(
            await link.evaluate((node) =>
              parseFloat(getComputedStyle(node).outlineWidth),
            ),
          ).toBeGreaterThanOrEqual(2);
          const overflow = await page.evaluate(() => ({
            width: innerWidth,
            document: document.documentElement.scrollWidth,
            nodes: [...document.querySelectorAll("body *")]
              .filter((node) => {
                const rect = node.getBoundingClientRect();
                return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
              })
              .slice(0, 16)
              .map((node) => ({
                tag: node.tagName,
                class: node.className,
                width: node.getBoundingClientRect().width,
              })),
          }));
          expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(width);
          fs.mkdirSync(evidence, { recursive: true });
          await page
            .locator(".home-services")
            .screenshot({ path: path.join(evidence, `home-services-${width}.png`) });
          await page
            .locator(".home-shop")
            .screenshot({ path: path.join(evidence, `home-shop-${width}.png`) });
          await vehicleBand.screenshot({
            path: path.join(evidence, `home-vehicles-empty-${width}.png`),
          });
        } finally {
          await page.close();
        }
      }, 30000);
    }
  },
);
