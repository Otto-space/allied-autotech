import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const file = process.env.REVIEW_SOURCES_SESSION_FILE;
test.skip(!file, "Requires the isolated review API and explicit temporary fixture.");
for (const target of ["BUSINESS", "ORDER", "UNCOMMITTED"] as const) {
  test(`real ${target} original request recovers across reload without duplicate review`, async ({
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
      body: unknown;
      key?: string;
      result?: { id: string; replayed: boolean };
    }[] = [];
    await page.route("**/api/v1/customers/support/reviews", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const record = {
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
        result: undefined as { id: string; replayed: boolean } | undefined,
      };
      writes.push(record);
      if (target === "UNCOMMITTED" && writes.length === 1)
        return route.abort("connectionreset");
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      record.result = (await response.json()).data;
      if (writes.length === 1) return route.abort("connectionreset");
      await route.fulfill({ response });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard/reviews");
    await expect(page).toHaveTitle(/Your reviews/);
    if (target === "ORDER") {
      await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
      const source = f.sources.find(
        (source: { body: { targetType: string } }) => source.body.targetType === "ORDER",
      );
      await page.getByLabel("Completed record", { exact: true }).selectOption(source.id);
    }
    const comment = `Real ${target} review recovery after a lost response.`;
    await page.getByLabel("Rating", { exact: true }).selectOption("5");
    await page.getByLabel("Your review", { exact: true }).fill(comment);
    await page.getByRole("button", { name: "Review submission", exact: true }).click();
    await page
      .getByRole("button", { name: "Submit for moderation", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    expect(writes).toHaveLength(1);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Review submission", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Review original submission", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(comment);
    if (target === "BUSINESS") {
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
          path: join(tmpdir(), `allied-review-replay-${width}.png`),
        });
      }
    }
    await page
      .getByRole("button", { name: "Send or recover review", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes).toHaveLength(2);
    expect(writes[1].key).toBe(writes[0].key);
    expect(writes[1].body).toEqual(writes[0].body);
    expect(writes[1].result?.replayed).toBe(target !== "UNCOMMITTED");
    if (target !== "UNCOMMITTED") expect(writes[1].result?.id).toBe(writes[0].result?.id);
    const saved = (
      await (await page.request.get("/api/v1/customers/support/reviews")).json()
    ).data.items;
    expect(
      saved.filter((row: { comment: string }) => row.comment === comment),
    ).toHaveLength(1);
    await page.reload();
    await expect(page.getByRole("region", { name: "Review recovery" })).toHaveCount(0);
    await expect(page.getByLabel("Your review", { exact: true })).toHaveValue("");
    expect(errors).toEqual([]);
  });
}
