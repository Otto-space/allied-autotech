import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerSupportFixture } from "../fixtures/customer-support";

type State = Awaited<ReturnType<typeof customerSupportFixture>>;
const thread = (state: State, kind: "enquiries" | "complaints" = "enquiries") =>
  `/dashboard/support/${kind}/${state.records[kind].id}`;
const marker = (state: State, kind = "enquiries") =>
  `aat:support-reply:v1:${state.userId}:${kind}:${state.records[kind as "enquiries" | "complaints"].id}`;
async function ready(page: Page) {
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
}
async function review(page: Page, text = "Please confirm my follow-up.") {
  await ready(page);
  await page.getByLabel("Reply text", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function send(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send reply", exact: true })
    .click();
}

for (const state of ["empty", "error", "closed", "uncertain"] as const) {
  test(`conversation ${state} state is accessible`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const s = await customerSupportFixture(page);
    if (state === "empty") s.messages = [];
    if (state === "error") s.failMessages = true;
    if (state === "closed") s.records.enquiries.status = "CLOSED";
    if (state === "uncertain")
      await page.addInitScript(
        (key) => sessionStorage.setItem(key, "pending"),
        marker(s),
      );
    await page.goto(thread(s));
    if (state === "empty")
      await expect(page.getByText("No replies on this page.")).toBeVisible();
    if (state === "error") {
      await expect(page.locator(".ct-message-content").getByRole("alert")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Review reply", exact: true }),
      ).toBeDisabled();
    }
    if (state === "closed")
      await expect(
        page.getByText("This record is closed. The reply form is unavailable."),
      ).toBeVisible();
    if (state === "uncertain")
      await expect(
        page.getByRole("heading", { name: "Reply needs checking" }),
      ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test("loading messages never appear as an empty conversation", async ({ page }) => {
  const s = await customerSupportFixture(page);
  s.delayMessages = true;
  await page.goto(thread(s));
  await expect(page.getByText("Checking messages…")).toBeVisible();
  await expect(page.getByText("No replies on this page.")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeDisabled();
  s.delayMessages = false;
  s.releaseMessages.forEach((release) => release());
  await ready(page);
});

test("stale record blocks a reviewed reply and preserves existing content", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  await page.goto(thread(s));
  await review(page);
  // A temporary background failure, rather than a permission revocation.
  await page.route(
    `**/api/v1/customers/support/enquiries/${s.records.enquiries.id}`,
    (route) =>
      route.fulfill({
        status: 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText(
      "Record details may be out of date. Refresh the record before replying.",
    ),
  ).toBeAttached();
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(s.writes).toHaveLength(0);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`conversation fits ${width}px with readable owned breadcrumb`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const s = await customerSupportFixture(page);
    s.records.enquiries.subject =
      "A long service question about my vehicle and the agreed workshop follow-up ".repeat(
        2,
      );
    await page.goto(thread(s));
    await ready(page);
    const trail = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(trail.locator("ol")).toHaveCount(1);
    await expect(trail.locator('[aria-current="page"]')).toHaveText(
      s.records.enquiries.subject,
    );
    await expect(
      trail.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveAttribute("href", "/dashboard");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.getByText("private@example.test")).toHaveCount(0);
  });
}
for (const width of [390, 768, 1280, 1440]) {
  test(`conversation and reply confirmation are accessible at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const s = await customerSupportFixture(page);
    await page.goto(thread(s));
    await ready(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await review(page);
    await expect(
      page.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Review reply", exact: true }),
    ).toBeFocused();
    expect(s.writes).toHaveLength(0);
  });
}
test("unknown reply survives reload and needs successful manual message review", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  s.unknown = true;
  await page.goto(thread(s));
  await review(page, "Please keep this uncertain draft.");
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Reply needs checking" })).toBeVisible();
  // Legacy markers still require explicit history reconciliation.
  await page.evaluate((key) => sessionStorage.setItem(key, "pending"), marker(s));
  await page.reload();
  await expect(page.getByLabel("Reply text")).toHaveValue(
    "Please keep this uncertain draft.",
  );
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeDisabled();
  const ack = page.getByRole("button", { name: "I have checked the conversation" });
  await expect(ack).toBeDisabled();
  await page.getByRole("button", { name: "Refresh messages", exact: true }).click();
  await expect(ack).toBeEnabled();
  await ack.click();
  await ready(page);
  expect(s.writes).toHaveLength(1);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker(s))).toBeNull();
});
test("failed manual refresh cannot be acknowledged after background success", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  await page.addInitScript((key) => sessionStorage.setItem(key, "pending"), marker(s));
  await page.goto(thread(s));
  await expect(page.getByText("Isolated reply 10", { exact: true })).toBeVisible();
  s.failMessages = true;
  s.failMessagesStatus = 503;
  await page.getByRole("button", { name: "Refresh messages", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh messages", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("Isolated reply 10", { exact: true })).toHaveCount(0);
  s.failMessages = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Isolated reply 10", { exact: true })).toBeVisible();
  const ack = page.getByRole("button", { name: "I have checked the conversation" });
  await expect(ack).toBeDisabled();
  await page.getByRole("button", { name: "Refresh messages", exact: true }).click();
  await expect(ack).toBeEnabled();
  expect(s.writes).toHaveLength(0);
});
test("message background failure retains rows but prevents an already reviewed reply", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  await page.goto(thread(s));
  await review(page);
  s.failMessages = true;
  s.failMessagesStatus = 503;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Messages may be out of date. Refresh messages before replying."),
  ).toBeAttached();
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(s.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Isolated reply 10", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeDisabled();
  s.failMessages = false;
  await page.getByRole("button", { name: "Refresh messages", exact: true }).click();
  await ready(page);
});
test("failed later page retains Previous and returns to the first message page", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  s.hasMore = true;
  await page.goto(thread(s));
  await ready(page);
  s.failMessageCursor = true;
  s.failMessagesStatus = 503;
  const nav = page.getByRole("navigation", { name: "Conversation messages pages" });
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(nav.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
  await expect(nav.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await nav.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByText("Isolated reply 10", { exact: true })).toBeVisible();
  await ready(page);
});
for (const mode of ["account", "role", "session"] as const) {
  test(`reply preflight prevents POST after ${mode} change`, async ({ page }) => {
    const s = await customerSupportFixture(page);
    await page.goto(thread(s));
    await review(page);
    if (mode === "account") s.userId = "d5000000-0000-4000-8000-000000000777";
    if (mode === "role") s.sessionRole = "ADMIN";
    if (mode === "session") s.failSession = true;
    await send(page);
    if (mode === "session")
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    else {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Go to sign in", exact: true }),
      ).toBeVisible();
    }
    expect(s.writes).toHaveLength(0);
  });
}
test("saved reply clears only its draft and submits the exact customer body", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  await page.goto(thread(s));
  await ready(page);
  await page.getByLabel("Reply text").fill("A restored and saved reply.");
  await page.reload();
  await expect(page.getByLabel("Reply text")).toHaveValue("A restored and saved reply.");
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await send(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(s.writes).toHaveLength(1);
  expect(s.writes[0].body).toEqual({ message: "A restored and saved reply." });
  expect(s.writes[0].csrf).toBeTruthy();
  await page.reload();
  await ready(page);
  await expect(page.getByLabel("Reply text")).toHaveValue("");
});
test("unavailable recovery storage prevents sending", async ({ page }) => {
  const s = await customerSupportFixture(page);
  await page.goto(thread(s));
  await review(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Unavailable");
    };
  });
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(s.writes).toHaveLength(0);
});
test("another conversation recovery marker does not block this reply", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  await page.addInitScript(
    (key) => sessionStorage.setItem(key, "pending"),
    marker(s, "complaints"),
  );
  await page.goto(thread(s));
  await ready(page);
  await expect(page.getByRole("heading", { name: "Reply needs checking" })).toHaveCount(
    0,
  );
});
test("429 pauses replies without retaining an uncertain marker", async ({ page }) => {
  const s = await customerSupportFixture(page);
  s.rateLimit = true;
  await page.goto(thread(s));
  await review(page);
  await send(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeDisabled();
  await ready(page);
  expect(s.writes).toHaveLength(1);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), marker(s))).toBeNull();
});
test("long complaint and resolution remain usable in a short reduced-motion viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const s = await customerSupportFixture(page);
  s.records.complaints.status = "RESOLVED";
  s.records.complaints.description = "A".repeat(4000);
  s.records.complaints.resolution = "The agreed follow-up has been recorded.";
  await page.goto(thread(s, "complaints"));
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Resolution", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await review(page);
  await page
    .getByRole("button", { name: "Send reply", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Send reply", exact: true }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  expect(s.writes).toHaveLength(0);
});
