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
  await expect(page.getByRole("heading", { name: "Order details" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Physical parts collection", exact: true }),
  ).toHaveCount(0);
  expect(reads).toBe(0);
});
