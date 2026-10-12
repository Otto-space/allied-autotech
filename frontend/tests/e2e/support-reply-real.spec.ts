import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const file = process.env.SUPPORT_REPLY_SESSION_FILE;
test.skip(!file, "Requires the isolated support reply API and fixture");
for (const kind of ["enquiry", "complaint"] as const)
  for (const committed of [true, false])
    test(`real ${kind}: ${committed ? "closed conversation and later-page saved reply" : "request interrupted before commit"}`, async ({
      page,
    }) => {
      const fixtures = JSON.parse(readFileSync(file!, "utf8"));
      const f = fixtures.find(
        (f: { kind: string; committed: boolean }) =>
          f.kind === kind && f.committed === committed,
      );
      const plural = kind === "enquiry" ? "enquiries" : "complaints";
      const base = `/customers/support/${plural}/${f.recordId}`;
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
      await page.route(`**/api/v1${base}/messages`, async (route) => {
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
      await page.goto(`/dashboard/support/${plural}/${f.recordId}`);
      await expect(page).toHaveTitle(/Support|Enquiry|Complaint|Conversation/);
      await expect(
        page.getByRole("button", { name: "Review reply", exact: true }),
      ).toBeEnabled();
      await page
        .getByLabel("Reply text", { exact: true })
        .fill("Original synthetic reply retained for recovery.");
      await page.getByRole("button", { name: "Review reply", exact: true }).click();
      await page.getByRole("button", { name: "Send reply", exact: true }).click();
      await page
        .getByRole("button", { name: "Close & review record", exact: true })
        .click();
      if (committed) {
        const first = (
          await (await page.request.get(`/api/v1${base}/messages?limit=50`)).json()
        ).data;
        expect(first.hasMore).toBe(true);
        expect(
          first.items.some((m: { id: string }) => m.id === writes[0].result?.id),
        ).toBe(false);
        const backend = resolve("../backend");
        execFileSync(
          process.execPath,
          [
            join(backend, "node_modules/tsx/dist/cli.mjs"),
            "tests/helpers/support-reply-browser-control.ts",
            "close",
            kind,
          ],
          {
            cwd: backend,
            env: {
              ...process.env,
              RUN_SUPPORT_REPLY_BROWSER_TESTS: "true",
              TEST_DB_NAME: "allied_preferences_20261013_test",
              DB_HOST: "127.0.0.1",
            },
            stdio: "pipe",
          },
        );
      }
      await page.reload();
      expect(writes).toHaveLength(1);
      if (committed)
        await expect(
          page.getByText("This record is closed. The reply form is unavailable."),
        ).toBeVisible();
      await page
        .getByRole("button", { name: "Review original reply", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "Original synthetic reply retained for recovery.",
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
            path: join(tmpdir(), `allied-support-${kind}-reply-recovery-${width}.png`),
          });
        }
      await page
        .getByRole("button", { name: "Send or recover reply", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(/Original reply confirmed/)).toBeVisible();
      expect(writes).toHaveLength(2);
      expect(writes[1].key).toBe(writes[0].key);
      expect(writes[1].body).toEqual(writes[0].body);
      expect(writes[1].result?.replayed).toBe(committed);
      if (committed) expect(writes[1].result?.id).toBe(writes[0].result?.id);
      expect(
        await page.evaluate(
          (key) => sessionStorage.getItem(key),
          `aat:support-reply:v1:${f.userId}:${plural}:${f.recordId}`,
        ),
      ).toBeNull();
      expect(errors).toEqual([]);
    });
