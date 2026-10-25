import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  publicEnquiryCreateBodySchema,
  customerEnquiryCreateBodySchema,
} from "../../src/modules/support/support.schemas.js";

vi.mock("../../src/config/database.js", () => ({ prisma: {} }));
vi.mock("../../src/modules/audit/audit.service.js", () => ({
  appendAuditEvent: vi.fn(),
}));
vi.mock("../../src/modules/support/department-email.js", () => ({
  enqueueDepartmentEmail: vi.fn(),
}));
vi.mock("../../src/modules/notifications/team-notifications.js", () => ({
  notifySupportTeam: vi.fn(),
}));
import { SupportService } from "../../src/modules/support/support.service.js";

const branchId = "51000000-0000-4000-8000-000000000001";
const productId = "51000000-0000-4000-8000-000000000002";
const input = {
  type: "PRODUCT" as const,
  subject: "Parts verification request",
  message: "Please check the right replacement filter for my vehicle.",
  name: "Isolated test customer",
  email: "parts@example.test",
};
function harness(branches = [{ id: branchId }]) {
  const tx = {
    branch: {
      findMany: vi.fn().mockResolvedValue(branches),
      findFirst: vi.fn().mockResolvedValue({ id: branchId }),
    },
    product: { findFirst: vi.fn().mockResolvedValue(null) },
    enquiry: {
      create: vi
        .fn()
        .mockResolvedValue({ id: productId, status: "OPEN", createdAt: new Date() }),
    },
  };
  const db = { $transaction: (run: (transaction: typeof tx) => unknown) => run(tx) };
  return { tx, service: new SupportService(db as unknown as PrismaClient) };
}
const context = { requestId: "parts-unit", ipAddress: null, userAgent: null };
describe("unlisted public parts enquiries", () => {
  it("accepts unlinked Product classification without fabricating a product reference", () => {
    expect(publicEnquiryCreateBodySchema.parse(input)).toEqual(input);
    expect(
      customerEnquiryCreateBodySchema.safeParse({
        type: "PRODUCT",
        subject: input.subject,
        message: input.message,
      }).success,
    ).toBe(false);
    for (const invalid of [
      { ...input, productId: "invalid" },
      { ...input, type: "SERVICE" },
      { ...input, type: "VEHICLE" },
      { ...input, customerId: productId },
    ])
      expect(publicEnquiryCreateBodySchema.safeParse(invalid).success).toBe(false);
  });
  it("resolves the actual sole active branch and retains the Product category", async () => {
    const { service, tx } = harness();
    await service.createPublicEnquiry(
      publicEnquiryCreateBodySchema.parse(input),
      context,
    );
    expect(tx.product.findFirst).not.toHaveBeenCalled();
    expect(tx.enquiry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId,
          type: "PRODUCT",
          subject: input.subject,
        }),
      }),
    );
    expect(tx.enquiry.create.mock.calls[0][0].data.productId).toBeUndefined();
  });
  it("still rejects nonexistent supplied products before creating any enquiry", async () => {
    const { service, tx } = harness();
    await expect(
      service.createPublicEnquiry({ ...input, productId }, context),
    ).rejects.toThrow();
    expect(tx.product.findFirst).toHaveBeenCalled();
    expect(tx.enquiry.create).not.toHaveBeenCalled();
  });
  it("requires a branch choice when there is no unique active workshop", async () => {
    const { service, tx } = harness([{ id: branchId }, { id: productId }]);
    await expect(service.createPublicEnquiry(input, context)).rejects.toThrow();
    expect(tx.enquiry.create).not.toHaveBeenCalled();
  });
});
