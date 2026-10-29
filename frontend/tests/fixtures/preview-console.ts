import { test, expect, type Page } from "@playwright/test";

export async function verifyConsole(page: Page, errors: string[], warnings: string[]) {
  expect(errors).toEqual([]);
  for (const warning of warnings) {
    const fontMatch =
      /^The resource (https?:\/\/[^ /]+\/_next\/static\/media\/[a-f0-9]+-s\.p\.(?:ttf|woff2)(?:\?dpl=dpl_[A-Za-z0-9]+)?) was preloaded using link preload but not used/.exec(
        warning,
      );
    if (fontMatch) {
      const url = new URL(fontMatch[1]);
      expect(url.origin).toBe(new URL(page.url()).origin);
      const response = await page.request.get(url.href);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toMatch(/font|octet-stream/);
      expect((await response.body()).length).toBeGreaterThan(1000);
      const families = await page.evaluate((filename) => {
        const families: string[] = [];
        for (const sheet of document.styleSheets) {
          for (const rule of sheet.cssRules) {
            if (
              rule instanceof CSSFontFaceRule &&
              rule.style.getPropertyValue("src").includes(filename)
            )
              families.push(rule.style.getPropertyValue("font-family"));
          }
        }
        return families;
      }, url.pathname.split("/").at(-1)!);
      expect(families.length, warning).toBeGreaterThan(0);
      expect(families.every((family) => /nippo|quicksand/i.test(family))).toBe(true);
      test.info().annotations.push({
        type: "verified-brand-font-preload-warning",
        description:
          "Unused global brand-font preload; same-origin font response and matching Nippo/Quicksand font-face declaration verified. Retained as a performance limitation.",
      });
      continue;
    }
    const match =
      /^The resource (https?:\/\/[^ /]+\/_next\/static\/css\/(?:[a-f0-9]+\.css(?:\?dpl=dpl_[A-Za-z0-9]+)?|app\/not-found\.css\?v=\d+)) was preloaded using link preload but not used/.exec(
        warning,
      );
    expect(match, warning).not.toBeNull();
    const url = new URL(match![1]);
    expect(url.origin).toBe(new URL(page.url()).origin);
    const css = await page.request.get(url.href);
    expect(css.ok()).toBe(true);
    expect(css.headers()["content-type"]).toContain("text/css");
    expect(await css.text()).toMatch(/\.missing-page\s*\{/);
    test.info().annotations.push({
      type: "verified-fallback-preload-warning",
      description:
        "Next not-found fallback stylesheet was preloaded but unused; verified its same-origin response and fallback selector. No operational stylesheet exception.",
    });
  }
}
