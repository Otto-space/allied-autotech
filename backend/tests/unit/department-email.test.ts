import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import {
  encryptNotificationPayload,
  decryptNotificationPayload,
} from "../../src/common/security/mfa-encryption.js";
import {
  departmentRecipient,
  enqueueDepartmentEmail,
} from "../../src/modules/support/department-email.js";
import { DepartmentEmailWorker } from "../../src/workers/department-email.worker.js";
import { providerRejected } from "../../src/common/errors/provider-error-mapper.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";

const saved = { ...env };
afterEach(() => Object.assign(env, saved));
const settings = {
  ...env,
  DEPARTMENT_INFO_EMAIL: "info@example.test",
  DEPARTMENT_SALES_EMAIL: "sales@example.test",
  DEPARTMENT_SUPPORT_EMAIL: "support@example.test",
};
const payload = {
  recipient: "support@example.test",
  replyTo: "customer@example.test",
  title: "New enquiry",
  message: "<script>untrusted</script>",
};

function harness(attempts = 1, owned = 1) {
  const event = {
    id: "event-row",
    eventId: "stable-provider-key",
    attempts,
    payload: { encrypted: encryptNotificationPayload(payload) },
  };
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([event]),
    $executeRaw: vi.fn().mockResolvedValue(owned),
    outboxEvent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const email = { send: vi.fn().mockResolvedValue(undefined) };
  return {
    database,
    email,
    worker: new DepartmentEmailWorker(email, database as unknown as PrismaClient),
  };
}

describe("department email routing and delivery", () => {
  it.each([
    ["GENERAL", "info"],
    ["PRODUCT", "sales"],
    ["VEHICLE", "sales"],
    ["QUOTATION", "sales"],
    ["SERVICE", "support"],
    ["BOOKING", "support"],
    ["COMPLAINT", "support"],
  ])("routes %s to %s", (type, department) => {
    expect(departmentRecipient(type!, settings)).toBe(`${department}@example.test`);
  });
  it("queues encrypted content in the caller's transaction and records disabled delivery", async () => {
    Object.assign(env, settings, { EMAIL_DELIVERY_ENABLED: false });
    const create = vi.fn().mockResolvedValue({});
    await enqueueDepartmentEmail(
      { outboxEvent: { create } } as unknown as Prisma.TransactionClient,
      {
        id: "request-id",
        type: "GENERAL",
        email: "customer@example.test",
        subject: "Question",
        message: "Private message",
      },
    );
    const data = create.mock.calls[0]![0].data;
    expect(data.status).toBe("DEAD_LETTER");
    expect(JSON.stringify(data.payload)).not.toContain("Private message");
    expect(decryptNotificationPayload(data.payload.encrypted)).toMatchObject({
      recipient: "info@example.test",
      replyTo: "customer@example.test",
    });
  });
  it("does not claim work when delivery is disabled", async () => {
    const h = harness();
    await new DepartmentEmailWorker(
      null,
      h.database as unknown as PrismaClient,
    ).runOnce();
    expect(h.database.$queryRaw).not.toHaveBeenCalled();
  });
  it("delivers escaped content with stable retry identity and fences completion by attempt", async () => {
    const h = harness();
    await h.worker.runOnce();
    await h.worker.runOnce();
    expect(h.email.send).toHaveBeenCalledTimes(2);
    for (const call of h.email.send.mock.calls)
      expect(call[0]).toMatchObject({
        to: payload.recipient,
        replyTo: payload.replyTo,
        idempotencyKey: "stable-provider-key",
        html: expect.stringContaining("&lt;script&gt;"),
      });
    expect(h.database.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-row", status: "PROCESSING", attempts: 1 },
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });
  it("does not deliver a claim already taken by another worker", async () => {
    const h = harness(1, 0);
    await h.worker.runOnce();
    expect(h.email.send).not.toHaveBeenCalled();
  });
  it("blocks department broadcasts in staging unless explicitly allowlisted", async () => {
    Object.assign(env, {
      DEPLOYMENT_ENV: "staging",
      STAGING_EMAIL_ALLOWLIST: ["tester@example.test"],
    });
    const h = harness();
    await h.worker.runOnce();
    expect(h.email.send).not.toHaveBeenCalled();
    expect(h.database.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DEAD_LETTER",
          lastError: "STAGING_RECIPIENT_NOT_ALLOWLISTED",
        }),
      }),
    );
  });
  it.each([1, 8])("bounds retry attempts at %s", async (attempts) => {
    const h = harness(attempts);
    h.email.send.mockRejectedValue(new Error("transient"));
    await h.worker.runOnce();
    expect(h.database.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: attempts === 8 ? "DEAD_LETTER" : "FAILED",
        }),
      }),
    );
  });
  it("does not retry provider rejections", async () => {
    const h = harness();
    h.email.send.mockRejectedValue(providerRejected());
    await h.worker.runOnce();
    expect(h.database.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DEAD_LETTER" }),
      }),
    );
  });
});
