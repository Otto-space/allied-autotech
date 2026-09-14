import { chromium } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
});
try {
  for (const [name, url] of [
    ["link", "https://app.link.com/"],
    ["termii", "https://app.termii.ai/auth/signin"],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page
        .locator("input:visible")
        .first()
        .waitFor({ state: "visible", timeout: 25_000 })
        .catch(() => undefined);
      const screenshot = path.join(os.tmpdir(), `allied-reference-${name}-loaded.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      console.log(
        JSON.stringify({
          name,
          url: page.url(),
          title: await page.title(),
          visibleInputs: await page.locator("input:visible").count(),
          publicText: (await page.locator("body").innerText()).slice(0, 1800),
          screenshot,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          name,
          accessible: false,
          failure: error instanceof Error ? error.name : "Unknown error",
        }),
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
