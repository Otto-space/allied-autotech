import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  customerEnquiryCreateBodySchema,
  publicEnquiryCreateBodySchema,
} from "../../src/modules/support/support.schemas.js";

const common = {
  type: "VEHICLE",
  subject: "Vehicle requirements: Toyota Corolla",
  message: "Foreign used; maximum budget NGN 15,000,000. No listing selected.",
};
const publicFields = { name: "Synthetic visitor", email: "visitor@example.test" };
describe("Vehicle enquiry intent contract", () => {
  for (const [name, schema, fields] of [
    ["public", publicEnquiryCreateBodySchema, publicFields],
    ["customer", customerEnquiryCreateBodySchema, {}],
  ] as const) {
    it(`${name}: accepts explicit requirements without a fabricated listing`, () => {
      expect(
        schema.parse({ ...common, ...fields, vehicleEnquiryIntent: "REQUIREMENTS" }),
      ).toMatchObject({ vehicleEnquiryIntent: "REQUIREMENTS" });
    });
    it(`${name}: accepts a legacy listing without changing its idempotency body`, () => {
      expect(
        schema.parse({ ...common, ...fields, vehicleListingId: randomUUID() }),
      ).not.toHaveProperty("vehicleEnquiryIntent");
    });
    it(`${name}: rejects missing intent and conflicting listing combinations`, () => {
      for (const context of [
        {},
        { vehicleEnquiryIntent: "LISTING" },
        { vehicleEnquiryIntent: "REQUIREMENTS", vehicleListingId: randomUUID() },
        { vehicleEnquiryIntent: "REQUIREMENTS", vehicleListingId: "" },
      ])
        expect(schema.safeParse({ ...common, ...fields, ...context }).success).toBe(
          false,
        );
    });
  }
});
