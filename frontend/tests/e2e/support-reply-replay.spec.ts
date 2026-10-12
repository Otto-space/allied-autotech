import { test, expect, type Page } from "@playwright/test";
import { customerSupportFixture } from "../fixtures/customer-support";
type State = Awaited<ReturnType<typeof customerSupportFixture>>;
const thread = (s: State, kind: "enquiries" | "complaints") =>
  `/dashboard/support/${kind}/${s.records[kind].id}`;
const marker = (s: State, kind: "enquiries" | "complaints") =>
  `aat:support-reply:v1:${s.userId}:${kind}:${s.records[kind].id}`;
async function lostReply(page: Page) {
  await page
    .getByLabel("Reply text", { exact: true })
    .fill("Keep this exact original reply.");
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
}
async function openRecovery(page: Page) {
  await page.getByRole("button", { name: "Review original reply", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Keep this exact original reply.");
}
for (const kind of ["enquiries", "complaints"] as const)
  for (const committed of [true, false])
    test(`${kind}: ${committed ? "committed reply after closure" : "uncommitted reply"} recovers with its original key`, async ({
      page,
    }) => {
      const s = await customerSupportFixture(page);
      s.messages = [];
      s.loseCommittedReplyOnce = committed;
      s.unknown = !committed;
      await page.goto(thread(s, kind));
      await lostReply(page);
      if (committed) s.records[kind].status = "CLOSED";
      await page.reload();
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      expect(s.writes).toHaveLength(1);
      s.unknown = false;
      await openRecovery(page);
      await page.getByRole("button", { name: "Go back", exact: true }).click();
      expect(s.writes).toHaveLength(1);
      await openRecovery(page);
      await page
        .getByRole("button", { name: "Send or recover reply", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(/Original reply confirmed/)).toBeVisible();
      expect(s.writes).toHaveLength(2);
      expect(s.writes[1].key).toBe(s.writes[0].key);
      expect(s.writes[1].body).toEqual(s.writes[0].body);
      expect(s.messages).toHaveLength(1);
      expect(s.replyReceipts.size).toBe(1);
      expect(
        await page.evaluate((key) => sessionStorage.getItem(key), marker(s, kind)),
      ).toBeNull();
      if (!committed) {
        await page.reload();
        await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue("");
      }
    });
test("expired reply recovery cannot automatically create a replacement", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  s.unknown = true;
  await page.goto(thread(s, "enquiries"));
  await lostReply(page);
  await page.evaluate(
    (key) => {
      const v = JSON.parse(sessionStorage.getItem(key)!);
      v.key = v.key.replace(/\.\d{13}\./, `.${Date.now() - 86400001}.`);
      sessionStorage.setItem(key, JSON.stringify(v));
    },
    marker(s, "enquiries"),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review original reply", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "I have checked the conversation", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Refresh messages", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "I have checked the conversation", exact: true }),
  ).toBeEnabled();
  expect(s.writes).toHaveLength(1);
});
test("account change at reply recovery redacts the retained text and blocks POST", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  s.unknown = true;
  await page.goto(thread(s, "enquiries"));
  await lostReply(page);
  const key = marker(s, "enquiries");
  await openRecovery(page);
  s.userId = "d5000000-0000-4000-8000-000000000777";
  await page.getByRole("button", { name: "Send or recover reply", exact: true }).click();
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), key))
    .toBe("pending");
  expect(s.writes).toHaveLength(1);
});
test("revoked conversation access hides retained text and blocks recovery", async ({
  page,
}) => {
  const s = await customerSupportFixture(page);
  s.unknown = true;
  await page.goto(thread(s, "enquiries"));
  await lostReply(page);
  s.failDetail = true;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review original reply", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Keep this exact original reply.", { exact: true }),
  ).toHaveCount(0);
  expect(s.writes).toHaveLength(1);
});
