import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { testOwner } from "../helpers/owner.js";
import { sessionWindow } from "../helpers/session-window.js";
import { CustomersRepository } from "../../src/modules/customers/customers.repository.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "customer profile revisions",
  () => {
    const app = createApp();
    const path = "/api/v1/customers/profile";
    afterAll(() => prisma.$disconnect());
    afterEach(() => vi.restoreAllMocks());
    async function fixture(role: UserRole = "CUSTOMER") {
      const user =
        role === "SUPER_ADMIN"
          ? await testOwner("unusable-synthetic-fixture")
          : await prisma.user.create({
              data: {
                email: `${randomUUID()}@example.test`,
                passwordHash: "unusable-synthetic-fixture",
                role,
                emailVerifiedAt: new Date(),
                ...(role === "CUSTOMER"
                  ? {
                      profile: {
                        create: {
                          firstName: "Ada",
                          lastName: "Chinwi",
                          phone: "08030000000",
                          phoneVerifiedAt: new Date(),
                          city: "Lagos",
                          address: "Old address",
                        },
                      },
                    }
                  : {}),
              },
            });
      const token = generateOpaqueToken(),
        csrf = generateOpaqueToken();
      const now = new Date();
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          ...sessionWindow(3600000),
          createdAt: now,
          lastRotatedAt: now,
          mfaRequired: role !== "CUSTOMER",
          mfaVerifiedAt: role === "CUSTOMER" ? null : now,
        },
      });
      return { user, cookie: `${sessionCookieName}=${token}`, csrf };
    }
    const get = (f: Awaited<ReturnType<typeof fixture>>) =>
      request(app).get(path).set("Cookie", f.cookie);
    const patch = (f: Awaited<ReturnType<typeof fixture>>, body: unknown) =>
      request(app)
        .patch(path)
        .set("Cookie", f.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.csrf)
        .send(body);
    const row = (f: Awaited<ReturnType<typeof fixture>>) =>
      prisma.customerProfile.findUniqueOrThrow({ where: { userId: f.user.id } });
    async function audits(f: Awaited<ReturnType<typeof fixture>>) {
      return prisma.auditLog.findMany({
        where: {
          userId: f.user.id,
          entityType: "CUSTOMER_PROFILE",
          action: "UPDATE",
        },
      });
    }

    it("returns an independent text revision and increments it once with changed-field audit", async () => {
      const f = await fixture();
      const initial = await get(f);
      expect(initial.status).toBe(200);
      expect(initial.headers["cache-control"]).toContain("no-store");
      expect(initial.body.data).toMatchObject({ profileVersion: 0, mediaVersion: 0 });
      const result = await patch(f, { expectedVersion: 0, city: "Abuja", address: null });
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        profileVersion: 1,
        mediaVersion: 0,
        city: "Abuja",
        address: null,
      });
      const events = await audits(f);
      expect(events).toHaveLength(1);
      expect(events[0]?.newValues).toEqual({
        changedFields: "address,city",
        profileVersion: 1,
      });
      expect(JSON.stringify(events[0]?.newValues)).not.toContain("Abuja");
    });
    it("allows exactly one competing session update and preserves the winner", async () => {
      const f = await fixture();
      const [a, b] = await Promise.all([
        patch(f, { expectedVersion: 0, city: "Abuja" }),
        patch(f, { expectedVersion: 0, city: "Enugu" }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const winner = a.status === 200 ? a : b;
      const loser = a.status === 409 ? a : b;
      expect(loser.body.error.code).toBe("STALE_VERSION");
      expect(await row(f)).toMatchObject({
        city: winner.body.data.city,
        profileVersion: 1,
      });
      expect(await audits(f)).toHaveLength(1);
    });
    it("rejects stale retries after a committed response is lost, without a second audit", async () => {
      const f = await fixture();
      const body = { expectedVersion: 0, firstName: "Amara" };
      expect((await patch(f, body)).status).toBe(200);
      expect((await patch(f, body)).status).toBe(409);
      expect((await get(f)).body.data).toMatchObject({
        firstName: "Amara",
        profileVersion: 1,
      });
      expect(await audits(f)).toHaveLength(1);
    });
    it("refuses an omitted precondition even when called outside HTTP validation", async () => {
      const f = await fixture();
      const repository = new CustomersRepository(prisma);
      await expect(
        prisma.$transaction((tx) =>
          repository.updateProfile(f.user.id, { city: "Abuja" } as never, tx),
        ),
      ).rejects.toMatchObject({ code: "STALE_VERSION" });
      expect(await row(f)).toMatchObject({ city: "Lagos", profileVersion: 0 });
      expect(await audits(f)).toHaveLength(0);
    });
    it("accepts a fresh revision after explicit reread and retains untouched fields", async () => {
      const f = await fixture();
      await patch(f, { expectedVersion: 0, city: "Abuja" });
      const current = (await get(f)).body.data;
      const result = await patch(f, {
        expectedVersion: current.profileVersion,
        firstName: "Amara",
      });
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        city: "Abuja",
        firstName: "Amara",
        profileVersion: 2,
      });
    });
    it("keeps photo-only updates independent and invalidates verification only when the phone changes", async () => {
      const f = await fixture();
      await prisma.customerProfile.update({
        where: { userId: f.user.id },
        data: { mediaVersion: { increment: 1 } },
      });
      const samePhone = await patch(f, { expectedVersion: 0, phone: "08030000000" });
      expect(samePhone.status).toBe(200);
      expect(samePhone.body.data).toMatchObject({ profileVersion: 1, mediaVersion: 1 });
      expect(samePhone.body.data.phoneVerifiedAt).not.toBeNull();
      const changed = await patch(f, { expectedVersion: 1, phone: "08039999999" });
      expect(changed.status).toBe(200);
      expect(changed.body.data).toMatchObject({
        profileVersion: 2,
        phoneVerifiedAt: null,
        mediaVersion: 1,
      });
    });
    it("advances revision for other text writers and rejects revision rewinds/jumps", async () => {
      const f = await fixture();
      await prisma.customerProfile.update({
        where: { userId: f.user.id },
        data: { city: "Enugu" },
      });
      expect((await patch(f, { expectedVersion: 0, city: "Abuja" })).status).toBe(409);
      for (const profileVersion of [0, 9, -1])
        await expect(
          prisma.customerProfile.update({
            where: { userId: f.user.id },
            data: { profileVersion },
          }),
        ).rejects.toThrow();
      expect(await row(f)).toMatchObject({ city: "Enugu", profileVersion: 1 });
    });
    it("rolls back the text and revision when its audit cannot commit", async () => {
      const f = await fixture();
      vi.spyOn(audit, "appendAuditEvent").mockRejectedValueOnce(
        new Error("synthetic audit failure"),
      );
      expect((await patch(f, { expectedVersion: 0, city: "Abuja" })).status).toBe(500);
      expect(await row(f)).toMatchObject({ city: "Lagos", profileVersion: 0 });
      expect(await audits(f)).toHaveLength(0);
    });
    for (const body of [
      { city: "Abuja" },
      { expectedVersion: "0", city: "Abuja" },
      { expectedVersion: -1, city: "Abuja" },
      { expectedVersion: 0.5, city: "Abuja" },
      { expectedVersion: 2147483647, city: "Abuja" },
      { expectedVersion: 0 },
      { expectedVersion: 0, profileVersion: 0, city: "Abuja" },
      { expectedVersion: 0, userId: randomUUID(), city: "Abuja" },
    ]) {
      it(`rejects invalid revision or writable projection: ${JSON.stringify(body)}`, async () => {
        const f = await fixture();
        expect((await patch(f, body)).status).toBe(422);
        expect((await row(f)).profileVersion).toBe(0);
        expect(await audits(f)).toHaveLength(0);
      });
    }
    for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"] as const)
      it(`denies ${role} access to customer text editing`, async () => {
        const f = await fixture(role);
        expect((await patch(f, { expectedVersion: 0, city: "Abuja" })).status).toBe(403);
        expect((await get(f)).status).toBe(403);
      });
    it("preserves CSRF and authentication enforcement", async () => {
      const f = await fixture();
      expect(
        (
          await request(app)
            .patch(path)
            .set("Cookie", f.cookie)
            .set("Origin", "http://localhost:3000")
            .send({ expectedVersion: 0, city: "Abuja" })
        ).status,
      ).toBe(403);
      expect(
        (await request(app).patch(path).send({ expectedVersion: 0, city: "Abuja" }))
          .status,
      ).toBe(401);
      expect((await row(f)).profileVersion).toBe(0);
    });
    it("binds reads and writes to the authenticated customer regardless of matching revisions", async () => {
      const a = await fixture(),
        b = await fixture();
      expect((await patch(a, { expectedVersion: 0, city: "Abuja" })).status).toBe(200);
      expect((await get(b)).body.data).toMatchObject({
        profileVersion: 0,
        city: "Lagos",
        user: { id: b.user.id },
      });
      expect((await row(b)).profileVersion).toBe(0);
    });
  },
);
