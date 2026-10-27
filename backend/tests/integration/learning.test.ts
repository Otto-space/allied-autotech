import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
import {
  learningCatalogue,
  learningEligible,
  publicLearningAccess,
} from "../../src/modules/learning/learning.service.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Help & Learn through actual authenticated HTTP",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    type Identity = { headers: Record<string, string> };
    const read = (identity: Identity | null, path = "/learning/catalogue") => {
      const req = request(app).get("/api/v1" + path);
      return identity ? req.set(identity.headers) : req;
    };
    const ids = (response: { body: { data: { articles: { id: string }[] } } }) =>
      response.body.data.articles.map((a) => a.id);
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    it("filters private titles, snippets, bodies, guide and scenario definitions before public search or direct reads", async () => {
      const publicResult = await read(null, "/public/learning/catalogue");
      expect(publicResult.status).toBe(200);
      expect(ids(publicResult)).toEqual([
        "home-next-step",
        "parts-fitment",
        "vehicle-enquiry",
        "service-request",
        "security-basics",
        "no-live-lookup",
      ]);
      const home = await read(null, "/public/learning/articles/home-next-step");
      expect(home.status).toBe(200);
      expect(home.body.data).toMatchObject({
        id: "home-next-step",
        page: "home",
        href: "/services",
        version: 1,
      });
      expect(publicResult.headers["cache-control"]).toContain("no-store");
      expect(publicResult.headers.vary).toContain("Cookie");
      for (const id of [
        "care-triage",
        "finance-meaning",
        "access-review",
        "privileged-recovery",
      ]) {
        expect(JSON.stringify(publicResult.body)).not.toContain(id);
        expect((await read(null, "/public/learning/articles/" + id)).status).toBe(404);
      }
      expect((await read(null, "/public/learning/guides/own-request")).status).toBe(404);
      expect(
        (await read(null, "/public/learning/scenarios/payment-discrepancy")).status,
      ).toBe(404);
      expect(ids(await read(null, "/public/learning/catalogue?q=FINANCE_READ"))).toEqual(
        [],
      );
      expect((await read(null)).status).toBe(401);
    });
    it("enforces verified customer ownership and rejects forged role/user scope", async () => {
      expect(ids(await read(f.customer))).toContain("own-conversation");
      expect(ids(await read(f.customer))).not.toContain("care-triage");
      expect((await read(f.customer, "/learning/scenarios/enquiry-draft")).status).toBe(
        200,
      );
      expect(
        (await read(f.customer, "/learning/articles/privileged-recovery")).status,
      ).toBe(404);
      expect(
        (
          await read(
            f.customer,
            "/learning/catalogue?role=SUPER_ADMIN&userId=" + f.owner.id,
          )
        ).status,
      ).toBe(422);
      expect(
        (await read(f.customer, "/public/learning/catalogue")).body.data.audience,
      ).toBe("public");
    });
    it("covers every implemented responsibility with only its effective permissions", async () => {
      const cases: [Identity, string[], string[]][] = [
        [
          f.operations,
          ["mixed-queues", "care-triage", "sales-enquiries"],
          ["finance-meaning", "customer-account-review"],
        ],
        [
          f.scopedAdmin,
          ["mixed-queues", "access-review"],
          ["customer-account-review", "care-triage"],
        ],
        [f.care, ["care-triage"], ["finance-meaning", "customer-account-review"]],
        [f.cashier, ["sales-enquiries"], ["care-triage", "finance-meaning"]],
        [f.sales, ["sales-enquiries"], ["care-triage", "finance-meaning"]],
        [f.accountant, ["finance-meaning"], ["care-triage", "assigned-findings"]],
        [f.mechanical1, ["assigned-findings"], ["job-assignment", "finance-meaning"]],
        [f.electrical, ["assigned-findings"], ["job-assignment", "care-triage"]],
        [
          f.lead,
          ["assigned-findings", "job-assignment"],
          ["finance-meaning", "care-triage"],
        ],
      ];
      for (const [identity, allowed, denied] of cases) {
        const response = await read(identity);
        expect(response.status).toBe(200);
        for (const id of allowed) expect(ids(response)).toContain(id);
        for (const id of denied) {
          expect(ids(response)).not.toContain(id);
          expect((await read(identity, "/learning/articles/" + id)).status).toBe(404);
        }
      }
      const ceo = await f.account(null, "ADMIN");
      await prisma.workforceAccess.create({
        data: { userId: ceo.user.id, position: "CEO_MD", updatedByUserId: f.owner.id },
      });
      expect(ids(await read(ceo))).toContain("oversight-scope");
      expect(ids(await read(ceo))).not.toContain("finance-meaning");
      const admin = await f.account(null, "ADMIN"),
        owner = await f.session(f.owner.id, "SUPER_ADMIN");
      expect(ids(await read(admin))).toEqual(
        expect.arrayContaining([
          "customer-account-review",
          "access-review",
          "care-triage",
        ]),
      );
      expect(ids(await read(admin))).not.toContain("privileged-recovery");
      expect(ids(await read(owner))).toContain("privileged-recovery");
      expect((await read(admin, "/learning/articles/care-triage")).body.data.href).toBe(
        "/admin/support",
      );
    });
    it("removes revoked/expired assignments and session assurance on the next read", async () => {
      const person = await f.account("ACCOUNTANT");
      const before = await read(person);
      expect(ids(before)).toContain("finance-meaning");
      await prisma.workforceAssignment.updateMany({
        where: { userId: person.user.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      const after = await read(person);
      expect(ids(after)).not.toContain("finance-meaning");
      expect(after.body.data.accessKey).not.toBe(before.body.data.accessKey);
      expect((await read(person, "/learning/scenarios/payment-discrepancy")).status).toBe(
        404,
      );
      await prisma.session.update({
        where: { id: person.record.id },
        data: { revokedAt: new Date() },
      });
      expect((await read(person)).status).toBe(401);
      const weak = await f.session(f.care.user.id, "STAFF", false);
      expect((await read(weak)).status).toBe(403);
    });
    it("searches across fields with synonyms; unknown, draft and disabled items do not leak", async () => {
      expect(
        ids(await read(null, "/public/learning/catalogue?q=shop+compatibility")),
      ).toEqual(["home-next-step", "parts-fitment"]);
      expect(
        ids(await read(null, "/public/learning/catalogue?q=no-such-fixture")),
      ).toEqual([]);
      const guideSearch = await read(null, "/public/learning/catalogue?q=walkthrough");
      expect(guideSearch.body.data.articles).toEqual([]);
      expect(guideSearch.body.data.guides.map((g: { id: string }) => g.id)).toEqual([
        "parts-find",
      ]);
      expect(guideSearch.body.data.scenarios).toEqual([]);
      const practiceSearch = await read(null, "/public/learning/catalogue?q=practise");
      expect(practiceSearch.body.data.articles).toEqual([]);
      expect(practiceSearch.body.data.guides).toEqual([]);
      expect(practiceSearch.body.data.scenarios.map((s: { id: string }) => s.id)).toEqual(
        ["corolla-fitment"],
      );
      const natural = await read(
        null,
        "/public/learning/catalogue?q=how+do+I+find+a+part",
      );
      expect(natural.body.data.articles.map((a: { id: string }) => a.id)).toContain(
        "parts-fitment",
      );
      expect(natural.body.data.guides.map((g: { id: string }) => g.id)).toContain(
        "parts-find",
      );
      expect(natural.body.data.scenarios.map((s: { id: string }) => s.id)).toContain(
        "corolla-fitment",
      );
      expect(ids(await read(null, "/public/learning/catalogue?q=product+photo"))).toEqual(
        [],
      );
      expect(ids(await read(f.care, "/learning/catalogue?q=product+photo"))).toEqual([]);
      const mediaOwner = await f.session(f.owner.id, "SUPER_ADMIN");
      expect(ids(await read(mediaOwner, "/learning/catalogue?q=product+photo"))).toEqual([
        "product-photos",
      ]);
      const article = learningArticles.find((a) => a.id === "parts-fitment")!;
      article.status = "draft";
      try {
        expect((await read(null, "/public/learning/articles/parts-fitment")).status).toBe(
          404,
        );
        expect(
          (await read(null, "/public/learning/scenarios/corolla-fitment")).status,
        ).toBe(404);
      } finally {
        article.status = "published";
      }
      env.HELP_LEARN_GUIDES_ENABLED = false;
      env.HELP_LEARN_PRACTICE_ENABLED = false;
      try {
        const response = await read(f.care);
        expect(response.body.data.guides).toEqual([]);
        expect(response.body.data.scenarios).toEqual([]);
        expect(
          (await read(null, "/public/learning/scenarios/corolla-fitment")).status,
        ).toBe(404);
      } finally {
        env.HELP_LEARN_GUIDES_ENABLED = true;
        env.HELP_LEARN_PRACTICE_ENABLED = true;
      }
      env.HELP_LEARN_ENABLED = false;
      try {
        expect((await read(f.customer)).status).toBe(404);
        expect((await read(null, "/public/learning/catalogue")).status).toBe(404);
      } finally {
        env.HELP_LEARN_ENABLED = true;
      }
    });
    it("has no training/operational mutation routes and changes no domain records on read", async () => {
      const counts = async () =>
        Promise.all([
          prisma.booking.count(),
          prisma.order.count(),
          prisma.payment.count(),
          prisma.enquiry.count(),
          prisma.outboxEvent.count(),
          prisma.workforceAssignment.count(),
        ]);
      const before = await counts();
      await read(f.care);
      await read(f.customer, "/learning/scenarios/enquiry-draft");
      const result = await request(app)
        .post("/api/v1/learning/scenarios/care-triage/reset")
        .set(f.care.headers)
        .send({ realId: f.generalEnquiry.id });
      expect([403, 404]).toContain(result.status);
      expect(await counts()).toEqual(before);
    });
  },
);

describe("learning eligibility is deterministic and conservative", () => {
  it("does not turn a title or learning completion into permissions", () => {
    expect(
      learningEligible(
        {
          ...publicLearningAccess,
          role: "STAFF",
          verified: true,
          position: "ACCOUNTANT",
        },
        "finance",
      ),
    ).toBe(false);
    expect(
      learningEligible(
        { ...publicLearningAccess, role: "CUSTOMER", verified: true, canManage: true },
        "access",
      ),
    ).toBe(false);
    const previous = env.HELP_LEARN_ENABLED;
    env.HELP_LEARN_ENABLED = true;
    try {
      expect(learningCatalogue(publicLearningAccess).flags.ai).toBe(false);
    } finally {
      env.HELP_LEARN_ENABLED = previous;
    }
  });
});
