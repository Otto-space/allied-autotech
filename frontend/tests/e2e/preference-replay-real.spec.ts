import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const file = process.env.PREFERENCE_SESSION_FILE;
test.skip(!file, "Requires the isolated preference API and explicit fixture");
for (const committed of [true, false])
  test(`real preference recovery after ${committed ? "commit and later withdrawal" : "request interruption"}`, async ({
    page,
  }) => {
    const f = JSON.parse(readFileSync(file!, "utf8"));
    await page.context().addCookies([
      {
        name: "aat_session",
        value: f.token,
        url: process.env.PLAYWRIGHT_BASE_URL!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const channel = committed ? "EMAIL" : "SMS";
    const writes: {
      key: string;
      body: unknown;
      result?: {
        preference: { version: number; enabled: boolean };
        appliedVersion: number;
        replayed: boolean;
      };
    }[] = [];
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(
      "**/api/v1/customers/notifications/preferences/current",
      async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        const record: {
          key: string;
          body: unknown;
          result?: {
            preference: { version: number; enabled: boolean };
            appliedVersion: number;
            replayed: boolean;
          };
        } = {
          key: route.request().headers()["idempotency-key"],
          body: route.request().postDataJSON(),
        };
        writes.push(record);
        if (!committed && writes.length === 1) return route.abort("connectionreset");
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        record.result = (await response.json()).data;
        if (writes.length === 1) return route.abort("connectionreset");
        await route.fulfill({ response });
      },
    );
    await page.goto("/dashboard/notifications");
    await expect(page).toHaveTitle(/Notifications/);
    await page
      .getByRole("button", {
        name: `Enable marketing ${channel === "EMAIL" ? "email" : "sms"}`,
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    expect(writes).toHaveLength(1);
    if (committed) {
      const csrf = (
        await (
          await page.request.post("/api/v1/auth/csrf", {
            headers: { Origin: process.env.PLAYWRIGHT_BASE_URL! },
            data: {},
          })
        ).json()
      ).data.csrfToken;
      const withdrawn = await page.request.put(
        "/api/v1/customers/notifications/preferences/current",
        {
          headers: {
            Origin: process.env.PLAYWRIGHT_BASE_URL!,
            "X-CSRF-Token": csrf,
            "Idempotency-Key": `preference-v1.${Date.now()}.${crypto.randomUUID()}`,
          },
          data: { category: "MARKETING", channel, enabled: false, expectedVersion: 1 },
        },
      );
      expect(withdrawn.status()).toBe(200);
      expect((await withdrawn.json()).data.preference).toMatchObject({
        version: 2,
        enabled: false,
      });
    }
    await page.reload();
    expect(writes).toHaveLength(1);
    await page
      .getByRole("button", { name: "Review original preference change", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Enabled");
    if (committed)
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
        await page.screenshot({ path: join(tmpdir(), `allied-preference-${width}.png`) });
      }
    await page
      .getByRole("button", { name: "Send or recover preference", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toEqual(writes[0].body);
    expect(writes[1].key).toBe(writes[0].key);
    expect(writes[1].result).toMatchObject({
      appliedVersion: 1,
      replayed: committed,
      preference: { version: committed ? 2 : 1, enabled: !committed },
    });
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Review original preference change",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
