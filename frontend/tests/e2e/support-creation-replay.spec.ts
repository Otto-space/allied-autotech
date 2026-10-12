import { expect, test, type Page } from "@playwright/test";
import { customerSupportFixture } from "../fixtures/customer-support";
const marker = (kind: string) =>
  `aat:support-create:v1:d5000000-0000-4000-8000-000000000021:${kind}`;
async function submit(page: Page, kind: string) {
  await page.getByLabel("Record category").selectOption(kind);
  await page
    .getByLabel("Handling branch")
    .selectOption("d5000000-0000-4000-8000-000000000002");
  await page.getByLabel("Subject", { exact: true }).fill("Retain original subject");
  await page
    .getByLabel(kind === "enquiries" ? "Your message" : "Complaint details", {
      exact: true,
    })
    .fill("Retain my exact original details.");
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
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
}
async function recover(page: Page) {
  await page
    .getByRole("button", { name: "Review original support request", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Retain my exact original details.",
  );
  await page
    .getByRole("button", { name: "Send or recover request", exact: true })
    .click();
}
for (const kind of ["enquiries", "complaints"] as const) {
  test(`${kind}: committed response loss recovers after reload without a second record`, async ({
    page,
  }) => {
    const state = await customerSupportFixture(page);
    state.loseCommittedCreateOnce = true;
    await page.goto("/dashboard/support");
    await submit(page, kind);
    const original = state.writes[0];
    state.records[kind].status = "CLOSED";
    await page.reload();
    await page.getByLabel("Record category").selectOption(kind);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    expect(state.writes).toHaveLength(1);
    await expect(
      page.getByRole("button", { name: "I have checked my records", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Review original support request", exact: true })
      .click();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    expect(state.writes).toHaveLength(1);
    await recover(page);
    await expect(page).toHaveURL(new RegExp(`/dashboard/support/${kind}/`));
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1].key).toBe(original.key);
    expect(state.writes[1].body).toEqual(original.body);
    expect(state.receipts.size).toBe(1);
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), marker(kind)),
    ).toBeNull();
    await page.goto("/dashboard/support");
    await page.getByLabel("Record category").selectOption(kind);
    await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("");
  });
  test(`${kind}: interruption before commit sends the original request only on confirmation`, async ({
    page,
  }) => {
    const state = await customerSupportFixture(page);
    state.unknown = true;
    await page.goto("/dashboard/support");
    await submit(page, kind);
    await page.reload();
    await page.getByLabel("Record category").selectOption(kind);
    state.unknown = false;
    await recover(page);
    await expect(page).toHaveURL(new RegExp(`/dashboard/support/${kind}/`));
    expect(state.receipts.size).toBe(1);
    expect(state.writes[1].key).toBe(state.writes[0].key);
  });
}
test("expired creation recovery requires history reconciliation and never generates a replacement key", async ({
  page,
}) => {
  const state = await customerSupportFixture(page);
  state.unknown = true;
  await page.goto("/dashboard/support");
  await submit(page, "enquiries");
  await page.evaluate((key) => {
    const v = JSON.parse(sessionStorage.getItem(key)!);
    v.key = v.key.replace(/\.\d{13}\./, `.${Date.now() - 86400001}.`);
    sessionStorage.setItem(key, JSON.stringify(v));
  }, marker("enquiries"));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Review original support request", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "I have checked my records", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Refresh support records", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "I have checked my records", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});
test("an account change at recovery redacts private contents and cannot submit", async ({
  page,
}) => {
  const state = await customerSupportFixture(page);
  state.unknown = true;
  await page.goto("/dashboard/support");
  await submit(page, "enquiries");
  state.userId = "d5000000-0000-4000-8000-000000000022";
  await recover(page);
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), marker("enquiries")))
    .toBe("pending");
  expect(state.writes).toHaveLength(1);
});
