import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyResendSignature } from "../../src/providers/messaging/resend-webhook.routes.js";

const secret = `whsec_${Buffer.from("synthetic-test-only-signing-key-32bytes").toString("base64")}`;
const id = "msg_synthetic_1";
const body = Buffer.from('{"type":"email.delivered"}');
function headers(at = Math.floor(Date.now() / 1000), raw = body) {
  const timestamp = String(at);
  const key = Buffer.from(secret.slice(6), "base64");
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.`)
    .update(raw)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  };
}
describe("Resend signed event boundary", () => {
  it("accepts only exact signed raw bytes", () => {
    expect(verifyResendSignature(body, headers(), secret)).toBe(id);
    expect(
      verifyResendSignature(
        Buffer.from('{"type": "email.delivered"}'),
        headers(),
        secret,
      ),
    ).toBeNull();
    expect(
      verifyResendSignature(
        body,
        { ...headers(), "svix-signature": "v1,invalid" },
        secret,
      ),
    ).toBeNull();
  });
  it("rejects expired and future requests", () => {
    expect(
      verifyResendSignature(body, headers(Math.floor(Date.now() / 1000) - 301), secret),
    ).toBeNull();
    expect(
      verifyResendSignature(body, headers(Math.floor(Date.now() / 1000) + 301), secret),
    ).toBeNull();
  });
});
