import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workSupportFixture } from "../fixtures/work-support";

for (const width of [320, 390, 414, 768, 1440]) {
  test(`enquiry table preserves copy, detail actions and reflow at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await workSupportFixture(page, "SUPER_ADMIN");
    f.support.records.enquiries = f.support.records.enquiries.slice(0, 2);
    const subject =
      "Service question with a long subject that must remain readable without expanding the whole page";
    f.support.records.enquiries[0].subject = subject;
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as unknown as { copied: string }).copied = value;
          },
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/admin/support");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(3);
    const region = page.getByRole("region", { name: "Customer care cases", exact: true });
    await expect(region).toHaveCSS("overflow-x", "auto");
    const row = table.locator("tbody tr").first();
    const copy = row.getByRole("button", { name: "Copy contact email", exact: true });
    await copy.focus();
    await page.keyboard.press("Enter");
    await expect(row.getByRole("status")).toHaveText("Copied");
    expect(
      await page.evaluate(() => (window as unknown as { copied: string }).copied),
    ).toBe("support@example.test");
    await expect(page).toHaveURL(/\/admin\/support$/);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Denied");
          },
        },
      }),
    );
    await copy.click();
    await expect(row.getByRole("status")).toContainText("Copy unavailable");
    const open = row.getByRole("link", { name: /Open case/ });
    await open.focus();
    expect(
      await open.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
        );
      }),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(row.getByRole("link", { name: subject, exact: true })).toHaveAttribute(
      "href",
      /\/admin\/support\/enquiries\//,
    );
    expect(f.support.writes).toEqual([]);
    if (width === 390)
      expect(
        (await new AxeBuilder({ page }).include("main").analyze()).violations,
      ).toEqual([]);
    await page.screenshot({ path: info.outputPath("enquiry-table.png") });
    expect(errors).toEqual([]);
  });
}
