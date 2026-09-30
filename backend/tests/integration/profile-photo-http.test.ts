import { randomUUID, createHash } from "node:crypto";
import { Router } from "express";
import request from "supertest";
import sharp from "sharp";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { issueCsrfToken } from "../../src/common/security/csrf-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { createProfilePhotoRouter } from "../../src/modules/customers/profile-photo.routes.js";
import { ProfilePhotoService } from "../../src/modules/customers/profile-photo.service.js";
import { GarageMediaService } from "../../src/modules/customers/garage-media.service.js";
import { createGarageMediaRouter } from "../../src/modules/customers/garage-media.routes.js";
import { ServiceMediaService } from "../../src/modules/service-operations/service-media.service.js";
import {
  createServiceMediaRouter,
  createPublicServiceMediaRouter,
} from "../../src/modules/service-operations/service-media.routes.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";
import { testOwner } from "../helpers/owner.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "profile photo HTTP boundary",
  () => {
    const storage = new MemoryMediaStorage();
    const router = Router().use(
      "/customers",
      createProfilePhotoRouter(new ProfilePhotoService(prisma, storage)),
    );
    const app = createApp({ apiRouter: router });
    router.use(
      "/customers",
      createGarageMediaRouter(new GarageMediaService(prisma, storage)),
    );
    const sessions = new Map<string, { cookie: string; csrf: string }>();
    router.use(
      "/admin/services",
      createServiceMediaRouter(new ServiceMediaService(prisma, storage)),
    );
    router.use(
      "/public",
      createPublicServiceMediaRouter(new ServiceMediaService(prisma, storage)),
    );
    beforeAll(async () => {
      for (const name of [
        "CUSTOMER",
        "OTHER",
        "STAFF",
        "ADMIN",
        "SUPER_ADMIN",
      ] as const) {
        const role = name === "OTHER" ? "CUSTOMER" : name;
        const user =
          role === "SUPER_ADMIN"
            ? await testOwner("unusable-test-password")
            : await prisma.user.create({
                data: {
                  email: `${randomUUID()}@example.test`,
                  passwordHash: "unusable",
                  role,
                  ...(role === "CUSTOMER"
                    ? {
                        profile: {
                          create: {
                            firstName: "HTTP",
                            lastName: "Owner",
                            phone: "+2348000000000",
                          },
                        },
                      }
                    : {}),
                },
              });
        const token = generateOpaqueToken();
        const csrf = issueCsrfToken();
        const expiresAt = new Date(Date.now() + 3600000);
        await prisma.session.create({
          data: {
            userId: user.id,
            tokenHash: hashToken("session", token),
            csrfTokenHash: csrf.hash,
            createdAt: new Date(Date.now() - 1000),
            expiresAt,
            idleExpiresAt: expiresAt,
            mfaRequired: role !== "CUSTOMER",
            mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
          },
        });
        sessions.set(name, { cookie: `${sessionCookieName}=${token}`, csrf: csrf.raw });
      }
    });
    afterAll(async () => prisma.$disconnect());
    const mutation = (
      method: "post" | "put" | "delete",
      suffix: string,
      role = "CUSTOMER",
    ) => {
      const session = sessions.get(role)!;
      return request(app)
        [method](`/api/v1/customers/profile/photo${suffix}`)
        .set("Cookie", session.cookie)
        .set("Origin", env.FRONTEND_URL[0]!)
        .set("X-CSRF-Token", session.csrf);
    };
    it("requires authentication, a customer role, CSRF and trusted origin", async () => {
      expect(
        (await request(app).post("/api/v1/customers/profile/photo/upload").send({}))
          .status,
      ).toBe(401);
      for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
        for (const method of ["post", "put", "delete"] as const) {
          expect(
            (await mutation(method, method === "post" ? "/upload" : "", role).send({}))
              .status,
          ).toBe(403);
        }
        expect(
          (
            await request(app)
              .get(`/api/v1/customers/media/images/${randomUUID()}`)
              .set("Cookie", sessions.get(role)!.cookie)
          ).status,
        ).toBe(403);
      }
      const missing = await request(app)
        .post("/api/v1/customers/profile/photo/upload")
        .set("Cookie", sessions.get("CUSTOMER")!.cookie)
        .send({});
      expect(missing.body.error.code).toBe("CSRF_INVALID");
      expect(
        (
          await mutation("post", "/upload")
            .set("Origin", "https://untrusted.example.test")
            .send({})
        ).status,
      ).toBe(403);
    });
    it("enforces garage role and CSRF boundaries on every mutation", async () => {
      const base = `/api/v1/customers/vehicles/${randomUUID()}`;
      for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"]) {
        for (const [method, suffix] of [
          ["post", "/assets/upload"],
          ["post", "/images"],
          ["patch", `/images/${randomUUID()}`],
          ["delete", `/images/${randomUUID()}`],
        ] as const) {
          const session = sessions.get(role)!;
          expect(
            (
              await request(app)
                [method](`${base}${suffix}`)
                .set("Cookie", session.cookie)
                .set("Origin", env.FRONTEND_URL[0]!)
                .set("X-CSRF-Token", session.csrf)
                .send({})
            ).status,
          ).toBe(403);
        }
      }
      expect((await request(app).post(`${base}/assets/upload`).send({})).status).toBe(
        401,
      );
      expect(
        (
          await request(app)
            .post(`${base}/assets/upload`)
            .set("Cookie", sessions.get("CUSTOMER")!.cookie)
            .send({})
        ).body.error.code,
      ).toBe("CSRF_INVALID");
    });
    it("enforces service image role and CSRF boundaries on every mutation", async () => {
      const base = `/api/v1/admin/services/${randomUUID()}`;
      for (const [method, suffix] of [
        ["post", "/assets/upload"],
        ["put", "/image"],
        ["patch", `/images/${randomUUID()}`],
        ["delete", `/images/${randomUUID()}`],
      ] as const) {
        expect((await request(app)[method](`${base}${suffix}`).send({})).status).toBe(
          401,
        );
        for (const role of ["CUSTOMER", "STAFF"]) {
          const session = sessions.get(role)!;
          expect(
            (
              await request(app)
                [method](`${base}${suffix}`)
                .set("Cookie", session.cookie)
                .set("Origin", env.FRONTEND_URL[0]!)
                .set("X-CSRF-Token", session.csrf)
                .send({})
            ).status,
          ).toBe(403);
        }
        const admin = sessions.get("ADMIN")!;
        expect(
          (
            await request(app)
              [method](`${base}${suffix}`)
              .set("Cookie", admin.cookie)
              .send({})
          ).body.error.code,
        ).toBe("CSRF_INVALID");
        expect(
          (
            await request(app)
              [method](`${base}${suffix}`)
              .set("Cookie", admin.cookie)
              .set("Origin", env.FRONTEND_URL[0]!)
              .set("X-CSRF-Token", admin.csrf)
              .send({})
          ).status,
        ).toBe(422);
      }
      expect(
        (await request(app).get(`/api/v1/public/media/images/${randomUUID()}`)).status,
      ).toBe(404);
    });
    it("validates strict input, confirms real bytes and serves them only to the owner", async () => {
      expect(
        (
          await mutation("post", "/upload").send({
            url: "https://untrusted.example.test/image.png",
          })
        ).status,
      ).toBe(422);
      const bytes = await sharp({
        create: { width: 128, height: 128, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer();
      const prepared = await mutation("post", "/upload").send({
        mimeType: "image/png",
        sizeBytes: bytes.length,
        checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      });
      expect(prepared.status).toBe(200);
      storage.objects.set(storage.prepared.at(-1)!.key, bytes);
      const body = { assetToken: prepared.body.data.assetToken, expectedVersion: 0 };
      const confirmed = await mutation("put", "").send(body);
      expect(confirmed.status).toBe(200);
      expect((await mutation("put", "").send(body)).body.data).toEqual(
        confirmed.body.data,
      );
      const url = confirmed.body.data.images[0].url as string;
      const image = await request(app)
        .get(url)
        .set("Cookie", sessions.get("CUSTOMER")!.cookie);
      expect(image.status).toBe(200);
      expect(image.headers["content-type"]).toBe("image/webp");
      expect(image.headers["cache-control"]).toBe("private, no-store");
      expect(image.headers["x-content-type-options"]).toBe("nosniff");
      expect((await request(app).get(url)).status).toBe(401);
      expect(
        (await request(app).get(url.replace("/customers/", "/public/"))).status,
      ).toBe(404);
      expect(
        (await request(app).get(url).set("Cookie", sessions.get("OTHER")!.cookie)).status,
      ).toBe(404);
      expect((await mutation("delete", "").send({ expectedVersion: 1 })).status).toBe(
        200,
      );
      expect(
        (await request(app).get(url).set("Cookie", sessions.get("CUSTOMER")!.cookie))
          .status,
      ).toBe(404);
    });
  },
);
