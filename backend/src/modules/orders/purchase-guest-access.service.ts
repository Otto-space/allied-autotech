import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { AppError } from "../../common/errors/app-error.js";
import { issueCsrfToken, verifyCsrfToken } from "../../common/security/csrf-tokens.js";
import { normalizeEmail } from "../../common/security/email.js";
import { encryptIdentityPayload } from "../../common/security/mfa-encryption.js";
import { generateOpaqueToken, hashToken } from "../../common/security/session-tokens.js";
import { trustedPurchaseOrigin } from "../../common/security/purchase-origin.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { identityEventTypes } from "../identity/identity.events.js";
import type { IdentityEmailPayload } from "../identity/identity.types.js";

const opaqueToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const emailSchema = z.string().transform(normalizeEmail).pipe(z.email().max(254));
const proofLifetimeSeconds = 15 * 60;
export const purchaseGuestAccessMessage =
  "If this request is eligible, a private purchase-access link will arrive shortly. Open it in this browser. This does not create a customer account.";

function accessInvalid() {
  return new AppError({
    code: "AUTHENTICATION_FAILED",
    statusCode: 401,
    message: "Purchase access is unavailable or has expired. Request a new link.",
  });
}

/** A guest principal is never an AuthenticatedActor and cannot enter account APIs. */
export interface PurchaseGuestAccess {
  guestId: string;
  sessionId: string;
  email: string;
  expiresAt: Date;
}

type AccessCheck = { kind: "read" } | { kind: "write"; csrfToken: string };

export class PurchaseGuestAccessService {
  constructor(private readonly database: PrismaClient = prisma) {}

