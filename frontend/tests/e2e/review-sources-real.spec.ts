import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const file = process.env.REVIEW_SOURCES_SESSION_FILE;
test.skip(!file, "Requires an explicitly provisioned isolated review-source API.");
const fixture = () =>
  JSON.parse(readFileSync(file!, "utf8")) as {
    token: string;
    sources: { id: string; body: { targetType: string } }[];
    race: { id: string; body: Record<string, unknown> };
    paging: { token: string; ids: string[] };
  };
async function login(page: Page, token: string) {
  await page.context().addCookies([
    {
      name: "aat_session",
      value: token,
      url: process.env.PLAYWRIGHT_BASE_URL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function compose(page: Page, target: string, id: string) {
  await page.getByLabel("Review type", { exact: true }).selectOption(target);
  await page.getByLabel("Completed record", { exact: true }).selectOption(id);
  await page.getByLabel("Rating", { exact: true }).selectOption("5");
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Isolated browser review source acceptance.");
  await page.getByRole("button", { name: "Review submission", exact: true }).click();
}

test("real owned sources create one review per target and disappear from eligibility", async ({
  page,
}) => {
  const f = fixture();
  await login(page, f.token);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard/reviews");
  await expect(page).toHaveTitle(/Your reviews/);
  await expect(
    page.getByRole("heading", { name: "Write a review", exact: true }),
  ).toBeVisible();
  for (const source of f.sources) {
    await compose(page, source.body.targetType, source.id);
    await page
      .getByRole("button", { name: "Submit for moderation", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const lookup = await page.request.get(
      `/api/v1/customers/support/review-sources?targetType=${source.body.targetType}&sourceId=${source.id}`,
    );
    expect(lookup.status()).toBe(200);
    expect((await lookup.json()).data.items).toEqual([]);
  }
  const history = (
    await (await page.request.get("/api/v1/customers/support/reviews")).json()
  ).data.items;
  expect(history).toHaveLength(4);
  expect(errors).toEqual([]);
});

test("real competing submission invalidates a selected source before the browser POST", async ({
  page,
}) => {
  const f = fixture();
  await login(page, f.token);
  await page.goto("/dashboard/reviews");
  await compose(page, "ORDER", f.race.id);
  const csrf = await page.request.post("/api/v1/auth/csrf", {
    headers: { Origin: process.env.PLAYWRIGHT_BASE_URL! },
    data: {},
  });
  const saved = await page.request.post("/api/v1/customers/support/reviews", {
    headers: {
      Origin: process.env.PLAYWRIGHT_BASE_URL!,
      "X-CSRF-Token": (await csrf.json()).data.csrfToken,
      "Idempotency-Key": `review-v1.${Date.now()}.${crypto.randomUUID()}`,
    },
    data: f.race.body,
  });
  expect(saved.status()).toBe(201);
  let posts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/customers/support/reviews")
    )
      posts++;
  });
  await page.getByRole("button", { name: "Submit for moderation", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(posts).toBe(0);
  await expect(page.getByLabel("Your review", { exact: true })).toHaveValue(
    "Isolated browser review source acceptance.",
  );
});

test("real source collection pages 20 plus 2 with accessible desktop and mobile views", async ({
  page,
}) => {
  const f = fixture();
  await login(page, f.paging.token);
  await page.goto("/dashboard/reviews");
  await page.getByLabel("Review type", { exact: true }).selectOption("ORDER");
  const picker = page.getByLabel("Completed record", { exact: true });
  await expect(picker.locator("option")).toHaveCount(21);
  const ids = await picker
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
    );
  expect(ids).toEqual(f.paging.ids.slice(0, 20));
  await page
    .getByRole("navigation", { name: "Completed records pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(picker.locator("option")).toHaveCount(3);
  expect(
    await picker
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      ),
  ).toEqual(f.paging.ids.slice(20));
  const selected = f.paging.ids[21];
  await picker.selectOption(selected);
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Draft from a later source page.");
  // A legacy draft or changed page context must not be needed to resolve the ID.
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (!key.startsWith("aat:form-draft:v1:") || !key.includes("review-create-form:2"))
        continue;
      const fields = JSON.parse(sessionStorage.getItem(key)!);
      delete fields["draft-page:Completed records:0"];
      sessionStorage.setItem(key, JSON.stringify(fields));
    }
  });
  const restoredLookup = page.waitForResponse(
    (response) =>
      response.url().includes(`review-sources?targetType=ORDER&sourceId=${selected}`) &&
      response.status() === 200,
  );
  await page.reload();
  await restoredLookup;
  await expect(
    page.getByRole("navigation", { name: "Completed records pages" }),
  ).toContainText("Page 1");
  await expect(page.getByLabel("Completed record", { exact: true })).toHaveValue(
    selected,
  );
  await expect(page.getByLabel("Your review", { exact: true })).toHaveValue(
    "Draft from a later source page.",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: join(tmpdir(), `allied-review-sources-${width}.png`),
      fullPage: true,
    });
  }
});
