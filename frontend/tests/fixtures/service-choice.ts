import { expect, type Page } from "@playwright/test";

/** Resolve the API identity, then choose through the visible keyboard control. */
export async function chooseServiceRecord(page: Page, label: string, id: string) {
  const input = page.getByRole("combobox", { name: label, exact: true });
  const fieldId = await input.getAttribute("id");
  const option = page.locator(
    `select[name^="${fieldId}:"][name$=":selection"] option[value="${id}"]`,
  );
  await expect(option).toHaveCount(1);
  const name = await option.textContent();
  await input.click();
  await input.fill(name ?? "");
  await input.press("Enter");
  await expect(input).toHaveValue(name ?? "");
}
