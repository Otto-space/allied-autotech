import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { CatalogService } from "../../src/modules/catalog/catalog.service.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "reviewed cart clearing",
  () => {
    afterAll(() => prisma.$disconnect());

    it("rejects another tab's quantity change without deleting the new contents", async () => {
      const customer = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-only",
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              firstName: "Synthetic",
              lastName: "Cart",
              phone: "+2348000000000",
              cart: { create: {} },
            },
          },
        },
        include: { profile: { include: { cart: true } } },
      });
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic cart stock",
          address: "Test only",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic cart", slug: randomUUID() },
      });
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: "Synthetic part",
          slug: randomUUID(),
          sku: randomUUID(),
          priceKobo: 10000n,
        },
      });
      await prisma.inventory.create({
        data: { branchId: branch.id, productId: product.id, quantity: 10 },
      });
      const item = await prisma.cartItem.create({
        data: { cartId: customer.profile!.cart!.id, productId: product.id, quantity: 2 },
      });
      const actor: AuthenticatedActor = {
        userId: customer.id,
        sessionId: randomUUID(),
        email: customer.email,
        role: "CUSTOMER",
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      const service = new CatalogService(prisma);
      const reviewed = {
        expectedItems: [
          {
            id: item.id,
            productId: product.id,
            quantity: 2,
            unitPriceKobo: "10000",
          },
        ],
      };

      await service.setCartItem(actor, product.id, 3);
      await expect(service.clearCart(actor, reviewed)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(
        (await prisma.cartItem.findUniqueOrThrow({ where: { id: item.id } })).quantity,
      ).toBe(3);

      await service.clearCart(actor, {
        expectedItems: [{ ...reviewed.expectedItems[0]!, quantity: 3 }],
      });
      expect(
        await prisma.cartItem.count({ where: { cartId: customer.profile!.cart!.id } }),
      ).toBe(0);
    });
  },
);
