import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const file = process.env.AFTERCARE_SESSION_FILE;
test.skip(!file, "Requires the isolated aftercare API and fixture");
for (const operation of ["returns", "aftercare"] as const)
  for (const committed of [true, false])
    test(`real ${operation}: ${committed ? "rejected original outside latest 100" : "request interrupted before commit"}`, async ({
      page,
    }) => {
      const fixtures = JSON.parse(readFileSync(file!, "utf8"));
      const f = fixtures.find(
        (f: { operation: string; committed: boolean }) =>
          f.operation === operation && f.committed === committed,
      );
      const base = `/customers/orders/${f.orderId}`;
      await page.context().addCookies([
        {
          name: "aat_session",
          value: f.token,
          url: process.env.PLAYWRIGHT_BASE_URL!,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const writes: {
        key: string;
        body: unknown;
        result?: { id: string; replayed: boolean };
      }[] = [];
      await page.route(`**/api/v1${base}/${operation}`, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const write: (typeof writes)[number] = {
          key: route.request().headers()["idempotency-key"],
          body: route.request().postDataJSON(),
        };
        writes.push(write);
        if (!committed && writes.length === 1) return route.abort("connectionreset");
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        write.result = (await response.json()).data;
        if (writes.length === 1) return route.abort("connectionreset");
        await route.fulfill({ response });
      });
      await page.goto(`/dashboard/orders/${f.orderId}/aftercare`);
      await expect(page).toHaveTitle(/Aftercare|Returns|Order/);
      await expect(
        page.getByRole("button", { name: "Review order request", exact: true }),
      ).toBeEnabled();
      await page
        .getByLabel("Request type", { exact: true })
        .selectOption(operation === "returns" ? "RETURN" : "CANCELLATION");
      await page.getByLabel("Products to review").selectOption("ALL");
      await page
        .getByLabel("Reason for your request")
        .fill("Original synthetic request retained for recovery.");
      await page
        .getByRole("button", { name: "Review order request", exact: true })
        .click();
      await page.getByRole("button", { name: "Send order request", exact: true }).click();
      await page
        .getByRole("button", { name: "Close & review record", exact: true })
        .click();
      if (committed) {
        const backend = resolve("../backend");
        execFileSync(
          process.execPath,
          [
            join(backend, "node_modules/tsx/dist/cli.mjs"),
            "tests/helpers/aftercare-browser-control.ts",
            "reject",
            operation,
          ],
          {
            cwd: backend,
            env: {
              ...process.env,
              RUN_AFTERCARE_BROWSER_TESTS: "true",
              TEST_DB_NAME: "allied_preferences_20261013_test",
              DB_HOST: "127.0.0.1",
            },
            stdio: "pipe",
          },
        );
      }
      await page.reload();
      expect(writes).toHaveLength(1);
      if (committed) {
        const history = (
          await (await page.request.get(`/api/v1${base}/aftercare`)).json()
        ).data;
        expect(history).toHaveLength(100);
        expect(history.some((r: { id: string }) => r.id === writes[0].result?.id)).toBe(
          false,
        );
      }
      await page
        .getByRole("button", { name: "Review original request", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "Original synthetic request retained for recovery.",
      );
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
          await page.screenshot({
            path: join(tmpdir(), `allied-aftercare-${operation}-recovery-${width}.png`),
          });
        }
      await page
        .getByRole("button", { name: "Send or recover request", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(/Original order request confirmed/)).toBeVisible();
      expect(writes).toHaveLength(2);
      expect(writes[1].key).toBe(writes[0].key);
      expect(writes[1].body).toEqual(writes[0].body);
      expect(writes[1].result?.replayed).toBe(committed);
      if (committed) expect(writes[1].result?.id).toBe(writes[0].result?.id);
      expect(
        await page.evaluate(
          (key) => sessionStorage.getItem(key),
          `aat:aftercare-create:v1:${f.userId}:${f.orderId}`,
        ),
      ).toBeNull();
      expect(errors).toEqual([]);
    });
