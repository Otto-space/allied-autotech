import { sessionWindow } from "../helpers/session-window.js";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import {
  inspectOwnerCandidate,
  provisionInitialOwner,
} from "../../src/modules/organization/owner-provisioning.js";

// This suite intentionally requires its own freshly migrated disposable DB:
// owner protection must not be disabled merely to reset a fixture.
const enabled = process.env.RUN_OWNER_PROVISIONING_TESTS === "true";
describe.skipIf(!enabled)(
  "sole owner provisioning on a fresh disposable database",
  () => {
    afterAll(async () => prisma.$disconnect());

    it("rejects unverified, inactive, missing and mismatched account selections", async () => {
      expect(process.env.DB_NAME).toMatch(/_(test|ci)$/);
      expect(await prisma.user.count({ where: { role: "SUPER_ADMIN" } })).toBe(0);
      const unverified = await prisma.user.create({
        data: {
          email: `unverified-${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-fixture",
        },
      });
      await expect(
        provisionInitialOwner(prisma, {
          email: unverified.email,
          expectedUserId: unverified.id,
        }),
      ).rejects.toThrow("active and email verified");
      await expect(
        prisma.user.update({
          where: { id: unverified.id },
          data: { role: "SUPER_ADMIN" },
        }),
      ).rejects.toThrow();
      const inactive = await prisma.user.create({
        data: {
          email: `inactive-${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-fixture",
          emailVerifiedAt: new Date(),
          status: "SUSPENDED",
        },
      });
      await expect(
        provisionInitialOwner(prisma, {
          email: inactive.email,
          expectedUserId: inactive.id,
        }),
      ).rejects.toThrow("active and email verified");
      await expect(
        prisma.user.update({ where: { id: inactive.id }, data: { role: "SUPER_ADMIN" } }),
      ).rejects.toThrow();
      await expect(
        provisionInitialOwner(prisma, {
          email: inactive.email,
          expectedUserId: unverified.id,
        }),
      ).rejects.toThrow("does not match");
      await expect(
        provisionInitialOwner(prisma, {
          email: "missing@example.test",
          expectedUserId: randomUUID(),
        }),
      ).rejects.toThrow("does not match");
      expect(await inspectOwnerCandidate(prisma, "missing@example.test")).toEqual({
        ownerCount: 0,
        candidate: null,
      });
      expect(await prisma.user.count({ where: { role: "SUPER_ADMIN" } })).toBe(0);
    });

    it("allows exactly one competing provisioner, revokes sessions and audits without changing credentials", async () => {
      const candidates = await Promise.all(
        [0, 1].map(async () => {
          const user = await prisma.user.create({
            data: {
              email: `owner-candidate-${randomUUID()}@example.test`,
              passwordHash: "unchanged-synthetic-password-hash",
              emailVerifiedAt: new Date(),
            },
          });
          const session = await prisma.session.create({
            data: {
              userId: user.id,
              tokenHash: randomUUID(),
              ...sessionWindow(600000),
            },
          });
          return { user, session };
        }),
      );
      const results = await Promise.allSettled(
        candidates.map(({ user }) =>
          provisionInitialOwner(prisma, { email: user.email, expectedUserId: user.id }),
        ),
      );
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(await prisma.user.count({ where: { role: "SUPER_ADMIN" } })).toBe(1);
      for (const [index, { user, session }] of candidates.entries()) {
        const won = results[index]?.status === "fulfilled";
        const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(stored.role).toBe(won ? "SUPER_ADMIN" : "CUSTOMER");
        expect(stored.emailVerifiedAt).toEqual(user.emailVerifiedAt);
        expect(stored.passwordHash).toBe(user.passwordHash);
        expect(
          (await prisma.session.findUniqueOrThrow({ where: { id: session.id } }))
            .revokedAt !== null,
        ).toBe(won);
        const audit = await prisma.auditLog.findMany({
          where: { entityId: user.id, action: "ROLE_CHANGE" },
        });
        expect(audit).toHaveLength(won ? 1 : 0);
        if (won)
          expect(audit[0]?.newValues).toMatchObject({
            role: "SUPER_ADMIN",
            source: "verified_account_initial_provisioning",
          });
      }
    });

    it("enforces singleton and owner protection even for direct database writes", async () => {
      const owner = await prisma.user.findFirstOrThrow({
        where: { role: "SUPER_ADMIN" },
      });
      await expect(
        prisma.user.create({
          data: {
            email: `second-owner-${randomUUID()}@example.test`,
            passwordHash: "synthetic",
            role: "SUPER_ADMIN",
            emailVerifiedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
      const mutations = [
        { role: "ADMIN" as const },
        { status: "SUSPENDED" as const },
        { status: "DEACTIVATED" as const },
        { emailVerifiedAt: null },
        { email: "replacement@example.test" },
        { id: randomUUID() },
      ];
      for (const data of mutations)
        await expect(
          prisma.user.update({ where: { id: owner.id }, data }),
        ).rejects.toThrow();
      await expect(prisma.user.delete({ where: { id: owner.id } })).rejects.toThrow();
      const other = await prisma.user.findFirstOrThrow({
        where: { role: "CUSTOMER", emailVerifiedAt: { not: null }, status: "ACTIVE" },
      });
      await expect(
        prisma.user.update({ where: { id: other.id }, data: { role: "SUPER_ADMIN" } }),
      ).rejects.toThrow();
      await expect(
        provisionInitialOwner(prisma, { email: other.email, expectedUserId: other.id }),
      ).rejects.toThrow("owner already exists");
      expect(
        await prisma.user.count({
          where: {
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            emailVerifiedAt: { not: null },
          },
        }),
      ).toBe(1);
      // Normal authentication/account bookkeeping remains possible.
      await expect(
        prisma.user.update({
          where: { id: owner.id },
          data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
        }),
      ).resolves.toMatchObject({ id: owner.id });
    });
  },
);
