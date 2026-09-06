import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { env } from "../../config/env.js";

export type VehicleAssetKind = "IMAGE" | "DOCUMENT" | "CONDITION_REPORT" | "HANDOVER";

export interface VehicleAssetTicket {
  actorUserId: string;
  vehicleId: string;
  kind: VehicleAssetKind;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  expiresAt: number;
}

function key(): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(env.ASSET_TICKET_KEY, "base64"),
      Buffer.from("allied-autotech:assets:v1", "utf8"),
      Buffer.from("vehicle-upload-ticket", "utf8"),
      32,
    ),
  );
}

export function issueVehicleAssetTicket(
  input: Omit<VehicleAssetTicket, "objectKey" | "expiresAt">,
): { ticket: string; payload: VehicleAssetTicket } {
  const payload: VehicleAssetTicket = {
    ...input,
    objectKey: `vehicles/${input.vehicleId}/${input.kind.toLowerCase()}/${randomUUID()}`,
    expiresAt: Date.now() + env.ASSET_UPLOAD_TTL_SECONDS * 1_000,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`vehicle-upload:${env.ASSET_TICKET_KEY_ID}`, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
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
      "utf8",
    ).toString("base64url"),
  };
}

export function readVehicleAssetTicket(ticket: string): VehicleAssetTicket {
  const envelope = JSON.parse(Buffer.from(ticket, "base64url").toString("utf8")) as {
    v?: unknown;
    kid?: unknown;
    iv?: unknown;
    ciphertext?: unknown;
    tag?: unknown;
  };
  if (
    envelope.v !== 1 ||
    envelope.kid !== env.ASSET_TICKET_KEY_ID ||
    typeof envelope.iv !== "string" ||
    typeof envelope.ciphertext !== "string" ||
    typeof envelope.tag !== "string"
  )
    throw new Error("Invalid asset ticket");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(`vehicle-upload:${env.ASSET_TICKET_KEY_ID}`, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as VehicleAssetTicket;
}
