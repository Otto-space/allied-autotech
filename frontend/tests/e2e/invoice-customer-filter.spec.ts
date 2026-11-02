import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workInvoiceFixture } from "../fixtures/work-invoices";
import { customerSearchFixture } from "../fixtures/customer-filter";

for (const width of [320, 1440]) {
  test(`invoice customer search preserves scope and recovery at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const invoices = await workInvoiceFixture(page);
    const customers = await customerSearchFixture(page);
    await page.goto("/admin/invoices");
    await page.getByRole("button", { name: "More filters", exact: true }).click();
    expect(customers.state.reads).toHaveLength(0);
    await page.getByText("Find a customer", { exact: true }).click();
    await page.getByLabel("Customer search", { exact: true }).fill("sy");
    await expect(
      page.getByRole("option", { name: /Synthetic Customer 2 ·/ }),
    ).toHaveCount(1);
    await page
      .getByLabel("Customer (optional)", { exact: true })
      .selectOption(customers.rows[2].id);
    await page
      .getByRole("navigation", { name: "Customer search pages" })
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await expect(
      page.getByRole("option", { name: /Synthetic Customer 27 ·/ }),
    ).toHaveCount(1);
    await expect(page.getByLabel("Customer (optional)", { exact: true })).toHaveValue(
      customers.rows[2].id,
    );
    await page
      .getByRole("button", { name: "Apply invoice filters", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`customerId=${customers.rows[2].id}`));
    expect(new URL(page.url()).searchParams.has("search")).toBe(false);
    await expect
      .poll(() => invoices.reads.at(-1)?.searchParams.get("customerId"))
      .toBe(customers.rows[2].id);
    await page.reload();
    await expect(
      page.getByRole("option", { name: /Synthetic Customer 2 ·/ }),
    ).toHaveCount(1);
    await page.getByText("Use a customer reference", { exact: true }).click();
    await page
      .getByLabel("Customer profile reference (optional)", { exact: true })
      .fill("incomplete");
    const reads = invoices.reads.length;
    await page
      .getByRole("button", { name: "Apply invoice filters", exact: true })
      .click();
    await expect(
      page.getByLabel("Customer profile reference (optional)", { exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("alert").filter({ hasText: "complete reference" }),
    ).toBeVisible();
    expect(invoices.reads).toHaveLength(reads);
    await page
      .getByLabel("Customer profile reference (optional)", { exact: true })
      .fill("");
    await page
      .getByRole("button", { name: "Apply invoice filters", exact: true })
      .click();
    await expect(page).not.toHaveURL(/customerId=/);
    expect(invoices.writes).toHaveLength(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".iv-filters").analyze()).violations,
    ).toEqual([]);
  });
}

test("invoice customer search retries without changing the filter or writing records", async ({
  page,
}) => {
  const invoices = await workInvoiceFixture(page);
  const customers = await customerSearchFixture(page);
  customers.state.mode = "error";
  await page.goto("/admin/invoices");
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await page.getByText("Find a customer", { exact: true }).click();
  await page.getByLabel("Customer search", { exact: true }).fill("am");
  await expect(
    page.getByRole("button", { name: "Retry customer search", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("customerId")).toBe(false);
  customers.state.mode = "normal";
  await page.getByRole("button", { name: "Retry customer search", exact: true }).click();
  await expect(page.getByRole("option", { name: /Amina Okafor ·/ })).toHaveCount(1);
  expect(invoices.writes).toHaveLength(0);
});
