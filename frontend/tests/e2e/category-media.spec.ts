import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workCategoriesFixture, bookingId } from "../fixtures/work-categories";
for (const width of [390, 1440])
  test(`group image review, persistence and removal at ${width}px`, async ({
    page,
  }, info) => {
    const { state } = await workCategoriesFixture(page);
    const category = state.records[1];
    const endpoint = `/api/v1/admin/service-categories/${category.id}`;
    const imageId = bookingId(990);
    let images = [
      {
        id: imageId,
        url: `${endpoint}/images/${imageId}/content`,
        altText: "Workshop illustration",
        width: 96,
        height: 64,
      },
    ];
    const writes: unknown[] = [];
    await page.route(`**${endpoint}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/content"))
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="#a00"/></svg>',
        });
      if (route.request().method() !== "GET") {
        const body = route.request().postDataJSON();
        expect(body.expectedVersion).toBe(category.version);
        writes.push(body);
        if (route.request().method() === "DELETE") images = [];
        else images = images.map((image) => ({ ...image, altText: body.altText }));
        category.version++;
      }
      return route.fulfill({
        json: {
          success: true,
          data: { version: category.version, images },
          message: "Isolated media fixture",
          meta: { requestId: "category-media" },
        },
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/admin/service-categories/${category.id}`);
    const opener = page.getByRole("button", { name: "Manage group image", exact: true });
    await opener.click();
    await expect(
      page.getByRole("heading", { name: `Image for ${category.name}`, exact: true }),
    ).toBeFocused();
    await page.getByLabel("Image description (optional)").fill("Workshop equipment");
    await page.getByRole("button", { name: "Save description", exact: true }).click();
    expect(writes).toHaveLength(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Go back", exact: true })
      .click();
    expect(writes).toHaveLength(0);
    await page.getByRole("button", { name: "Save description", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: "Workshop equipment", exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    await page.getByRole("button", { name: "Close image editor", exact: true }).click();
    await expect(opener).toBeFocused();
    await page.reload();
    await opener.click();
    await expect(page.getByLabel("Image description (optional)")).toHaveValue(
      "Workshop equipment",
    );
    expect(
      (await new AxeBuilder({ page }).include(".work-category-detail").analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath("group-image-editor.png") });
    await page
      .getByRole("button", { name: "Remove service group image", exact: true })
      .click();
    expect(writes).toHaveLength(1);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(
      page.getByText("No service group image yet.", { exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(2);
  });
