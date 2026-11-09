import { ordersFixture, orderRecord } from "../fixtures/customer-orders";
import { purchaseFixture } from "../fixtures/purchase-guest";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workOrderDetailFixture, bookingId } from "../fixtures/work-order-detail";
import { verifyConsole } from "../fixtures/preview-console";
const path = `/admin/orders/${bookingId(1100)}`;
for (const width of [320, 1440])
  test(`private pickup is reviewed before a physical event and survives refresh at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
      if (message.type() === "warning") warnings.push(message.text());
    });
    const detail = await workOrderDetailFixture(page);
    detail.record = {
      ...detail.record,
      status: "READY",
      readyAt: "2026-11-09T12:00:00Z",
      pickupCapabilityVersion: 1,
      allowedTransitions: [],
    };
    const lines = detail.record.items.map((item) => ({
      orderItemId: item.id,
      quantity: item.quantity,
    }));
    const summary = {
      orderId: detail.record.id,
      version: detail.record.version,
      status: "READY",
      legacyCompleted: false,
      remaining: lines,
      handoverReview: null as { id: string; claimedAt: string } | null,
      authorisation: {
        id: bookingId(9300),
        issuedAt: "2026-11-09T12:00:00Z",
        expiresAt: "2099-11-09T12:00:00Z",
        lines,
      },
      handovers: [] as {
        id: string;
        createdAt: string;
        collectorName: string;
        lines: typeof lines;
      }[],
      hasMoreHistory: false,
    };
    const writes: { suffix: string; body: Record<string, unknown> }[] = [];
    await page.route("**/api/v1/staff/orders/*/pickup**", async (route) => {
      const req = route.request();
      const ok = (data: unknown) =>
        route.fulfill({
          json: {
            success: true,
            data,
            meta: { requestId: "synthetic-pickup" },
            message: "Synthetic pickup",
          },
        });
      if (req.method() === "GET") return ok(summary);
      expect(req.headers()["x-csrf-token"]).toBeTruthy();
      const body = req.postDataJSON();
      expect(body.expectedVersion).toBe(summary.version);
      const suffix = new URL(req.url()).pathname.split("/").at(-1)!;
      writes.push({ suffix, body });
      if (suffix === "verify") {
        expect(body.pickupCode).toBe("x".repeat(43));
        summary.version++;
        summary.handoverReview = {
          id: bookingId(9301),
          claimedAt: "2026-11-09T12:01:00Z",
        };
        return ok({
          orderId: summary.orderId,
          version: summary.version,
          claimId: bookingId(9301),
          authorisationId: bookingId(9300),
          expiresAt: summary.authorisation.expiresAt,
          financialReviewHash: "a".repeat(64),
          lines: body.lines.map((line: (typeof lines)[number]) => ({
            ...line,
            productName: detail.record.items.find((item) => item.id === line.orderItemId)!
              .productName,
          })),
          completesOrder: false,
        });
      }
      expect(suffix).toBe("handover");
      expect(body.claimId).toBe(bookingId(9301));
      expect(body.physicalHandoverConfirmed).toBe(true);
      expect(body.lines).toEqual([lines[0]]);
      summary.version++;
      summary.handoverReview = null;
      summary.remaining = [lines[1]];
      summary.handovers = [
        {
          id: bookingId(9302),
          createdAt: "2026-11-09T12:02:00Z",
          collectorName: "Synthetic collector",
          lines: [lines[0]],
        },
      ];
      detail.record.version = summary.version;
      return ok({
        id: bookingId(9302),
        orderId: summary.orderId,
        claimId: bookingId(9301),
        collectedAt: "2026-11-09T12:02:00Z",
        lines: [lines[0]],
        complete: false,
        replayed: false,
      });
    });
    await page.goto(path);
    const panel = page.getByRole("region", {
      name: "Physical parts collection",
      exact: true,
    });
    await expect(
      panel.getByText("No detailed physical handover is recorded."),
    ).toBeVisible();
    await panel.getByLabel("Brake pads (up to 1)").fill("1");
    await panel.getByLabel("Private pickup code", { exact: true }).fill("x".repeat(43));
    await panel.getByRole("button", { name: "Review pickup authorisation" }).click();
    let modal = page.getByRole("dialog", { name: "Begin this pickup review?" });
    await modal.getByRole("button", { name: "Go back" }).click();
    expect(writes).toHaveLength(0);
    await expect(panel.getByLabel("Private pickup code", { exact: true })).toHaveValue(
      "x".repeat(43),
    );
    await panel.getByRole("button", { name: "Review pickup authorisation" }).click();
    modal = page.getByRole("dialog", { name: "Begin this pickup review?" });
    await modal.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      panel.getByRole("group", { name: "Record physical handover", exact: true }),
    ).toBeVisible();
    expect(writes.map((write) => write.suffix)).toEqual(["verify"]);
    await panel.getByLabel("Collector?s name").fill("Synthetic collector");
    await panel
      .getByLabel("Verification note")
      .fill("Synthetic authority and actual goods checked; no ID number stored");
    await panel
      .getByLabel("These exact goods have physically been handed over to this collector.")
      .check();
    await panel.getByRole("button", { name: "Review handover record" }).click();
    modal = page.getByRole("dialog", { name: "Record goods physically handed over?" });
    await expect(modal).toContainText("Brake pads");
    await modal.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      panel.getByText(
        "Physical handover recorded. Remaining quantities are shown below.",
      ),
    ).toBeVisible();
    expect(writes.map((write) => write.suffix)).toEqual(["verify", "handover"]);
    await page.reload();
    await expect(panel).toContainText("Engine oil ? 1 remaining");
    await expect(panel).toContainText("Synthetic collector");
    await expect(panel.getByLabel("Private pickup code", { exact: true })).toHaveValue(
      "",
    );
    await expect(panel).not.toContainText("x".repeat(43));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page })
          .include(`[aria-labelledby="${await panel.getAttribute("aria-labelledby")}"]`)
          .analyze()
      ).violations,
    ).toEqual([]);
    await panel.screenshot({ path: info.outputPath(`private-pickup-${width}.png`) });
    await verifyConsole(page, errors, warnings);
  });
test("older backend does not expose pickup controls or make unsupported reads", async ({
  page,
}) => {
  const detail = await workOrderDetailFixture(page);
  detail.record.status = "READY";
  detail.record.allowedTransitions = [];
  let reads = 0;
  await page.route("**/api/v1/staff/orders/*/pickup**", async (route) => {
    reads++;
    await route.abort();
  });
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: detail.record.orderNumber, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Physical parts collection", exact: true }),
  ).toHaveCount(0);
  expect(reads).toBe(0);
});

for (const audience of ["customer", "guest"] as const)
  test(`${audience} pickup shows a secret once and keeps it out of refresh and browser storage`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const guest = audience === "guest" ? await purchaseFixture(page) : null;
    if (!guest) await ordersFixture(page);
    const record = {
      ...(guest?.order ?? orderRecord(1, "READY")),
      status: "READY",
      paidAt: "2026-11-09T12:00:00Z",
      pickupCapabilityVersion: 1,
      fulfillmentMethod: "COLLECTION",
    };
    const prefix = audience === "guest" ? "purchase" : "customers";
    const lines = record.items.map((item) => ({
      orderItemId: item.id,
      quantity: item.quantity,
    }));
    const summary = {
      orderId: record.id,
      version: record.version,
      status: "READY",
      legacyCompleted: false,
      remaining: lines,
      handoverReview: null,
      authorisation: null as null | {
        id: string;
        issuedAt: string;
        expiresAt: string;
        lines: typeof lines;
      },
      handovers: [],
      hasMoreHistory: false,
    };
    const writes: unknown[] = [];
    await page.route(`**/api/v1/${prefix}/orders/${record.id}**`, async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      const ok = (data: unknown) =>
        route.fulfill({
          json: {
            success: true,
            data,
            message: "Synthetic owned pickup",
            meta: { requestId: "synthetic-pickup" },
          },
        });
      if (!url.pathname.includes("/pickup")) return ok(record);
      if (req.method() === "GET") return ok(summary);
      const body = req.postDataJSON();
      writes.push(body);
      expect(req.headers()["x-csrf-token"]).toBeTruthy();
      expect(body.expectedVersion).toBe(summary.version);
      summary.version++;
      record.version = summary.version;
      summary.authorisation = {
        id: bookingId(9500),
        issuedAt: "2026-11-09T12:00:00Z",
        expiresAt: "2099-11-09T12:00:00Z",
        lines: body.lines,
      };
      return ok({
        orderId: record.id,
        authorisationId: bookingId(9500),
        pickupCode: "x".repeat(43),
        expiresAt: "2099-11-09T12:00:00Z",
        replayed: false,
      });
    });
    if (audience === "customer")
      await page.route("**/api/v1/auth/csrf", (route) =>
        route.fulfill({
          json: {
            success: true,
            data: { csrfToken: "c".repeat(43) },
            meta: { requestId: "synthetic-csrf" },
          },
        }),
      );
    await page.goto(
      audience === "guest"
        ? `/purchase/orders/${record.id}`
        : `/dashboard/orders/${record.id}`,
    );
    const panel = page.getByRole("region", { name: "Collect your parts", exact: true });
    await expect(panel).toBeVisible();
    await panel.getByRole("spinbutton").first().fill("1");
    await panel.getByRole("button", { name: "Create pickup code", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Create a private pickup code?" });
    await expect(modal).toContainText("shown once");
    expect(writes).toHaveLength(0);
    await modal.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(panel.locator("code")).toHaveText("x".repeat(43));
    expect(writes).toHaveLength(1);
    expect(
      await page.evaluate(
        () =>
          location.href + JSON.stringify(localStorage) + JSON.stringify(sessionStorage),
      ),
    ).not.toContain("x".repeat(43));
    await panel.getByRole("button", { name: "Hide code", exact: true }).click();
    await expect(panel.locator("code")).toHaveCount(0);
    await page.reload();
    await expect(panel).toBeVisible();
    await expect(panel.locator("code")).toHaveCount(0);
    expect(writes).toHaveLength(1);
  });

test("collection contact failures cannot create a deadline and extensions preserve the original date", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const detail = await workOrderDetailFixture(page);
  detail.record = {
    ...detail.record,
    status: "READY",
    readyAt: "2026-11-02T08:00:00Z",
    pickupCapabilityVersion: 1,
    allowedTransitions: [],
  };
  const summary = {
    orderId: detail.record.id,
    version: detail.record.version,
    status: "READY",
    legacyCompleted: false,
    remaining: detail.record.items.map((item) => ({
      orderItemId: item.id,
      quantity: item.quantity,
    })),
    handoverReview: null,
    authorisation: null,
    handovers: [],
    hasMoreHistory: false,
    collectionHoldCapabilityVersion: 1,
    holding: {
      state: "PENDING",
      notifiedAt: null as string | null,
      originalCollectByDate: null as string | null,
      collectByDate: null as string | null,
      extendedAt: null as string | null,
      pendingReason: "NOTIFICATION_REQUIRED" as string | null,
      latestNotificationAttempt: null as null | { kind: string; createdAt: string },
    },
  };
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/v1/staff/orders/*/pickup**", async (route) => {
    const req = route.request(),
      ok = (data: unknown) =>
        route.fulfill({
          json: {
            success: true,
            data,
            meta: { requestId: "synthetic-hold" },
            message: "Synthetic hold",
          },
        });
    if (req.method() === "GET") return ok(summary);
    const body = req.postDataJSON();
    writes.push(body);
    expect(body.expectedVersion).toBe(summary.version);
    expect(req.headers()["x-csrf-token"]).toBeTruthy();
    summary.version++;
    detail.record.version = summary.version;
    if (new URL(req.url()).pathname.endsWith("/contact")) {
      expect(body.actualContactResultConfirmed).toBe(true);
      summary.holding.latestNotificationAttempt = {
        kind: body.outcome,
        createdAt: "2026-11-02T09:00:00Z",
      };
      if (body.outcome === "NOTIFIED")
        Object.assign(summary.holding, {
          state: "HOLDING",
          notifiedAt: "2026-11-02T09:00:00Z",
          originalCollectByDate: "2026-11-07",
          collectByDate: "2026-11-07",
          pendingReason: null,
        });
    } else {
      expect(new URL(req.url()).pathname).toContain("/extend-hold");
      summary.holding.collectByDate = String(body.collectByDate);
      summary.holding.extendedAt = "2026-11-03T09:00:00Z";
    }
    return ok(summary);
  });
  await page.goto(path);
  const panel = page.getByRole("region", {
    name: "Physical parts collection",
    exact: true,
  });
  await expect(panel).toContainText("A collection deadline is not set");
  const contact = panel.getByRole("group", {
    name: "Record actual collection contact",
    exact: true,
  });
  await contact
    .getByLabel("Internal contact note")
    .fill("Synthetic phone attempt went unanswered");
  await contact
    .getByLabel("I confirm this is the contact result that actually occurred.")
    .check();
  await contact.getByRole("button", { name: "Review contact result" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(panel).toContainText("The latest contact attempt failed");
  await expect(panel).toContainText("A collection deadline is not set");
  await contact.getByLabel("Actual result").selectOption("NOTIFIED");
  await contact
    .getByLabel("Internal contact note")
    .fill("Synthetic successful phone conversation confirmed readiness");
  await contact.getByRole("button", { name: "Review contact result" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(panel).toContainText("Collect by 7 November 2026");
  const extension = panel.getByRole("group", {
    name: "Extend collection holding",
    exact: true,
  });
  await extension.getByLabel("New collect-by date (Nigeria time)").fill("2026-11-14");
  await extension
    .getByLabel("Internal extension reason")
    .fill("Synthetic agreed later collection; goods retained");
  await extension.getByRole("button", { name: "Review holding extension" }).click();
  await expect(page.getByRole("dialog")).toContainText("2026-11-14");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(panel).toContainText("Collect by 14 November 2026");
  await expect(panel).toContainText("Extended from 2026-11-07");
  await page.reload();
  await expect(panel).toContainText("Collect by 14 November 2026");
  expect(writes).toHaveLength(3);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
});
