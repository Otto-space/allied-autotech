import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { notifySupportTeam } from "../../src/modules/notifications/team-notifications.js";
import { env } from "../../src/config/env.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "granular Care case authority",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    const previousHelp = [
      env.HELP_LEARN_ENABLED,
      env.HELP_LEARN_GUIDES_ENABLED,
      env.HELP_LEARN_PRACTICE_ENABLED,
    ];
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      env.HELP_LEARN_ENABLED =
        env.HELP_LEARN_GUIDES_ENABLED =
        env.HELP_LEARN_PRACTICE_ENABLED =
          true;
    }, 30000);
    afterAll(() => {
      [
        env.HELP_LEARN_ENABLED,
        env.HELP_LEARN_GUIDES_ENABLED,
        env.HELP_LEARN_PRACTICE_ENABLED,
      ] = previousHelp as [boolean, boolean, boolean];
      return prisma.$disconnect();
    });
    type Duty = "CARE_VIEWER" | "CARE_RESPONDER" | "CARE_ASSIGNER" | "CARE_LIVE_AGENT";
    async function duty(userId: string, template: Duty, branchId = f.home.id) {
      return prisma.workforceAssignment.create({
        data: {
          userId,
          template,
          templateVersion: 2,
          branchId,
          scope: "BRANCH",
          temporary: false,
          startsAt: new Date(Date.now() - 1000),
          reason: "Reviewed synthetic Care case duty",
          assignedByUserId: f.owner.id,
        },
      });
    }
    async function operator(duties: Duty[], role: "STAFF" | "ADMIN" = "STAFF") {
      const actor = await f.account(null, role);
      await prisma.workforceAccess.create({
        data: {
          userId: actor.user.id,
          position: "CUSTOMER_SERVICE",
          updatedByUserId: f.owner.id,
        },
      });
      for (const name of duties) await duty(actor.user.id, name);
      return actor;
    }
    async function enquiry(
      branchId = f.home.id,
      type: "GENERAL" | "PRODUCT" = "GENERAL",
    ) {
      return prisma.enquiry.create({
        data: {
          branchId,
          type,
          ...(type === "PRODUCT" ? { productId: f.enquiry.productId } : {}),
          customerId: f.customer.user.profile!.id,
          name: "Synthetic customer",
          email: f.customer.user.email,
          subject: `Synthetic Care case ${randomUUID()}`,
          message: "Synthetic customer-visible case question",
        },
      });
    }
    async function complaint() {
      return prisma.complaint.create({
        data: {
          branchId: f.home.id,
          customerId: f.customer.user.profile!.id,
          name: "Synthetic customer",
          email: f.customer.user.email,
          subject: `Synthetic Care complaint ${randomUUID()}`,
          description: "Synthetic customer-visible complaint description",
        },
      });
    }
    const get = (actor: { headers: Record<string, string> }, path: string) =>
      request(app).get(`/api/v1/staff/workforce${path}`).set(actor.headers);
    const reply = (
      actor: { headers: Record<string, string> },
      kind: string,
      id: string,
      extra: object = {},
    ) =>
      request(app)
        .post(`/api/v1/staff/workforce/${kind}/${id}/replies`)
        .set(actor.headers)
        .send({
          expectedVersion: 0,
          expectedLatestMessageId: null,
          body: "Synthetic reviewed customer-visible reply",
          ...extra,
        });
    const assign = (
      actor: { headers: Record<string, string> },
      kind: string,
      id: string,
      staffId: string,
    ) =>
      request(app)
        .patch(`/api/v1/staff/workforce/${kind}/${id}/assignment`)
        .set(actor.headers)
        .send({
          expectedVersion: 0,
          staffId,
          reason: "Reviewed synthetic Care assignment",
        });

    for (const role of ["STAFF", "ADMIN"] as const)
      it(`${role} can view branch cases without receiving reply, assignment or legacy customer powers`, async () => {
        const actor = await operator(["CARE_VIEWER"], role),
          e = await enquiry(),
          c = await complaint();
        await prisma.supportMessage.create({
          data: {
            enquiryId: e.id,
            authorUserId: f.owner.id,
            authorType: "STAFF",
            visibility: "INTERNAL",
            kind: "INTERNAL_NOTE",
            body: "INTERNAL-SYNTHETIC-NEVER-SHARE",
          },
        });
        const detail = await get(actor, `/enquiries/${e.id}`);
        expect(detail.status).toBe(200);
        expect(detail.body.data.contact.email).toBe(f.customer.user.email);
        expect(JSON.stringify(detail.body)).not.toContain(
          "INTERNAL-SYNTHETIC-NEVER-SHARE",
        );
        expect(
          (await get(actor, `/enquiries?q=${encodeURIComponent(e.subject)}`)).body.data
            .items[0].id,
        ).toBe(e.id);
        expect((await get(actor, `/complaints/${c.id}`)).status).toBe(200);
        expect((await reply(actor, "enquiries", e.id)).status).toBe(403);
        expect((await reply(actor, "complaints", c.id)).status).toBe(403);
        expect(
          (await assign(actor, "enquiries", e.id, f.cashier.user.staffProfile!.id))
            .status,
        ).toBe(403);
        expect(
          (await get(actor, `/enquiries/${(await enquiry(f.other.id)).id}`)).status,
        ).toBe(404);
        const legacy = await request(app)
          .get("/api/v1/admin/customers")
          .set(actor.headers);
        expect(legacy.status).toBe(403);
      });
    it("requires view plus reply on the same branch, including for a managed Admin", async () => {
      const actor = await operator(["CARE_RESPONDER"], "ADMIN"),
        e = await enquiry();
      expect((await get(actor, "/enquiries")).status).toBe(403);
      expect((await reply(actor, "enquiries", e.id)).status).toBe(403);
      await duty(actor.user.id, "CARE_VIEWER", f.other.id);
      expect((await reply(actor, "enquiries", e.id)).status).toBe(403);
      await duty(actor.user.id, "CARE_VIEWER");
      expect(
        (await reply(actor, "enquiries", e.id, { visibility: "INTERNAL" })).status,
      ).toBe(422);
      const saved = await reply(actor, "enquiries", e.id);
      expect(saved.status).toBe(200);
      expect(saved.body.data.messageReceipt.visibility).toBe("CUSTOMER");
      expect(saved.body.data.actorUserId).toBe(actor.user.id);
      expect(
        await prisma.supportMessage.count({
          where: { enquiryId: e.id, visibility: "CUSTOMER" },
        }),
      ).toBe(1);
      expect((await reply(actor, "enquiries", e.id)).status).toBe(409);
    });
    it("permits reviewed complaint replies only with both branch duties and returns no internal notes", async () => {
      const actor = await operator(["CARE_VIEWER", "CARE_RESPONDER"]),
        c = await complaint();
      const saved = await reply(actor, "complaints", c.id);
      expect(saved.status).toBe(200);
      expect(saved.body.data.messageReceipt.visibility).toBe("CUSTOMER");
      expect(
        (await get(actor, `/complaints/${c.id}`)).body.data.messages.items,
      ).toHaveLength(1);
    });
    it("assigns a general case only to a current same-branch viewer/responder, not a view-only colleague", async () => {
      const actor = await operator(["CARE_VIEWER", "CARE_ASSIGNER"]),
        target = await operator(["CARE_VIEWER", "CARE_RESPONDER"]),
        viewer = await operator(["CARE_VIEWER"]),
        e = await enquiry();
      expect(
        (await assign(actor, "enquiries", e.id, viewer.user.staffProfile!.id)).status,
      ).toBe(403);
      const options = await get(
        actor,
        `/enquiries/${e.id}/assignees?limit=25&q=Synthetic`,
      );
      expect(options.status).toBe(200);
      expect(
        options.body.data.items.some(
          (a: { id: string }) => a.id === target.user.staffProfile!.id,
        ),
      ).toBe(true);
      expect(
        options.body.data.items.some(
          (a: { id: string }) => a.id === viewer.user.staffProfile!.id,
        ),
      ).toBe(false);
      const saved = await assign(actor, "enquiries", e.id, target.user.staffProfile!.id);
      expect(saved.status).toBe(200);
      expect(saved.body.data.assignmentReceipt.staffId).toBe(
        target.user.staffProfile!.id,
      );
      expect(
        (await prisma.enquiry.findUniqueOrThrow({ where: { id: e.id } })).assignedStaffId,
      ).toBe(target.user.staffProfile!.id);
    });
    it("preserves Sales assignment to a cashier who will gain assigned scope through that very assignment", async () => {
      const e = await enquiry(f.home.id, "PRODUCT");
      const saved = await assign(
        f.sales,
        "enquiries",
        e.id,
        f.cashier.user.staffProfile!.id,
      );
      expect(saved.status).toBe(200);
      expect((await get(f.cashier, `/enquiries/${e.id}`)).status).toBe(200);
    });
    it("supports explicit complaint assignment without giving the old broad Care duty new assignment powers", async () => {
      const actor = await operator(["CARE_VIEWER", "CARE_ASSIGNER"]),
        target = await operator(["CARE_VIEWER", "CARE_RESPONDER"]),
        c = await complaint();
      expect(
        (await assign(f.care, "complaints", c.id, target.user.staffProfile!.id)).status,
      ).toBe(403);
      expect((await get(actor, `/complaints/${c.id}/assignees?limit=25`)).status).toBe(
        200,
      );
      const saved = await assign(actor, "complaints", c.id, target.user.staffProfile!.id);
      expect(saved.status).toBe(200);
      expect(
        (await prisma.complaint.findUniqueOrThrow({ where: { id: c.id } }))
          .assignedStaffId,
      ).toBe(target.user.staffProfile!.id);
    });
    it("notifies only current case viewers; reply and live-acceptance duties alone confer no private alert access", async () => {
      const viewer = await operator(["CARE_VIEWER"]),
        responder = await operator(["CARE_RESPONDER"]),
        live = await operator(["CARE_LIVE_AGENT"]),
        foreign = await operator([]),
        e = await enquiry();
      await duty(foreign.user.id, "CARE_VIEWER", f.other.id);
      await prisma.$transaction((tx) =>
        notifySupportTeam(tx, {
          kind: "ENQUIRY",
          id: e.id,
          event: `synthetic-care:${e.id}`,
          title: "Synthetic case update",
        }),
      );
      const rows = await prisma.notification.findMany({
        where: {
          resourceId: e.id,
          userId: { in: [viewer, responder, live, foreign].map((a) => a.user.id) },
        },
        select: { userId: true },
      });
      expect(rows.map((r) => r.userId)).toEqual([viewer.user.id]);
      const inbox = await request(app)
        .get("/api/v1/staff/notifications")
        .set(viewer.headers);
      expect(inbox.status).toBe(200);
      const notice = inbox.body.data.items.find(
        (r: { resourceId: string }) => r.resourceId === e.id,
      );
      expect(notice.destination.href).toBe(`/admin/workforce/enquiries?selected=${e.id}`);
      await prisma.workforceAssignment.updateMany({
        where: { userId: viewer.user.id },
        data: { revokedAt: new Date() },
      });
      const after = await request(app)
        .get("/api/v1/staff/notifications")
        .set(viewer.headers);
      const redacted = after.body.data.items.find(
        (r: { id: string }) => r.id === notice.id,
      );
      expect(redacted.destination).toBeNull();
      expect(redacted.resourceId).toBeNull();
      expect(redacted.title).toBe("Update no longer available");
    });
    it("filters eligible handlers before pagination and rejects foreign or ineligible cursors", async () => {
      const actor = await operator(["CARE_VIEWER", "CARE_ASSIGNER"]),
        e = await enquiry(),
        a = await operator(["CARE_VIEWER", "CARE_RESPONDER"]),
        b = await operator(["CARE_VIEWER", "CARE_RESPONDER"]),
        viewer = await operator(["CARE_VIEWER"]),
        foreign = await operator([]),
        tag = randomUUID();
      await duty(foreign.user.id, "CARE_VIEWER", f.other.id);
      await duty(foreign.user.id, "CARE_RESPONDER", f.other.id);
      await prisma.staffProfile.updateMany({
        where: { userId: { in: [a, b, viewer, foreign].map((v) => v.user.id) } },
        data: { lastName: tag },
      });
      const path = `/enquiries/${e.id}/assignees?limit=1&q=${tag}`;
      const first = await get(actor, path);
      expect(first.status).toBe(200);
      expect(first.body.data.items).toHaveLength(1);
      expect(first.body.data.nextCursor).toBe(first.body.data.items[0].id);
      const next = await get(actor, `${path}&cursor=${first.body.data.nextCursor}`);
      expect(next.status).toBe(200);
      expect(next.body.data.items).toHaveLength(1);
      expect(next.body.data.nextCursor).toBeUndefined();
      expect(
        new Set(
          [...first.body.data.items, ...next.body.data.items].map(
            (v: { id: string }) => v.id,
          ),
        ),
      ).toEqual(new Set([a, b].map((v) => v.user.staffProfile!.id)));
      for (const id of [viewer.user.staffProfile!.id, foreign.user.staffProfile!.id])
        expect((await get(actor, `${path}&cursor=${id}`)).status).toBe(404);
      expect(
        (await get(actor, `/enquiries/${e.id}/assignees?limit=25&q=%25`)).body.data.items,
      ).toEqual([]);
    });
    it("serialises competing assignments and preserves customer-owned history without internal assignment reasons", async () => {
      const actor = await operator(["CARE_VIEWER", "CARE_ASSIGNER"]),
        e = await enquiry(),
        a = await operator(["CARE_VIEWER", "CARE_RESPONDER"]),
        b = await operator(["CARE_VIEWER", "CARE_RESPONDER"]);
      const results = await Promise.all([
        assign(actor, "enquiries", e.id, a.user.staffProfile!.id),
        assign(actor, "enquiries", e.id, b.user.staffProfile!.id),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        (await prisma.enquiry.findUniqueOrThrow({ where: { id: e.id } })).version,
      ).toBe(1);
      expect(
        await prisma.auditLog.count({ where: { entityId: e.id, action: "UPDATE" } }),
      ).toBe(1);
      const own = await request(app)
        .get(`/api/v1/customers/support/enquiries/${e.id}`)
        .set(f.customer.headers);
      expect(own.status).toBe(200);
      expect(own.body.data.id).toBe(e.id);
      expect(JSON.stringify(own.body)).not.toContain(
        "Reviewed synthetic Care assignment",
      );
      expect(
        (
          await request(app)
            .get(`/api/v1/customers/support/enquiries/${e.id}`)
            .set(f.stranger.headers)
        ).status,
      ).toBe(404);
    });
    it("offers read-only guidance and queue walkthroughs without reply practice until same-branch reply authority exists", async () => {
      const actor = await operator(["CARE_VIEWER"]);
      await duty(actor.user.id, "CARE_RESPONDER", f.other.id);
      const learning = (path: string) =>
        request(app).get(`/api/v1/learning/${path}`).set(actor.headers);
      const readOnly = await learning("catalogue");
      expect(readOnly.status).toBe(200);
      const article = readOnly.body.data.articles.find(
        (a: { id: string }) => a.id === "care-triage",
      );
      expect(article.version).toBe(2);
      expect(article.href).toBe("/admin/workforce/enquiries");
      expect(article.summary).toContain("do not permit customer replies");
      expect(article.steps.join(" ")).toContain("does not provide internal notes");
      expect(
        readOnly.body.data.guides.some((g: { id: string }) => g.id === "care-queue"),
      ).toBe(true);
      expect(
        readOnly.body.data.scenarios.some((g: { id: string }) => g.id === "care-triage"),
      ).toBe(false);
      expect((await learning("scenarios/care-triage")).status).toBe(404);
      expect((await learning("guides/care-queue")).status).toBe(200);
      await duty(actor.user.id, "CARE_RESPONDER");
      const replyScope = await learning("catalogue");
      expect(replyScope.body.data.accessKey).not.toBe(readOnly.body.data.accessKey);
      expect(
        replyScope.body.data.scenarios.some(
          (g: { id: string }) => g.id === "care-triage",
        ),
      ).toBe(true);
      expect((await learning("scenarios/care-triage")).status).toBe(200);
    });
    it("does not offer private Care help to a reply-only operator with a Customer Service position", async () => {
      const actor = await operator(["CARE_RESPONDER"]);
      const read = await request(app)
        .get("/api/v1/learning/articles/care-triage")
        .set(actor.headers);
      expect(read.status).toBe(404);
    });
    for (const kind of ["enquiries", "complaints"] as const)
      it(`rejects expired public-reply authority after a ${kind} record-lock wait, with no saved reply`, async () => {
        const actor = await operator(["CARE_VIEWER", "CARE_RESPONDER"]),
          row = kind === "enquiries" ? await enquiry() : await complaint();
        const expiresAt = new Date(Date.now() + 1800);
        await prisma.workforceAssignment.updateMany({
          where: { userId: actor.user.id, template: "CARE_RESPONDER" },
          data: { expiresAt },
        });
        let release!: () => void, ready!: () => void;
        const blocked = new Promise<void>((resolve) => (release = resolve)),
          locked = new Promise<void>((resolve) => (ready = resolve));
        const holder = prisma.$transaction(async (tx) => {
          if (kind === "enquiries")
            await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id"=${row.id}::uuid FOR UPDATE`;
          else
            await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id"=${row.id}::uuid FOR UPDATE`;
          ready();
          await blocked;
        });
        await locked;
        const pending = reply(actor, kind, row.id).then((r) => r);
        try {
          const deadline = Date.now() + 1400;
          let waiting = false;
          const pattern = `%FROM "${kind === "enquiries" ? "Enquiry" : "Complaint"}"%FOR UPDATE%`;
          while (Date.now() < deadline) {
            const [state] = await prisma.$queryRaw<
              { waiting: boolean }[]
            >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND wait_event_type='Lock' AND query LIKE ${pattern}) AS waiting`;
            if (state?.waiting) {
              waiting = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 15));
          }
          expect(waiting).toBe(true);
          while (Date.now() <= expiresAt.getTime())
            await new Promise((resolve) => setTimeout(resolve, 20));
        } finally {
          release();
          await holder;
        }
        expect((await pending).status).toBe(403);
        expect((await get(actor, `/${kind}/${row.id}`)).status).toBe(200);
        expect(
          await prisma.supportMessage.count({
            where: kind === "enquiries" ? { enquiryId: row.id } : { complaintId: row.id },
          }),
        ).toBe(0);
        expect(
          await prisma.auditLog.count({ where: { entityId: row.id, action: "UPDATE" } }),
        ).toBe(0);
        const current =
          kind === "enquiries"
            ? await prisma.enquiry.findUniqueOrThrow({ where: { id: row.id } })
            : await prisma.complaint.findUniqueOrThrow({ where: { id: row.id } });
        expect(current.version).toBe(0);
      });
  },
);
