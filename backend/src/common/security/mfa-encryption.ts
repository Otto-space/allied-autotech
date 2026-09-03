import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { env } from "../../config/env.js";

export interface EncryptedEnvelope {
  version: 1;
  keyId: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

type EncryptionPurpose = "totp-secret" | "identity-outbox";

function deriveKey(keyMaterial: string, purpose: EncryptionPurpose): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(keyMaterial, "base64"),
      Buffer.from("allied-autotech:identity:v1", "utf8"),
      Buffer.from(purpose, "utf8"),
      32,
    ),
  );
}

function encrypt(
  plaintext: string,
  purpose: EncryptionPurpose,
  keyMaterial: string,
  keyId: string,
): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(keyMaterial, purpose), iv);
  cipher.setAAD(Buffer.from(`${purpose}:${keyId}:v1`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    version: 1,
    keyId,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(
  envelope: EncryptedEnvelope,
  purpose: EncryptionPurpose,
  keyMaterial: string,
  expectedKeyId: string,
): string {
  if (envelope.version !== 1 || envelope.keyId !== expectedKeyId) {
    throw new Error("Unsupported encrypted identity payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(keyMaterial, purpose),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(`${purpose}:${envelope.keyId}:v1`, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptTotpSecret(secret: string): EncryptedEnvelope {
  return encrypt(
    secret,
    "totp-secret",
    env.MFA_ENCRYPTION_KEY,
    env.MFA_ENCRYPTION_KEY_ID,
  );
}

export function decryptTotpSecret(envelope: EncryptedEnvelope): string {
  return decrypt(
    envelope,
    "totp-secret",
    env.MFA_ENCRYPTION_KEY,
    env.MFA_ENCRYPTION_KEY_ID,
  );
}

export function encryptIdentityPayload(payload: unknown): EncryptedEnvelope {
  return encrypt(
    JSON.stringify(payload),
    "identity-outbox",
    env.OUTBOX_ENCRYPTION_KEY,
    env.OUTBOX_ENCRYPTION_KEY_ID,
  );
}

export function decryptIdentityPayload<T>(envelope: EncryptedEnvelope): T {
  return JSON.parse(
    decrypt(
      envelope,
      "identity-outbox",
      env.OUTBOX_ENCRYPTION_KEY,
      env.OUTBOX_ENCRYPTION_KEY_ID,
    ),
  ) as T;
}

export function serializeEncryptedEnvelope(
  envelope: EncryptedEnvelope,
): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(JSON.stringify(envelope), "utf8"));
}

export function parseEncryptedEnvelope(value: Uint8Array): EncryptedEnvelope {
  return JSON.parse(Buffer.from(value).toString("utf8")) as EncryptedEnvelope;
}
