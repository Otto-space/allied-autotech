import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const file = process.env.OPERATIONS_PAGING_SESSION_FILE;
test.skip(!file, "Requires isolated operations paging API and synthetic fixtures");
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`real ${role} pages both operational job sources without repeating records or submitting mutations`, async ({
    page,
  }) => {
    const { fixtures, jobs } = JSON.parse(readFileSync(file!, "utf8"));
    const account = fixtures.find((f: { role: string }) => f.role === role);
    await page.context().addCookies([
      {
        name: "aat_session",
        value: account.token,
        url: process.env.PLAYWRIGHT_BASE_URL!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const errors: string[] = [],
      writes: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/v1/**", async (route) => {
      if (!["GET", "HEAD"].includes(route.request().method()))
        writes.push(
          route.request().method() + " " + new URL(route.request().url()).pathname,
        );
      await route.continue();
    });
    await page.setViewportSize({ width: role === "ADMIN" ? 1440 : 390, height: 900 });
    await page.goto("/admin/processing-jobs");
    const pages = page.getByRole("navigation", { name: "Processing jobs pages" });
    for (const source of ["OUTBOX", "PAYMENT_WEBHOOK"]) {
      if (source !== "OUTBOX") await page.getByLabel("Job source").selectOption(source);
      await expect(
        page.getByRole("heading", {
          name: `synthetic.ops.${source.toLowerCase()}`,
          exact: true,
        }),
      ).toHaveCount(25);
      await expect(pages).toContainText("Page 1");
      await expect(
        pages.getByRole("button", { name: "Previous", exact: true }),
      ).toBeDisabled();
      const expected = jobs
        .filter((j: { source: string }) => j.source === source)
        .map((j: { id: string }) => j.id)
        .sort();
      const first = await page
        .locator("section[aria-labelledby^=job-]")
        .evaluateAll((nodes) =>
          nodes.map((n) =>
            n.getAttribute("aria-labelledby")!.replace(/^job-(?:outbox|webhook)-/, ""),
          ),
        );
      await pages.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: `synthetic.ops.${source.toLowerCase()}`,
          exact: true,
        }),
      ).toHaveCount(2);
      const second = await page
        .locator("section[aria-labelledby^=job-]")
        .evaluateAll((nodes) =>
          nodes.map((n) =>
            n.getAttribute("aria-labelledby")!.replace(/^job-(?:outbox|webhook)-/, ""),
          ),
        );
      expect([...first, ...second].sort()).toEqual(expected);
      expect(new Set([...first, ...second]).size).toBe(27);
      await expect(pages).toContainText("Page 2");
      await expect(
        pages.getByRole("button", { name: "Next", exact: true }),
      ).toBeDisabled();
      await pages.getByRole("button", { name: "Previous", exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: `synthetic.ops.${source.toLowerCase()}`,
          exact: true,
        }),
      ).toHaveCount(25);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: join(tmpdir(), `allied-operations-paging-${role}.png`),
    });
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
