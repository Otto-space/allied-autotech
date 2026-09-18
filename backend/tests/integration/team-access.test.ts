import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import { decryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";
import type { EncryptedEnvelope } from "../../src/common/security/mfa-encryption.js";

const password = "Isolated team proof passphrase 9142";
let passwordHash: string;
async function account(
  role: Exclude<UserRole, "SUPER_ADMIN">,
  verified = true,
  assured = true,
) {
  const branch = await prisma.branch.create({
    data: {
      code: `TEAM-${randomUUID().slice(0, 8)}`,
      name: "Isolated team branch",
      address: "Test address",
      city: "Test city",
      state: "Test state",
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `team-${randomUUID()}@example.test`,
      role,
      passwordHash,
      emailVerifiedAt: verified ? new Date() : null,
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Synthetic",
                lastName: "Customer",
                phone: "+2348000000000",
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Synthetic", lastName: role, branchId: branch.id },
            },
          }),
    },
  });
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 3600000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      createdAt: new Date(Date.now() - 1000),
      expiresAt,
      idleExpiresAt: expiresAt,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
    },
  });
  return {
    user,
    session,
    branch,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}
type Account = Awaited<ReturnType<typeof account>>;

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "existing-account team access",
  () => {
    let app = createApp({ checkReadiness: async () => undefined });
    beforeEach(() => {
      app = createApp({ checkReadiness: async () => undefined });
    });
    beforeAll(async () => {
      passwordHash = await hashPassword(password);
    });
    afterAll(async () => prisma.$disconnect());

    async function invite(admin: Account, staff: Account) {
      const response = await request(app)
        .post("/api/v1/admin/staff/invitations")
        .set(admin.headers)
        .send({ email: staff.user.email, role: "ADMIN", currentPassword: password });
      expect(response.status).toBe(202);
      expect(response.body.data.delivery).toBe("QUEUED");
      expect(response.body.data.invitation).not.toHaveProperty("tokenHash");
      const id = response.body.data.invitation.id as string;
      const outbox = await prisma.outboxEvent.findFirstOrThrow({
        where: { aggregateId: id },
      });
      const payload = decryptIdentityPayload<IdentityEmailPayload>(
        (outbox.payload as unknown as { encrypted: EncryptedEnvelope }).encrypted,
      );
      const token = new URLSearchParams(new URL(payload.link).hash.slice(1)).get(
        "token",
      )!;
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(new URL(payload.link).search).toBe("");
      return { id, token };
    }
    const accept = (staff: Account, token: string) =>
      request(app)
        .post("/api/v1/auth/staff/invitations/accept")
        .set(staff.headers)
        .send({ token, currentPassword: password });

    it("promotes only a verified existing customer, preserves credentials and records, revokes sessions and audits", async () => {
      const admin = await account("ADMIN");
      const customer = await account("CUSTOMER");
      const before = await prisma.customerProfile.findUniqueOrThrow({
        where: { userId: customer.user.id },
      });
      const search = await request(app)
        .get(
          `/api/v1/admin/staff/candidates?email=${encodeURIComponent(customer.user.email)}`,
        )
        .set(admin.headers);
      expect(search.status).toBe(200);
      expect(search.body.data.items[0].id).toBe(customer.user.id);
      expect(search.body.data.items[0]).not.toHaveProperty("passwordHash");
      const body = {
        customerUserId: customer.user.id,
        branchId: admin.branch.id,
        currentPassword: password,
      };
      expect(
        (
          await request(app)
            .post("/api/v1/admin/staff/promotions")
            .set(admin.headers)
            .send({ ...body, currentPassword: "wrong" })
        ).status,
      ).toBe(403);
      const result = await request(app)
        .post("/api/v1/admin/staff/promotions")
        .set(admin.headers)
        .send(body);
      expect(result.status).toBe(200);
      expect(result.body.data.role).toBe("STAFF");
      expect(result.body.data.staffProfile.branchId).toBe(admin.branch.id);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: customer.user.id },
        include: { profile: true },
      });
      expect(user.passwordHash).toBe(customer.user.passwordHash);
      expect(user.profile?.id).toBe(before.id);
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: customer.session.id } }))
          .revokedAt,
      ).not.toBeNull();
      expect(
        await prisma.auditLog.count({
          where: { entityId: customer.user.id, action: "ROLE_CHANGE" },
        }),
      ).toBe(1);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/staff/promotions")
            .set(admin.headers)
            .send(body)
        ).status,
      ).toBe(409);
      const unverified = await account("CUSTOMER", false);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/staff/promotions")
            .set(admin.headers)
            .send({ ...body, customerUserId: unverified.user.id })
        ).status,
      ).toBe(409);
    }, 30000);

    it("requires authenticated intended-recipient acceptance, MFA, CSRF and current password; concurrent acceptance grants once", async () => {
      const admin = await account("ADMIN");
      const staff = await account("STAFF");
      const wrong = await account("STAFF");
      const invitation = await invite(admin, staff);
      expect(
        (
          await request(app)
            .post("/api/v1/auth/staff/invitations/accept")
            .set("Origin", "http://localhost:3000")
            .send({ token: invitation.token, currentPassword: password })
        ).status,
      ).toBe(401);
      expect((await accept(wrong, invitation.token)).status).toBe(400);
      expect(
        (
          await request(app)
            .post("/api/v1/auth/staff/invitations/accept")
            .set({ Cookie: staff.headers.Cookie, Origin: staff.headers.Origin })
            .send({ token: invitation.token, currentPassword: password })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/auth/staff/invitations/accept")
            .set(staff.headers)
            .send({ token: invitation.token, currentPassword: "incorrect" })
        ).status,
      ).toBe(403);
      const count = await prisma.user.count();
      const outcomes = await Promise.all([
        accept(staff, invitation.token),
        accept(staff, invitation.token),
      ]);
      expect(outcomes.filter((item) => item.status === 200)).toHaveLength(1);
      expect(
        outcomes.filter((item) => [400, 401, 403].includes(item.status)),
      ).toHaveLength(1);
      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: staff.user.id },
        include: { staffProfile: true },
      });
      expect(updated.role).toBe("ADMIN");
      expect(updated.staffProfile?.branchId).toBeNull();
      expect(updated.passwordHash).toBe(staff.user.passwordHash);
      expect(updated.emailVerifiedAt).toEqual(staff.user.emailVerifiedAt);
      expect(await prisma.user.count()).toBe(count);
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: staff.session.id } }))
          .revokedAt,
      ).not.toBeNull();
      expect(
        await prisma.auditLog.count({
          where: { entityId: invitation.id, action: "INVITATION_ACCEPTED" },
        }),
      ).toBe(1);
      expect((await accept(staff, invitation.token)).status).toBe(401);
      const audit = await prisma.auditLog.findMany({
        where: { entityId: invitation.id },
      });
      expect(JSON.stringify(audit)).not.toContain(invitation.token);
    }, 30000);

    it("lists and revokes only permitted invitations and rejects replacement, revoked and expired tokens", async () => {
      const admin = await account("ADMIN");
      const otherAdmin = await account("ADMIN");
      const staff = await account("STAFF");
      const first = await invite(admin, staff);
      const second = await invite(admin, staff);
      expect((await accept(staff, first.token)).status).toBe(400);
      const own = await request(app)
        .get("/api/v1/admin/staff/invitations?status=PENDING")
        .set(admin.headers);
      expect(own.status).toBe(200);
      expect(own.body.data.items.map((item: { id: string }) => item.id)).toContain(
        second.id,
      );
      expect(JSON.stringify(own.body)).not.toContain("tokenHash");
      const other = await request(app)
        .get("/api/v1/admin/staff/invitations")
        .set(otherAdmin.headers);
      expect(other.body.data.items).toEqual([]);
      expect(
        (
          await request(app)
            .post(`/api/v1/admin/staff/invitations/${second.id}/revoke`)
            .set(otherAdmin.headers)
            .send({ currentPassword: password })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post(`/api/v1/admin/staff/invitations/${second.id}/revoke`)
            .set(admin.headers)
            .send({ currentPassword: password })
        ).status,
      ).toBe(200);
      expect((await accept(staff, second.token)).status).toBe(400);
      const expiredToken = generateOpaqueToken();
      await prisma.privilegedInvitation.create({
        data: {
          recipientId: staff.user.id,
          invitedById: admin.user.id,
          email: staff.user.email,
          role: "ADMIN",
          tokenHash: hashToken("privileged-invitation", expiredToken),
          expiresAt: new Date(Date.now() - 1000),
          createdAt: new Date(Date.now() - 2000),
        },
      });
      expect((await accept(staff, expiredToken)).status).toBe(400);
    }, 30000);

    it.each(["inviter", "recipient"] as const)(
      "rechecks %s eligibility and immutable account binding",
      async (changed) => {
        const admin = await account("ADMIN");
        const staff = await account("STAFF");
        const invitation = await invite(admin, staff);
        await expect(
          prisma.privilegedInvitation.update({
            where: { id: invitation.id },
            data: { recipientId: admin.user.id },
          }),
        ).rejects.toThrow();
        if (changed === "inviter")
          await prisma.user.update({
            where: { id: admin.user.id },
            data: { role: "STAFF" },
          });
        else
          await prisma.user.update({
            where: { id: staff.user.id },
            data: { email: `changed-${randomUUID()}@example.test` },
          });
        expect((await accept(staff, invitation.token)).status).toBe(400);
        expect(
          (
            await prisma.privilegedInvitation.findUniqueOrThrow({
              where: { id: invitation.id },
            })
          ).usedAt,
        ).toBeNull();
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: staff.user.id } })).role,
        ).toBe("STAFF");
      },
      30000,
    );

    it.each(["mfa", "suspended", "unverified", "revoked-session"] as const)(
      "rejects acceptance after recipient assurance changes: %s",
      async (changed) => {
        const admin = await account("ADMIN");
        const staff = await account("STAFF");
        const invitation = await invite(admin, staff);
        if (changed === "mfa" || changed === "revoked-session")
          await prisma.session.update({
            where: { id: staff.session.id },
            data: changed === "mfa" ? { mfaVerifiedAt: null } : { revokedAt: new Date() },
          });
        else
          await prisma.user.update({
            where: { id: staff.user.id },
            data:
              changed === "suspended"
                ? { status: "SUSPENDED" }
                : { emailVerifiedAt: null },
          });
        expect([401, 403]).toContain((await accept(staff, invitation.token)).status);
        expect(
          (
            await prisma.privilegedInvitation.findUniqueOrThrow({
              where: { id: invitation.id },
            })
          ).usedAt,
        ).toBeNull();
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: staff.user.id } })).role,
        ).toBe("STAFF");
      },
      30000,
    );

    it("serializes acceptance against revocation without contradictory terminal states", async () => {
      const admin = await account("ADMIN");
      const staff = await account("STAFF");
      const invitation = await invite(admin, staff);
      const [accepted, revoked] = await Promise.all([
        accept(staff, invitation.token),
        request(app)
          .post(`/api/v1/admin/staff/invitations/${invitation.id}/revoke`)
          .set(admin.headers)
          .send({ currentPassword: password }),
      ]);
      const stored = await prisma.privilegedInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: staff.user.id } });
      if (accepted.status === 200) {
        expect(revoked.status).toBe(409);
        expect(stored.usedAt).not.toBeNull();
        expect(stored.revokedAt).toBeNull();
        expect(user.role).toBe("ADMIN");
      } else {
        expect(accepted.status).toBe(400);
        expect(revoked.status).toBe(200);
        expect(stored.usedAt).toBeNull();
        expect(stored.revokedAt).not.toBeNull();
        expect(user.role).toBe("STAFF");
      }
    }, 30000);

    it("revokes pending recipient invitations when an administrator suspends staff", async () => {
      const admin = await account("ADMIN");
      const staff = await account("STAFF");
      const invitation = await invite(admin, staff);
      const result = await request(app)
        .patch(`/api/v1/admin/staff/${staff.user.id}/status`)
        .set(admin.headers)
        .send({ status: "SUSPENDED" });
      expect(result.status).toBe(200);
      const stored = await prisma.privilegedInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(stored.revokedAt).not.toBeNull();
      expect(stored.usedAt).toBeNull();
      expect([401, 403]).toContain((await accept(staff, invitation.token)).status);
    }, 30000);

    it("denies customer/staff team management, MFA-pending invitations, generic ADMIN assignment and public role tampering", async () => {
      const staff = await account("STAFF");
      const customer = await account("CUSTOMER");
      const pending = await account("ADMIN", true, false);
      const admin = await account("ADMIN");
      for (const actor of [staff, customer]) {
        expect(
          (
            await request(app)
              .get(
                `/api/v1/admin/staff/candidates?email=${encodeURIComponent(staff.user.email)}`,
              )
              .set(actor.headers)
          ).status,
        ).toBe(403);
        expect(
          (await request(app).get("/api/v1/admin/staff/invitations").set(actor.headers))
            .status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .post("/api/v1/admin/staff/promotions")
              .set(actor.headers)
              .send({
                customerUserId: customer.user.id,
                branchId: staff.branch.id,
                currentPassword: password,
              })
          ).status,
        ).toBe(403);
      }
      expect(
        (
          await request(app)
            .post("/api/v1/admin/staff/invitations")
            .set(pending.headers)
            .send({ email: staff.user.email, role: "ADMIN", currentPassword: password })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/api/v1/admin/staff/${staff.user.id}/role`)
            .set(admin.headers)
            .send({ role: "ADMIN" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/staff/invitations")
            .set(admin.headers)
            .send({
              email: customer.user.email,
              role: "SUPER_ADMIN",
              currentPassword: password,
            })
        ).status,
      ).toBe(422);
    }, 30000);
  },
);
