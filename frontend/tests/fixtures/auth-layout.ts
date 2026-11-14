import { expect, type Locator } from "@playwright/test";

// Long account forms may reflow vertically. Exercise keyboard focus and native
// scrolling, keeping the complete hit area clear instead of limiting the first frame.
export async function expectAuthControlReachable(control: Locator) {
  if (await control.isEnabled()) {
    await control.page().keyboard.press("Tab");
    await control.focus();
    await expect(control).toBeFocused();
  }
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport({ ratio: 1 });
  expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  if (await control.isEnabled())
    expect(
      await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
    ).toBe(true);
}
