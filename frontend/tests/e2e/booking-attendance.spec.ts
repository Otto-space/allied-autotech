import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { AttendanceEvent } from "../../lib/api/booking-attendance";
import { workforceBookingConfirmationFixture } from "../fixtures/workforce-booking-confirmation";
import { workforceJobDetailFixture } from "../fixtures/workforce-job-detail";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";
import { verifyConsole } from "../fixtures/preview-console";

test.beforeEach(async ({ request, page }) => bookingRuntimeCapabilities(request, page));

async function start(page: Page, width: number, mode = "normal") {
  const fixture = await workforceBookingConfirmationFixture(page);
  const booking = fixture.booking;
  booking.status = "CONFIRMED";
  booking.scheduledAt = new Date(
    Date.now() + (mode === "early" ? 10 : -20) * 60000,
  ).toISOString();
  booking.confirmedAt = new Date(Date.now() - 30 * 60000).toISOString();
  const events: AttendanceEvent[] = [];
  Object.assign(booking, { attendanceEvents: events });
  const writes: { body: Record<string, unknown>; csrf?: string }[] = [];
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  let readFailure = mode === "denied";
  let releaseRead: (() => void) | undefined;
  const held =
    mode === "slow"
      ? new Promise<void>((resolve) => {
          releaseRead = resolve;
        })
      : null;
  const snapshot = (receiptId?: string | null) => ({
    bookingId: booking.id,
    bookingVersion: booking.version,
    scheduleVersion: booking.scheduleVersion,
    status: booking.status,
    startedAt: null,
    serverTime: new Date().toISOString(),
    checkAt: new Date(Date.parse(booking.scheduledAt) + 15 * 60000).toISOString(),
    policy: { graceMinutes: 15, source: "DELEGATED_DEFAULT", policyVersionId: null },
    workReviewRequired: false,
    checkAttendance: mode !== "early" && events.length === 0,
    current: events[0] ?? null,
    events,
    receipt: events.find((event) => event.id === receiptId) ?? null,
  });
  await page.route("**/api/v1/staff/workforce/bookings/*/attendance*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const reply = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic attendance receipt",
          meta: { requestId: "attendance-dashboard-fixture" },
        },
      });
    if (request.method() === "GET") {
      if (held) await held;
      if (readFailure)
        return route.fulfill({
          status: 403,
          json: {
            success: false,
            error: { code: "FORBIDDEN" },
          },
        });
      return reply(snapshot(url.searchParams.get("receiptId")));
    }
    expect(request.method()).toBe("POST");
    const body = request.postDataJSON();
    writes.push({ body, csrf: request.headers()["x-csrf-token"] });
    expect(body.expectedVersion).toBe(booking.version);
    booking.version++;
    const event: AttendanceEvent = {
      id: body.operationId,
      kind: body.kind,
      reason: body.reason ?? "Arrival recorded by the workshop",
      createdAt: new Date().toISOString(),
      bookingVersion: booking.version,
      scheduleVersion: booking.scheduleVersion,
      graceMinutes: body.kind === "ABSENCE_CONFIRMED" ? 15 : null,
      graceSource: body.kind === "ABSENCE_CONFIRMED" ? "DELEGATED_DEFAULT" : null,
    };
    events.unshift(event);
    if (body.kind === "ABSENCE_CONFIRMED") booking.status = "NO_SHOW";
    if (mode === "lost") return route.abort("failed");
    return reply({
      event,
      performedByUserId: fixture.base.access.userId,
      attendance: snapshot(),
    });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const expected =
      ["lost", "denied"].includes(mode) &&
      message.location().url.includes("/attendance") &&
      /^Failed to load resource:/.test(message.text());
    if (message.type() === "error" && !expected) errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      /^https?:/.test(url.protocol) &&
      !["127.0.0.1", "localhost"].includes(url.hostname)
    )
      external.push(request.url());
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/admin/workforce/bookings/${booking.id}`);
  await expect(page).toHaveURL(new RegExp(`/admin/workforce/bookings/${booking.id}$`));
  await expect(page).toHaveTitle(/Allied AutoTech/);
  const panel = page.locator("#booking-attendance");
  await expect(
    panel.getByRole("heading", { name: "Arrival and attendance", exact: true }),
  ).toBeVisible();
  return {
    fixture,
    panel,
    writes,
    events,
    releaseRead,
    allowRead: () => {
      readFailure = false;
    },
    check: async () => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include("#booking-attendance")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(external).toEqual([]);
      await verifyConsole(page, errors, warnings);
    },
  };
}

for (const width of [390, 768, 1440]) {
  test(`records arrival, agreed waiting and leaving in the dashboard at ${width}px`, async ({
    page,
  }) => {
    const { fixture, panel, writes, check } = await start(page, width);
    const originalTime = fixture.booking.scheduledAt;
    await expect(panel.getByLabel("Update", { exact: true })).toBeEnabled();
    await panel.getByLabel("Update", { exact: true }).focus();
    await expect(panel.getByLabel("Update", { exact: true })).toBeFocused();
    expect(
      await panel
        .getByLabel("Update", { exact: true })
        .evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth)),
    ).toBeGreaterThan(0);
    expect(writes).toHaveLength(0);
    await panel
      .getByRole("button", { name: "Save attendance update", exact: true })
      .click();
    await expect(
      page.getByText("Attendance update saved.", { exact: true }),
    ).toBeVisible();
    for (const kind of ["WAITING", "LEFT"] as const) {
      await panel.getByLabel("Update", { exact: true }).selectOption(kind);
      await panel
        .getByLabel("Factual note", { exact: true })
        .fill(
          `Synthetic customer ${kind === "WAITING" ? "agreed to wait" : "left the workshop"}.`,
        );
      await panel
        .getByRole("button", { name: "Save attendance update", exact: true })
        .click();
      await expect(
        panel.getByText(
          `Synthetic customer ${kind === "WAITING" ? "agreed to wait" : "left the workshop"}.`,
          { exact: true },
        ),
      ).toBeVisible();
    }
    expect(writes.map((w) => w.body.kind)).toEqual(["ARRIVED", "WAITING", "LEFT"]);
    expect(writes.every((w) => Boolean(w.csrf))).toBe(true);
    expect(fixture.booking.scheduledAt).toBe(originalTime);
    expect(fixture.booking.status).toBe("CONFIRMED");
    if (width === 1440) {
      await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
      await check();
      await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
    } else {
      await page
        .getByRole("button", { name: "Open dashboard navigation", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Dashboard navigation", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Close dashboard navigation", exact: true })
        .click();
    }
    await page.screenshot({
      path: test.info().outputPath(`attendance-dashboard-${width}.png`),
      fullPage: true,
    });
    await check();
  });
}

test("requires a factual absence check and never marks missed merely because time elapsed", async ({
  page,
}) => {
  const { panel, writes, fixture, check } = await start(page, 390);
  await panel.getByLabel("Update", { exact: true }).selectOption("ABSENCE_CONFIRMED");
  const save = panel.getByRole("button", {
    name: "Confirm missed appointment",
    exact: true,
  });
  await expect(save).toBeDisabled();
  expect(fixture.booking.status).toBe("CONFIRMED");
  expect(writes).toHaveLength(0);
  await panel
    .getByLabel("Factual note", { exact: true })
    .fill("Synthetic staff verified that no arrival was recorded or observed.");
  await panel
    .getByLabel("I checked that the customer has not arrived.", { exact: true })
    .check();
  await expect(
    panel.getByText(/does not apply a fee, forfeiture or automatic refund decision/),
  ).toBeVisible();
  await save.click();
  await expect(panel.getByLabel("Update", { exact: true })).toHaveCount(0);
  await expect(
    panel.getByText("Staff verified a missed appointment", { exact: true }).first(),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  await check();
});

test("recovers a saved attendance operation across reload without retaining the note or replaying the write", async ({
  page,
}) => {
  const { panel, writes, check } = await start(page, 390, "lost");
  const note = "Synthetic attendance note stays out of browser storage.";
  await panel.getByLabel("Factual note (optional)", { exact: true }).fill(note);
  await panel
    .getByRole("button", { name: "Save attendance update", exact: true })
    .click();
  await expect(
    panel.getByText("The saved update has been found in this appointment's history.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate((note) => JSON.stringify(sessionStorage).includes(note), note),
  ).toBe(false);
  await page.reload();
  await expect(
    panel.getByText("The saved update has been found in this appointment's history.", {
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Continue with saved update", exact: true })
    .click();
  await expect(page.getByText("Saved update verified.", { exact: true })).toBeVisible();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  expect(writes).toHaveLength(1);
  await check();
});

for (const mode of ["early", "denied", "slow"])
  test(`handles ${mode} attendance without exposing an unsafe action`, async ({
    page,
  }) => {
    const { panel, writes, releaseRead, allowRead, check } = await start(page, 390, mode);
    if (mode === "slow") {
      await expect(
        panel.getByText("Checking attendance…", { exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Refresh attendance", exact: true }),
      ).toBeDisabled();
      releaseRead!();
    }
    if (mode === "denied") {
      await expect(panel.getByRole("alert")).toBeVisible();
      await expect(panel.getByLabel("Update", { exact: true })).toHaveCount(0);
      allowRead();
      await panel
        .getByRole("button", { name: "Refresh attendance", exact: true })
        .click();
    }
    await expect(panel.getByLabel("Update", { exact: true })).toBeEnabled();
    if (mode === "early")
      await expect(
        panel.getByRole("option", {
          name: "Check attendance and mark missed",
          exact: true,
        }),
      ).toHaveCount(0);
    expect(writes).toHaveLength(0);
    await check();
  });

for (const width of [390, 1440])
  test(`assigned technician records arrival from the job without a booking-confirmation grant at ${width}px`, async ({
    page,
  }) => {
    const fixture = await workforceJobDetailFixture(page);
    const job = fixture.job;
    job.status = "CONFIRMED";
    job.scheduledAt = new Date(Date.now() - 20 * 60000).toISOString();
    job.workOrder = null;
    const events: AttendanceEvent[] = [];
    job.attendanceEvents = events;
    expect(fixture.base.access.permissions).toContain("JOBS_UPDATE");
    expect(fixture.base.access.independentCapabilities ?? []).not.toContain(
      "BOOKING_CONFIRM",
    );
    let writes = 0;
    const snapshot = () => ({
      bookingId: job.id,
      bookingVersion: job.version,
      scheduleVersion: 0,
      status: job.status,
      startedAt: null,
      serverTime: new Date().toISOString(),
      checkAt: new Date(Date.parse(job.scheduledAt) + 15 * 60000).toISOString(),
      checkAttendance: events.length === 0,
      workReviewRequired: false,
      policy: { graceMinutes: 15, source: "DELEGATED_DEFAULT", policyVersionId: null },
      current: events[0] ?? null,
      events,
      receipt: null,
    });
    await page.route(
      "**/api/v1/staff/workforce/bookings/*/attendance*",
      async (route) => {
        const reply = (data: unknown) =>
          route.fulfill({
            json: {
              success: true,
              data,
              message: "Synthetic assigned-job attendance",
              meta: { requestId: "job-attendance-fixture" },
            },
          });
        if (route.request().method() === "GET") return reply(snapshot());
        const body = route.request().postDataJSON();
        expect(body.kind).toBe("ARRIVED");
        expect(body.expectedVersion).toBe(job.version);
        expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
        writes++;
        job.version++;
        const event: AttendanceEvent = {
          id: body.operationId,
          kind: "ARRIVED",
          reason: "Arrival recorded by the workshop",
          createdAt: new Date().toISOString(),
          bookingVersion: job.version,
          scheduleVersion: 0,
          graceMinutes: null,
          graceSource: null,
        };
        events.unshift(event);
        return reply({
          event,
          performedByUserId: fixture.base.access.userId,
          attendance: snapshot(),
        });
      },
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/admin/workforce/jobs/${job.id}`);
    await expect(page).toHaveURL(new RegExp(`/admin/workforce/jobs/${job.id}$`));
    const panel = page.locator("#booking-attendance");
    await panel
      .getByRole("button", { name: "Save attendance update", exact: true })
      .click();
    await expect(
      page.getByText("Attendance update saved.", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByText("Arrival recorded by the workshop", { exact: true }),
    ).toBeVisible();
    expect(writes).toBe(1);
    expect(fixture.writes).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
