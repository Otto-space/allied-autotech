import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "recorded product family authoring",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let headers: Record<string, string>;
    let category: { id: string };
    beforeAll(async () => {
      f = await workforceFixture();
      headers = (await f.session(f.owner.id, "SUPER_ADMIN")).headers;
      const response = await request(app)
        .post("/api/v1/admin/catalog/categories")
        .set(headers)
        .send({
          name: "Synthetic recorded oils",
          slug: `oils-${randomUUID()}`,
          family: "ENGINE_OIL",
        })
        .expect(201);
      category = response.body.data;
    });
    afterAll(() => prisma.$disconnect());
    const product = () => ({
      categoryId: category.id,
      name: "Synthetic oil",
      slug: `oil-${randomUUID()}`,
      sku: `OIL-${randomUUID()}`,
      priceKobo: "2500000",
      family: "ENGINE_OIL",
    });
    const create = (data: unknown) =>
      request(app).post("/api/v1/admin/catalog/products").set(headers).send(data);

    it("persists recorded grade/volume through authoring and exposes them publicly without an approval claim", async () => {
      const response = await create({
        ...product(),
        oilViscosityGrade: "5W30",
        packVolumeMl: 5000,
      }).expect(201);
      const id = response.body.data.id;
      expect(await prisma.product.findUniqueOrThrow({ where: { id } })).toMatchObject({
        family: "ENGINE_OIL",
        oilViscosityGrade: "5W-30",
        packVolumeMl: 5000,
        condition: null,
        classification: null,
      });
      const publicRow = (
        await request(app).get(`/api/v1/public/catalog/products/${id}`).expect(200)
      ).body.data;
      expect(publicRow).toMatchObject({
        family: "ENGINE_OIL",
        oilViscosityGrade: "5W-30",
        packVolumeMl: 5000,
      });
      expect(publicRow).not.toHaveProperty("manufacturerApproval");
      const updated = await request(app)
        .patch(`/api/v1/admin/catalog/products/${id}`)
        .set(headers)
        .send({
          oilViscosityGrade: "5W-40",
          expectedUpdatedAt: response.body.data.updatedAt,
        })
        .expect(200);
      expect(updated.body.data.oilViscosityGrade).toBe("5W-40");
    });
    it("rejects family/category mismatches and partial edits that would retain incompatible attributes", async () => {
      await create({ ...product(), family: "REPLACEMENT_PART" }).expect(409);
      const row = (await create({ ...product(), oilViscosityGrade: "5W-30" }).expect(201))
        .body.data;
      await request(app)
        .patch(`/api/v1/admin/catalog/products/${row.id}`)
        .set(headers)
        .send({ family: "REPLACEMENT_PART" })
        .expect(409);
      await create({ ...product(), condition: "USED" }).expect(422);
      await request(app)
        .patch(`/api/v1/admin/catalog/categories/${category.id}`)
        .set(headers)
        .send({ family: "REPLACEMENT_PART" })
        .expect(409);
    });
    it("keeps shared products unchanged and inherits a typed parent category", async () => {
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: f.enquiry.productId! } }),
      ).toMatchObject({ family: null, oilViscosityGrade: null, packVolumeMl: null });
      const child = (
        await request(app)
          .post("/api/v1/admin/catalog/categories")
          .set(headers)
          .send({
            name: "Synthetic child",
            slug: `oil-child-${randomUUID()}`,
            parentId: category.id,
          })
          .expect(201)
      ).body.data;
      await create({
        ...product(),
        categoryId: child.id,
        family: "REPLACEMENT_PART",
      }).expect(409);
      await request(app)
        .post("/api/v1/admin/catalog/categories")
        .set(headers)
        .send({
          name: "Invalid child",
          slug: `bad-child-${randomUUID()}`,
          parentId: category.id,
          family: "REPLACEMENT_PART",
        })
        .expect(409);
    });
  },
);
