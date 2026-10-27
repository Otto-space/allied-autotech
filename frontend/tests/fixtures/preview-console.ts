import { test, expect, type Page } from "@playwright/test";

export async function verifyConsole(page: Page, errors: string[], warnings: string[]) {
  expect(errors).toEqual([]);
  for (const warning of warnings) {
    const match =
      /^The resource (http:\/\/(?:127\.0\.0\.1|localhost):\d+\/_next\/static\/css\/[a-f0-9]+\.css) was preloaded using link preload but not used/.exec(
        warning,
      );
    expect(match, warning).not.toBeNull();
    const url = new URL(match![1]);
    expect(url.origin).toBe(new URL(page.url()).origin);
    const css = await page.request.get(url.href);
    expect(css.ok()).toBe(true);
    expect(await css.text()).toContain(".missing-page{");
    test.info().annotations.push({
      type: "known-preview-warning",
      description:
        "Built Next not-found fallback stylesheet was preloaded but unused; no operational stylesheet exception.",
    });
  }
}
