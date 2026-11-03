// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createRuntimeCapabilityApi } from "../fixtures/runtime-capabilities-api.mjs";
import { parsePublicCapabilities } from "@/lib/public-capabilities";
import {
  parseServiceCategories,
  parseServiceCategory,
  parseServiceDiscovery,
} from "@/lib/api/public-schemas";

const server = createRuntimeCapabilityApi();
let origin: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing loopback address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function controls(value: object) {
  return fetch(`${origin}/__capabilities`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}
beforeEach(async () => {
  expect((await controls({ mode: "browse_enquiries" })).status).toBe(200);
});
async function data(path: string) {
  const response = await fetch(origin + "/api/v1" + path);
  expect(response.status).toBe(200);
  return (await response.json()).data;
}

it("supplies real capability contracts for every independent module combination", async () => {
  for (const bookings of [true, false])
    for (const purchases of [true, false]) {
      expect(
        (
          await controls({
            mode: "full",
            bookingRequestsEnabled: bookings,
            productPurchasesEnabled: purchases,
            checkoutApproved: true,
          })
        ).status,
      ).toBe(200);
      const value = parsePublicCapabilities(await data("/public/capabilities"));
      expect(value.release.bookingRequestsEnabled).toBe(bookings);
      expect(value.checkoutEnabled).toBe(purchases);
    }
});
it("keeps service fixtures compatible with the catalogue parsers", async () => {
  const groups = parseServiceCategories(await data("/public/services/categories"));
  expect(groups.items).toHaveLength(1);
  const group = parseServiceCategory(
    await data(`/public/services/categories/${groups.items[0].id}`),
  );
  const services = parseServiceDiscovery(await data("/public/services/discovery"));
  expect(services.items).toHaveLength(2);
  expect(services.items.every((service) => service.category?.id === group.id)).toBe(true);
});
it("cannot submit any real business or provider mutation", async () => {
  for (const path of [
    "/customers/orders/checkout",
    "/staff/orders/synthetic/status",
    "/webhooks/paystack",
  ])
    expect(
      (await fetch(origin + "/api/v1" + path, { method: "POST", body: "{}" })).status,
    ).toBe(405);
});
it("rejects malformed controls without changing the fixture's current state", async () => {
  expect((await controls({ mode: "unknown" })).status).toBe(400);
  expect((await controls({ mode: "full", bookingRequestsEnabled: "yes" })).status).toBe(
    400,
  );
  expect((await controls({ mode: "full", unexpected: true })).status).toBe(400);
  expect((await controls({ mode: "full", unexpected: "x".repeat(2000) })).status).toBe(
    413,
  );
  expect(parsePublicCapabilities(await data("/public/capabilities")).release.mode).toBe(
    "browse_enquiries",
  );
});
it("exercises failed capability reads rather than inventing enabled permissions", async () => {
  await controls({ mode: "full", fail: true });
  const response = await fetch(origin + "/api/v1/public/capabilities");
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ success: false });
});
