import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookingsFixture, bookingRecord, bookingId } from "../fixtures/customer-bookings";
import { SESSION_CHANGED } from "@/lib/api/client";

async function calendarFixture(page: Page) {
  const base = await bookingsFixture(page);
  const rows: ReturnType<typeof bookingRecord>[] = [
    { ...bookingRecord(1, "REQUESTED"), scheduledAt: "2026-11-02T09:00:00Z" },
    { ...bookingRecord(2, "CONFIRMED"), scheduledAt: "2026-11-03T10:00:00Z" },
    { ...bookingRecord(3, "CANCELLED"), scheduledAt: "2026-11-03T12:00:00Z" },
  ];
  const state = {
    mode: "normal",
    held: undefined as undefined | (() => void),
    reads: [] as URL[],
  };
  await page.route("**/api/v1/customers/bookings?**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("scheduledFrom")) return route.fallback();
    state.reads.push(url);
    if (state.mode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (state.mode === "error")
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      });
    const monthRows = rows.filter((row) =>
      [row.scheduledAt, row.alternativeStartsAt].some(
        (date) =>
          date &&
          Date.parse(date) >= Date.parse(url.searchParams.get("scheduledFrom")!) &&
          Date.parse(date) < Date.parse(url.searchParams.get("scheduledTo")!),
      ),
    );
    const later = url.searchParams.has("cursor");
    const data =
      state.mode === "inconsistent"
        ? { items: [{ ...rows[0], scheduledAt: "invalid" }] }
        : {
            items: later ? monthRows.slice(1) : monthRows.slice(0, 1),
            ...(!later && monthRows.length > 1 ? { nextCursor: bookingId(1) } : {}),
          };
    await route
      .fulfill({
        json: {
          success: true,
          message: "Isolated owned month",
          meta: { requestId: "calendar-fixture" },
          data,
        },
      })
      .catch(() => {});
  });
  return { state, base, rows };
}
for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
  [1366, 900],
  [1440, 900],
]) {
  test.describe(`calendar ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      // Firefox has no isMobile emulation; retain the exact responsive viewport.
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    test(`owned appointment calendar, keyboard, date selection and close at ${width}px`, async ({
      page,
    }, info) => {
      await page.clock.install({ time: new Date("2026-11-02T08:00:00Z") });
      const f = await calendarFixture(page);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/dashboard/bookings");
      expect(
        await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      ).toEqual({ width, height });

      const opener = page.getByRole("button", { name: "View calendar", exact: true });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Your appointment calendar" });
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(1);
      if (width <= 600) expect(box.width).toBe(width);
      expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await expect(dialog.getByRole("columnheader")).toHaveCount(7);
      await expect(
        dialog.getByRole("columnheader", { name: "Sun", exact: true }),
      ).toBeVisible();
      const firstWeek = dialog.locator("tbody tr").first().getByRole("button");
      await expect(firstWeek).toHaveCount(7);
      const boxes = await firstWeek.evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { x: Math.round(rect.x), y: Math.round(rect.y), width: rect.width };
        }),
      );
      expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
      expect(new Set(boxes.map((box) => box.x)).size).toBe(7);
      expect(Math.min(...boxes.map((box) => box.width))).toBeGreaterThanOrEqual(24);
      await expect(
        dialog.getByRole("heading", { name: "Your appointment calendar" }),
      ).toBeFocused();
      await expect(
        dialog.getByRole("button", {
          name: "2 November 2026, 1 booking, Requested",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(dialog.getByRole("timer")).toHaveCount(0);
      const third = dialog.getByRole("button", {
        name: "3 November 2026, 2 bookings, Confirmed, Cancelled",
        exact: true,
      });
      await third.click();
      await expect(
        dialog
          .getByRole("region", { name: "Selected date bookings" })
          .getByRole("link", { name: "View details" }),
      ).toHaveCount(2);
      await expect(dialog.getByRole("timer")).toHaveCount(1);
      await third.press("ArrowRight");
      await expect(
        dialog.getByRole("button", { name: "4 November 2026, 0 bookings", exact: true }),
      ).toBeFocused();
      await expect(dialog.getByText("No bookings on this date.")).toBeVisible();
      await dialog.getByRole("button", { name: "Next month", exact: true }).click();
      await expect(
        dialog.getByRole("heading", { name: "December 2026", exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "1 December 2026, 0 bookings", exact: true }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Today", exact: true }).click();
      await expect(
        dialog.getByRole("heading", { name: "November 2026", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      if ([320, 1440].includes(width)) {
        expect(
          (
            await new AxeBuilder({ page })
              .include("dialog[open]")
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({ path: info.outputPath(`calendar-${width}.png`) });
      }
      await page.screenshot({ path: info.outputPath(`calendar-month-${width}.png`) });
      await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
      const schedule = dialog.getByRole("region", { name: "Month schedule" });
      await expect(
        schedule.getByRole("link", { name: "View details", exact: true }),
      ).toHaveCount(3);
      await expect(schedule).toContainText("Requested");
      await expect(schedule).toContainText("Confirmed");
      await expect(schedule).toContainText("Cancelled");
      await page.screenshot({ path: info.outputPath(`calendar-schedule-${width}.png`) });
      await dialog.getByRole("button", { name: "Month", exact: true }).click();
      const closeButton = dialog.getByRole("button", {
        name: "Close appointment calendar",
        exact: true,
      });
      await dialog.getByRole("heading", { name: "Your appointment calendar" }).focus();
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
      await closeButton.focus();
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      await expect(closeButton).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(opener).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      expect(f.state.reads[0].searchParams.get("scheduledFrom")).toBe(
        "2026-11-01T00:00:00+01:00",
      );
      expect(f.base.writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

for (const mode of ["error", "inconsistent"])
  test(`${mode} calendar never presents false empty dates and can recover`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-11-02T08:00:00Z") });
    const f = await calendarFixture(page);
    f.state.mode = mode;
    await page.goto("/dashboard/bookings");
    await page.getByRole("button", { name: "View calendar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Retry calendar" })).toBeVisible();
    await expect(dialog.getByText("No bookings on this date.")).toHaveCount(0);
    await expect(dialog.getByRole("timer")).toHaveCount(0);
    f.state.mode = "normal";
    await dialog.getByRole("button", { name: "Retry calendar" }).click();
    await expect(
      dialog.getByRole("button", { name: "2 November 2026, 1 booking, Requested" }),
    ).toBeVisible();
    expect(f.base.writes).toEqual([]);
  });
test("calendar discards an in-flight month on session invalidation", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-02T08:00:00Z") });
  const f = await calendarFixture(page);
  f.state.mode = "hold";
  await page.goto("/dashboard/bookings");
  await page.getByRole("button", { name: "View calendar" }).click();
  await expect.poll(() => !!f.state.held).toBe(true);
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), SESSION_CHANGED);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  f.state.held?.();
  await expect(page.locator("dialog article")).toHaveCount(0);
  expect(f.base.writes).toEqual([]);
});

test("a proposal in a different month is visible as proposed, never as a confirmed countdown", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T08:00:00Z") });
  const f = await calendarFixture(page);
  f.rows.push({
    ...bookingRecord(4, "REQUESTED"),
    scheduledAt: "2026-10-15T09:00:00Z",
    alternativeStartsAt: "2026-11-05T10:00:00Z",
  });
  await page.goto("/dashboard/bookings");
  await page.getByRole("button", { name: "View calendar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "5 November 2026, 1 booking, Proposed time",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByRole("region", { name: "Selected date bookings" }),
  ).toContainText("Proposed time");
  await expect(
    dialog.getByRole("region", { name: "Selected date bookings" }),
  ).toContainText("not a confirmed appointment");
  await expect(dialog.getByRole("timer")).toHaveCount(0);
  expect(f.base.writes).toEqual([]);
});

test("offline data stops counting down and reconnect reloads the authoritative month", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T08:00:00Z") });
  const f = await calendarFixture(page);
  await page.goto("/dashboard/bookings");
  await page.getByRole("button", { name: "View calendar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "3 November 2026, 2 bookings, Confirmed, Cancelled",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("timer")).toHaveCount(1);
  await context.setOffline(true);
  await expect(dialog.getByRole("alert")).toContainText("offline");
  await expect(dialog.getByRole("timer")).toHaveCount(0);
  await context.setOffline(false);
  await expect(dialog.getByRole("timer")).toHaveCount(1);
  expect(f.base.writes).toEqual([]);
});

test("a delayed prior month cannot replace the newly selected month", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-02T08:00:00Z") });
  const f = await calendarFixture(page);
  f.state.mode = "hold";
  await page.goto("/dashboard/bookings");
  await page.getByRole("button", { name: "View calendar" }).click();
  await expect.poll(() => !!f.state.held).toBe(true);
  const releaseOld = f.state.held;
  f.state.mode = "normal";
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Next month" }).click();
  await expect(
    dialog.getByRole("button", { name: "1 December 2026, 0 bookings", exact: true }),
  ).toBeVisible();
  releaseOld?.();
  await expect(
    dialog.getByRole("heading", { name: "December 2026", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("region", { name: "Selected date bookings" }),
  ).toContainText("No bookings on this date");
  expect(f.base.writes).toEqual([]);
});

test("touch date selection opens the owned booking details", async ({
  browser,
  browserName,
}, info) => {
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    hasTouch: true,
    isMobile: browserName !== "firefox",
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-11-02T08:00:00Z") });
    const f = await calendarFixture(page);
    await page.goto("/dashboard/bookings");
    await page.getByRole("button", { name: "View calendar" }).tap();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", {
        name: "3 November 2026, 2 bookings, Confirmed, Cancelled",
        exact: true,
      })
      .tap();
    await dialog.getByRole("link", { name: "View details", exact: true }).first().tap();
    await expect(page).toHaveURL(new RegExp(`/dashboard/bookings/${bookingId(2)}$`));
    await expect(dialog).toHaveCount(0);
    expect(f.base.writes).toEqual([]);
  } finally {
    await context.close();
  }
});