  /** Caller must require a trusted origin and sensitive IP throttling.
   * No public route is mounted until the complete guest checkout is ready. */
  async request(
    emailInput: string,
    previousBrowserToken?: string,
    requestOrigin?: string,
  ) {
    const email = emailSchema.parse(emailInput);
    const linkOrigin = requestOrigin
      ? trustedPurchaseOrigin(requestOrigin)
      : env.FRONTEND_VERIFY_EMAIL_URL;
    const browserToken = opaqueToken.safeParse(previousBrowserToken).success
      ? previousBrowserToken!
      : generateOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + proofLifetimeSeconds * 1000);
    await withTransactionRetry(this.database, async (tx) => {
      // Recipient-wide bound also stops distributed IPs queueing unbounded mail.
      // The same response and browser cookie are returned whether throttled or not.
      const lock = `purchase-guest-email:${hashToken("throttle-email-ip", email)}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
      const recent = await tx.purchaseGuestChallenge.count({
        where: { email, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
      });
      if (recent >= 3) return;
      const rawToken = generateOpaqueToken();
      const challenge = await tx.purchaseGuestChallenge.create({
        data: {
          email,
          tokenHash: hashToken("purchase-guest-proof", rawToken),
          browserBindingHash: hashToken("purchase-guest-browser", browserToken),
          expiresAt,
        },
        select: { id: true },
      });
      const link = new URL("/purchase/verify", linkOrigin);
      link.hash = new URLSearchParams({ token: rawToken }).toString();
      const payload: IdentityEmailPayload = {
        template: "purchase-guest-access",
        to: email,
        link: link.toString(),
      };
      await tx.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "PurchaseGuestChallenge",
          aggregateId: challenge.id,
          eventType: identityEventTypes.purchaseGuestAccessRequested,
          payload: {
            encrypted: encryptIdentityPayload(payload),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return { message: purchaseGuestAccessMessage, browserToken, expiresAt };
  }

  async verify(rawToken: string, browserToken: string, previousSessionToken?: string) {
    if (
      !opaqueToken.safeParse(rawToken).success ||
      !opaqueToken.safeParse(browserToken).success
    )
      throw accessInvalid();
    const tokenHash = hashToken("purchase-guest-proof", rawToken);
    const browserBindingHash = hashToken("purchase-guest-browser", browserToken);
    return withTransactionRetry(this.database, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseGuestChallenge" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      // Check time after any row-lock wait, not at request arrival.
      const now = new Date();
      // Consume atomically: a link cannot create two sessions under concurrency.
      const consumed = await tx.purchaseGuestChallenge.updateMany({
        where: {
          tokenHash,
          browserBindingHash,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw accessInvalid();
      const challenge = await tx.purchaseGuestChallenge.findUniqueOrThrow({
        where: { tokenHash },
      });
      const guest = await tx.purchaseGuest.upsert({
        where: { email: challenge.email },
        create: { email: challenge.email, verifiedAt: now },
        update: { verifiedAt: now },
        select: { id: true, email: true },
      });
      if (previousSessionToken && opaqueToken.safeParse(previousSessionToken).success)
        await tx.purchaseGuestSession.updateMany({
          where: {
            tokenHash: hashToken("purchase-guest-session", previousSessionToken),
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
      const sessionToken = generateOpaqueToken();
      const csrf = issueCsrfToken();
      const expiresAt = new Date(now.getTime() + env.CUSTOMER_SESSION_TTL_SECONDS * 1000);
      const session = await tx.purchaseGuestSession.create({
        data: {
          guestId: guest.id,
          tokenHash: hashToken("purchase-guest-session", sessionToken),
          csrfTokenHash: csrf.hash,
          expiresAt,
          idleExpiresAt: new Date(
            Math.min(
              expiresAt.getTime(),
              now.getTime() + env.CUSTOMER_SESSION_IDLE_SECONDS * 1000,
            ),
          ),
        },
        select: { id: true },
      });
      return {
        sessionToken,
        csrfToken: csrf.raw,
        access: {
          guestId: guest.id,
          sessionId: session.id,
          email: guest.email,
          expiresAt,
        } satisfies PurchaseGuestAccess,
      };
    });
  }

  async access(sessionToken: string, check: AccessCheck) {
    if (!opaqueToken.safeParse(sessionToken).success) throw accessInvalid();
    return withTransactionRetry(this.database, async (tx) =>
      this.lockAccess(tx, sessionToken, check),
    );
  }

  /** Checkout/payment must call inside their transaction, so revoke/expiry cannot
   * race a previously authenticated operation. No body-supplied guest ID is trusted. */
  async lockAccess(
    tx: Prisma.TransactionClient,
    sessionToken: string,
    check: AccessCheck,
  ): Promise<PurchaseGuestAccess> {
    if (!opaqueToken.safeParse(sessionToken).success) throw accessInvalid();
    const tokenHash = hashToken("purchase-guest-session", sessionToken);
    await tx.$queryRaw`SELECT "id" FROM "PurchaseGuestSession" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    const session = await tx.purchaseGuestSession.findUnique({
      where: { tokenHash },
      include: { guest: { select: { email: true } } },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.idleExpiresAt <= now
    )
      throw accessInvalid();
    if (
      check.kind === "write" &&
      (!opaqueToken.safeParse(check.csrfToken).success ||
        !verifyCsrfToken(check.csrfToken, session.csrfTokenHash))
    )
      throw new AppError({
        code: "CSRF_INVALID",
        statusCode: 403,
        message: "Purchase request validation failed",
      });
    await tx.purchaseGuestSession.update({
      where: { id: session.id },
      data: {
        idleExpiresAt: new Date(
          Math.min(
            session.expiresAt.getTime(),
            now.getTime() + env.CUSTOMER_SESSION_IDLE_SECONDS * 1000,
          ),
        ),
      },
    });
    return {
      guestId: session.guestId,
      sessionId: session.id,
      email: session.guest.email,
      expiresAt: session.expiresAt,
    };
  }

  async rotateCsrf(sessionToken: string) {
    return withTransactionRetry(this.database, async (tx) => {
      const access = await this.lockAccess(tx, sessionToken, { kind: "read" });
      const token = issueCsrfToken();
      await tx.purchaseGuestSession.update({
        where: { id: access.sessionId },
        data: { csrfTokenHash: token.hash },
      });
      return token.raw;
    });
  }

  async revoke(sessionToken: string, csrfToken: string, allSessions = false) {
    await withTransactionRetry(this.database, async (tx) => {
      const access = await this.lockAccess(tx, sessionToken, {
        kind: "write",
        csrfToken,
      });
      await tx.purchaseGuestSession.updateMany({
        where: allSessions
          ? { guestId: access.guestId, revokedAt: null }
          : { id: access.sessionId },
        data: { revokedAt: new Date() },
      });
      if (allSessions)
        await tx.purchaseGuestChallenge.updateMany({
          where: { email: access.email, consumedAt: null },
          data: { consumedAt: new Date() },
        });
    });
  }
}
