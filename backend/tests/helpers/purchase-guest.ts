import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import { decryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";
import { PurchaseGuestAccessService } from "../../src/modules/orders/purchase-guest-access.service.js";
import { assertIsolatedLoopbackDatabase } from "./isolated-database.js";

/** Controlled synthetic recipient: exercise real proof/session logic without
 * invoking an external email transport or manufacturing a User. */
export async function purchaseGuest(email = `purchase-${randomUUID()}@example.test`) {
  await assertIsolatedLoopbackDatabase();
  const access = new PurchaseGuestAccessService();
  const request = await access.request(email);
  const proof = await prisma.purchaseGuestChallenge.findFirstOrThrow({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  const outbox = await prisma.outboxEvent.findFirstOrThrow({
    where: { aggregateId: proof.id },
  });
  const payload = decryptIdentityPayload<IdentityEmailPayload>(
    (
      outbox.payload as unknown as {
        encrypted: Parameters<typeof decryptIdentityPayload>[0];
      }
    ).encrypted,
  );
  const token = new URLSearchParams(new URL(payload.link).hash.slice(1)).get("token");
  if (!token) throw new Error("Synthetic guest proof is missing");
  return access.verify(token, request.browserToken);
}
