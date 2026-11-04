import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures/overview-browser";
import { overviewFixture } from "../fixtures/overview";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
const id = (n: number) => `b9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`customer attention ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width <= 430,
      hasTouch: width <= 768,
      reducedMotion: "reduce",
    });
    test("owned next steps, settled refresh and account change remain distinct from history", async ({
      page,
    }, info) => {
      const state = await fixture(page, "CUSTOMER");
      const empty = overviewFixture("CUSTOMER", undefined, true).care!;
      const ready = {
        id: id(511),
        orderNumber: "ORD-COLLECTION-511",
        status: "READY" as const,
        fulfillmentMethod: "COLLECTION" as const,
        createdAt: "2026-11-03T12:00:00Z",
      };
      state.care = {
        ...empty,
        firstName: "Chiamaka-Anne",
        collectionOrder: ready,
        order: ready,
        enquiry: {
          id: id(512),
          subject: "My replacement-part question with a deliberately long reference",
          status: "IN_PROGRESS",
          updatedAt: "2026-11-03T12:00:00Z",
        },
        invoice: {
          id: id(513),
          invoiceNumber: "INV-OWN-513",
          currency: "NGN",
          totalKobo: "9007199254740993",
          issuedAt: "2026-11-03T12:00:00Z",
        },
      };
      const errors: string[] = [];
      const writes: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().includes("/api/v1/") && !["GET", "HEAD"].includes(r.method()))
          writes.push(r.method());
      });
      await page.route("**/api/v1/public/capabilities", (r) =>
        r.fulfill({
          json: {
            success: true,
            message: "Isolated",
            meta: { requestId: "attention" },
            data: publicCapabilitiesFixture("browse_enquiries"),
          },
        }),
      );
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Welcome, Chiamaka-Anne." }),
      ).toBeVisible();
      await expect(page.locator(".care-attention")).toBeVisible();
      expect(
        await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      ).toEqual({ width, height });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await expect(
        page.getByRole("heading", { name: "Latest order", exact: true }),
      ).toHaveCount(0);
      const attention = await page.locator(".care-attention").boundingBox();
      const history = await page.locator(".customer-history > summary").boundingBox();
      expect(attention!.y + attention!.height).toBeLessThan(history!.y);
      for (const [name, path] of [
        ["View collection order", `/dashboard/orders/${id(511)}`],
        ["View enquiry", `/dashboard/support/enquiries/${id(512)}`],
        ["View invoice", `/dashboard/invoices/${id(513)}`],
      ]) {
        const action = page.getByRole("link", { name, exact: true });
        await expect(action).toHaveAttribute("href", path);
        await action.focus();
        await expect(action).toBeFocused();
        const box = await action.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        const top = await page.locator(".dashboard-top").boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(top!.y + top!.height);
        const dock = await page.locator(".support-controls").boundingBox();
        expect(
          Boolean(
            dock &&
            box!.x < dock.x + dock.width &&
            box!.x + box!.width > dock.x &&
            box!.y < dock.y + dock.height &&
            box!.y + box!.height > dock.y,
          ),
        ).toBe(false);

        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      await page.locator(".overview-welcome").scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("attention-first-viewport.png") });
      await page.screenshot({
        path: info.outputPath("attention-full-page.png"),
        fullPage: true,
      });
      await page
        .locator(".care-attention")
        .screenshot({ path: info.outputPath("attention-records.png") });
      await page.locator(".customer-history > summary").click();
      await page.getByLabel("From", { exact: true }).fill("2000-01-01");
      await page.getByLabel("To", { exact: true }).fill("2000-01-02");
      await page.getByRole("button", { name: "Apply dates", exact: true }).click();
      await expect
        .poll(() => state.reads.at(-1)?.searchParams.get("from"))
        .toBe("2000-01-01");
      await expect(page.locator(".care-attention")).toContainText("INV-OWN-513");
      state.care = { ...empty, firstName: "Chiamaka-Anne" };
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(page.locator(".care-attention")).toHaveCount(0);
      await expect(
        page.getByText("No service in progress", { exact: true }),
      ).toBeVisible();
      state.userId = id(514);
      state.care = { ...empty, firstName: "Tunde" };
      await page.evaluate(() => {
        const c = new BroadcastChannel("aat-session");
        c.postMessage("changed");
        c.close();
      });
      const verify = page.getByRole("button", { name: "Verify session again" });
      await expect(verify).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Welcome, Chiamaka-Anne." }),
      ).toHaveCount(0);
      await verify.click();
      await expect(page.getByRole("heading", { name: "Welcome, Tunde." })).toBeVisible();
      await expect(page.locator("main")).not.toContainText("INV-OWN-513");
      expect(errors).toEqual([]);
      expect(writes).toEqual([]);
    });
  });
}
