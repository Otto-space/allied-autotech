import { createHash, randomUUID } from "node:crypto";
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

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "notification preference revisions and recovery",
  () => {
    const app = createApp();
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

    const path = (f: Awaited<ReturnType<typeof fixture>>) =>
      `/api/v1/${f.user.role === "CUSTOMER" ? "customers" : "staff"}/notifications/preferences/current`;
    const key = (stamp = Date.now()) => `preference-v1.${stamp}.${randomUUID()}`;
    const input = {
      category: "MARKETING",
      channel: "EMAIL",
      enabled: true,
      expectedVersion: 0,
    };
    const get = (f: Awaited<ReturnType<typeof fixture>>) =>
      request(app).get(path(f)).set("Cookie", f.cookie);
    const put = (
      f: Awaited<ReturnType<typeof fixture>>,
      body: unknown = input,
      requestKey = key(),
    ) =>
      request(app)
        .put(path(f))
        .set("Cookie", f.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.csrf)
        .set("Idempotency-Key", requestKey)
        .send(body);
    async function counts(f: Awaited<ReturnType<typeof fixture>>) {
      return {
        consent: await prisma.consentRecord.count({ where: { userId: f.user.id } }),
        audit: await prisma.auditLog.count({
          where: { userId: f.user.id, entityType: "USER", action: "UPDATE" },
        }),
        receipt: await prisma.idempotencyRecord.count({
          where: { scope: `notification-preference:${f.user.id}` },
        }),
      };
    }
    for (const category of ["MARKETING", "OPERATIONAL"])
      for (const channel of ["EMAIL", "SMS"])
        it(`${category} ${channel}: defaults, first save, replay and current projection`, async () => {
          const f = await fixture(),
            k = key(),
            body = { ...input, category, channel };
          const before = await get(f);
          expect(before.status).toBe(200);
          expect(before.body.data.preferences).toEqual([]);
          expect(before.headers["cache-control"]).toContain("no-store");
          const first = await put(f, body, k);
          expect(first.status).toBe(200);
          expect(first.body.data).toMatchObject({
            replayed: false,
            appliedVersion: 1,
            preference: { category, channel, enabled: true, version: 1 },
          });
          const replay = await put(
            f,
            Object.fromEntries(Object.entries(body).reverse()),
            k,
          );
          expect(replay.status).toBe(200);
          expect(replay.body.data).toEqual({ ...first.body.data, replayed: true });
          expect(Object.keys(replay.body.data.preference).sort()).toEqual(
            [
              "category",
              "channel",
              "consentedAt",
              "enabled",
              "updatedAt",
              "version",
            ].sort(),
          );
          expect(await counts(f)).toEqual({ consent: 1, audit: 1, receipt: 1 });
        });
    it("simultaneous same-key requests append one consent and audit", async () => {
      const f = await fixture(),
        k = key();
      const responses = await Promise.all([
        put(f, input, k),
        put(f, input, k),
        put(f, input, k),
      ]);
      expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(responses.filter((r) => !r.body.data.replayed)).toHaveLength(1);
      expect(await counts(f)).toEqual({ consent: 1, audit: 1, receipt: 1 });
    });
    it("competing sessions with different keys cannot silently overwrite an absent or existing pair", async () => {
      const f = await fixture();
      const results = await Promise.all([
        put(f, input),
        put(f, { ...input, enabled: false }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const next = await Promise.all([
        put(f, { ...input, expectedVersion: 1 }),
        put(f, { ...input, enabled: false, expectedVersion: 1 }),
      ]);
      expect(next.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await counts(f)).toEqual({ consent: 2, audit: 2, receipt: 2 });
    });
    it("original replay after withdrawal returns current state and never grants consent again", async () => {
      const f = await fixture(),
        k = key();
      expect((await put(f, input, k)).status).toBe(200);
      expect(
        (await put(f, { ...input, enabled: false, expectedVersion: 1 })).status,
      ).toBe(200);
      const replay = await put(f, input, k);
      expect(replay.status).toBe(200);
      expect(replay.body.data).toMatchObject({
        replayed: true,
        appliedVersion: 1,
        preference: { enabled: false, version: 2 },
      });
      const stale = await put(f, input);
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe("CONFLICT");
      expect(await counts(f)).toEqual({ consent: 2, audit: 2, receipt: 2 });
      const history = await prisma.consentRecord.findMany({
        where: { userId: f.user.id },
        orderBy: { recordedAt: "asc" },
      });
      expect(history.map((r) => r.granted)).toEqual([true, false]);
    });
    it("changed key content conflicts and actor scopes cannot expose another account", async () => {
      const f = await fixture(),
        other = await fixture(),
        k = key();
      await put(f, input, k);
      for (const changed of [
        { ...input, enabled: false },
        { ...input, expectedVersion: 1 },
        { ...input, channel: "SMS" },
      ])
        expect((await put(f, changed, k)).status).toBe(409);
      expect((await get(other)).body.data.preferences).toEqual([]);
      expect((await put(other, input, k)).body.data.replayed).toBe(false);
      expect(await counts(f)).toEqual({ consent: 1, audit: 1, receipt: 1 });
      expect(await counts(other)).toEqual({ consent: 1, audit: 1, receipt: 1 });
    });
    it("expiry is rejected before and after receipt cleanup; future timestamps are rejected", async () => {
      const f = await fixture();
      for (const stamp of [Date.now() - 86400001, Date.now() + 120000]) {
        const r = await put(f, input, key(stamp));
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe("IDEMPOTENCY_EXPIRED");
      }
      expect(await counts(f)).toEqual({ consent: 0, audit: 0, receipt: 0 });
      const k = key(),
        created = await put(f, input, k);
      expect(created.status).toBe(200);
      const expiredKey = key(Date.now() - 86400001),
        scope = `notification-preference:${f.user.id}`;
      const receipt = await prisma.idempotencyRecord.findFirstOrThrow({
        where: { scope },
      });
      const { id: ignored, ...stored } = receipt;
      void ignored;
      await prisma.idempotencyRecord.create({
        data: {
          ...stored,
          keyHash: createHash("sha256").update(expiredKey).digest("hex"),
          expiresAt: new Date(Date.now() - 1),
        },
      });
      expect((await put(f, input, expiredKey)).body.error.code).toBe(
        "IDEMPOTENCY_EXPIRED",
      );
      await prisma.idempotencyRecord.deleteMany({
        where: { scope, expiresAt: { lt: new Date() } },
      });
      expect((await put(f, input, expiredKey)).body.error.code).toBe(
        "IDEMPOTENCY_EXPIRED",
      );
      expect((await get(f)).body.data.preferences[0].version).toBe(1);
    });
    it("audit failure rolls back value, receipt and consent so original request can retry", async () => {
      const f = await fixture(),
        k = key();
      const fail = vi
        .spyOn(audit, "appendAuditEvent")
        .mockRejectedValueOnce(new Error("Synthetic audit fault"));
      expect((await put(f, input, k)).status).toBe(500);
      expect(await counts(f)).toEqual({ consent: 0, audit: 0, receipt: 0 });
      expect((await get(f)).body.data.preferences).toEqual([]);
      fail.mockRestore();
      expect((await put(f, input, k)).status).toBe(200);
      expect((await put(f, input, k)).body.data.replayed).toBe(true);
      expect(await counts(f)).toEqual({ consent: 1, audit: 1, receipt: 1 });
    });
    it("database writers advance revisions without resetting them", async () => {
      const f = await fixture();
      await put(f, input);
      await prisma.notificationPreference.updateMany({
        where: { userId: f.user.id },
        data: { enabled: false, version: 1 },
      });
      expect((await get(f)).body.data.preferences[0]).toMatchObject({
        enabled: false,
        version: 2,
      });
      expect((await put(f, { ...input, expectedVersion: 1 })).status).toBe(409);
    });
    it("foreign or missing receipt resources cannot be recovered or replaced", async () => {
      const f = await fixture(),
        other = await fixture(),
        k = key();
      await put(f, input, k);
      await put(other);
      const foreign = await prisma.notificationPreference.findFirstOrThrow({
        where: { userId: other.user.id },
      });
      const receipt = await prisma.idempotencyRecord.findFirstOrThrow({
        where: { scope: `notification-preference:${f.user.id}` },
      });
      await prisma.idempotencyRecord.update({
        where: { id: receipt.id },
        data: { responseBody: { resourceId: foreign.id, appliedVersion: 1 } },
      });
      expect((await put(f, input, k)).body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      expect(await counts(f)).toEqual({ consent: 1, audit: 1, receipt: 1 });
    });
    it("receipt revision must match the original expected revision, not a later change", async () => {
      const f = await fixture(),
        k = key();
      await put(f, input, k);
      await put(f, { ...input, enabled: false, expectedVersion: 1 });
      const receipt = await prisma.idempotencyRecord.findFirstOrThrow({
        where: {
          scope: `notification-preference:${f.user.id}`,
          keyHash: createHash("sha256").update(k).digest("hex"),
        },
      });
      const preference = await prisma.notificationPreference.findFirstOrThrow({
        where: { userId: f.user.id },
      });
      await prisma.idempotencyRecord.update({
        where: { id: receipt.id },
        data: { responseBody: { resourceId: preference.id, appliedVersion: 2 } },
      });
      expect((await put(f, input, k)).body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      expect(await counts(f)).toEqual({ consent: 2, audit: 2, receipt: 2 });
    });
    it("missing authentication and staff MFA cannot alter preferences", async () => {
      expect(
        (await request(app).get("/api/v1/customers/notifications/preferences/current"))
          .status,
      ).toBe(401);
      const f = await fixture("STAFF");
      await prisma.session.updateMany({
        where: { userId: f.user.id },
        data: { mfaVerifiedAt: null },
      });
      expect((await put(f)).status).toBe(403);
      expect(await counts(f)).toEqual({ consent: 0, audit: 0, receipt: 0 });
    });
    for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const)
      it(`${role}: only own route, CSRF and required contract`, async () => {
        const f = await fixture(role);
        const before = await counts(f);
        const current = (await get(f)).body.data.preferences.find(
          (p: { category: string; channel: string; version: number }) =>
            p.category === input.category && p.channel === input.channel,
        );
        expect(
          (await put(f, { ...input, expectedVersion: current?.version ?? 0 })).status,
        ).toBe(200);
        const foreignRoute = role === "CUSTOMER" ? "staff" : "customers";
        expect(
          (
            await request(app)
              .get(`/api/v1/${foreignRoute}/notifications/preferences/current`)
              .set("Cookie", f.cookie)
          ).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .put(path(f))
              .set("Cookie", f.cookie)
              .set("Origin", "http://localhost:3000")
              .send(input)
          ).status,
        ).toBe(403);
        const missing = await request(app)
          .put(path(f))
          .set("Cookie", f.cookie)
          .set("Origin", "http://localhost:3000")
          .set("X-CSRF-Token", f.csrf)
          .send(input);
        expect(missing.status).toBe(422);
        for (const invalid of [
          { category: "SECURITY", channel: "EMAIL", enabled: false, expectedVersion: 1 },
          { ...input, expectedVersion: -1 },
          { ...input, expectedVersion: "1" },
          { ...input, userId: randomUUID() },
          { category: "MARKETING", channel: "EMAIL", enabled: true },
        ])
          expect((await put(f, invalid)).status).toBe(422);
        expect(await counts(f)).toEqual({
          consent: before.consent + 1,
          audit: before.audit + 1,
          receipt: before.receipt + 1,
        });
      });
  },
);
