import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated saved customer vehicle configurations",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    const base = "/api/v1/customers/vehicles";
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let makeId: string, makeName: string, modelId: string;
    const get = (path = base, identity = f.customer) =>
      request(app).get(path).set(identity.headers);
    const create = (body: unknown, identity = f.customer) =>
      request(app).post(base).set(identity.headers).send(body);
    const patch = (id: string, body: unknown, identity = f.customer) =>
      request(app).patch(`${base}/${id}`).set(identity.headers).send(body);
    const input = () => ({
      make: makeName,
      model: "Corolla",
      year: 2018,
      vehicleModelId: modelId,
      nickname: "Synthetic daily driver",
      engineCode: "２ＺＲ－ＦＥ",
      market: "Japan",
    });
    beforeAll(async () => {
      f = await workforceFixture();
      const nonce = randomUUID();
      makeName = `Toyota synthetic ${nonce.slice(0, 8)}`;
      const make = await prisma.vehicleMake.create({
        data: { name: makeName, key: `saved-make-${nonce}` },
      });
      makeId = make.id;
      const model = await prisma.vehicleModel.create({
        data: {
          makeId,
          name: "Corolla",
          key: "corolla",
          yearFrom: 2013,
          yearTo: 2019,
          sourceReference: "Synthetic isolated model-year fixture",
        },
      });
      modelId = model.id;
    }, 30000);
    afterAll(() => prisma.$disconnect());

    it("saves canonical configurations, nickname and default without touching vehicles for sale", async () => {
      const before = await prisma.vehicle.count();
      const saved = await create({ ...input(), isDefault: true });
      expect(saved.status, JSON.stringify(saved.body)).toBe(201);
      expect(saved.body.data).toMatchObject({
        nickname: "Synthetic daily driver",
        isDefault: true,
        vehicleModelId: modelId,
        engineCode: "2ZR-FE",
        vehicleModel: { id: modelId, makeId, make: { id: makeId, name: makeName } },
      });
      expect(saved.body.data).not.toHaveProperty("defaultSlot");
      expect(saved.body.data.vehicleModel).not.toHaveProperty("sourceReference");
      expect(await prisma.vehicle.count()).toBe(before);
      const read = await get(`${base}/${saved.body.data.id}`);
      expect(read.headers["cache-control"]).toBe("private, no-store");
      expect(read.body.data).toMatchObject({
        id: saved.body.data.id,
        isDefault: true,
        engineCode: "2ZR-FE",
      });
      expect(read.body.data).not.toHaveProperty("defaultSlot");
    });
    it("rejects mismatched catalogue identities and keeps records isolated from other accounts and roles", async () => {
      for (const changes of [
        { model: "Different model" },
        { make: "Different make" },
        { year: 2020 },
        { vehicleModelId: randomUUID() },
        { customerId: f.stranger.user.profile!.id },
        { defaultSlot: 1 },
      ])
        expect((await create({ ...input(), ...changes })).status).toBe(422);
      const saved = await create(input());
      expect(saved.status).toBe(201);
      const id = saved.body.data.id;
      expect((await get(`${base}/${id}`, f.stranger)).status).toBe(404);
      expect(
        (await patch(id, { nickname: "Foreign change", isDefault: true }, f.stranger))
          .status,
      ).toBe(404);
      expect(
        (await request(app).delete(`${base}/${id}`).set(f.stranger.headers).send({}))
          .status,
      ).toBe(404);
      expect((await get(`${base}?cursor=${id}`, f.stranger)).status).toBe(404);
      expect((await create(input(), f.operations)).status).toBe(403);
      expect((await get(`${base}/${id}`)).body.data.nickname).toBe(input().nickname);
    });
    it("serializes default switches, finds the default beyond page one and never accepts a stale edit", async () => {
      const first = await create(input()),
        second = await create({ ...input(), nickname: "Synthetic second car" });
      const results = await Promise.all(
        [first, second].map((row) =>
          patch(row.body.data.id, {
            isDefault: true,
            expectedUpdatedAt: row.body.data.updatedAt,
          }),
        ),
      );
      expect(results.map((row) => row.status)).toEqual([200, 200]);
      const defaults = await prisma.customerVehicle.findMany({
        where: { customerId: f.customer.user.profile!.id, defaultSlot: 1 },
      });
      expect(defaults).toHaveLength(1);
      await prisma.customerVehicle.create({
        data: {
          id: `00000000-0000-4000-8000-${randomUUID().replaceAll("-", "").slice(0, 12)}`,
          customerId: f.customer.user.profile!.id,
          make: "Synthetic",
          model: "Unlinked car",
          year: 2018,
        },
      });
      expect((await get(`${base}?limit=1`)).body.data.vehicles[0].id).not.toBe(
        defaults[0]!.id,
      );
      expect(
        (await get(`${base}?defaultOnly=true&limit=1`)).body.data.vehicles,
      ).toMatchObject([{ id: defaults[0]!.id, isDefault: true }]);
      expect(
        (await get(`${base}?defaultOnly=true`, f.stranger)).body.data.vehicles,
      ).toEqual([]);
      const stale = defaults[0]!.id === first.body.data.id ? second : first;
      expect(
        (
          await patch(stale.body.data.id, {
            nickname: "Stale overwrite",
            isDefault: true,
            expectedUpdatedAt: stale.body.data.updatedAt,
          })
        ).status,
      ).toBe(409);
      expect((await get(`${base}?defaultOnly=true`)).body.data.vehicles).toMatchObject([
        { id: defaults[0]!.id, isDefault: true },
      ]);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "CUSTOMER_VEHICLE", entityId: first.body.data.id },
        }),
      ).toBeGreaterThan(1);
    });
    it("clears obsolete specifications when the model changes and preserves an explicit manual unlink", async () => {
      const saved = await create(input());
      expect(saved.status).toBe(201);
      const model = await prisma.vehicleModel.create({
        data: {
          makeId,
          name: "Different test model",
          key: `different-${randomUUID()}`,
          yearFrom: 2016,
          yearTo: 2020,
          sourceReference: "Synthetic alternate model fixture",
        },
      });
      const changed = await patch(saved.body.data.id, {
        vehicleModelId: model.id,
        model: model.name,
        expectedUpdatedAt: saved.body.data.updatedAt,
      });
      expect(changed.status, JSON.stringify(changed.body)).toBe(200);
      expect(changed.body.data).toMatchObject({
        vehicleModelId: model.id,
        model: model.name,
        engineCode: null,
        market: null,
      });
      expect(
        (
          await patch(saved.body.data.id, {
            model: "Unmatched manual name",
            expectedUpdatedAt: changed.body.data.updatedAt,
          })
        ).status,
      ).toBe(422);
      const unlinked = await patch(saved.body.data.id, {
        vehicleModelId: null,
        make: "Manual unknown make",
        model: "Manual unknown model",
        expectedUpdatedAt: changed.body.data.updatedAt,
      });
      expect(unlinked.status).toBe(200);
      expect(unlinked.body.data).toMatchObject({
        vehicleModelId: null,
        vehicleModel: null,
        engineCode: null,
        make: "Manual unknown make",
      });
    });
    it("removes only the owner's selected default while retaining the associated booking", async () => {
      const saved = await create({ ...input(), isDefault: true });
      expect(saved.status).toBe(201);
      await prisma.booking.update({
        where: { id: f.job1.id },
        data: { vehicleId: saved.body.data.id },
      });
      const count = await prisma.customerVehicle.count({
        where: { customerId: f.customer.user.profile!.id },
      });
      const removed = await request(app)
        .delete(`${base}/${saved.body.data.id}`)
        .set(f.customer.headers)
        .send({});
      expect(removed.status, JSON.stringify(removed.body)).toBe(200);
      expect(
        await prisma.customerVehicle.count({
          where: { customerId: f.customer.user.profile!.id },
        }),
      ).toBe(count - 1);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: f.job1.id } })).vehicleId,
      ).toBeNull();
      expect((await get(`${base}?defaultOnly=true`)).body.data.vehicles).toEqual([]);
      expect((await get(`${base}/${saved.body.data.id}`)).status).toBe(404);
    });
    it("clears implicit details on a year change but permits ordinary edits to a retired catalogue link", async () => {
      const saved = await create(input());
      expect(saved.status).toBe(201);
      const changedYear = await patch(saved.body.data.id, {
        year: 2019,
        expectedUpdatedAt: saved.body.data.updatedAt,
      });
      expect(changedYear.status).toBe(200);
      expect(changedYear.body.data).toMatchObject({
        year: 2019,
        engineCode: null,
        market: null,
      });
      await prisma.vehicleModel.update({
        where: { id: modelId },
        data: { isActive: false },
      });
      const renamed = await patch(saved.body.data.id, {
        make: makeName,
        model: "Corolla",
        year: 2019,
        vehicleModelId: modelId,
        nickname: "Synthetic retained car",
        expectedUpdatedAt: changedYear.body.data.updatedAt,
      });
      expect(renamed.status, JSON.stringify(renamed.body)).toBe(200);
      expect(renamed.body.data).toMatchObject({
        nickname: "Synthetic retained car",
        vehicleModelId: modelId,
        vehicleModel: { isActive: false },
      });
    });
  },
);
