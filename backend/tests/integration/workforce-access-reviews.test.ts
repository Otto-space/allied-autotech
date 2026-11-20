import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "current scoped access reviews",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let owner: Awaited<ReturnType<typeof f.session>>;
    let noDuties: Awaited<ReturnType<typeof f.account>>;
    let earlier: Awaited<ReturnType<typeof f.account>>;
    const expected: Record<string, string[]> = {};
    const read = (
      actor: { headers: Record<string, string> },
      query: Record<string, unknown> = {},
    ) =>
      request(app)
        .get("/api/v1/admin/workforce/accounts")
        .set(actor.headers)
        .query(query);
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
      const now = Date.now(),
        day = 86400000;
      const ending = await f.assignment(
        f.care.user.id,
        "CUSTOMER_SERVICE",
        true,
        f.home.id,
        new Date(now + 3600000),
      );
      const open = await f.assignment(f.care.user.id, "CUSTOMER_SERVICE", true);
      const scheduled = await f.assignment(
        f.care.user.id,
        "CUSTOMER_SERVICE",
        true,
        f.home.id,
        new Date(now + 4 * day),
      );
      await prisma.workforceAssignment.update({
        where: { id: scheduled.id },
        data: { startsAt: new Date(now + 3 * day) },
      });
      const ended = await f.assignment(f.care.user.id, "CUSTOMER_SERVICE", true);
      await prisma.workforceAssignment.update({
        where: { id: ended.id },
        data: { startsAt: new Date(now - 3 * day), expiresAt: new Date(now - day) },
      });
      const removed = await f.assignment(
        f.care.user.id,
        "CUSTOMER_SERVICE",
        true,
        f.home.id,
        new Date(now + day),
      );
      await prisma.workforceAssignment.update({
        where: { id: removed.id },
        data: {
          revokedAt: new Date(),
          revokedByUserId: f.owner.id,
          revocationReason: "Synthetic separately reviewed removal",
        },
      });
      Object.assign(expected, {
        COVER_ENDING: [ending.id],
        OPEN_ENDED_COVER: [open.id],
        SCHEDULED: [scheduled.id],
        ENDED: [ended.id],
        REMOVED: [removed.id],
      });
      const foreign = await f.assignment(
        f.care.user.id,
        "ACCOUNTANT",
        true,
        f.other.id,
        new Date(now + 3600000),
      );
      expected.foreign = [foreign.id];
      const unknown = await f.assignment(f.care.user.id, "CUSTOMER_SERVICE", true);
      await prisma.workforceAssignment.update({
        where: { id: unknown.id },
        data: { templateVersion: 999 },
      });
      noDuties = await f.account(null);
      await prisma.workforceAccess.create({
        data: {
          userId: noDuties.user.id,
          position: "CUSTOMER_SERVICE",
          updatedByUserId: f.owner.id,
        },
      });
      earlier = await f.account(null);
    }, 30000);
    afterAll(() => prisma.$disconnect());

    it("preserves the default DTO and all original duty records", async () => {
      const before = await prisma.workforceAssignment.findMany({
        where: { userId: f.care.user.id },
        orderBy: { id: "asc" },
      });
      const r = await read(owner, { q: f.care.user.email });
      expect(r.status).toBe(200);
      expect(r.body.data).not.toHaveProperty("review");
      expect(r.body.data.items[0]).not.toHaveProperty("reviewMatches");
      await read(owner, { q: f.care.user.email, review: "REMOVED" });
      expect(
        await prisma.workforceAssignment.findMany({
          where: { userId: f.care.user.id },
          orderBy: { id: "asc" },
        }),
      ).toEqual(before);
    });
    for (const kind of [
      "COVER_ENDING",
      "OPEN_ENDED_COVER",
      "SCHEDULED",
      "ENDED",
      "REMOVED",
    ]) {
      it(`returns recorded matches independently of active duties: ${kind}`, async () => {
        const r = await read(f.scopedAdmin, { q: f.care.user.email, review: kind });
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        expect(r.body.data.review).toMatchObject({
          kind,
          scope: "DELEGATED_STAFF_AND_DUTIES",
        });
        expect(r.body.data.items).toHaveLength(1);
        const row = r.body.data.items[0];
        expect(
          row.reviewMatches.map((a: { assignmentId: string }) => a.assignmentId),
        ).toEqual(expected[kind]);
        expect(
          row.responsibilities.some(
            (a: { template: string }) => a.template === "CUSTOMER_SERVICE",
          ),
        ).toBe(true);
        for (const a of row.reviewMatches) {
          expect(a.branch.id).toBe(f.home.id);
          expect(a.templateVersion).toBe(1);
          expect(a).not.toHaveProperty("reason");
          expect(a).not.toHaveProperty("assignedByUserId");
        }
        if (kind === "COVER_ENDING")
          expect(
            Date.parse(r.body.data.review.windowEndsAt) -
              Date.parse(r.body.data.generatedAt),
          ).toBe(7 * 86400000);
        else expect(r.body.data.review).not.toHaveProperty("windowEndsAt");
      });
    }
    it("uses explicit 24-hour/7-day/30-day windows and excludes future cover from ending-now checks", async () => {
      for (const days of [1, 7, 30]) {
        const r = await read(f.scopedAdmin, {
          q: f.care.user.email,
          review: "COVER_ENDING",
          reviewDays: days,
        });
        expect(r.status).toBe(200);
        expect(
          Date.parse(r.body.data.review.windowEndsAt) -
            Date.parse(r.body.data.generatedAt),
        ).toBe(days * 86400000);
        expect(
          r.body.data.items[0].reviewMatches.map(
            (a: { assignmentId: string }) => a.assignmentId,
          ),
        ).toEqual(expected.COVER_ENDING);
      }
      for (const query of [
        { review: "FORGED" },
        { reviewDays: 7 },
        { review: "REMOVED", reviewDays: 7 },
        { review: "COVER_ENDING", reviewDays: 2 },
      ])
        expect((await read(owner, query)).status).toBe(422);
    });
    it("never leaks another delegated template/branch and labels the owner scope separately", async () => {
      const r = await read(owner, { q: f.care.user.email, review: "COVER_ENDING" });
      expect(r.status).toBe(200);
      expect(r.body.data.review.scope).toBe("ALL_PRIVILEGED_ACCOUNTS");
      expect(
        r.body.data.items[0].reviewMatches.map(
          (a: { assignmentId: string }) => a.assignmentId,
        ),
      ).toEqual(
        expect.arrayContaining([...expected.COVER_ENDING!, ...expected.foreign!]),
      );
      expect(
        (await read(f.scopedAdmin, { review: "COVER_ENDING", branchId: f.other.id })).body
          .data.items,
      ).toEqual([]);
    });
    it("retains assigned-record scope for sales and technician cover in the review contract", async () => {
      for (const [person, template] of [
        [f.cashier, "SALES_CASHIER"],
        [f.electrical, "ELECTRICAL_TECHNICIAN"],
        [f.mechanical1, "MECHANICAL_TECHNICIAN"],
      ] as const) {
        const assignment = await f.assignment(
          person.user.id,
          template,
          true,
          f.home.id,
          new Date(Date.now() + 3600000),
        );
        const r = await read(owner, { q: person.user.email, review: "COVER_ENDING" });
        expect(r.status).toBe(200);
        expect(r.body.data.items).toHaveLength(1);
        expect(r.body.data.items[0].reviewMatches).toEqual([
          expect.objectContaining({
            assignmentId: assignment.id,
            template,
            templateVersion: 1,
            scope: "ASSIGNED",
          }),
        ]);
        expect(
          (await read(f.scopedAdmin, { q: person.user.email, review: "COVER_ENDING" }))
            .body.data.items,
        ).toEqual([]);
      }
    });
    it("separates managed Staff with no active in-scope duties from earlier Staff setup and protected baselines", async () => {
      const empty = await read(owner, { review: "UNASSIGNED", q: noDuties.user.email });
      expect(empty.status).toBe(200);
      expect(empty.body.data.items.map((p: { userId: string }) => p.userId)).toEqual([
        noDuties.user.id,
      ]);
      expect(empty.body.data.items[0].reviewMatches).toEqual([]);
      expect(
        (await read(owner, { review: "UNASSIGNED", q: earlier.user.email })).body.data
          .items,
      ).toEqual([]);
      expect(
        (
          await read(owner, { review: "EARLIER_STAFF_SETUP", q: earlier.user.email })
        ).body.data.items.map((p: { userId: string }) => p.userId),
      ).toEqual([earlier.user.id]);
      for (const email of [
        f.owner.email,
        f.operations.user.email,
        f.customer.user.email,
      ]) {
        expect(
          (await read(owner, { review: "UNASSIGNED", q: email })).body.data.items,
        ).toEqual([]);
        expect(
          (await read(owner, { review: "EARLIER_STAFF_SETUP", q: email })).body.data
            .items,
        ).toEqual([]);
      }
      // This person has a mechanical duty which this manager cannot administer.
      expect(
        (await read(f.scopedAdmin, { review: "UNASSIGNED", q: f.mechanical1.user.email }))
          .body.data.items,
      ).toHaveLength(1);
      expect(
        (await read(owner, { review: "UNASSIGNED", q: f.mechanical1.user.email })).body
          .data.items,
      ).toEqual([]);
    });
    it("does not describe inactive or unverified Staff as an active-duty gap", async () => {
      for (const data of [
        { status: "SUSPENDED" as const },
        { status: "ACTIVE" as const, emailVerifiedAt: null },
      ]) {
        await prisma.user.update({ where: { id: noDuties.user.id }, data });
        expect(
          (await read(owner, { review: "UNASSIGNED", q: noDuties.user.email })).body.data
            .items,
        ).toEqual([]);
      }
      await prisma.user.update({
        where: { id: noDuties.user.id },
        data: { status: "ACTIVE", emailVerifiedAt: new Date() },
      });
    });
    it("filters matches before pagination and checks cursor membership against the same review", async () => {
      const ids: string[] = [];
      for (let n = 0; n < 3; n++) {
        const person = await f.account("CUSTOMER_SERVICE");
        await prisma.staffProfile.update({
          where: { userId: person.user.id },
          data: { firstName: "ReviewPage" },
        });
        await f.assignment(
          person.user.id,
          "CUSTOMER_SERVICE",
          true,
          f.home.id,
          new Date(Date.now() + 3600000),
        );
        ids.push(person.user.id);
      }
      let cursor: string | undefined;
      const seen: string[] = [];
      for (let n = 0; n < 3; n++) {
        const r = await read(f.scopedAdmin, {
          review: "COVER_ENDING",
          q: "ReviewPage",
          limit: 1,
          ...(cursor ? { cursor } : {}),
        });
        expect(r.status).toBe(200);
        expect(r.body.data.items).toHaveLength(1);
        seen.push(r.body.data.items[0].userId);
        cursor = r.body.data.nextCursor;
      }
      expect(new Set(seen)).toEqual(new Set(ids));
      expect(cursor).toBeUndefined();
      expect(
        (await read(f.scopedAdmin, { review: "COVER_ENDING", cursor: earlier.user.id }))
          .status,
      ).toBe(404);
    });
    it("bounds matches independently for each person without mixing their records", async () => {
      const expectedByPerson = new Map<string, Set<string>>();
      for (let n = 0; n < 2; n++) {
        const person = await f.account("CUSTOMER_SERVICE");
        await prisma.staffProfile.update({
          where: { userId: person.user.id },
          data: { firstName: "ReviewBound" },
        });
        await prisma.workforceAssignment.createMany({
          data: Array.from({ length: 21 }, () => ({
            userId: person.user.id,
            template: "CUSTOMER_SERVICE",
            templateVersion: 1,
            scope: "BRANCH",
            branchId: f.home.id,
            temporary: true,
            startsAt: new Date(Date.now() - 10000),
            expiresAt: new Date(Date.now() + 3600000),
            reason: "Synthetic bounded review duty",
            assignedByUserId: f.owner.id,
          })),
        });
        expectedByPerson.set(
          person.user.id,
          new Set(
            (
              await prisma.workforceAssignment.findMany({
                where: { userId: person.user.id, temporary: true },
                select: { id: true },
              })
            ).map((a) => a.id),
          ),
        );
      }
      const r = await read(f.scopedAdmin, {
        review: "COVER_ENDING",
        q: "ReviewBound",
        limit: 2,
      });
      expect(r.status).toBe(200);
      expect(r.body.data.items).toHaveLength(2);
      for (const person of r.body.data.items) {
        expect(person.reviewMatches).toHaveLength(20);
        expect(person.reviewMatchesMore).toBe(true);
        expect(
          person.reviewMatches.every((a: { assignmentId: string }) =>
            expectedByPerson.get(person.userId)!.has(a.assignmentId),
          ),
        ).toBe(true);
        expect(
          new Set(
            person.reviewMatches.map((a: { assignmentId: string }) => a.assignmentId),
          ).size,
        ).toBe(20);
      }
    });
    it("keeps ordinary roles, MFA, stale sessions and current delegation authoritative", async () => {
      expect(
        (
          await request(app).get(
            "/api/v1/admin/workforce/accounts?review=OPEN_ENDED_COVER",
          )
        ).status,
      ).toBe(401);
      for (const actor of [f.customer, f.care, f.operations])
        expect((await read(actor, { review: "OPEN_ENDED_COVER" })).status).toBe(403);
      const mfa = await f.session(f.scopedAdmin.user.id, "ADMIN", false);
      expect((await read(mfa, { review: "OPEN_ENDED_COVER" })).status).toBe(403);
      const stale = await f.session(f.scopedAdmin.user.id, "ADMIN");
      await prisma.session.update({
        where: { id: stale.record.id },
        data: { revokedAt: new Date() },
      });
      expect((await read(stale, { review: "OPEN_ENDED_COVER" })).status).toBe(401);
      await prisma.workforceAccess.update({
        where: { userId: f.scopedAdmin.user.id },
        data: { delegatedTemplates: [], version: { increment: 1 } },
      });
      expect((await read(f.scopedAdmin, { review: "OPEN_ENDED_COVER" })).status).toBe(
        403,
      );
    });
  },
);
