import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
import { learningResponseSchemas } from "../../src/modules/learning/learning.schemas.js";
import { answerAllie } from "../../src/modules/learning/allie.answer.js";
import { AllieFailure } from "../../src/modules/learning/allie.contracts.js";
import { createAllieProvider } from "../../src/modules/learning/allie.provider.js";
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
    const currentCatalogue = (identity: Identity | null) => async () => {
      const result = await read(
        identity,
        identity ? "/learning/catalogue" : "/public/learning/catalogue",
      );
      if (result.status !== 200) throw new AllieFailure("access_changed");
      return learningResponseSchemas.catalogue.parse(result.body.data);
    };
    const providerReply = () =>
      new Response(
        JSON.stringify({
          status: "completed",
          model: "isolated-test-model",
          output: [
            {
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    kind: "clarification",
                    answer: "Which supported task would you like explained?",
                    steps: [],
                    caveat: null,
                    sourceIds: [],
                    actionIds: [],
                  }),
                },
              ],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    const providerSettings = {
      apiKey: "synthetic-isolated-key-not-real",
      model: "isolated-test-model",
    };
    it("filters the model input through actual current HTTP learning access for every responsibility and account audience", async () => {
      const owner = await f.session(f.owner.id, "SUPER_ADMIN");
      const identities = [
        null,
        f.customer,
        f.operations,
        f.scopedAdmin,
        f.care,
        f.cashier,
        f.sales,
        f.accountant,
        f.mechanical1,
        f.electrical,
        f.lead,
        owner,
      ];
      for (const identity of identities) {
        const getCatalogue = currentCatalogue(identity),
          eligible = await getCatalogue();
        const outbound = vi.fn<typeof fetch>().mockResolvedValue(providerReply());
        const result = await answerAllie({
          question:
            "Explain work access, finance, customer care, assignment, product photos, invitations and privileged recovery",
          page: "other",
          getCatalogue,
          provider: createAllieProvider(providerSettings, outbound),
        });
        expect(result.usage.total_tokens).toBe(120);
        const requestBody = JSON.parse(outbound.mock.calls[0]![1]!.body as string);
        const payload = JSON.parse(requestBody.input[0].content) as {
          reviewedPassages: { id: string; passage: string }[];
        };
        const eligibleIds = eligible.articles.map(
          (article) => `${article.id}@v${article.version}`,
        );
        for (const source of payload.reviewedPassages)
          expect(eligibleIds).toContain(source.id);
        expect(payload.reviewedPassages.length).toBeLessThanOrEqual(4);
        expect(requestBody.store).toBe(false);
        expect(JSON.stringify(requestBody)).not.toContain(f.owner.id);
        expect(JSON.stringify(requestBody)).not.toContain(f.customer.user.email);
        expect(JSON.stringify(requestBody)).not.toContain(f.generalEnquiry.id);
        expect(payload).not.toHaveProperty("accessKey");
      }
    });
    it("discards an in-flight model answer after actual responsibility expiry", async () => {
      const person = await f.account("ACCOUNTANT");
      const outbound = vi.fn<typeof fetch>().mockImplementation(async () => {
        await prisma.workforceAssignment.updateMany({
          where: { userId: person.user.id },
          data: { expiresAt: new Date(Date.now() - 1) },
        });
        return providerReply();
      });
      await expect(
        answerAllie({
          question: "Explain finance records",
          page: "work",
          getCatalogue: currentCatalogue(person),
          provider: createAllieProvider(providerSettings, outbound),
        }),
      ).rejects.toMatchObject({ code: "access_changed" });
      expect(outbound).toHaveBeenCalledOnce();
      expect(
        (await currentCatalogue(person)()).articles.map((article) => article.id),
      ).not.toContain("finance-meaning");
    });
    it("requires current MFA before a call and current session ownership after generation", async () => {
      const weak = await f.session(f.care.user.id, "STAFF", false),
        before = vi.fn<typeof fetch>();
      await expect(
        answerAllie({
          question: "Explain care",
          page: "work",
          getCatalogue: currentCatalogue(weak),
          provider: createAllieProvider(providerSettings, before),
        }),
      ).rejects.toMatchObject({ code: "access_changed" });
      expect(before).not.toHaveBeenCalled();
      const person = await f.account("CUSTOMER_SERVICE");
      const outbound = vi.fn<typeof fetch>().mockImplementation(async () => {
        await prisma.session.update({
          where: { id: person.record.id },
          data: { revokedAt: new Date() },
        });
        return providerReply();
      });
      await expect(
        answerAllie({
          question: "Explain care",
          page: "work",
          getCatalogue: currentCatalogue(person),
          provider: createAllieProvider(providerSettings, outbound),
        }),
      ).rejects.toMatchObject({ code: "access_changed" });
      expect(outbound).toHaveBeenCalledOnce();
    });
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
      const accessReview = await read(f.scopedAdmin, "/learning/articles/access-review");
      expect(accessReview.status).toBe(200);
      expect(accessReview.body.data).toMatchObject({ version: 4 });
      expect(accessReview.body.data.steps.join(" ")).toContain(
        "review access added, removed and retained",
      );
      expect(accessReview.body.data.steps.join(" ")).toContain(
        "Scheduled assignments supply no access before their start",
      );
      const workAccess = await read(f.care, "/learning/articles/work-access");
      expect(workAccess.status).toBe(200);
      expect(workAccess.body.data.version).toBe(5);
      expect(workAccess.body.data.steps.join(" ")).toContain(
        "They do not widen your branch responsibilities",
      );
      expect(workAccess.body.data.steps.join(" ")).toContain(
        "Protected unsent work is discarded, never sent automatically",
      );
    });
    it("projects actual managed reply audience, sales scope and customer note privacy", async () => {
      const managed = await read(f.care, "/learning/articles/care-triage");
      expect(managed.status).toBe(200);
      expect(managed.body.data.steps.join(" ")).toContain(
        "does not provide internal notes",
      );
      expect(managed.body.data.recovery).not.toContain("use Contact support");
      const admin = await f.account(null, "ADMIN");
      const legacy = await read(admin, "/learning/articles/care-triage");
      expect(legacy.body.data.steps.join(" ")).toContain("internal-note");
      expect(legacy.body.data.href).toBe("/admin/support");
      const cashier = await read(f.cashier, "/learning/articles/sales-enquiries");
      expect(cashier.body.data.summary).toContain("Only enquiries assigned to you");
      const supervisor = await read(f.sales, "/learning/articles/sales-enquiries");
      expect(supervisor.body.data.summary).toContain("authorised branch scope");
      const customer = await read(f.customer, "/learning/articles/own-conversation");
      expect(customer.body.data.steps.join(" ")).toContain(
        "Internal staff notes are not shown",
      );
      expect(customer.body.data.version).toBe(5);
      expect(customer.body.data.steps.join(" ")).toContain(
        "no help transcript is attached automatically",
      );
      expect(customer.body.data.steps.join(" ")).toContain(
        "exact message, branch and destination",
      );
      expect(customer.body.data.steps.join(" ")).toContain("Go back to edit your draft");
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
