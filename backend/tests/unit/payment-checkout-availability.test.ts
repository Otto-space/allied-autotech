import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
const original = { paystack: env.PAYSTACK_MODE, monnify: env.MONNIFY_MODE };
afterEach(() => {
  env.PAYSTACK_MODE = original.paystack;
  env.MONNIFY_MODE = original.monnify;
  vi.restoreAllMocks();
});
const customer: AuthenticatedActor = {
  userId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  email: "synthetic@example.test",
  role: "CUSTOMER",
  mfaRequired: false,
  mfaVerifiedAt: null,
};
describe("owned payment checkout availability", () => {
  it("returns only registered providers whose server mode is enabled", () => {
    const registry = new PaymentProviderRegistry({
      PAYSTACK: {} as PaymentProviderPort,
      MONNIFY: {} as PaymentProviderPort,
    });
    env.PAYSTACK_MODE = "disabled";
    env.MONNIFY_MODE = "disabled";
    expect(registry.enabledProviders()).toEqual([]);
    env.PAYSTACK_MODE = "test";
    expect(registry.enabledProviders()).toEqual(["PAYSTACK"]);
    env.MONNIFY_MODE = "sandbox";
    expect(registry.enabledProviders()).toEqual(["PAYSTACK", "MONNIFY"]);
    env.PAYSTACK_MODE = "disabled";
    expect(registry.enabledProviders()).toEqual(["MONNIFY"]);
    expect(new PaymentProviderRegistry({}).enabledProviders()).toEqual([]);
  });
  it("adds names to an owned read without changing monetary serialization", async () => {
    const profileId = crypto.randomUUID(),
      paymentId = crypto.randomUUID();
    const findFirst = vi.fn().mockResolvedValue({
      id: paymentId,
      amountKobo: BigInt(12345),
      status: "REQUIRES_PAYMENT",
    });
    const database = {
      customerProfile: { findUnique: vi.fn().mockResolvedValue({ id: profileId }) },
      payment: { findFirst },
    } as unknown as PrismaClient;
    const registry = new PaymentProviderRegistry({});
    vi.spyOn(registry, "enabledProviders").mockReturnValue(["PAYSTACK"]);
    expect(
      await new PaymentsService(database, registry).customerGet(customer, paymentId),
    ).toEqual({
      id: paymentId,
      amountKobo: "12345",
      status: "REQUIRES_PAYMENT",
      checkoutProviders: ["PAYSTACK"],
      reversalReported: false,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: paymentId, customerId: profileId } }),
    );
  });
  it("does not expose availability through a missing or unowned payment", async () => {
    const database = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }),
      },
      payment: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    const registry = new PaymentProviderRegistry({});
    const enabled = vi.spyOn(registry, "enabledProviders");
    await expect(
      new PaymentsService(database, registry).customerGet(customer, crypto.randomUUID()),
    ).rejects.toThrow();
    expect(enabled).not.toHaveBeenCalled();
  });
  it.each(["STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
    "rejects %s before reading customer data",
    async (role) => {
      const findUnique = vi.fn();
      const database = { customerProfile: { findUnique } } as unknown as PrismaClient;
      await expect(
        new PaymentsService(database).customerGet(
          { ...customer, role },
          crypto.randomUUID(),
        ),
      ).rejects.toThrow();
      expect(findUnique).not.toHaveBeenCalled();
    },
  );
});

it("exposes only reversal existence, never internal observations", async () => {
  const profileId = crypto.randomUUID(),
    paymentId = crypto.randomUUID();
  const database = {
    customerProfile: { findUnique: vi.fn().mockResolvedValue({ id: profileId }) },
    payment: {
      findFirst: vi.fn().mockResolvedValue({
        id: paymentId,
        amountKobo: 12345n,
        status: "SUCCEEDED",
        anomalies: [{ id: crypto.randomUUID() }],
      }),
    },
  } as unknown as PrismaClient;
  const result = await new PaymentsService(
    database,
    new PaymentProviderRegistry({}),
  ).customerGet(customer, paymentId);
  expect(result).toEqual({
    id: paymentId,
    amountKobo: "12345",
    status: "SUCCEEDED",
    reversalReported: true,
    checkoutProviders: [],
  });
});
