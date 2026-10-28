import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), createMany: vi.fn() }));
vi.mock("../../src/config/database.js", () => ({ prisma: { outboxEvent: mocks } }));
import { env } from "../../src/config/env.js";
import { createResendWebhookRouter } from "../../src/providers/messaging/resend-webhook.routes.js";

const signingSecret = `whsec_${Buffer.from("synthetic-only-resend-webhook-signing-key").toString("base64")}`;
const sourceId = "51000000-0000-4000-8000-000000000001";
const event = {
  type: "email.delivered",
  created_at: "2026-10-23T09:00:00.000Z",
  data: {
    email_id: "provider-test-id",
    to: ["private@example.test"],
    tags: { support_outbox_event_id: sourceId },
  },
};
function signed(body: string, id = "msg_test_1") {
  const at = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", Buffer.from(signingSecret.slice(6), "base64"))
    .update(`${id}.${at}.${body}`)
    .digest("base64");
  return { "svix-id": id, "svix-timestamp": at, "svix-signature": `v1,${signature}` };
}
const app = express();
app.use(
  "/webhooks/resend",
  express.raw({ type: "application/json", limit: "256kb" }),
  createResendWebhookRouter(),
);
const originalSecret = env.RESEND_WEBHOOK_SECRET;
afterEach(() => {
  env.RESEND_WEBHOOK_SECRET = originalSecret;
  vi.clearAllMocks();
});
describe("Resend Support outcome ingestion", () => {
  it("rejects unauthenticated requests without touching the database", async () => {
    env.RESEND_WEBHOOK_SECRET = signingSecret;
    const result = await request(app)
      .post("/webhooks/resend")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event));
    expect(result.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("retains only a signed, tagged Support event and deduplicates replays", async () => {
    env.RESEND_WEBHOOK_SECRET = signingSecret;
    mocks.findFirst.mockResolvedValue({ id: sourceId });
    mocks.createMany.mockResolvedValue({ count: 1 });
    const body = JSON.stringify(event);
    const headers = signed(body);
    for (const expectedCount of [1, 0]) {
      mocks.createMany.mockResolvedValueOnce({ count: expectedCount });
      const result = await request(app)
        .post("/webhooks/resend")
        .set("Content-Type", "application/json")
        .set(headers)
        .send(body);
      expect(result.status).toBe(204);
    }
    expect(mocks.createMany).toHaveBeenCalledTimes(2);
    const first = mocks.createMany.mock.calls[0]![0];
    expect(first.skipDuplicates).toBe(true);
    expect(first.data[0]).toMatchObject({
      aggregateId: sourceId,
      payload: { type: "email.delivered" },
    });
    expect(JSON.stringify(first)).not.toContain("private@example.test");
    expect(JSON.stringify(first)).not.toContain("provider-test-id");
  });
});
