import { test, expect, type Page } from "@playwright/test";
import { workBookingDetailFixture, bookingId } from "../fixtures/work-booking-detail";
import { detailRecord } from "../fixtures/customer-booking-detail";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

async function openReview(page: Page) {
  const { state } = await workBookingDetailFixture(page);
  // Register after the catch-all booking fixture so client and server agree.
  await bookingRuntimeCapabilities(page.request, page);
  const quote = detailRecord().quotes[0];
  state.record.quotes = [
    {
      ...quote,
      status: "DRAFT",
      items: quote.items.map((item) => ({
        ...item,
        type: "LABOUR",
        productId: null,
      })),
    },
  ];
  await page.goto(`/admin/bookings/${bookingId(1)}`);
  const opener = page.getByRole("button", { name: "Review issue", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Issue this quotation?" });
  await expect(dialog).toBeVisible();
  return { state, opener, dialog };
}

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`quotation review ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      hasTouch: width <= 430,
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      reducedMotion: "reduce",
    });
    test("fills phone width, centers and returns focus after a delayed refresh", async ({
      page,
    }, info) => {
      const { state, opener, dialog } = await openReview(page);
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      const box = (await dialog.boundingBox())!;
      expect(box.width).toBe(width <= 430 ? width : 560);
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(1);
      expect(box.height).toBeLessThanOrEqual(height - 24);
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await dialog.getByRole("button", { name: "Confirm change", exact: true }).focus();
      await expect(
        dialog.getByRole("button", { name: "Confirm change", exact: true }),
      ).toBeInViewport();
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath("quotation-review.png") });
      const reads = state.reads;
      state.mode = "hold";
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => !!state.held).toBe(true);
      await expect(opener).toBeDisabled();
      state.mode = "normal";
      state.held!();
      await expect(opener).toBeFocused();
      expect(state.reads).toBeGreaterThan(reads);
      expect(state.writes).toEqual([]);
    });
  });
}

test("keeps the user's new focus while a closed review refreshes", async ({ page }) => {
  const { state, dialog } = await openReview(page);
  state.mode = "hold";
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => !!state.held).toBe(true);
  const link = page
    .getByRole("navigation", { name: "Breadcrumb", exact: true })
    .getByRole("link", { name: "Workshop bookings", exact: true });
  await link.focus();
  state.mode = "normal";
  state.held!();
  await expect(
    page.getByRole("button", { name: "Review issue", exact: true }),
  ).toBeEnabled();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(link).toBeFocused();
  expect(state.writes).toEqual([]);
});

for (const outcome of ["issued", "denied"]) {
  test(`returns to the booking heading when the opener becomes ${outcome}`, async ({
    page,
  }) => {
    const { state, dialog } = await openReview(page);
    if (outcome === "denied") state.mode = "denied";
    else state.record.quotes[0].status = "ISSUED";
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Manage workshop booking", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Review issue", exact: true }),
    ).toHaveCount(0);
    expect(state.writes).toEqual([]);
  });
}

test("successful issue refreshes before focusing the heading; rejection remains reviewable", async ({
  page,
}) => {
  const { state, dialog, opener } = await openReview(page);
  const confirm = dialog.getByRole("button", { name: "Confirm change", exact: true });
  state.outcome = "conflict";
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(dialog).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.click();
  state.outcome = "success";
  state.record.quotes[0].status = "ISSUED";
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Manage workshop booking", exact: true }),
  ).toBeFocused();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].body).toEqual({
    expectedRevision: state.record.quotes[0].revision,
  });
});
