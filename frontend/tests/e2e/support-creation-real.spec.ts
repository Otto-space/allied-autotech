import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const file = process.env.SUPPORT_CREATION_SESSION_FILE;
test.skip(!file, "Requires isolated support API and explicit fixture");
for (const kind of ["enquiries", "complaints"] as const)
  for (const committed of [true, false]) {
    test(`real ${kind}: recover ${committed ? "committed response loss" : "interrupted request"}`, async ({
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
      const writes: {
        key: string;
        body: unknown;
        result?: { id: string; replayed: boolean };
      }[] = [];
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(`**/api/v1/customers/support/${kind}`, async (route) => {
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
      await page.goto("/dashboard/support");
      await expect(page).toHaveTitle(/Support|Customer care/);
      await page.getByLabel("Record category").selectOption(kind);
      const branchChoice = page.getByLabel("Handling branch");
      await expect(branchChoice).toBeEnabled();
      for (let currentPage = 1; currentPage < 50; currentPage++) {
        if (await branchChoice.locator(`option[value="${f.branchId}"]`).count()) break;
        const pages = page.getByRole("navigation", { name: "branch choices pages" });
        await pages.getByRole("button", { name: "Next", exact: true }).click();
        await expect(pages).toContainText(`Page ${currentPage + 1}`);
        await expect(branchChoice).toBeEnabled();
      }
      await page.getByLabel("Handling branch").selectOption(f.branchId);
      const subject = `Synthetic recovery ${kind} ${committed ? "committed" : "interrupted"}`;
      await page.getByLabel("Subject", { exact: true }).fill(subject);
      await page
        .getByLabel(kind === "enquiries" ? "Your message" : "Complaint details", {
          exact: true,
        })
        .fill("Original synthetic support details.");
      await page
        .getByRole("button", {
          name: kind === "enquiries" ? "Review enquiry" : "Review complaint",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: kind === "enquiries" ? "Send enquiry" : "Send complaint",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Close & review record", exact: true })
        .click();
      await page.reload();
      await page.getByLabel("Record category").selectOption(kind);
      expect(writes).toHaveLength(1);
      await page
        .getByRole("button", { name: "Review original support request", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "Original synthetic support details.",
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
            path: join(tmpdir(), `allied-support-${kind}-recovery-${width}.png`),
          });
        }
      await page
        .getByRole("button", { name: "Send or recover request", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/support/${kind}/`));
      expect(writes).toHaveLength(2);
      expect(writes[1].key).toBe(writes[0].key);
      expect(writes[1].body).toEqual(writes[0].body);
      expect(writes[1].result?.replayed).toBe(committed);
      if (committed) expect(writes[1].result?.id).toBe(writes[0].result?.id);
      await expect(
        page.getByRole("heading", { name: subject, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          (key) => sessionStorage.getItem(key),
          `aat:support-create:v1:${f.userId}:${kind}`,
        ),
      ).toBeNull();
      expect(errors).toEqual([]);
    });
  }
