import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";

async function createUser(role: UserRole, branchId?: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `${role.toLowerCase()}-${id}@example.test`,
      passwordHash: await hashPassword(`phase four test passphrase ${id}`),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Phase",
                lastName: "Customer",
                phone: "+234 800 111 2222",
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Phase", lastName: role, branchId: branchId ?? null },
            },
          }),
    },
    select: { id: true, role: true, profile: { select: { id: true } } },
  });
}

async function createSession(userId: string, role: UserRole) {
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1_000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : now,
    },
  });
  return { cookie: `${sessionCookieName}=${token}`, csrf };
}

function mutation(session: Awaited<ReturnType<typeof createSession>>) {
  return { Origin: origin, Cookie: session.cookie, "X-CSRF-Token": session.csrf };
}

describe.skipIf(!runDatabaseTests)("Phase 4 catalogue, cart, and inventory flow", () => {
  afterAll(async () => prisma.$disconnect());

  it("enforces ownership, branch boundaries, idempotency, locking, and append-only history", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const branch = await prisma.branch.create({
      data: {
        code: `P4-${randomUUID().slice(0, 8)}`,
        name: "Phase Four Branch",
        address: "4 Test Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const otherBranch = await prisma.branch.create({
      data: {
        code: `P4-${randomUUID().slice(0, 8)}`,
        name: "Other Phase Four Branch",
        address: "5 Test Road",
        city: "Abuja",
        state: "FCT",
      },
    });
    const admin = await createUser("ADMIN");
    const customer = await createUser("CUSTOMER");
    const assignedStaff = await createUser("STAFF", branch.id);
    const otherStaff = await createUser("STAFF", otherBranch.id);
    const adminSession = await createSession(admin.id, admin.role);
    const customerSession = await createSession(customer.id, customer.role);
    const staffSession = await createSession(assignedStaff.id, assignedStaff.role);
    const otherStaffSession = await createSession(otherStaff.id, otherStaff.role);

    const categoryResponse = await request(app)
      .post("/api/v1/admin/catalog/categories")
      .set(mutation(adminSession))
      .send({ name: "Filters", slug: `filters-${randomUUID().slice(0, 8)}` });
    expect(categoryResponse.status).toBe(201);
    const categoryId = categoryResponse.body.data.id as string;

    const productResponse = await request(app)
      .post("/api/v1/admin/catalog/products")
      .set(mutation(adminSession))
      .send({
        categoryId,
        name: "Secure Oil Filter",
        slug: `secure-filter-${randomUUID().slice(0, 8)}`,
        sku: `SKU-${randomUUID().slice(0, 8)}`,
        brand: "Allied",
        priceKobo: "125000",
      });
    expect(productResponse.status).toBe(201);
    expect(productResponse.body.data.priceKobo).toBe("125000");
    const productId = productResponse.body.data.id as string;

    const compatibility = await request(app)
      .post(`/api/v1/admin/catalog/products/${productId}/compatibilities`)
      .set(mutation(adminSession))
      .send({ make: "Toyota", model: "Camry", yearFrom: 2018, yearTo: 2026 });
    expect(compatibility.status).toBe(201);
    const compatibilityId = compatibility.body.data.id as string;
    const compatibilityPath = `/api/v1/admin/catalog/products/${productId}/compatibilities/${compatibilityId}`;
    for (const invalidPartial of [{ yearFrom: 2028 }, { yearTo: 2017 }]) {
      await request(app)
        .patch(compatibilityPath)
        .set(mutation(adminSession))
        .send(invalidPartial)
        .expect(409);
      expect(
        await prisma.productCompatibility.findUniqueOrThrow({
          where: { id: compatibilityId },
        }),
      ).toMatchObject({ yearFrom: 2018, yearTo: 2026 });
    }
    const competingBounds = await Promise.all(
      [{ yearFrom: 2024 }, { yearTo: 2020 }].map((body) =>
        request(app).patch(compatibilityPath).set(mutation(adminSession)).send(body),
      ),
    );
    expect(competingBounds.map(({ status }) => status).sort()).toEqual([200, 409]);
    for (const body of [
      { yearFrom: null, yearTo: 2010 },
      { yearFrom: 2028, yearTo: null },
      { yearFrom: 2018, yearTo: 2026 },
    ]) {
      const changed = await request(app)
        .patch(compatibilityPath)
        .set(mutation(adminSession))
        .send(body)
        .expect(200);
      expect(changed.body.data).toMatchObject(body);
    }
    await request(app)
      .patch(
        `/api/v1/admin/catalog/products/${productId}/compatibilities/${randomUUID()}`,
      )
      .set(mutation(adminSession))
      .send({ yearFrom: 2020 })
      .expect(404);
    const image = await request(app)
      .post(`/api/v1/admin/catalog/products/${productId}/images`)
      .set(mutation(adminSession))
      .send({
        url: "https://assets.example.test/filter.jpg",
        altText: "Oil filter",
        isPrimary: true,
      });
    expect(image.status).toBe(201);
    expect(image.body.data).not.toHaveProperty("publicId");
    const imageId = image.body.data.id as string;

    const updatedCompatibility = await request(app)
      .patch(
        `/api/v1/admin/catalog/products/${productId}/compatibilities/${compatibilityId}`,
      )
      .set(mutation(adminSession))
      .send({ yearTo: 2027, notes: null });
    expect(updatedCompatibility.status).toBe(200);
    const updatedImage = await request(app)
      .patch(`/api/v1/admin/catalog/products/${productId}/images/${imageId}`)
      .set(mutation(adminSession))
      .send({ sortOrder: 1, altText: null, isPrimary: false });
    expect(updatedImage.status).toBe(200);
    const updatedProduct = await request(app)
      .patch(`/api/v1/admin/catalog/products/${productId}`)
      .set(mutation(adminSession))
      .send({ compareAtPriceKobo: "150000", description: null, featured: true });
    expect(updatedProduct.status).toBe(200);
    expect(updatedProduct.body.data.compareAtPriceKobo).toBe("150000");

    const publicProduct = await request(app).get(
      `/api/v1/public/catalog/products/${productId}`,
    );
    expect(publicProduct.status).toBe(200);
    expect(publicProduct.body.data.priceKobo).toBe("125000");
    expect(publicProduct.body.data).not.toHaveProperty("inventories");
    for (const sort of ["newest", "name", "price_asc", "price_desc"]) {
      const products = await request(app).get("/api/v1/public/catalog/products").query({
        categoryId,
        brand: "Allied",
        search: "Filter",
        make: "Toyota",
        model: "Camry",
        year: 2022,
        featured: "true",
        sort,
      });
      expect(products.status).toBe(200);
      expect(products.body.data.items).toHaveLength(1);
    }
    const adminCategories = await request(app)
      .get("/api/v1/admin/catalog/categories?isActive=true")
      .set("Cookie", adminSession.cookie);
    expect(adminCategories.status).toBe(200);
    const adminProducts = await request(app)
      .get("/api/v1/admin/catalog/products?isActive=true")
      .set("Cookie", adminSession.cookie);
    expect(adminProducts.status).toBe(200);

    const inventoryResponse = await request(app)
      .post("/api/v1/admin/inventory")
      .set(mutation(adminSession))
      .send({ productId, branchId: branch.id, reorderLevel: 3 });
    expect(inventoryResponse.status).toBe(201);
    const inventoryId = inventoryResponse.body.data.id as string;

    const stockKey = `stock-${randomUUID()}`;
    const stockRequest = () =>
      request(app)
        .post(`/api/v1/staff/inventory/${inventoryId}/movements`)
        .set(mutation(staffSession))
        .set("Idempotency-Key", stockKey)
        .send({ type: "STOCK_IN", quantity: 10, note: "Opening stock" });
    const stocked = await stockRequest();
    expect(stocked.status).toBe(200);
    expect(stocked.body.data.inventory.available).toBe(10);
    const storedMovement = await prisma.inventoryTransaction.findUniqueOrThrow({
      where: { id: stocked.body.data.transaction.id as string },
      select: { idempotencyKey: true, requestHash: true },
    });
    expect(storedMovement.idempotencyKey).toBe(
      hashToken("inventory-idempotency", stockKey),
    );
    expect(storedMovement.idempotencyKey).not.toBe(stockKey);
    expect(storedMovement.requestHash).toMatch(/^[0-9a-f]{64}$/);
    const replay = await stockRequest();
    expect(replay.status).toBe(200);
    expect(replay.body.data.replayed).toBe(true);
    expect(replay.body.data.transaction.id).toBe(stocked.body.data.transaction.id);
    const mismatch = await request(app)
      .post(`/api/v1/staff/inventory/${inventoryId}/movements`)
      .set(mutation(staffSession))
      .set("Idempotency-Key", stockKey)
      .send({ type: "STOCK_IN", quantity: 11, note: "Different request" });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe(errorCodes.idempotencyConflict);

    const crossBranch = await request(app)
      .get(`/api/v1/staff/inventory/${inventoryId}`)
      .set("Cookie", otherStaffSession.cookie);
    expect(crossBranch.status).toBe(403);
    const inventoryList = await request(app)
      .get(`/api/v1/staff/inventory?branchId=${otherBranch.id}&lowStock=false`)
      .set("Cookie", staffSession.cookie);
    expect(inventoryList.status).toBe(200);
    expect(inventoryList.body.data.items).toHaveLength(1);

    const expiry = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
    const reservations = await Promise.all([
      request(app)
        .post(`/api/v1/staff/inventory/${inventoryId}/reservations`)
        .set(mutation(staffSession))
        .set("Idempotency-Key", `reserve-${randomUUID()}`)
        .send({ quantity: 6, expiresAt: expiry, customerId: customer.profile?.id }),
      request(app)
        .post(`/api/v1/staff/inventory/${inventoryId}/reservations`)
        .set(mutation(staffSession))
        .set("Idempotency-Key", `reserve-${randomUUID()}`)
        .send({ quantity: 6, expiresAt: expiry, customerId: customer.profile?.id }),
    ]);
    expect(reservations.map(({ status }) => status).sort()).toEqual([201, 409]);
    const winningReservation = reservations.find(({ status }) => status === 201);
    expect(winningReservation?.body.data.inventory.reserved).toBe(6);
    const reservedVersion = winningReservation?.body.data.inventory.version as number;
    const activeReservations = await request(app)
      .get(`/api/v1/staff/inventory/${inventoryId}/reservations?status=ACTIVE`)
      .set("Cookie", staffSession.cookie);
    expect(activeReservations.status).toBe(200);
    expect(activeReservations.body.data.items).toHaveLength(1);
    const reorderConflict = await request(app)
      .patch(`/api/v1/staff/inventory/${inventoryId}`)
      .set(mutation(staffSession))
      .send({ reorderLevel: 5, expectedVersion: reservedVersion - 1 });
    expect(reorderConflict.status).toBe(409);
    const reorderUpdated = await request(app)
      .patch(`/api/v1/staff/inventory/${inventoryId}`)
      .set(mutation(staffSession))
      .send({ reorderLevel: 5, expectedVersion: reservedVersion });
    expect(reorderUpdated.status).toBe(200);
    const lowStock = await request(app)
      .get("/api/v1/staff/inventory?lowStock=true")
      .set("Cookie", staffSession.cookie);
    expect(lowStock.status).toBe(200);
    expect(lowStock.body.data.items).toHaveLength(1);

    const favourite = await request(app)
      .put(`/api/v1/customers/favourites/${productId}`)
      .set(mutation(customerSession))
      .send({});
    expect(favourite.status).toBe(200);
    const favourites = await request(app)
      .get("/api/v1/customers/favourites")
      .set("Cookie", customerSession.cookie);
    expect(favourites.status).toBe(200);
    expect(favourites.body.data.items).toHaveLength(1);
    const cart = await request(app)
      .put(`/api/v1/customers/cart/items/${productId}`)
      .set(mutation(customerSession))
      .send({ quantity: 2 });
    expect(cart.status).toBe(200);
    expect(cart.body.data.subtotalKobo).toBe("250000");

    const reservationId = winningReservation?.body.data.reservation.id as string;
    const release = await request(app)
      .post(
        `/api/v1/staff/inventory/${inventoryId}/reservations/${reservationId}/release`,
      )
      .set(mutation(staffSession))
      .set("Idempotency-Key", `release-${randomUUID()}`)
      .send({ note: "Customer changed request" });
    expect(release.status).toBe(200);
    expect(release.body.data.inventory.reserved).toBe(0);

    const movement = async (body: Record<string, unknown>) =>
      request(app)
        .post(`/api/v1/staff/inventory/${inventoryId}/movements`)
        .set(mutation(staffSession))
        .set("Idempotency-Key", `movement-${randomUUID()}`)
        .send(body);
    expect(
      (await movement({ type: "DAMAGE", quantity: 1, note: "Damaged packaging" })).status,
    ).toBe(200);
    expect(
      (
        await movement({
          type: "RETURN",
          quantity: 1,
          referenceType: "MANUAL",
          referenceId: "return-1",
        })
      ).status,
    ).toBe(200);
    expect((await movement({ type: "SALE", quantity: 1 })).status).toBe(200);
    const currentInventory = await request(app)
      .get(`/api/v1/staff/inventory/${inventoryId}`)
      .set("Cookie", staffSession.cookie);
    expect(currentInventory.status).toBe(200);
    expect(
      (
        await movement({
          type: "ADJUSTMENT",
          targetQuantity: currentInventory.body.data.quantity + 2,
          note: "Verified cycle count",
        })
      ).status,
    ).toBe(200);

    const history = await request(app)
      .get(`/api/v1/staff/inventory/${inventoryId}/history`)
      .set("Cookie", staffSession.cookie);
    expect(history.status).toBe(200);
    expect(history.body.data.items.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining(["STOCK_IN", "RESERVATION", "RESERVATION_RELEASE"]),
    );
    expect(JSON.stringify(history.body)).not.toContain(stockKey);
    const stockHistory = await request(app)
      .get(`/api/v1/staff/inventory/${inventoryId}/history?type=STOCK_IN`)
      .set("Cookie", staffSession.cookie);
    expect(stockHistory.body.data.items).toHaveLength(1);

    expect(
      (
        await request(app)
          .delete(`/api/v1/customers/cart/items/${productId}`)
          .set(mutation(customerSession))
          .send({})
      ).status,
    ).toBe(200);
    await request(app)
      .put(`/api/v1/customers/cart/items/${productId}`)
      .set(mutation(customerSession))
      .send({ quantity: 1 })
      .expect(200);
    await request(app)
      .delete("/api/v1/customers/cart")
      .set(mutation(customerSession))
      .send({})
      .expect(200);
    await request(app)
      .delete(`/api/v1/customers/favourites/${productId}`)
      .set(mutation(customerSession))
      .send({})
      .expect(200);

    const categoryStillUsed = await request(app)
      .patch(`/api/v1/admin/catalog/categories/${categoryId}`)
      .set(mutation(adminSession))
      .send({ isActive: false });
    expect(categoryStillUsed.status).toBe(409);
    await request(app)
      .patch(`/api/v1/admin/catalog/products/${productId}`)
      .set(mutation(adminSession))
      .send({ isActive: false })
      .expect(200);
    await request(app)
      .patch(`/api/v1/admin/catalog/categories/${categoryId}`)
      .set(mutation(adminSession))
      .send({ isActive: false })
      .expect(200);
    await request(app)
      .delete(`/api/v1/admin/catalog/products/${productId}/images/${imageId}`)
      .set(mutation(adminSession))
      .send({})
      .expect(200);
    await request(app)
      .delete(
        `/api/v1/admin/catalog/products/${productId}/compatibilities/${compatibilityId}`,
      )
      .set(mutation(adminSession))
      .send({})
      .expect(200);

    await expect(
      prisma.inventoryTransaction.update({
        where: { id: stocked.body.data.transaction.id as string },
        data: { note: "tampered" },
      }),
    ).rejects.toThrow();
  }, 60_000);
});
