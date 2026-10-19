import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { ResendEmailProvider } from "../../src/providers/messaging/resend-email.adapter.js";

const previous = env.RESEND_REPLY_TO_EMAIL;
afterEach(() => {
  env.RESEND_REPLY_TO_EMAIL = previous;
  vi.unstubAllGlobals();
});

describe("transactional reply routing", () => {
  it.each([undefined, "support@example.test"])(
    "uses the configured reply destination %s without changing delivery or idempotency",
    async (replyTo) => {
      env.RESEND_REPLY_TO_EMAIL = replyTo;
      const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetch);
      await new ResendEmailProvider("synthetic-key", "noreply@mail.example.test").send({
        to: "tester@example.test",
        subject: "Verify your account",
        text: "Synthetic verification content",
        html: "<p>Synthetic verification content</p>",
        idempotencyKey: "synthetic-event-id",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, request] = fetch.mock.calls[0]!;
      expect(url).toBe("https://api.resend.com/emails");
      expect(request.headers["idempotency-key"]).toBe("synthetic-event-id");
      const body = JSON.parse(request.body);
      expect(body.from).toBe("noreply@mail.example.test");
      expect(body.to).toEqual(["tester@example.test"]);
      if (replyTo === undefined) expect(body).not.toHaveProperty("reply_to");
      else expect(body.reply_to).toBe(replyTo);
    },
  );
});
