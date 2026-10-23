import { createECDH, randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/config/database.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { enqueueNotification } from "../../src/modules/notifications/notifications.service.js";
import { notifySupportTeam } from "../../src/modules/notifications/team-notifications.js";
import { PushWorker } from "../../src/workers/push.worker.js";

describe.skipIf(process.env.RUN_TEAM_PUSH_TESTS !== "true")(
  "team notifications and browser push",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let branch: string;
    async function account(
      role: "CUSTOMER" | "STAFF" | "ADMIN" | "SUPER_ADMIN",
      branchId = branch,
    ) {
      const existingOwner =
        role === "SUPER_ADMIN"
          ? await prisma.user.findFirst({
              where: {
                role: "SUPER_ADMIN",
                email: { startsWith: "push-", endsWith: "@example.test" },
              },
              include: { staffProfile: true },
            })
          : null;
      const user =
        existingOwner ??
        (await prisma.user.create({
          data: {
            email: `push-${randomUUID()}@example.test`,
            role,
            emailVerifiedAt: new Date(),
            passwordHash: "synthetic-unusable",
            ...(role !== "CUSTOMER"
              ? {
                  staffProfile: {
                    create: { firstName: "Synthetic", lastName: "Push", branchId },
                  },
                }
              : {}),
          },
          include: { staffProfile: true },
        }));
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiry = new Date(Date.now() + 3600000);
      const session = await prisma.session.create({
        data: {
          createdAt: new Date(Date.now() - 1000),
          userId: user.id,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt: expiry,
          idleExpiresAt: expiry,
          mfaRequired: role !== "CUSTOMER",
          mfaVerifiedAt: role !== "CUSTOMER" ? new Date() : null,
        },
      });
      return {
        user,
        session,
        base: `/api/v1/${role === "CUSTOMER" ? "customers" : "staff"}/notifications`,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "X-CSRF-Token": csrf,
        },
      };
    }
    function subscription() {
      const ecdh = createECDH("prime256v1");
      ecdh.generateKeys();
      return {
        endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`,
        keys: {
          p256dh: ecdh.getPublicKey().toString("base64url"),
          auth: randomBytes(16).toString("base64url"),
        },
      };
    }
    async function notification(userId: string) {
      return prisma.$transaction((tx) =>
        enqueueNotification(tx, {
          userId,
          type: "SYSTEM",
          category: "OPERATIONAL",
          title: "Synthetic confidential title",
          message: "Synthetic private content",
          deduplicationKey: `push-test:${randomUUID()}`,
          channels: [],
        }),
      );
    }
    beforeAll(async () => {
      if (
        env.NODE_ENV !== "test" ||
        env.DB_HOST !== "127.0.0.1" ||
        env.DB_NAME !== "allied_team_push_20261023_ci"
      )
        throw new Error("Requires the isolated team push target");
      const [actual] = await prisma.$queryRaw<
        { name: string; superuser: boolean }[]
      >`SELECT current_database() AS name, rolsuper AS superuser FROM pg_roles WHERE rolname = current_user`;
      expect(actual).toEqual({ name: env.DB_NAME, superuser: false });
      branch = (
        await prisma.branch.create({
          data: {
            code: randomUUID().slice(0, 8),
            name: "Synthetic push branch",
            address: "Synthetic",
            city: "Synthetic",
            state: "Synthetic",
          },
        })
      ).id;
      const vapid = webpush.generateVAPIDKeys();
      Object.assign(env, {
        PUSH_DELIVERY_ENABLED: true,
        VAPID_PUBLIC_KEY: vapid.publicKey,
        VAPID_PRIVATE_KEY: vapid.privateKey,
        VAPID_SUBJECT: "mailto:tests@example.test",
      });
    });
    afterAll(async () => {
      env.PUSH_DELIVERY_ENABLED = false;
      await prisma.$disconnect();
    });
    it("supports every role, requires CSRF, isolates endpoints and owned notification links", async () => {
      const other = await account("CUSTOMER");
      for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
        const actor = await account(role),
          sub = subscription();
        const noCsrf = { Cookie: actor.headers.Cookie, Origin: actor.headers.Origin };
        await request(app).put(`${actor.base}/push`).set(noCsrf).send(sub).expect(403);
        await request(app)
          .put(`${actor.base}/push`)
          .set(actor.headers)
          .send(sub)
          .expect(200);
        const status = await request(app)
          .get(`${actor.base}/push`)
          .set(actor.headers)
          .expect(200);
        expect(status.body.data).toMatchObject({ available: true, enabled: true });
        expect(JSON.stringify(status.body)).not.toContain(env.VAPID_PRIVATE_KEY);
        await request(app)
          .put(`${other.base}/push`)
          .set(other.headers)
          .send(sub)
          .expect(409);
        const row = await notification(actor.user.id);
        await request(app).get(`${actor.base}/${row.id}`).set(actor.headers).expect(200);
        await request(app).get(`${other.base}/${row.id}`).set(other.headers).expect(404);
        const summary = await request(app)
          .get(`${actor.base}/summary`)
          .set(actor.headers)
          .expect(200);
        expect(summary.body.data.unreadCount).toBeGreaterThanOrEqual(1);
        await request(app)
          .delete(`${actor.base}/push`)
          .set(actor.headers)
          .send({})
          .expect(200);
      }
    });
    it("rejects unsupported endpoints and invalid keys without making network calls", async () => {
      const actor = await account("CUSTOMER");
      for (const endpoint of [
        "http://127.0.0.1/private",
        "https://fcm.googleapis.com.evil.test/send",
        "https://user@fcm.googleapis.com/send",
        "https://fcm.googleapis.com:8443/send",
      ]) {
        await request(app)
          .put(`${actor.base}/push`)
          .set(actor.headers)
          .send({ ...subscription(), endpoint })
          .expect(422);
      }
      await request(app)
        .put(`${actor.base}/push`)
        .set(actor.headers)
        .send({ ...subscription(), keys: { p256dh: "invalid", auth: "invalid" } })
        .expect(422);
    });
    it("sends only generic alerts, cancels revoked-session deliveries and retires expired endpoints", async () => {
      const actor = await account("CUSTOMER");
      await request(app)
        .put(`${actor.base}/push`)
        .set(actor.headers)
        .send(subscription())
        .expect(200);
      await notification(actor.user.id);
      const send = vi
        .fn<typeof webpush.sendNotification>()
        .mockResolvedValue({ statusCode: 201, body: "", headers: {} });
      await new PushWorker(prisma, send).runOnce(100);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![1]).not.toMatch(
        /Synthetic|private|confidential|example.test/,
      );
      await notification(actor.user.id);
      send.mockRejectedValueOnce({ statusCode: 410 });
      await new PushWorker(prisma, send).runOnce(100);
      expect(
        (
          await prisma.pushSubscription.findFirstOrThrow({
            where: { userId: actor.user.id },
          })
        ).disabledAt,
      ).not.toBeNull();
      await request(app)
        .put(`${actor.base}/push`)
        .set(actor.headers)
        .send(subscription())
        .expect(200);
      await notification(actor.user.id);
      await prisma.session.update({
        where: { id: actor.session.id },
        data: { revokedAt: new Date() },
      });
      send.mockClear();
      await new PushWorker(prisma, send).runOnce(100);
      expect(send).not.toHaveBeenCalled();
    });
    it("delivers support alerts only to active staff within current branch and responsibility scopes", async () => {
      const owner = await account("SUPER_ADMIN"),
        admin = await account("ADMIN"),
        staff = await account("STAFF"),
        managed = await account("STAFF");
      await prisma.workforceAccess.create({
        data: {
          userId: managed.user.id,
          position: "ACCOUNTANT",
          updatedByUserId: owner.user.id,
          assignments: {
            create: {
              template: "ACCOUNTANT",
              scope: "BRANCH",
              branchId: branch,
              startsAt: new Date(),
              reason: "Synthetic test",
              assignedByUserId: owner.user.id,
            },
          },
        },
      });
      const row = await prisma.enquiry.create({
        data: {
          branchId: branch,
          type: "GENERAL",
          name: "Synthetic",
          email: "synthetic@example.test",
          subject: "Private test subject",
          message: "Private test message",
        },
      });
      const input = {
        kind: "ENQUIRY" as const,
        id: row.id,
        event: `new:${row.id}`,
        title: "New customer enquiry",
      };
      await prisma.$transaction((tx) => notifySupportTeam(tx, input));
      await prisma.$transaction((tx) => notifySupportTeam(tx, input));
      const alerts = await prisma.notification.findMany({
        where: { resourceId: row.id },
      });
      for (const user of [owner.user, admin.user, staff.user])
        expect(alerts.filter((n) => n.userId === user.id)).toHaveLength(1);
      expect(alerts.some((n) => n.userId === managed.user.id)).toBe(false);
      expect(JSON.stringify(alerts)).not.toContain("Private test");
    });
  },
);
