import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { sessionWindow } from "./session-window.js";
import { testReservationAcceptance } from "./reservation-terms.js";
import type { ReviewCreateInput } from "../../src/modules/support/support.schemas.js";

export const sourceTargets = [
  "PRODUCT",
  "SERVICE",
  "ORDER",
  "VEHICLE_TRANSACTION",
] as const;
export type SourceTarget = (typeof sourceTargets)[number];
export async function reviewSourceCustomer() {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-fixture",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Review", lastName: "Customer", phone: "08030000000" },
      },
    },
    include: { profile: true },
  });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    now = new Date();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      ...sessionWindow(4 * 3600000),
      createdAt: now,
      lastRotatedAt: now,
    },
  });
  return {
    user,
    token,
    csrf,
    cookie: `${sessionCookieName}=${token}`,
    customerId: user.profile!.id,
  };
}
export async function reviewSourceFixtures(customerId: string) {
  const suffix = randomUUID();
  const branch = await prisma.branch.create({
    data: {
      code: suffix.slice(0, 10),
      name: "Review test",
      address: "Private address",
      city: "Lagos",
      state: "Lagos",
    },
  });
  const service = await prisma.service.create({
    data: {
      name: "Completed maintenance",
      slug: suffix,
      pricingType: "FIXED",
      priceKobo: 100n,
    },
  });
  const category = await prisma.category.create({
    data: { name: "Review category", slug: suffix },
  });
  const product = await prisma.product.create({
    data: {
      name: "Purchased part",
      slug: suffix,
      sku: suffix,
      categoryId: category.id,
      priceKobo: 100n,
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: {
      branchId: branch.id,
      stockNumber: suffix,
      make: "Test",
      model: "Car",
      year: 2025,
    },
  });
  const listing = await prisma.vehicleListing.create({
    data: {
      branchId: branch.id,
      vehicleId: vehicle.id,
      slug: suffix,
      title: "Purchased vehicle",
      priceKobo: 100n,
    },
  });
  async function source(
    target: SourceTarget,
    completed = true,
    owner = customerId,
    sameProduct = false,
  ) {
    const id = randomUUID();
    let fields: Record<string, string>;
    if (target === "ORDER" || target === "PRODUCT") {
      const order = await prisma.order.create({
        data: {
          id,
          customerId: owner,
          branchId: branch.id,
          orderNumber: id,
          status: completed ? "COMPLETED" : "PENDING",
          subtotalKobo: 100n,
          totalKobo: 100n,
          customerName: "PRIVATE_CONTACT_SENTINEL",
          customerEmail: "private@example.test",
          customerPhone: "08030000000",
          completedAt: completed ? new Date() : null,
        },
      });
      if (target === "ORDER") fields = { orderId: order.id };
      else {
        const purchased = sameProduct
          ? product
          : await prisma.product.create({
              data: {
                name: "Purchased part",
                slug: id,
                sku: id,
                categoryId: category.id,
                priceKobo: 100n,
              },
            });
        const item = await prisma.orderItem.create({
          data: {
            id,
            orderId: order.id,
            productId: purchased.id,
            productName: purchased.name,
            sku: purchased.sku,
            unitPriceKobo: 100n,
            subtotalKobo: 100n,
            quantity: 1,
          },
        });
        fields = { orderItemId: item.id, productId: purchased.id };
      }
    } else if (target === "SERVICE") {
      await prisma.booking.create({
        data: {
          id,
          customerId: owner,
          serviceId: service.id,
          branchId: branch.id,
          scheduledAt: new Date(),
          status: completed ? "COMPLETED" : "REQUESTED",
          staffNotes: "PRIVATE_CONTACT_SENTINEL",
          completedAt: completed ? new Date() : null,
        },
      });
      fields = { bookingId: id, serviceId: service.id };
    } else {
      const purchasedListing = await prisma.vehicleListing.create({
        data: {
          branch: { connect: { id: branch.id } },
          slug: id,
          title: "Purchased vehicle",
          priceKobo: 100n,
          vehicle: {
            create: {
              branchId: branch.id,
              stockNumber: id,
              make: "Test",
              model: "Car",
              year: 2025,
            },
          },
        },
      });
      await prisma.vehicleTransaction.create({
        data: {
          id,
          customerId: owner,
          vehicleListingId: purchasedListing.id,
          transactionNumber: id,
          customerName: "PRIVATE_CONTACT_SENTINEL",
          customerPhone: "08030000000",
          askingPriceKobo: 100n,
          agreedPriceKobo: completed ? 100n : null,
          ...(completed ? await testReservationAcceptance(owner) : {}),
          status: completed ? "COMPLETED" : "ENQUIRY",
          completedAt: completed ? new Date() : null,
          notes: "PRIVATE_CONTACT_SENTINEL",
        },
      });
      fields = { vehicleTransactionId: id };
    }
    return {
      id,
      fields,
      body: {
        targetType: target,
        ...fields,
        rating: 5,
        comment: "Synthetic source review",
      } as ReviewCreateInput,
    };
  }
  return { source, product, service, listing };
}
