import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { fitmentProductWhere } from "../../src/modules/fitment/fitment.engine.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated reviewed parts fitment HTTP",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let productId: string, modelId: string, makeId: string;
    const read = (path: string, identity?: { headers: Record<string, string> }) =>
      request(app)
        .get(`/api/v1${path}`)
        .set(identity?.headers ?? {});
    const write = (
      method: "post" | "put",
      path: string,
      body: unknown,
      identity: { headers: Record<string, string> },
    ) => request(app)[method](`/api/v1${path}`).set(identity.headers).send(body);
    const rules = () => `/staff/fitment/products/${productId}/rules`;
    const input = () => ({
      branchId: f.home.id,
      vehicleModelId: modelId,
      yearFrom: 2014,
      yearTo: 2019,
      safetyCritical: true,
      allVariantsConfirmed: true,
      requiredQualifiers: ["engineCode", "market", "position", "brakeSystem"],
      engineCode: "2ZR-FE",
      market: "Japan",
      position: "front",
      brakeSystem: "Akebono",
      sourceReference: "Synthetic catalogue: Toyota Corolla 2018 brake pads",
      evidenceNotes: "Synthetic test evidence only, not a production fitment source",
    });
    const selection = () => ({
      vehicleMakeId: makeId,
      vehicleModelId: modelId,
      year: 2018,
      engineCode: "2zr-fe",
      market: "Japan",
      position: "Front",
      brakeSystem: "Akebono",
    });
    async function create(body: unknown = input()) {
      const response = await write("post", rules(), body, f.operations);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      return response.body.data as { id: string; version: number; reviewStatus: string };
    }
    async function transition(
      id: string,
      version: number,
      action: string,
      identity = f.operations,
    ) {
      return write(
        "post",
        `${rules()}/${id}/transitions`,
        { action, expectedVersion: version, note: "Synthetic reviewed test decision" },
        identity,
      );
    }
    beforeAll(async () => {
      f = await workforceFixture();
      const nonce = randomUUID();
      const product = await prisma.product.create({
        data: {
          name: "Synthetic Toyota Corolla brake pads",
          sku: `FIT-${nonce}`,
          slug: `fit-${nonce}`,
          priceKobo: 10000n,
          productType: "BRAKE_PADS",
          category: { create: { name: "Synthetic brake pads", slug: `fit-${nonce}` } },
          inventories: { create: { branchId: f.home.id, quantity: 2 } },
        },
      });
      productId = product.id;
      const make = await write(
        "post",
        "/staff/fitment/makes",
        { name: `Toyota test ${nonce}` },
        f.operations,
      );
      expect(make.status, JSON.stringify(make.body)).toBe(200);
      makeId = make.body.data.id;
      const model = await write(
        "post",
        "/staff/fitment/models",
        {
          makeId,
          name: "Corolla",
          yearFrom: 2013,
          yearTo: 2019,
          sourceReference: "Synthetic model-year reference",
        },
        f.operations,
      );
      expect(model.status, JSON.stringify(model.body)).toBe(200);
      modelId = model.body.data.id;
    }, 30000);
    afterAll(() => prisma.$disconnect());

    it("provides dependent catalogue choices and rejects mismatched vehicle identities", async () => {
      const models = await read(`/public/fitment/models?makeId=${makeId}`);
      expect(models.status).toBe(200);
      expect(models.body.data.items.map((row: { id: string }) => row.id)).toContain(
        modelId,
      );
      expect(
        (await read(`/public/fitment/years?modelId=${modelId}`)).body.data.years,
      ).toEqual([2019, 2018, 2017, 2016, 2015, 2014, 2013]);
      expect((await read("/public/fitment/models")).status).toBe(422);
      expect(
        (
          await read(`/public/fitment/products/${productId}`).query({
            ...selection(),
            vehicleMakeId: randomUUID(),
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await read(`/public/fitment/products/${productId}`).query({
            ...selection(),
            year: 2020,
          })
        ).status,
      ).toBe(422);
    });
    it("requires current staff responsibilities, MFA, CSRF and product/branch scope", async () => {
      expect((await read("/staff/fitment/access", f.operations)).body.data).toMatchObject(
        { canAuthor: true, canReview: false },
      );
      expect((await read("/staff/fitment/access", f.lead)).body.data).toMatchObject({
        canAuthor: false,
        canReview: true,
      });
      for (const identity of [f.mechanical1, f.cashier, f.customer])
        expect((await read("/staff/fitment/access", identity)).status).toBe(403);
      expect(
        (await write("post", rules(), { ...input(), branchId: f.other.id }, f.operations))
          .status,
      ).toBe(403);
      const noMfa = await f.session(f.operations.user.id, "STAFF", false);
      expect((await read("/staff/fitment/access", noMfa)).status).toBe(403);
      const noCsrf = { ...f.operations.headers, "X-CSRF-Token": "" };
      expect((await write("post", rules(), input(), { headers: noCsrf })).status).toBe(
        403,
      );
    });
    it("publishes only independently approved evidence, preserves history and demotes corrections", async () => {
      const row = await create();
      expect(
        (await read(`/public/fitment/products/${productId}`).query(selection())).body.data
          .status,
      ).toBe("UNKNOWN");
      expect(
        (await read(`/public/catalog/products/${productId}`)).body.data.compatibilities,
      ).toEqual([]);
      expect((await transition(row.id, 0, "SUBMIT")).body.data.reviewStatus).toBe(
        "PENDING",
      );
      // Holding both responsibilities still never permits self-approval.
      await f.assignment(f.operations.user.id, "WORKSHOP_LEAD", true);
      expect((await transition(row.id, 1, "APPROVE")).status).toBe(403);
      const approved = await transition(row.id, 1, "APPROVE", f.lead);
      expect(approved.status, JSON.stringify(approved.body)).toBe(200);
      expect(
        (await read(`/public/fitment/products/${productId}`).query(selection())).body.data
          .status,
      ).toBe("VERIFIED_FIT");
      expect(
        (
          await read(`/public/fitment/products/${productId}`).query({
            vehicleModelId: modelId,
            year: 2018,
          })
        ).body.data.status,
      ).toBe("NEEDS_VERIFICATION");
      expect((await write("post", rules(), input(), f.operations)).status).toBe(409);
      const history = await read(`${rules()}/${row.id}/history?limit=2`, f.lead);
      expect(history.status).toBe(200);
      expect(
        history.body.data.items.map((entry: { action: string }) => entry.action),
      ).toEqual(["CREATE", "SUBMIT"]);
      const next = await read(
        `${rules()}/${row.id}/history?limit=2&cursor=${history.body.data.nextCursor}`,
        f.lead,
      );
      expect(
        next.body.data.items.map((entry: { action: string }) => entry.action),
      ).toEqual(["APPROVE"]);
      const historyId = history.body.data.items[0].id;
      await expect(
        prisma.productCompatibilityHistory.update({
          where: { id: historyId },
          data: { action: "forged" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.productCompatibilityHistory.delete({ where: { id: historyId } }),
      ).rejects.toThrow();
      expect(
        (
          await write(
            "put",
            `${rules()}/${row.id}`,
            { ...input(), expectedVersion: 1 },
            f.operations,
          )
        ).status,
      ).toBe(409);
      const edited = await write(
        "put",
        `${rules()}/${row.id}`,
        { ...input(), expectedVersion: 2, market: "Europe" },
        f.operations,
      );
      expect(edited.status).toBe(200);
      expect(edited.body.data).toMatchObject({
        reviewStatus: "DRAFT",
        version: 3,
        reviewedAt: null,
        reviewedByUserId: null,
      });
      expect(
        (await read(`/public/fitment/products/${productId}`).query(selection())).body.data
          .status,
      ).toBe("UNKNOWN");
    });
    it("keeps incomplete critical evidence unpublishable and exclusions stronger than broad inclusions", async () => {
      const incomplete = await create({
        ...input(),
        market: "Synthetic incomplete",
        brakeSystem: null,
      });
      expect((await transition(incomplete.id, 0, "SUBMIT")).status).toBe(422);
      const include = await create({
        ...input(),
        engineCode: null,
        market: null,
        requiredQualifiers: ["position", "brakeSystem"],
      });
      expect((await transition(include.id, 0, "SUBMIT")).status).toBe(200);
      expect((await transition(include.id, 1, "APPROVE", f.lead)).status).toBe(200);
      const exclude = await create({ ...input(), effect: "EXCLUDE" });
      expect((await transition(exclude.id, 0, "SUBMIT")).status).toBe(200);
      expect((await transition(exclude.id, 1, "APPROVE", f.lead)).status).toBe(200);
      expect(
        (await read(`/public/fitment/products/${productId}`).query(selection())).body.data
          .status,
      ).toBe("NOT_COMPATIBLE");
      const eligible = await prisma.product.count({
        where: { id: productId, ...fitmentProductWhere(selection(), true) },
      });
      expect(eligible).toBe(0);
      const changedMarket = { ...selection(), market: "Europe" };
      expect(
        (await read(`/public/fitment/products/${productId}`).query(changedMarket)).body
          .data.status,
      ).toBe("VERIFIED_FIT");
      expect(
        await prisma.product.count({
          where: { id: productId, ...fitmentProductWhere(changedMarket, true) },
        }),
      ).toBe(1);
      const unknownMarket = {
        vehicleModelId: modelId,
        year: 2018,
        position: "front",
        brakeSystem: "Akebono",
      };
      expect(
        (await read(`/public/fitment/products/${productId}`).query(unknownMarket)).body
          .data.status,
      ).toBe("NEEDS_VERIFICATION");
      expect(
        await prisma.product.count({
          where: { id: productId, ...fitmentProductWhere(unknownMarket, true) },
        }),
      ).toBe(0);
      expect(
        (await transition(exclude.id, 2, "RETIRE", f.lead)).body.data.reviewStatus,
      ).toBe("RETIRED");
      expect(
        (await read(`/public/fitment/products/${productId}`).query(selection())).body.data
          .status,
      ).toBe("VERIFIED_FIT");
    });

    it("keeps legacy compatibility edits unreviewed and retires them without losing history", async () => {
      const admin = await f.account(null, "ADMIN");
      const base = `/admin/catalog/products/${productId}/compatibilities`;
      const created = await write(
        "post",
        base,
        {
          make: "Legacy unverified make",
          model: "Legacy model",
          yearFrom: 2010,
          yearTo: 2012,
        },
        admin,
      );
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const id = created.body.data.id;
      const changed = await request(app)
        .patch(`/api/v1${base}/${id}`)
        .set(admin.headers)
        .send({ notes: "Unverified legacy correction" });
      expect(changed.status, JSON.stringify(changed.body)).toBe(200);
      const retired = await request(app)
        .delete(`/api/v1${base}/${id}`)
        .set(admin.headers)
        .send({});
      expect(retired.status, JSON.stringify(retired.body)).toBe(200);
      expect(
        await prisma.productCompatibility.findUnique({ where: { id } }),
      ).toMatchObject({
        reviewStatus: "RETIRED",
        version: 2,
      });
      expect(
        await prisma.productCompatibilityHistory.count({
          where: { compatibilityId: id },
        }),
      ).toBe(3);
      const approved = await prisma.productCompatibility.findFirstOrThrow({
        where: { productId, reviewStatus: "APPROVED" },
      });
      expect(
        (
          await request(app)
            .patch(`/api/v1${base}/${approved.id}`)
            .set(admin.headers)
            .send({ notes: "Attempt to bypass technical review" })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .delete(`/api/v1${base}/${approved.id}`)
            .set(admin.headers)
            .send({})
        ).status,
      ).toBe(409);
    });
  },
);
