import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  demoProducts,
  demoListings,
  demoServices,
  demoId,
} from "../fixtures/discovery-demo.mjs";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";

// Browser-only records and geometric image swatches. Never written to an API or database.
const dimensions = [
  [64, 48],
  [120, 240],
  [640, 360],
] as const;
const longName =
  "DEMO extended replacement assembly and specification name with additional identifying information for a narrow catalogue card";
const products = demoProducts.slice(0, 3).map((item, i) => ({
  ...item,
  name: `${longName} ${i + 1}`,
  brand: null,
  manufacturerPartNumber: null,
  images: [
    {
      id: demoId(600 + i),
      url: `/api/v1/public/catalog/products/images/${demoId(600 + i)}`,
      altText: `TEST geometry ${i}`,
      isPrimary: true,
      width: dimensions[i][0],
      height: dimensions[i][1],
    },
  ],
}));
const listings = demoListings.slice(0, 3).map((item, i) => ({
  ...item,
  vehicle: {
    ...item.vehicle,
    model: longName,
    trim: "Extended test trim",
    mileageKm: null,
    transmission: null,
    fuelType: null,
    ownerReportedIssues:
      "TEST owner report: AC not working. Diagnosis and repair required. This entire disclosure must remain readable.",
    images: [
      {
        id: demoId(600 + i),
        url: `/api/v1/public/vehicles/images/${demoId(600 + i)}`,
        altText: `TEST geometry ${i}`,
        isPrimary: true,
        width: dimensions[i][0],
        height: dimensions[i][1],
      },
    ],
  },
}));
const services = demoServices.slice(0, 3).map((item, i) => ({
  ...item,
  name: `${longName} ${i + 1}`,
  image: {
    id: demoId(600 + i),
    url: `/api/v1/public/media/images/${demoId(600 + i)}`,
    altText: `TEST geometry ${i}`,
    width: dimensions[i][0],
    height: dimensions[i][1],
  },
}));
type Catalogue = "parts" | "vehicles" | "services";
const presentation = {
  parts: {
    search: "Search products",
    card: ".shop-product-card",
    media: ".product-media",
  },
  vehicles: { search: "Search vehicles", card: ".vehicle-card", media: ".product-media" },
  services: {
    search: "Search services",
    card: ".services-row",
    media: ".services-row-media",
  },
};
async function setup(page: Page, kind: Catalogue, race = false) {
  const writes: string[] = [],
    imageRequests: string[] = [];
  let olderRequested = false,
    releaseOlder = () => {};
  const held = new Promise<void>((resolve) => {
    releaseOlder = resolve;
  });
  const images = await Promise.all(
    dimensions.map(([width, height]) =>
      sharp({ create: { width, height, channels: 3, background: "#c8d1d8" } })
        .png()
        .toBuffer(),
    ),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() !== "GET") {
      writes.push(url.pathname);
      return route.abort();
    }
    if (url.pathname.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    const imageIndex = dimensions.findIndex((_, i) =>
      url.pathname.endsWith(demoId(600 + i)),
    );
    if (imageIndex >= 0 && url.pathname.includes("/images/")) {
      imageRequests.push(url.pathname + url.search);
      return route.fulfill({ contentType: "image/png", body: images[imageIndex] });
    }
    let data = discoveryResponse(url);
    const discovery =
      kind === "parts"
        ? "/public/catalog/products/discovery"
        : `/public/${kind}/discovery`;
    if (url.pathname.endsWith(discovery)) {
      if (race && url.searchParams.get("search") === "older") {
        olderRequested = true;
        await held;
      }
      const rows =
        kind === "parts" ? products : kind === "vehicles" ? listings : services;
      const newer = url.searchParams.get("search") === "newer";
      const items = race
        ? rows.slice(0, newer ? 1 : 3).map((item) =>
            kind !== "vehicles"
              ? { ...item, name: newer ? "NEWER result" : "OLDER result" }
              : {
                  ...item,
                  vehicle: {
                    ...listings[0].vehicle,
                    model: newer ? "NEWER result" : "OLDER result",
                  },
                },
          )
        : rows;
      data = { items, totalMatches: items.length };
    }
    return route.fulfill({
      json: {
        success: true,
        data,
        message: "Browser-only edge fixture",
        meta: { requestId: "catalogue-edge" },
      },
    });
  });
  return { writes, imageRequests, olderRequested: () => olderRequested, releaseOlder };
}
for (const width of [390, 1440])
  for (const kind of ["parts", "vehicles", "services"] as const) {
    test(`${kind} long names and varied image dimensions at ${width}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const fixture = await setup(page, kind);
      await page.goto(`/${kind}`);
      const search = page.getByRole("searchbox", {
        name: presentation[kind].search,
        exact: true,
      });
      await search.fill("DEMO layout");
      await search.press("Enter");
      await expect(page).toHaveURL(/search=DEMO(?:\+|%20)layout/);
      if (kind === "services") {
        await expect(page.locator(".services-results")).toHaveAttribute(
          "aria-busy",
          "false",
        );
      }
      const cards = page.locator(presentation[kind].card);
      await expect(cards).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        const card = cards.nth(i),
          image = card.locator(`${presentation[kind].media} img`);
        await card.scrollIntoViewIfNeeded();
        await expect
          .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
        // naturalWidth is density-corrected for width-descriptor srcset candidates.
        // Decode the selected response to assert actual fixture pixel dimensions.
        const decoded = await image.evaluate(async (el: HTMLImageElement) => {
          await el.decode();
          const response = await fetch(el.currentSrc);
          const bitmap = await createImageBitmap(await response.blob());
          const size = [bitmap.width, bitmap.height];
          bitmap.close();
          return size;
        });
        expect(decoded).toEqual([...dimensions[i]]);
        await expect(image).toHaveCSS(
          "object-fit",
          kind === "services" ? "cover" : "contain",
        );
        if (kind === "services") {
          const frame = (await card.locator(presentation[kind].media).boundingBox())!;
          expect(frame.width / frame.height).toBeCloseTo(
            dimensions[i][0] / dimensions[i][1],
            2,
          );
        }
        await expect(card.locator("h3")).toContainText(longName);
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        const photoBox = await card.locator(presentation[kind].media).boundingBox(),
          titleBox = await card.locator("h3").boundingBox();
        expect(photoBox!.y + photoBox!.height).toBeLessThanOrEqual(titleBox!.y + 1);
        if (kind === "services") {
          await expect(card).toContainText("Quotation required");
          await expect(card).not.toContainText("₦0");
        }
        if (kind === "vehicles") {
          const issue = card.locator(".vehicle-owner-issue-preview");
          await expect(issue).toContainText(
            "This entire disclosure must remain readable.",
          );
          expect(
            await issue.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
          ).toBe(true);
          await expect(card).not.toContainText("0 km");
        }
        await page.screenshot({
          path: info.outputPath(`${kind}-${width}-image-${i}.png`),
        });
      }
      expect(
        fixture.imageRequests.some(
          (url) => url.includes(demoId(600)) && url.includes("?w="),
        ),
      ).toBe(false);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width >= 1024 && kind !== "services") {
        await page.getByRole("button", { name: "Close filters", exact: true }).click();
        await expect(cards).toHaveCount(3);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
      expect(fixture.writes).toEqual([]);
    });
    test(`${kind} newer search wins over an older slow response at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const fixture = await setup(page, kind, true);
      await page.goto(`/${kind}`);
      const search = page.getByRole("searchbox", {
        name: presentation[kind].search,
        exact: true,
      });
      await search.fill("older");
      await search.press("Enter");
      await expect.poll(fixture.olderRequested).toBe(true);
      await search.fill("newer");
      await search.press("Enter");
      await expect(page).toHaveURL(/search=DEMO(?:\+|%20)layout/);
      if (kind === "services") {
        await expect(page.locator(".services-results")).toHaveAttribute(
          "aria-busy",
          "false",
        );
      }
      const cards = page.locator(presentation[kind].card);
      await expect(cards).toHaveCount(1);
      await expect(cards.first().locator("h3")).toContainText("NEWER result");
      fixture.releaseOlder();
      await page.waitForTimeout(700);
      await expect(cards).toHaveCount(1);
      await expect(cards.first().locator("h3")).toContainText("NEWER result");
      await expect(page).toHaveURL(/search=newer/);
      expect(fixture.writes).toEqual([]);
    });
  }
