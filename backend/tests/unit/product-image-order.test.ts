import { expect, it } from "vitest";
import { productImageOrderSchema } from "../../src/modules/catalog/product-media.schemas.js";
import { imageCreateBodySchema } from "../../src/modules/catalog/catalog.schemas.js";
const id = "f0000000-0000-4000-8000-000000000001";
it("requires a unique, nonempty image permutation and explicit gallery revision", () => {
  expect(
    productImageOrderSchema.safeParse({ expectedVersion: 0, imageIds: [id] }).success,
  ).toBe(true);
  for (const value of [
    { imageIds: [id] },
    { expectedVersion: -1, imageIds: [id] },
    { expectedVersion: 0, imageIds: [] },
    { expectedVersion: 0, imageIds: [id, id] },
    { expectedVersion: 0, imageIds: [id], productId: id },
  ])
    expect(productImageOrderSchema.safeParse(value).success).toBe(false);
});
it("rejects private and expiring hosted image sources without fetching them", () => {
  expect(
    imageCreateBodySchema.safeParse({
      url: "https://images.example.test/a.jpg?width=400",
    }).success,
  ).toBe(true);
  for (const url of [
    "not a URL",
    "https://",
    "https://127.0.0.1/a.jpg",
    "https://169.254.169.254/a",
    "https://[::1]/a",
    "https://localhost/a",
    "https://photos.internal/a",
    "https://images.example.test/a?X-Amz-Signature=secret",
    "https://images.example.test/a?token=private",
    "https://images.example.test:8443/a",
    "https://images.example.test/a?expires=123",
    "https://images.example.test/a#private",
  ])
    expect(imageCreateBodySchema.safeParse({ url }).success).toBe(false);
});
