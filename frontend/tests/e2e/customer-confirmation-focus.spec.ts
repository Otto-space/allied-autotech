import { expect, test, type Page } from "@playwright/test";
import { privacyFixture } from "../fixtures/customer-privacy";
import { customerReviewsFixture } from "../fixtures/customer-reviews";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";

type Journey = "privacy" | "reviews";
async function setup(page: Page, journey: Journey) {
  const outgoing: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (!["GET", "HEAD"].includes(route.request().method())) {
      outgoing.push(new URL(route.request().url()).pathname);
      return route.abort();
    }
    return route.fallback();
  });
  const fixture = await (journey === "privacy"
    ? privacyFixture(page)
    : customerReviewsFixture(page));
  await page.route("**/api/v1/public/capabilities", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Isolated capabilities",
        meta: { requestId: "confirmation-fixture" },
        data: { ...publicCapabilitiesFixture(), serverTime: new Date().toISOString() },
      },
    }),
  );
  const state = {
    failRead: false,
    rejectWrite: false,
    rejectedWrites: 0,
    release: undefined as (() => void) | undefined,
  };
  await page.route(
    journey === "privacy"
      ? "**/api/v1/customers/privacy-requests*"
      : "**/api/v1/customers/support/reviews*",
    async (route) => {
      if (route.request().method() === "POST" && state.rejectWrite) {
        state.rejectedWrites++;
        return route.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      }
      if (route.request().method() === "GET" && fixture.writes.length > 0) {
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
        if (state.failRead)
          return route.fulfill({
            status: 503,
            json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
          });
      }
      return route.fallback();
    },
  );
  await page.goto(`/dashboard/${journey}`);
  const opener = page.getByRole("button", {
    name: journey === "privacy" ? "Review privacy request" : "Review submission",
    exact: true,
  });
  await expect(opener).toBeEnabled();
  if (journey === "privacy") {
    await page.getByLabel("Request type", { exact: true }).selectOption("ANONYMIZATION");
    await page
      .getByLabel("Why are you making this request?")
      .fill("Please review the personal information connected with my account.");
  } else {
    await page.getByLabel("Rating", { exact: true }).selectOption("4");
    await page
      .getByLabel("Your review", { exact: true })
      .fill("Clear advice and careful work.");
  }
  await opener.focus();
  await opener.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const submit = async () => {
    await dialog
      .getByRole("button", {
        name: journey === "privacy" ? "Send privacy request" : "Submit for moderation",
        exact: true,
      })
      .click();
  };
  return { state, fixture, opener, dialog, submit, outgoing, errors };
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
  test.describe(`customer confirmation ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      hasTouch: width <= 430,
      reducedMotion: "reduce",
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
    });
    for (const journey of ["privacy", "reviews"] as const) {
      test(`${journey} centers, cancels and returns focus after delayed history`, async ({
        page,
      }, info) => {
        const { state, fixture, opener, dialog, submit, outgoing, errors } = await setup(
          page,
          journey,
        );
        expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
          width,
          height,
        ]);
        const box = (await dialog.boundingBox())!;
        expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(1);
        if (width <= 430) expect(box.width).toBe(width);
        expect(box.height).toBeLessThanOrEqual(height - 24);
        expect(
          await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
        ).toBe(true);
        await expect(
          dialog.getByRole("button", { name: "Go back", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(opener).toBeFocused();
        expect(fixture.writes).toHaveLength(0);
        await opener.press("Enter");
        if (width === 320 || width === 1280)
          await page.screenshot({
            path: info.outputPath(`${journey}-${width}-confirmation.png`),
          });
        await submit();
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => typeof state.release).toBe("function");
        await expect(opener).toBeDisabled();
        state.release!();
        await expect(opener).toBeFocused();
        await expect(opener).toBeEnabled();
        expect(fixture.writes).toHaveLength(1);
        expect(outgoing).toEqual([]);
        expect(errors).toEqual([]);
        if (width === 320 || width === 1280)
          await page.screenshot({
            path: info.outputPath(`${journey}-${width}-saved.png`),
          });
      });
    }
  });
}

test.describe("customer confirmation recovery", () => {
  test.use({
    viewport: { width: 320, height: 720 },
    hasTouch: true,
    isMobile: async ({ browserName }, provide) => {
      await provide(browserName !== "firefox");
    },
  });
  for (const outcome of ["settled read", "failed read", "moved focus"] as const) {
    test(`review replay respects ${outcome} when its opener disappears`, async ({
      page,
    }) => {
      const { state, fixture, dialog, submit, outgoing, errors } = await setup(
        page,
        "reviews",
      );
      if (!("dropCommitted" in fixture)) throw new Error("Review fixture required");
      const previousCount = fixture.rows.length;
      fixture.dropCommitted = true;
      await submit();
      await expect(
        dialog.getByRole("button", { name: "Close & review record", exact: true }),
      ).toBeEnabled();
      await page.keyboard.press("Escape");
      const recoveryOpener = page.getByRole("button", {
        name: "Review original submission",
        exact: true,
      });
      await recoveryOpener.focus();
      await recoveryOpener.press("Enter");
      await page.keyboard.press("Escape");
      await expect(recoveryOpener).toBeFocused();
      expect(fixture.writes).toHaveLength(1);
      fixture.dropCommitted = false;
      state.failRead = outcome === "failed read";
      await recoveryOpener.press("Enter");
      await dialog
        .getByRole("button", { name: "Send or recover review", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => typeof state.release).toBe("function");
      await expect(recoveryOpener).toHaveCount(0);
      const link = page.getByRole("link", { name: "Read public reviews", exact: true });
      if (outcome === "moved focus") await link.focus();
      state.release!();
      if (outcome === "moved focus") await expect(link).toBeFocused();
      else
        await expect(
          page.getByRole("heading", { name: "Your submissions", exact: true }),
        ).toBeFocused();
      if (outcome === "failed read")
        await expect(
          page.getByRole("button", { name: "Review submission", exact: true }),
        ).toBeDisabled();
      expect(fixture.writes).toHaveLength(2);
      expect(fixture.writes[1].key).toBe(fixture.writes[0].key);
      expect(fixture.writes[1].body).toEqual(fixture.writes[0].body);
      expect(fixture.rows).toHaveLength(previousCount + 1);
      expect(outgoing).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
  for (const journey of ["privacy", "reviews"] as const) {
    test(`${journey} unknown outcome returns focus to recovery without resubmitting`, async ({
      page,
    }) => {
      const { fixture, opener, dialog, submit, outgoing, errors } = await setup(
        page,
        journey,
      );
      if ("outcome" in fixture) fixture.outcome = "unknown";
      else fixture.unknown = true;
      await submit();
      await expect(
        dialog.getByRole("button", { name: "Close & review record", exact: true }),
      ).toBeEnabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      const recovery = page.getByRole("region", {
        name: journey === "privacy" ? "Request recovery" : "Review recovery",
        exact: true,
      });
      await expect(recovery).toBeFocused();
      await expect(opener).toBeDisabled();
      await expect(
        page.getByLabel(
          journey === "privacy" ? "Why are you making this request?" : "Your review",
          { exact: true },
        ),
      ).not.toHaveValue("");
      await page.keyboard.press("Tab");
      await expect(
        recovery.getByRole("button", {
          name:
            journey === "privacy"
              ? "Refresh privacy requests"
              : "Review original submission",
          exact: true,
        }),
      ).toBeFocused();
      expect(fixture.writes).toHaveLength(1);
      expect(outgoing).toEqual([]);
      expect(errors).toEqual([]);
    });
    for (const outcome of ["failed read", "moved focus"] as const) {
      test(`${journey} respects ${outcome} after saving`, async ({ page }) => {
        const { state, fixture, opener, dialog, submit, outgoing, errors } = await setup(
          page,
          journey,
        );
        state.failRead = outcome === "failed read";
        await submit();
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => typeof state.release).toBe("function");
        const link = page.getByRole("link", {
          name: journey === "privacy" ? "Manage your profile" : "Read public reviews",
          exact: true,
        });
        if (outcome === "moved focus") await link.focus();
        state.release!();
        if (outcome === "failed read") {
          await expect(
            page.getByRole("heading", {
              name: journey === "privacy" ? "Your requests" : "Your submissions",
              exact: true,
            }),
          ).toBeFocused();
          await expect(opener).toBeDisabled();
        } else {
          await expect(opener).toBeEnabled();
          await expect(link).toBeFocused();
        }
        expect(fixture.writes).toHaveLength(1);
        expect(outgoing).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
    test(`${journey} rejected submission stays reviewable without clearing input`, async ({
      page,
    }) => {
      const { state, fixture, opener, dialog, submit, outgoing, errors } = await setup(
        page,
        journey,
      );
      state.rejectWrite = true;
      await submit();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Go back", exact: true }),
      ).toBeEnabled();
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
      await expect(
        page.getByLabel(
          journey === "privacy" ? "Why are you making this request?" : "Your review",
          { exact: true },
        ),
      ).not.toHaveValue("");
      expect(state.rejectedWrites).toBe(1);
      expect(fixture.writes).toHaveLength(0);
      expect(outgoing).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});
