import React from "react";
import { chromium, expect, type Browser } from "@playwright/test";
import { describe, test, beforeAll, afterAll } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CustomerCareSummary } from "../../app/components/customer-care-summary";
import { overviewFixture } from "../fixtures/overview";

const evidence = path.join(os.tmpdir(), "allied-visual-audit-20261027");
const read = (name: string) => fs.readFileSync(path.resolve(name), "utf8");
const styles = [
  "app/colour-tokens.css",
  "app/globals.css",
  "app/overview.css",
  "app/dashboard/customer-overview.css",
  "app/components/care-workspace.css",
]
  .map(read)
  .join("\n")
  .replace(/@import[^;]+;/g, "");
const font = fs.readFileSync("public/fonts/quicksand-variable.ttf").toString("base64");

// This mounts the actual component HTML and relevant source CSS, not the full Next app.
// No preview server, customer session, external network or business API is used.
describe.skipIf(process.env.RUN_VISUAL_AUDIT_COMPONENTS !== "true")(
  "isolated browser styles",
  () => {
    let browser: Browser;
    beforeAll(async () => {
      browser = await chromium.launch({ channel: "msedge", headless: true });
    });
    afterAll(async () => {
      await browser?.close();
    }, 30000);
    for (const width of [360, 390, 768, 1440]) {
      for (const empty of [false, true]) {
        test(`isolated Next booking remains readable at ${width}px (${empty ? "empty" : "populated"})`, async () => {
          const page = await browser.newPage();
          try {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.route("**/*", (route) => route.abort());
            await page.setViewportSize({ width, height: 900 });
            const care = overviewFixture("CUSTOMER", undefined, empty).care!;
            const html = renderToStaticMarkup(<CustomerCareSummary care={care} />);
            await page.setContent(`<!doctype html><html lang="en"><head><title>Isolated customer care summary</title>
        <style>@font-face {font-family: Quicksand;src:url(data:font/ttf;base64,${font});font-weight:300 700;}
        :root {--font-quicksand:Quicksand;} ${styles}</style></head>
        <body><div class="dashboard" style="display:block"><main class="dashboard-content">
        <div class="customer-overview">${html}</div>
        <a class="care-next" href="#reply">Reply to this request</a><textarea id="reply" aria-label="Fixture reply"></textarea>
        </main></div></body></html>`);
            await page.evaluate(() => document.fonts.ready);
            const card = page.locator(".customer-care-next");
            const heading = card.getByRole("heading", { name: "Next booking" });
            await expect(heading).toBeVisible();
            await expect(heading).toHaveCSS("color", "rgb(8, 12, 15)");
            await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
            await expect(page.locator("a.care-next")).toHaveCSS(
              "color",
              "rgb(255, 255, 255)",
            );
            await expect(card).toContainText(
              empty ? "No upcoming requested or confirmed booking." : "Routine service",
            );
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.locator("a.care-next").hover();
            await expect(heading).toHaveCSS("color", "rgb(8, 12, 15)");
            expect(errors).toEqual([]);
            fs.mkdirSync(evidence, { recursive: true });
            await card.screenshot({
              path: path.join(
                evidence,
                `booking-${width}-${empty ? "empty" : "populated"}.png`,
              ),
            });
          } finally {
            await page.close();
          }
        }, 30000);
      }
    }
  },
);
