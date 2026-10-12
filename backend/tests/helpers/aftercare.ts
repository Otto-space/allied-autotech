import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { sessionWindow } from "./session-window.js";

export const app = createApp({ checkReadiness: async () => undefined });
export async function account(
  role: "CUSTOMER" | "STAFF" | "ADMIN",
  branchId?: string,
  assured = true,
) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Synthetic",
                lastName: "Aftercare",
                phone: "+2348000000000",
              },
            },
          }
        : {
            staffProfile: {
              create: {
                firstName: "Synthetic",
                lastName: "Reviewer",
                ...(branchId ? { branchId } : {}),
              },
            },
          }),
    },
    include: { profile: true },
  });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken();
  await prisma.session.create({
    data: {
      createdAt: new Date(Date.now() - 1000),
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      ...sessionWindow(3600000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
    },
  });
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}
type Account = Awaited<ReturnType<typeof account>>;
export const post = (actor: Account, url: string, body: unknown) =>
  request(app)
    .post(`/api/v1${url}`)
    .set(actor.headers)
    .set("Idempotency-Key", `aftercare-v1.${Date.now()}.${randomUUID()}`)
    .send(body);
export const get = (actor: Account, url: string) =>
  request(app).get(`/api/v1${url}`).set(actor.headers);
export async function fixture() {
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Synthetic aftercare",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const customer = await account("CUSTOMER"),
    staff = await account("STAFF", branch.id),
    admin = await account("ADMIN");
  const category = await prisma.category.create({
    data: { name: "Synthetic", slug: randomUUID() },
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: "Synthetic product",
      slug: randomUUID(),
      sku: randomUUID(),
      priceKobo: 10000n,
    },
  });
  const inventory = await prisma.inventory.create({
    data: { branchId: branch.id, productId: product.id, quantity: 12, reserved: 2 },
  });
  const order = await prisma.order.create({
    data: {
      branchId: branch.id,
      customerId: customer.user.profile!.id,
      orderNumber: randomUUID(),
      customerName: "Synthetic customer",
      customerEmail: customer.user.email,
      customerPhone: "+2348000000000",
      subtotalKobo: 30000n,
      totalKobo: 30000n,
      status: "COMPLETED",
      fulfillmentMethod: "COLLECTION",
      createdAt: new Date(Date.now() - 86400000),
      confirmedAt: new Date(Date.now() - 80000000),
      paidAt: new Date(Date.now() - 80000000),
      completedAt: new Date(Date.now() - 3600000),
      items: {
        create: {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 3,
          unitPriceKobo: 10000n,
          subtotalKobo: 30000n,
        },
      },
    },
    include: { items: true },
  });
  const path = `/customers/orders/${order.id}`;
  const body = {
    kind: "RETURN",
    reason: "Synthetic request for one damaged product",
    items: [{ orderItemId: order.items[0]!.id, quantity: 1 }],
  };
  return { branch, customer, staff, admin, inventory, order, path, body };
}
