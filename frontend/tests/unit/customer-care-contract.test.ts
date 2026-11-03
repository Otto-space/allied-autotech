import { expect, it } from "vitest";
import { customerCareSchema } from "@/lib/api/customer-care-schemas";
import { overviewFixture } from "../fixtures/overview";

const legacy = overviewFixture("CUSTOMER").care!;
const photo = {
  id: "b9000000-0000-4000-8000-000000000302",
  url: "/api/v1/customers/media/images/b9000000-0000-4000-8000-000000000302",
  altText: null,
  sortOrder: 0,
  isPrimary: true,
  width: 160,
  height: 120,
};
it("accepts the released payload without inventing a default or photo", () => {
  const care = customerCareSchema.parse(legacy);
  expect(care.defaultVehicle).toBeUndefined();
  expect(care.vehicle?.photo).toBeUndefined();
});
it("retains explicit absence and a real saved default independently of the booked vehicle", () => {
  expect(
    customerCareSchema.parse({ ...legacy, defaultVehicle: null }).defaultVehicle,
  ).toBeNull();
  const chosen = {
    ...legacy.vehicle!,
    id: "b9000000-0000-4000-8000-000000000301",
    photo,
  };
  const care = customerCareSchema.parse({ ...legacy, defaultVehicle: chosen });
  expect(care.defaultVehicle).toEqual(chosen);
  expect(care.vehicle).toEqual(legacy.vehicle);
  expect(care.vehicleSource).toBe("BOOKING");
});
it.each([
  "https://example.test/private.jpg",
  "/api/v1/public/media/images/b9000000-0000-4000-8000-000000000302",
  "data:image/png;base64,invalid",
  "/api/v1/customers/media/images/b9000000-0000-4000-8000-000000000302?token=private",
])("rejects a non-private or token-bearing cover URL %s", (url) => {
  expect(
    customerCareSchema.safeParse({
      ...legacy,
      defaultVehicle: { ...legacy.vehicle!, photo: { ...photo, url } },
    }).success,
  ).toBe(false);
});
