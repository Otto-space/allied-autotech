import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import {
  encryptNotificationPayload,
  decryptNotificationPayload,
} from "../../src/common/security/mfa-encryption.js";
import {
  enqueueSupportCustomerUpdate,
  renderSupportCustomerEmail,
  supportEmailDeliveries,
} from "../../src/modules/support/customer-email.js";
import { SupportCustomerEmailWorker } from "../../src/workers/support-customer-email.worker.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { providerRejected } from "../../src/common/errors/provider-error-mapper.js";

const saved = { ...env };
afterEach(() => Object.assign(env, saved));
const id = "51000000-0000-4000-8000-000000000001";
const userId = "51000000-0000-4000-8000-000000000002";
const payload = {
  recipient: "guest@example.test",
  replyTo: "support@example.test",
  userId: null,
  kind: "enquiry" as const,
  conversationId: id,
  title: "New enquiry response",
  message: "<script>private reply</script>",
};
function transaction(optedOut = false) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: { findUnique: vi.fn().mockResolvedValue({ email: "account@example.test" }) },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue({ enabled: !optedOut }),
    },
    notification: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: userId }),
    },
    outboxEvent: {
      create: vi.fn().mockResolvedValue({ id }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}
function harness(attempts = 1, owned = 1, registered = false) {
  const event = {
    id,
    eventId: id,
    attempts,
    payload: {
      encrypted: encryptNotificationPayload({
        ...payload,
        userId: registered ? userId : null,
      }),
    },
  };
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([event]),
    $executeRaw: vi.fn().mockResolvedValue(owned),
    notificationPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    outboxEvent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const email = { send: vi.fn().mockResolvedValue(undefined) };
  return {
    event,
    database,
    email,
    worker: new SupportCustomerEmailWorker(email, database as unknown as PrismaClient),
  };
}
describe("support customer email", () => {
  it.each([false, true])(
    "queues exactly one encrypted resolution email; linked=%s",
    async (linked) => {
      Object.assign(env, {
        EMAIL_DELIVERY_ENABLED: true,
        DEPARTMENT_SUPPORT_EMAIL: payload.replyTo,
      });
      const tx = transaction();
      await enqueueSupportCustomerUpdate(tx as unknown as Prisma.TransactionClient, {
        kind: "enquiry",
        record: { id, email: payload.recipient, customer: linked ? { userId } : null },
        messageId: id,
        status: "RESOLVED",
        response: "Private final answer",
        version: 2,
      });
      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      const data = tx.outboxEvent.create.mock.calls[0]![0].data;
      expect(data.status).toBe("PENDING");
      expect(JSON.stringify(data)).not.toContain("Private final answer");
      const decoded = decryptNotificationPayload<{
        message: string;
        recipient: string;
        replyTo: string;
      }>(data.payload.encrypted);
      expect(decoded.replyTo).toBe(payload.replyTo);
      expect(decoded.recipient).toBe(linked ? "account@example.test" : payload.recipient);
      expect(decoded.message.includes("Private final answer")).toBe(!linked);
      expect(tx.notification.create).toHaveBeenCalledTimes(linked ? 1 : 0);
    },
  );
  it.each(["disabled", "optout", "missing-email", "missing-support"])(
    "records why email is not sent: %s",
    async (reason) => {
      Object.assign(env, {
        EMAIL_DELIVERY_ENABLED: reason !== "disabled",
        DEPARTMENT_SUPPORT_EMAIL:
          reason === "missing-support" ? undefined : payload.replyTo,
        RESEND_REPLY_TO_EMAIL: undefined,
      });
      const tx = transaction(reason === "optout");
      await enqueueSupportCustomerUpdate(tx as unknown as Prisma.TransactionClient, {
        kind: "complaint",
        record: {
          id,
          email: reason === "missing-email" ? null : payload.recipient,
          customer: reason === "optout" ? { userId } : null,
        },
        messageId: id,
        response: "Answer",
      });
      expect(tx.outboxEvent.create.mock.calls[0]![0].data).toMatchObject({
        status: "DEAD_LETTER",
        lastError: {
          disabled: "CHANNEL_DISABLED",
          optout: "CONSENT_WITHDRAWN",
          "missing-email": "NO_RECIPIENT",
          "missing-support": "SUPPORT_REPLY_ADDRESS_MISSING",
        }[reason],
      });
    },
  );
  it("escapes guest text and does not invent an account link", () => {
    const rendered = renderSupportCustomerEmail(payload);
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.text).toContain(payload.message);
    expect(rendered.html).not.toContain("/dashboard/");
    expect(rendered.html).toContain('href="https://alliedautotech.com/help"');
  });
  it("uses the configured frontend and the real authenticated support route", () => {
    env.FRONTEND_URL = ["https://allied.example.test"];
    expect(renderSupportCustomerEmail({ ...payload, userId }).text).toContain(
      `https://allied.example.test/dashboard/support/enquiries/${id}`,
    );
  });
  it("does not claim work when email is disabled", async () => {
    const h = harness();
    await new SupportCustomerEmailWorker(
      null,
      h.database as unknown as PrismaClient,
    ).runOnce();
    expect(h.database.$queryRaw).not.toHaveBeenCalled();
  });
  it("sends to the guest with Support Reply-To and a stable provider key", async () => {
    const h = harness();
    await h.worker.runOnce();
    await h.worker.runOnce();
    expect(h.email.send).toHaveBeenCalledTimes(2);
    expect(h.email.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: payload.recipient,
        replyTo: payload.replyTo,
        idempotencyKey: id,
      }),
    );
    expect(h.database.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id, attempts: 1, status: "PROCESSING" },
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });
  it("fences a lost claim", async () => {
    const h = harness(1, 0);
    await h.worker.runOnce();
    expect(h.email.send).not.toHaveBeenCalled();
  });
  it("rechecks email preference before sending", async () => {
    const h = harness(1, 1, true);
    h.database.notificationPreference.findUnique.mockResolvedValue({ enabled: false });
    await h.worker.runOnce();
    expect(h.email.send).not.toHaveBeenCalled();
    expect(h.database.outboxEvent.updateMany.mock.calls[0]![0].data).toMatchObject({
      status: "DEAD_LETTER",
      lastError: "CONSENT_WITHDRAWN",
    });
  });
  it("fails closed on malformed encrypted payload", async () => {
    const h = harness();
    h.event.payload.encrypted.ciphertext = "invalid";
    await h.worker.runOnce();
    expect(h.email.send).not.toHaveBeenCalled();
    expect(h.database.outboxEvent.updateMany.mock.calls[0]![0].data.status).toBe(
      "DEAD_LETTER",
    );
  });
  it("honours staging recipient restrictions", async () => {
    Object.assign(env, {
      DEPLOYMENT_ENV: "staging",
      STAGING_EMAIL_ALLOWLIST: ["allowed@example.test"],
    });
    const h = harness();
    await h.worker.runOnce();
    expect(h.email.send).not.toHaveBeenCalled();
  });
  it.each([1, 8])("bounds retries at attempt %s", async (attempts) => {
    const h = harness(attempts);
    h.email.send.mockRejectedValue(Error("temporary"));
    await h.worker.runOnce();
    expect(h.database.outboxEvent.updateMany.mock.calls[0]![0].data.status).toBe(
      attempts === 8 ? "DEAD_LETTER" : "FAILED",
    );
  });
  it("does not retry a permanent provider rejection", async () => {
    const h = harness();
    h.email.send.mockRejectedValue(providerRejected());
    await h.worker.runOnce();
    expect(h.database.outboxEvent.updateMany.mock.calls[0]![0].data.status).toBe(
      "DEAD_LETTER",
    );
  });
  it("returns bounded redacted delivery metadata, never recipients or payloads", async () => {
    const tx = transaction();
    const date = new Date();
    tx.outboxEvent.findMany.mockResolvedValue([
      { id, status: "PUBLISHED", lastError: null, createdAt: date, publishedAt: date },
      {
        id: userId,
        status: "DEAD_LETTER",
        lastError: "private-provider-text",
        createdAt: date,
        publishedAt: null,
      },
    ]);
    const result = await supportEmailDeliveries(
      tx as unknown as Prisma.TransactionClient,
      id,
    );
    expect(result.items.map((r) => r.status)).toEqual(["SENT", "FAILED"]);
    expect(JSON.stringify(result)).not.toContain("private-provider-text");
    expect(tx.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        where: expect.objectContaining({ aggregateId: id }),
        select: expect.not.objectContaining({ payload: true }),
      }),
    );
  });
});
