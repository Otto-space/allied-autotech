import { expect, it, vi } from "vitest";
import { ServiceOperationsService } from "../../src/modules/service-operations/service-operations.service.js";

it("does not read appointment slots for a priced service with an unconfirmed duration", async () => {
  const slots = vi.fn();
  const database = {
    service: {
      findFirst: vi.fn().mockResolvedValue({
        id: crypto.randomUUID(),
        description: null,
        shortDescription: null,
        pricingType: "FIXED",
        priceKobo: 800000n,
        durationMinutes: null,
        mediaImages: [],
        category: null,
      }),
    },
    bookingSlot: { findMany: slots },
  };
  const service = new ServiceOperationsService(database as never);
  await expect(
    service.publicBookingSlots(crypto.randomUUID(), {} as never),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(slots).not.toHaveBeenCalled();
});
