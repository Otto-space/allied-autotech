import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import { reviewSourceFixtures } from "./review-sources.js";

export const supportCreationKey = (stamp = Date.now()) =>
  `support-create-v1.${stamp}.${randomUUID()}`;
export async function supportCreationSources(customerId: string) {
  const f = await reviewSourceFixtures(customerId);
  const booking = await f.source("SERVICE"),
    order = await f.source("ORDER"),
    sale = await f.source("VEHICLE_TRANSACTION");
  const staff = await prisma.staffProfile.create({
    data: {
      firstName: "Synthetic",
      lastName: "Support",
      branch: { connect: { id: f.listing.branchId } },
      user: {
        create: {
          email: `${randomUUID()}@example.test`,
          role: "STAFF",
          passwordHash: "unusable-synthetic-fixture",
        },
      },
    },
  });
  const quote = await prisma.serviceQuote.create({
    data: {
      bookingId: booking.id,
      createdByStaffId: staff.id,
      quoteNumber: randomUUID(),
      subtotalKobo: 100n,
      totalKobo: 100n,
    },
  });
  const availableVehicle = await prisma.vehicle.create({
    data: {
      branchId: f.listing.branchId,
      stockNumber: randomUUID(),
      make: "Test",
      model: "Available",
      year: 2025,
    },
  });
  const availableListing = await prisma.vehicleListing.create({
    data: {
      branchId: f.listing.branchId,
      vehicleId: availableVehicle.id,
      slug: randomUUID(),
      title: "Available support fixture",
      priceKobo: 100n,
      status: "AVAILABLE",
      publishedAt: new Date(),
    },
  });
  return {
    branchId: f.listing.branchId,
    productId: f.product.id,
    serviceId: f.service.id,
    vehicleListingId: availableListing.id,
    bookingId: booking.id,
    quoteId: quote.id,
    orderId: order.id,
    vehicleTransactionId: sale.id,
  };
}
