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
          const poster = page.locator(".home-services__image img");
          await poster.scrollIntoViewIfNeeded();
          await expect(poster).toBeVisible();
          await expect
            .poll(() =>
              poster.evaluate((node) => (node as HTMLImageElement).naturalWidth),
            )
            .toBeGreaterThan(0);
          const size = await poster.boundingBox();
          expect(size!.height).toBeLessThanOrEqual(401);
          expect(size!.width / size!.height).toBeCloseTo(0.8, 1);
          const card = page.locator(".home-product-card");
          await expect(card).toHaveCount(1);
          await expect(card).toContainText("Availability not listed");
          await expect(card).toContainText("Image unavailable");
          expect((await card.boundingBox())!.height).toBeLessThan(330);
          const invitation = page.locator(".home-feedback--empty");
          await expect(invitation).toContainText(
            "No customer reviews have been published yet",
          );
          expect((await invitation.boundingBox())!.height).toBeLessThan(300);
          const vehicleBand = page.locator(".home-vehicles");
          await expect(vehicleBand).toHaveCSS("background-image", /linear-gradient/);
          expect(
            await vehicleBand.evaluate((node) => getComputedStyle(node).backgroundImage),
          ).not.toContain("16, 44, 71");
          const link = card.getByRole("link", { name: "View product: Synthetic part" });
          await link.focus();
          await expect(link).toBeFocused();
          expect(
            await link.evaluate((node) =>
              parseFloat(getComputedStyle(node).outlineWidth),
            ),
          ).toBeGreaterThanOrEqual(2);
          await link.hover();
          await expect(link).toBeFocused();
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
          await invitation.screenshot({
            path: path.join(evidence, `home-reviews-empty-${width}.png`),
          });
        } finally {
          await page.close();
        }
      }, 30000);
    }
  },
);
