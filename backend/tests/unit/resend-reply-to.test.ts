import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { ResendEmailProvider } from "../../src/providers/messaging/resend-email.adapter.js";
import { emailSenderSchema } from "../../src/config/email-settings.js";

const previous = env.RESEND_REPLY_TO_EMAIL;
afterEach(() => {
  env.RESEND_REPLY_TO_EMAIL = previous;
  vi.unstubAllGlobals();
});

describe("transactional reply routing", () => {
  it("preserves the branded company sender and uses the validated customer Reply-To", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await new ResendEmailProvider(
      "synthetic-key",
      "Allied AutoTech <notifications@notify.example.test>",
      "support@example.test",
    ).send({
      to: "sales@example.test",
      replyTo: "customer@example.test",
      subject: "Enquiry",
      text: "Test",
      html: "<p>Test</p>",
      idempotencyKey: "same-event",
    });
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      from: "Allied AutoTech <notifications@notify.example.test>",
      reply_to: "customer@example.test",
      to: ["sales@example.test"],
    });
  });
  it.each([
    "Allied <invalid>",
    "Name\r\nBcc: other@example.test <sender@example.test>",
    "one@example.test,two@example.test",
    "<sender@example.test>",
  ])("rejects invalid sender %s", (value) => {
    expect(emailSenderSchema.safeParse(value).success).toBe(false);
  });
  it("rejects an invalid customer Reply-To before network I/O", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      new ResendEmailProvider("synthetic-key", "sender@example.test").send({
        to: "support@example.test",
        replyTo: "bad\r\nBcc: attacker@example.test",
        subject: "Test",
        text: "Test",
        html: "Test",
        idempotencyKey: "test",
      }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
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
