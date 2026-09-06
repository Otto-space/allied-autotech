import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { env } from "../../config/env.js";

export interface PaymentEvidenceTicket {
  actorUserId: string;
  paymentId: string;
  objectKey: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  sizeBytes: number;
  checksumSha256: string;
  expiresAt: number;
}
const key = () =>
  Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(env.ASSET_TICKET_KEY, "base64"),
      Buffer.from("allied-autotech:assets:v1"),
      Buffer.from("payment-evidence-ticket"),
      32,
    ),
  );
export function issuePaymentEvidenceTicket(
  input: Omit<PaymentEvidenceTicket, "objectKey" | "expiresAt">,
) {
  const payload: PaymentEvidenceTicket = {
    ...input,
    objectKey: `payments/${input.paymentId}/manual-evidence/${randomUUID()}`,
    expiresAt: Date.now() + env.ASSET_UPLOAD_TTL_SECONDS * 1_000,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`payment-evidence:${env.ASSET_TICKET_KEY_ID}`));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
  ]);
  return {
    payload,
    ticket: Buffer.from(
      JSON.stringify({
        v: 1,
        kid: env.ASSET_TICKET_KEY_ID,
        iv: iv.toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
      }),
    ).toString("base64url"),
  };
}
export function readPaymentEvidenceTicket(ticket: string): PaymentEvidenceTicket {
  const value = JSON.parse(Buffer.from(ticket, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
  if (
    value["v"] !== 1 ||
    value["kid"] !== env.ASSET_TICKET_KEY_ID ||
    typeof value["iv"] !== "string" ||
    typeof value["ciphertext"] !== "string" ||
    typeof value["tag"] !== "string"
  )
    throw new Error("Invalid evidence ticket");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(value["iv"], "base64url"),
  );
  decipher.setAAD(Buffer.from(`payment-evidence:${env.ASSET_TICKET_KEY_ID}`));
  decipher.setAuthTag(Buffer.from(value["tag"], "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(value["ciphertext"], "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as PaymentEvidenceTicket;
}
